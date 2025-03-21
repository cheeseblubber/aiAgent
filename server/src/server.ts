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

// Track all connected WebSocket clients
const connectedClients = new Set<WebSocket>();

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

// Browser management
let browser: Browser | null = null;
let page: Page | null = null;
let agent: Agent | null = null;
let computer: Computer | null = null;

async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: false,
    });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();

    // Navigate to bing.com
    await page.goto("https://www.bing.com");

    // Create Computer and Agent instances
    computer = new Computer([1280, 720], "browser", page);
    agent = new Agent(
      computer,
      "computer-use-preview",
      toolsList,
      (message: string) => {
        console.log("Safety check acknowledged:", message);
        return true; // Auto-acknowledge all safety checks
      }
    );

    // Set up page event listeners
    page.on("console", async (msg: ConsoleMessage) => {
      broadcastToAll({
        type: "console",
        data: { type: msg.type(), text: msg.text() },
      });
    });

    page.on("load", async () => {
      if (!page) return;
      const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
      broadcastToAll({
        type: "screenshot",
        data: { image: screenshot.toString("base64") },
      });
    });
  }
  return { browser, page, agent, computer };
}

// Function to broadcast to all clients
function broadcastToAll(update: BrowserUpdate) {
  const message = JSON.stringify(update);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Function to broadcast chat messages to all clients
function broadcastChatMessage(content: string) {
  const chatUpdate: ChatUpdate = {
    type: "chat",
    data: {
      content,
      sender: "ai",
    },
  };

  const message = JSON.stringify(chatUpdate);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

server.register(async function (server: FastifyInstance) {
  server.get(
    "/browser",
    { websocket: true },
    async (connection: SocketStream, req) => {
      console.log("Client connected to browser WebSocket");
      connectedClients.add(connection.socket);

      // Ensure browser is initialized
      const { page } = await initBrowser();
      if (!page) {
        connection.socket.send(
          JSON.stringify({
            type: "error",
            data: { message: "Failed to initialize browser" },
          })
        );
        return;
      }

      // Send initial screenshot
      const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
      connection.socket.send(
        JSON.stringify({
          type: "screenshot",
          data: { image: screenshot.toString("base64") },
        })
      );

      // Set up periodic screenshots
      const screenshotInterval = setInterval(async () => {
        if (page && connection.socket.readyState === WebSocket.OPEN) {
          const screenshot = await page.screenshot({
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
            await page.goto(update.data.url);
          }
        } catch (error) {
          console.error("Failed to process WebSocket message:", error);
        }
      });

      connection.socket.on("close", () => {
        console.log("Client disconnected from browser WebSocket");
        connectedClients.delete(connection.socket);
        clearInterval(screenshotInterval);
      });
    }
  );
});

// Cleanup on server shutdown
process.on("SIGTERM", async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

server.post<{ Body: ChatMessage }>("/chat", async (request, reply) => {
  try {
    const { message } = request.body;

    // const aiResponse = await openAiChat(message);
    if (!page) {
      return reply.code(500).send({
        success: false,
        error: "Failed to process message",
      });
    }
    // Use Agent to handle the message
    if (!agent) {
      return reply.code(500).send({
        success: false,
        error: "Agent not initialized",
      });
    }

    // Create a conversation history with the user message
    const conversationHistory = [
      {
        role: "user",
        content: [{ type: "input_text", text: message }],
      },
    ];

    // Run the agent
    agent.runFullTurn(conversationHistory, {
      printSteps: true,
      showImages: true,
      messageCallback: (message) => {
        broadcastChatMessage(message);
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
    await server.listen({ port: 3000, host: "0.0.0.0" });
    console.log("Server running at http://localhost:3000");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
