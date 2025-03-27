import dotenv from "dotenv";
dotenv.config();

import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import ws from "@fastify/websocket";
import { WebSocket } from "ws";
import { SocketStream } from "@fastify/websocket";
import type { Browser, Page, ConsoleMessage } from "playwright";
import { chromium } from "playwright";
import Browserbase from "@browserbasehq/sdk";
import { Agent } from "./agent";
import { Computer } from "./computer";
import { toolsList } from "./tools";

const server = fastify({
  logger: true,
  maxParamLength: 1000,
});

server.register(cors, {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
});

server.register(ws, {
  options: {
    maxPayload: 1048576, // 1MB
    clientTracking: true,
  },
});

server.get("/health", async () => {
  return { status: "ok" };
});

interface ChatMessage {
  message: string;
  type?: "text" | "computer-use";
}

// Interface for conversation session
interface ConversationSession {
  browser: Browser;
  page: Page;
  agent: Agent;
  computer: Computer;
  connectedClients: Set<WebSocket>;
  lastActivity: number;
  conversationHistory: any[];
  browserbaseSessionId?: string; // BrowserBase session ID
}

// Map to store conversation sessions by conversationId
const conversationSessions = new Map<string, ConversationSession>();

// Timeout for inactive sessions (30 minutes)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// Interface for browser update messages
interface BrowserUpdate {
  type: "page" | "console" | "network" | "screenshot";
  data: any;
}

// Import the AgentMessageType from agent.ts
import { AgentMessageType } from "./agent";

// Interface for chat messages sent via WebSocket
interface ChatUpdate {
  type: "chat";
  data: {
    content: string;
    sender: "ai";
    messageType?: AgentMessageType; // Optional for backward compatibility
  };
}

// Initialize a new browser session for a conversation
async function initBrowserForConversation(conversationId: string): Promise<ConversationSession> {
  // Check if session already exists
  if (conversationSessions.has(conversationId)) {
    console.log(`Found existing session for conversation: ${conversationId}`);
    const session = conversationSessions.get(conversationId)!;
    session.lastActivity = Date.now();
    return session;
  }
  
  console.log(`Creating new browser session for conversation: ${conversationId}`);

  // Initialize BrowserBase
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  
  if (!apiKey || !projectId) {
    throw new Error('BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID must be set in .env file');
  }
  
  const bb = new Browserbase({
    apiKey
  });

  // Create a new session
  // const bbSession = await bb.sessions.create({
  //   projectId
  // });

  // console.log(`BrowserBase session created: ${bbSession.id}`);

  // Connect to the session
  // const browser = await chromium.connectOverCDP(bbSession.connectUrl);
  const browser = await chromium.launch({
    headless: false,
  });

  // Getting the default context to ensure the sessions are recorded
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  // Navigate to bing.com
  await page.goto("https://www.bing.com");

  // Create Computer and Agent instances
  const computer = new Computer([1280, 720], "browser", page);
  const agent = new Agent(
    computer,
    "computer-use-preview",
    toolsList,
    (message: string) => {
      console.log("Safety check acknowledged:", message);
      return true; // Auto-acknowledge all safety checks
    }
  );

  // Create new session
  const session: ConversationSession = {
    browser,
    page,
    agent,
    computer,
    connectedClients: new Set<WebSocket>(),
    lastActivity: Date.now(),
    conversationHistory: [],
    browserbaseSessionId: undefined, // Store the BrowserBase session ID
  };

  // Set up page event listeners
  page.on("console", async (msg: ConsoleMessage) => {
    broadcastToConversation(conversationId, {
      type: "console",
      data: { type: msg.type(), text: msg.text() },
    });
  });

  page.on("load", async () => {
    const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
    broadcastToConversation(conversationId, {
      type: "screenshot",
      data: { image: screenshot.toString("base64") },
    });
  });

  // Store the session
  conversationSessions.set(conversationId, session);
  return session;
}

// Clean up inactive sessions
function cleanupInactiveSessions() {
  const now = Date.now();
  for (const [conversationId, session] of conversationSessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      console.log(`Cleaning up inactive session: ${conversationId}`);
      // Close browser
      session.browser.close().catch(err => {
        console.error(`Error closing browser for session ${conversationId}:`, err);
      });
      // Remove from map
      conversationSessions.delete(conversationId);
    }
  }
}

// Function to interrupt an agent for a specific conversation
function interruptAgent(conversationId: string): boolean {
  const session = conversationSessions.get(conversationId);
  if (!session) {
    console.log(`No session found for conversation: ${conversationId}`);
    return false;
  }
  
  try {
    session.agent.interrupt();
    console.log(`Agent interrupted for conversation: ${conversationId}`);
    return true;
  } catch (error) {
    console.error(`Error interrupting agent for conversation ${conversationId}:`, error);
    return false;
  }
}

// Function to broadcast to clients in a specific conversation
function broadcastToConversation(conversationId: string, update: BrowserUpdate) {
  const session = conversationSessions.get(conversationId);
  if (!session) return;

  const message = JSON.stringify(update);
  for (const client of session.connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Function to broadcast chat messages to clients in a specific conversation
function broadcastChatMessage(conversationId: string, content: string, messageType?: AgentMessageType) {
  const session = conversationSessions.get(conversationId);
  if (!session) return;

  const chatUpdate: ChatUpdate = {
    type: "chat",
    data: {
      content,
      sender: "ai",
      messageType, // Include the message type if provided
    },
  };

  const message = JSON.stringify(chatUpdate);
  for (const client of session.connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Add endpoint to get or create a conversation ID
server.get("/conversation", async (request, reply) => {
  // Generate a new conversation ID
  const conversationId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString();
  
  // Return the conversation ID
  return reply.code(200).send({
    success: true,
    conversationId,
  });
});

// Add endpoint to get the BrowserBase live view link for a conversation
server.get("/conversation/:conversationId/liveview", async (request, reply) => {
  try {
    const { conversationId } = request.params as { conversationId: string };
    
    // Check if the conversation session exists
    if (!conversationSessions.has(conversationId)) {
      return reply.code(404).send({
        success: false,
        error: "Conversation not found",
      });
    }
    
    const session = conversationSessions.get(conversationId)!;
    
    // Check if the BrowserBase session ID exists
    if (!session.browserbaseSessionId) {
      return reply.code(400).send({
        success: false,
        error: "BrowserBase session ID not found for this conversation",
      });
    }
    
    // Initialize BrowserBase
    const apiKey = process.env.BROWSERBASE_API_KEY;
    
    if (!apiKey) {
      return reply.code(500).send({
        success: false,
        error: "BROWSERBASE_API_KEY not set in environment variables",
      });
    }
    
    const bb = new Browserbase({
      apiKey
    });
    
    // Get the live view links for the session
    const liveViewLinks = await bb.sessions.debug(session.browserbaseSessionId);
    const liveViewLink = liveViewLinks.debuggerFullscreenUrl;
    
    console.log(`🔍 Live View Link for conversation ${conversationId}: ${liveViewLink}`);
    
    // Return the live view link
    return reply.code(200).send({
      success: true,
      liveViewLink,
    });
  } catch (error) {
    console.error("Error getting live view link:", error);
    return reply.code(500).send({
      success: false,
      error: "Failed to get live view link",
    });
  }
});

server.register(async function (server: FastifyInstance) {
  server.get(
    "/browser",
    { websocket: true },
    async (connection: SocketStream, req) => {
      console.log("Client connected to browser WebSocket");
      
      // Get conversation ID from query parameters
      const url = new URL(req.url, "http://localhost");
      const conversationId = url.searchParams.get("conversationId");
      
      if (!conversationId) {
        connection.socket.send(
          JSON.stringify({
            type: "error",
            data: { message: "Missing conversation ID" },
          })
        );
        connection.socket.close();
        return;
      }
      
      console.log({conversationId})
      // Initialize or get browser session for this conversation
      const session = await initBrowserForConversation(conversationId);
      session.connectedClients.add(connection.socket);
      
      // Send initial screenshot using CDP for better performance
      try {
        // Create a CDP session for faster screenshots
        const client = await session.browser.contexts()[0].newCDPSession(session.page);
        
        // Capture the screenshot using CDP
        const { data } = await client.send("Page.captureScreenshot", {
          format: "jpeg",
          quality: 80,
        });
        
        connection.socket.send(
          JSON.stringify({
            type: "screenshot",
            data: { image: data },
          })
        );
      } catch (error) {
        console.error("Error taking initial CDP screenshot:", error);
        // Fallback to regular screenshot if CDP fails
        const screenshot = await session.page.screenshot({ type: "jpeg", quality: 80 });
        connection.socket.send(
          JSON.stringify({
            type: "screenshot",
            data: { image: screenshot.toString("base64") },
          })
        );
      }
      
      // Send current page info
      const pageUrl = session.page.url();
      const title = await session.page.title();
      connection.socket.send(
        JSON.stringify({
          type: "page",
          data: { url: pageUrl, title },
        })
      );

      // Create a CDP session for faster screenshots
      let cdpClient: any = null;
      try {
        cdpClient = await session.browser.contexts()[0].newCDPSession(session.page);
      } catch (error) {
        console.error("Error creating CDP session:", error);
      }
      
      // Set up periodic screenshots using CDP for better performance
      const screenshotInterval = setInterval(async () => {
        if (session.page && connection.socket.readyState === WebSocket.OPEN) {
          try {
            if (cdpClient) {
              // Use CDP for faster screenshots
              const { data } = await cdpClient.send("Page.captureScreenshot", {
                format: "jpeg",
                quality: 80,
              });
              
              connection.socket.send(
                JSON.stringify({
                  type: "screenshot",
                  data: { image: data },
                })
              );
            } else {
              // Fallback to regular screenshot if CDP is not available
              const screenshot = await session.page.screenshot({
                type: "jpeg",
                quality: 80,
              });
              connection.socket.send(
                JSON.stringify({
                  type: "screenshot",
                  data: { image: screenshot.toString("base64") },
                })
              );
            }
          } catch (error) {
            console.error("Error taking periodic screenshot:", error);
          }
        }
      }, 1000); // Send screenshot every second

      connection.socket.on("message", async (message: Buffer) => {
        try {
          const update = JSON.parse(message.toString()) as BrowserUpdate;
          if (update.type === "page" && update.data.url) {
            await session.page.goto(update.data.url);
          }
        } catch (error) {
          console.error("Failed to process WebSocket message:", error);
        }
      });

      connection.socket.on("close", async () => {
        console.log("Client disconnected from browser WebSocket");
        
        // Clean up CDP client if it exists
        if (cdpClient) {
          try {
            await cdpClient.detach();
          } catch (error) {
            console.error("Error detaching CDP client:", error);
          }
        }
        session.connectedClients.delete(connection.socket);
        clearInterval(screenshotInterval);
      });
    }
  );
});

// Cleanup on server shutdown
process.on("SIGTERM", async () => {
  // Close all browser instances
  for (const [conversationId, session] of conversationSessions.entries()) {
    console.log(`Closing browser for session ${conversationId}`);
    await session.browser.close().catch(err => {
      console.error(`Error closing browser for session ${conversationId}:`, err);
    });
  }
  process.exit(0);
});

server.post<{ Body: ChatMessage }>("/chat", async (request, reply) => {
  try {
    const { message } = request.body;
    
    // Get conversation ID from headers
    const conversationId = request.headers["x-conversation-id"] as string;
    
    if (!conversationId) {
      return reply.code(400).send({
        success: false,
        error: "Missing conversation ID",
      });
    }
    
    // Get or initialize the session for this conversation
    const session = await initBrowserForConversation(conversationId);
    session.lastActivity = Date.now();
    
    // Create a conversation history with the user message
    const conversationHistory = [
      {
        role: "user",
        content: [{ type: "input_text", text: message }],
      },
    ];

    console.log({conversationId})
    // Run the agent
    session.agent.runFullTurn(conversationHistory, {
      printSteps: true,

      messageCallback: (message, type) => {
        broadcastChatMessage(conversationId, message, type);
      },
    });

    return reply.code(200).send({
      success: true,
      message: "computer use triggered",
    });
  } catch (error) {
    console.error("Error processing chat message:", error);
    return reply.code(500).send({
      success: false,
      error: "Failed to process message",
    });
  }
});

// API endpoint to interrupt an agent for a specific conversation
server.post<{ Params: { conversationId: string } }>("/interrupt/:conversationId", async (request, reply) => {
  try {
    const { conversationId } = request.params;
    
    if (!conversationId) {
      return reply.code(400).send({
        success: false,
        error: "Missing conversation ID",
      });
    }
    
    const success = interruptAgent(conversationId);
    
    if (success) {
      return reply.code(200).send({
        success: true,
        message: `Agent interrupted for conversation: ${conversationId}`,
      });
    } else {
      return reply.code(404).send({
        success: false,
        error: `No active agent found for conversation: ${conversationId}`,
      });
    }
  } catch (error) {
    console.error("Error interrupting agent:", error);
    return reply.code(500).send({
      success: false,
      error: "Failed to interrupt agent",
    });
  }
});

const start = async () => {
  try {
    // Set up periodic cleanup of inactive sessions
    setInterval(cleanupInactiveSessions, 5 * 60 * 1000); // Check every 5 minutes
    
    await server.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server running at http://localhost:3000");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
