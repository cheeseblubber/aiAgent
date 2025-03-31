/**
 * RemoteComputer class that handles communication with the Electron desktop app
 * for browser automation via WebSocket.
 */

import { WebSocket } from "ws";
import {
  ComputerAction,
  ClickAction,
  DoubleClickAction,
  MoveAction,
  DragAction,
  ScrollAction,
  KeypressAction,
  TypeAction,
  WaitAction,
  NavigateAction,
  BackAction,
  ForwardAction,
  MouseButton,
  BrowserUpdate,
  ActionResponse,
} from "../../shared/types";

// Minimal interface to satisfy the Agent's requirements
class MockPage {
  // This is just a placeholder to satisfy type requirements
}

export class RemoteComputer {
  private ws: WebSocket | null = null;
  dimensions: [number, number];
  environment: "mac" | "windows" | "ubuntu" | "browser";
  // Add a mock page property to satisfy the Agent class requirements
  page: MockPage;
  private lastScreenshot: string | null = null;
  private currentUrl: string | null = null;
  private pendingActions: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  constructor(
    dimensions: [number, number] = [1024, 768],
    environment: "mac" | "windows" | "ubuntu" | "browser" = "browser"
  ) {
    this.dimensions = dimensions;
    this.environment = environment;
    this.page = new MockPage();
  }

  // Set the WebSocket connection for this computer
  setWebSocket(ws: WebSocket): void {
    this.ws = ws;

    // Set up message handler for action responses
    ws.on("message", (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(message.action, message.type);

        // Handle action responses
        if (message.type === "desktop-browser") {
          switch (message.action) {
            case "screenshot":
              this.lastScreenshot = message.data.image;
              break;
            case "url":
              this.currentUrl = message.data.url;
              break;
            case "action-response":
              // Resolve pending action promise
              const pendingAction = this.pendingActions.get(message.id);
              if (pendingAction) {
                clearTimeout(pendingAction.timeout);

                if (message.data && message.data.success) {
                  // Successful action, resolve with the result
                  pendingAction.resolve(message.data.result);
                } else {
                  // Action failed, reject with the error
                  pendingAction.reject(
                    new Error(message.data?.error || "Unknown error")
                  );
                }

                this.pendingActions.delete(message.id);
                console.log(`Resolved action ${message.id}`);
              } else {
                console.warn(
                  `Received response for unknown action ID: ${message.id}`
                );
              }
              break;
          }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    });
  }

  // Helper method to send actions and wait for responses
  private async sendAction<T extends ComputerAction["action"]>(
    action: T,
    params: any,
    timeoutMs = 30000
  ): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(
        "WebSocket connection not available, action will be simulated"
      );
      return null; // Return null instead of throwing to allow for graceful degradation
    }

    return new Promise((resolve, reject) => {
      const actionId =
        Date.now().toString() + Math.random().toString(36).substring(2, 15);

      // Create the action message
      const actionMessage: ComputerAction = {
        type: "computer-action",
        action: action as any, // Type assertion needed due to generic constraints
        params,
        id: actionId,
      };

      // Set up timeout for the action
      const timeout = setTimeout(() => {
        if (this.pendingActions.has(actionId)) {
          this.pendingActions.delete(actionId);
          reject(new Error(`Action ${action} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      // Store the promise callbacks
      this.pendingActions.set(actionId, { resolve, reject, timeout });

      // Send the action
      // We've already checked this.ws is not null above, but TypeScript doesn't track this
      // through the Promise callback, so we need to check again
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(actionMessage));
      } else {
        // Clean up the pending action
        clearTimeout(timeout);
        this.pendingActions.delete(actionId);
        reject(new Error("WebSocket connection closed while sending action"));
      }
    });
  }

  // Computer interface methods
  async click(
    x: number,
    y: number,
    button: MouseButton = "left"
  ): Promise<void> {
    console.log(`Action: click at (${x}, ${y}) with button '${button}'`);
    await this.sendAction("click", { x, y, button });
  }

  async double_click(x: number, y: number): Promise<void> {
    console.log(`Action: double click at (${x}, ${y})`);
    await this.sendAction("doubleClick", { x, y });
  }

  async move(x: number, y: number): Promise<void> {
    console.log(`Action: move mouse to (${x}, ${y})`);
    await this.sendAction("move", { x, y });
  }

  async drag(path: Array<[number, number]>): Promise<void> {
    if (path.length < 2) {
      throw new Error("Drag path must contain at least two points");
    }

    console.log(
      `Action: drag from (${path[0][0]}, ${path[0][1]}) to (${
        path[path.length - 1][0]
      }, ${path[path.length - 1][1]})`
    );
    await this.sendAction("drag", { path });
  }

  async scroll(
    x: number,
    y: number,
    scroll_x: number,
    scroll_y: number
  ): Promise<void> {
    console.log(
      `Action: scroll at (${x}, ${y}) with offsets (scrollX=${scroll_x}, scrollY=${scroll_y})`
    );
    await this.sendAction("scroll", {
      x,
      y,
      scrollX: scroll_x,
      scrollY: scroll_y,
    });
  }

  async keypress(keys: string[]): Promise<void> {
    for (const k of keys) {
      console.log(`Action: keypress '${k}'`);
    }
    await this.sendAction("keypress", { keys });
  }

  async type(text: string): Promise<void> {
    console.log(`Action: type text '${text}'`);
    await this.sendAction("type", { text });
  }

  async wait(ms: number = 2000): Promise<void> {
    console.log(`Action: wait for ${ms}ms`);
    await this.sendAction("wait", { ms });
  }

  async screenshot(): Promise<string> {
    console.log("Action: screenshot");

    try {
      // Request a fresh screenshot and wait for the response
      await this.sendAction("takeScreenshot", {});

      // Return the last received screenshot
      if (!this.lastScreenshot) {
        throw new Error("No screenshot available");
      }

      return this.lastScreenshot;
    } catch (error) {
      console.error("Screenshot error:", error);
      // Return the last screenshot we have if available, otherwise rethrow
      if (this.lastScreenshot) {
        return this.lastScreenshot;
      }
      throw error;
    }
  }

  async get_current_url(): Promise<string> {
    try {
      // Request the current URL and wait for the response
      const result = await this.sendAction("getCurrentUrl", {});

      // If the action returns a direct result, use it
      if (typeof result === "string") {
        this.currentUrl = result;
        return result;
      }

      // Otherwise use the stored URL from WebSocket updates
      if (!this.currentUrl) {
        throw new Error("Current URL not available");
      }

      return this.currentUrl;
    } catch (error) {
      console.error("Get current URL error:", error);
      // Return the last known URL if available, otherwise rethrow
      if (this.currentUrl) {
        return this.currentUrl;
      }
      throw error;
    }
  }

  async goto(url: string): Promise<void> {
    console.log(`Action: navigate to ${url}`);
    await this.sendAction("navigate", { url });
  }

  async back(): Promise<void> {
    console.log("Action: navigate back");
    await this.sendAction("back", {});
  }

  async forward(): Promise<void> {
    console.log("Action: navigate forward");
    await this.sendAction("forward", {});
  }
}
