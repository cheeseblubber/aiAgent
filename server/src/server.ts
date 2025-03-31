import dotenv from "dotenv";
dotenv.config();

import fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import ws from "@fastify/websocket";
import { WebSocket } from "ws";
import { SocketStream } from "@fastify/websocket";
import { Agent } from "./agent";
import { RemoteComputer } from "./remoteComputer";
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
  agent: Agent;
  computer: RemoteComputer;
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

// Initialize a new session for a conversation
async function initSessionForConversation(conversationId: string): Promise<ConversationSession> {
  // Check if session already exists
  if (conversationSessions.has(conversationId)) {
    console.log(`Found existing session for conversation: ${conversationId}`);
    const session = conversationSessions.get(conversationId)!;
    session.lastActivity = Date.now();
    return session;
  }
  
  console.log(`Creating new session for conversation: ${conversationId}`);

  // Create RemoteComputer and Agent instances
  const computer = new RemoteComputer([1280, 720], "browser");
  // Use type assertion since RemoteComputer implements the necessary functionality
  // but doesn't need to fully implement the Computer interface
  const agent = new Agent(
    computer as any, // Type assertion to satisfy TypeScript
    "computer-use-preview",
    toolsList,
    (message: string) => {
      console.log("Safety check acknowledged:", message);
      return true; // Auto-acknowledge all safety checks
    }
  );

  // Create new session
  const session: ConversationSession = {
    agent,
    computer,
    connectedClients: new Set<WebSocket>(),
    lastActivity: Date.now(),
    conversationHistory: [],
  };

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
      // Initialize or get session for this conversation
      const session = await initSessionForConversation(conversationId);
      session.connectedClients.add(connection.socket);
      
      // Set the WebSocket for the RemoteComputer
      session.computer.setWebSocket(connection.socket);
      
      // Request an initial screenshot from the desktop browser
      connection.socket.send(JSON.stringify({
        type: "computer-action",
        action: "takeScreenshot",
        params: {},
        id: "initial-screenshot-" + Date.now()
      }));
      
      // Request current URL from the desktop browser
      connection.socket.send(JSON.stringify({
        type: "computer-action",
        action: "getCurrentUrl",
        params: {},
        id: "initial-url-" + Date.now()
      }));

      // Set up periodic screenshot requests
      const screenshotInterval = setInterval(() => {
        if (connection.socket.readyState === WebSocket.OPEN) {
          connection.socket.send(JSON.stringify({
            type: "computer-action",
            action: "takeScreenshot",
            params: {},
            id: "periodic-screenshot-" + Date.now()
          }));
        }
      }, 5000); // Request screenshot every 5 seconds

      connection.socket.on("message", async (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`Received message from client for conversation ${conversationId}:`, data.type);
          
          // Handle desktop browser messages
          if (data.type === 'desktop-browser') {
            // Update session activity timestamp
            session.lastActivity = Date.now();
            
            // Process different desktop browser actions
            switch (data.action) {
              case 'screenshot':
                // Screenshot received from desktop browser
                broadcastToConversation(conversationId, {
                  type: "screenshot",
                  data: { image: data.data.image },
                });
                break;
                
              case 'console':
                // Console message received from desktop browser
                broadcastToConversation(conversationId, {
                  type: "console",
                  data: data.data,
                });
                break;
                
              case 'status':
                // Status update received from desktop browser
                console.log(`Desktop browser status for conversation ${conversationId}: ${data.data.status}`);
                break;
                
              case 'url':
                // URL update received from desktop browser
                console.log(`Desktop browser URL for conversation ${conversationId}: ${data.data.url}`);
                break;
                
              case 'connect':
                // Initial connection message
                console.log(`Desktop browser connected for conversation ${conversationId}`);
                break;
                
              case 'heartbeat':
                // Heartbeat message
                // Just update the lastActivity timestamp, which we already did
                break;
            }
          }
        } catch (error) {
          console.error("Failed to process WebSocket message:", error);
        }
      });

      connection.socket.on("close", () => {
        console.log("Client disconnected from browser WebSocket");
        session.connectedClients.delete(connection.socket);
        clearInterval(screenshotInterval);
      });
    }
  );
});

// Cleanup on server shutdown
process.on("SIGTERM", async () => {
  // Close the server
  await server.close();
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
    const session = await initSessionForConversation(conversationId);
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
