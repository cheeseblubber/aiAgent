import dotenv from "dotenv";
dotenv.config();

import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import ws from "@fastify/websocket";
import { WebSocket } from "ws";
import { SocketStream } from "@fastify/websocket";
import type { Browser, Page, ConsoleMessage } from "playwright";
import { chromium } from "playwright";
import { Agent, Computer } from "./agent";
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

// Interface for chat messages sent via WebSocket
interface ChatUpdate {
  type: "chat";
  data: {
    content: string;
    sender: "ai";
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

  // Create new browser session
  const browser = await chromium.launch({
    headless: false,
  });
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
  console.log(`Total active sessions: ${conversationSessions.size}`);
  return session;
}

// Clean up inactive sessions
function cleanupInactiveSessions() {
  const now = Date.now();
  console.log(`Running periodic cleanup, checking ${conversationSessions.size} sessions`);
  
  for (const [conversationId, session] of conversationSessions.entries()) {
    const inactiveTime = now - session.lastActivity;
    console.log(`Session ${conversationId} inactive for ${Math.floor(inactiveTime/1000/60)} minutes`);
    
    if (inactiveTime > SESSION_TIMEOUT_MS) {
      console.log(`Cleaning up inactive session: ${conversationId}`);
      // Close browser
      session.browser.close();
      // Remove from map
      conversationSessions.delete(conversationId);
      console.log(`Removed inactive session: ${conversationId}`);
    }
  }
  
  console.log(`Cleanup complete, ${conversationSessions.size} active sessions remaining`);
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
function broadcastChatMessage(conversationId: string, content: string) {
  const session = conversationSessions.get(conversationId);
  if (!session) return;

  const chatUpdate: ChatUpdate = {
    type: "chat",
    data: {
      content,
      sender: "ai",
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
      
      console.log(`WebSocket connection request for conversation: ${conversationId}`);
      
      // Initialize or get browser session for this conversation
      const session = await initBrowserForConversation(conversationId);
      
      // Add this client to the session's connected clients
      session.connectedClients.add(connection.socket);
      console.log(`Connected clients for conversation ${conversationId}: ${session.connectedClients.size}`);
      
      // Send initial screenshot
      const screenshot = await session.page.screenshot({ type: "jpeg", quality: 80 });
      connection.socket.send(
        JSON.stringify({
          type: "screenshot",
          data: { image: screenshot.toString("base64") },
        })
      );
      
      // Send current page info
      const pageUrl = session.page.url();
      const title = await session.page.title();
      connection.socket.send(
        JSON.stringify({
          type: "page",
          data: { url: pageUrl, title },
        })
      );

      // Set up periodic screenshots
      const screenshotInterval = setInterval(async () => {
        if (session.page && connection.socket.readyState === WebSocket.OPEN) {
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

      connection.socket.on("close", () => {
        console.log(`Client disconnected from browser WebSocket for conversation: ${conversationId}`);
        session.connectedClients.delete(connection.socket);
        clearInterval(screenshotInterval);
        
        console.log(`Remaining clients for conversation ${conversationId}: ${session.connectedClients.size}`);
        
        // If this was the last client and we're not in the middle of cleanup,
        // schedule cleanup after a short delay to avoid race conditions
        if (session.connectedClients.size === 0) {
          console.log(`No more clients for conversation ${conversationId}, scheduling cleanup`);
          setTimeout(async () => {
            // Double-check that no new clients connected in the meantime
            if (conversationSessions.has(conversationId) && 
                conversationSessions.get(conversationId)!.connectedClients.size === 0) {
              console.log(`Cleaning up unused session for conversation: ${conversationId}`);
              const sessionToClean = conversationSessions.get(conversationId)!;
              await sessionToClean.browser.close();
              conversationSessions.delete(conversationId);
              console.log(`Removed session for conversation: ${conversationId}`);
              console.log(`Remaining active sessions: ${conversationSessions.size}`);
            }
          }, 5000); // 5 second delay before cleanup
        }
      });
    }
  );
});

// Cleanup on server shutdown
process.on("SIGTERM", async () => {
  // Close all browser instances
  for (const [_, session] of conversationSessions.entries()) {
    await session.browser.close();
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
    
    // Add the new user message to the conversation history
    session.conversationHistory.push({
      role: "user",
      content: [{ type: "input_text", text: message }],
    });

    console.log(`Running agent for conversation: ${conversationId} with ${session.conversationHistory.length} messages in history`);
    // Run the agent with the full conversation history
    session.agent.runFullTurn(session.conversationHistory, {
      printSteps: true,
      showImages: true,
      messageCallback: (message) => {
        broadcastChatMessage(conversationId, message);
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
