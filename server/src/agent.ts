import OpenAI from "openai";
import {
  Tool,
  EasyInputMessage,
  Response,
} from "openai/resources/responses/responses";
import { APIPromise } from "openai/core";
import { tools } from "./tools";

// Utility functions
export function createResponse(
  model: string,
  input: EasyInputMessage[],
  tools: Array<Tool>,
  truncation: "auto" | "disabled" | null
): APIPromise<Response> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  return openai.responses.create({
    model,
    input,
    tools,
    truncation,
  });
}

export function pp(...args: any[]): void {
  console.log(JSON.stringify(args, null, 2));
}

export function sanitizeMessage(message: any): any {
  // Deep clone and sanitize sensitive information
  const sanitized = JSON.parse(JSON.stringify(message));
  // Implement sanitization logic here
  return sanitized;
}

export function checkBlocklistedUrl(url: string): void {
  // Implement URL blocklist checking
  const blocklist: string[] = [
    // Add blocklisted domains/patterns here
  ];

  for (const pattern of blocklist) {
    if (url.includes(pattern)) {
      throw new Error(`URL contains blocklisted pattern: ${pattern}`);
    }
  }
}

// Import ComputerTool from OpenAI SDK
import { ComputerTool } from "openai/resources/responses/responses";
import { RemoteComputer } from "./remoteComputer";

// Define message types for agent communication
export type AgentMessageType =
  | "action" // Agent is performing an action
  | "thinking" // Agent is processing/thinking
  | "complete" // Agent has completed its task
  | "error" // Agent encountered an error
  | "interrupted"; // Agent was interrupted

// Extending the ComputerTool type from OpenAI SDK
type ComputerPreviewTool = ComputerTool;

// Define specific action types
type ClickAction = {
  type: "click";
  x: number;
  y: number;
  button?: "left" | "right" | "wheel" | "back" | "forward";
};

type ScrollAction = {
  type: "scroll";
  x: number;
  y: number;
  scroll_x: number;
  scroll_y: number;
};

type KeypressAction = {
  type: "keypress";
  keys: string[];
};

type TypeAction = {
  type: "type";
  text: string;
};

type WaitAction = {
  type: "wait";
  ms?: number;
};

type OtherAction = {
  type: string;
  [key: string]: unknown;
};

// Union of all possible computer actions
type ComputerAction =
  | ClickAction
  | ScrollAction
  | KeypressAction
  | TypeAction
  | WaitAction
  | OtherAction;

type PendingSafetyCheck = {
  id: string;
  code: string;
  message: string;
};

type ComputerCallItem = {
  type: "computer_call";
  call_id: string;
  action: ComputerAction;
  pending_safety_checks?: PendingSafetyCheck[];
};

type MessageItem = {
  type: "message";
  content: { text: string }[];
};

type FunctionCallItem = {
  type: "function_call";
  name: string;
  arguments: string;
  call_id: string;
};

type ResponseOutput = {
  output: ResponseItem[];
};

interface ResponseItemBase {
  type?: string;
  role?: string;
  call_id?: string;
  output?: string | number | boolean | Record<string, unknown>;
}

type ResponseItem =
  | ComputerCallItem
  | MessageItem
  | FunctionCallItem
  | ResponseItemBase;

export class Agent {
  model: string;
  computer: RemoteComputer;
  tools: Array<Tool | ComputerPreviewTool>;
  printSteps: boolean;
  debug: boolean;

  acknowledgeSafetyCheckCallback: (message: string) => boolean;
  isInterrupted: boolean;

  constructor(
    computer: RemoteComputer,
    model: string = "computer-use-preview",
    tools: Array<Tool> = [],
    acknowledgeSafetyCheckCallback: (message: string) => boolean = () => false
  ) {
    this.model = model;
    this.computer = computer;
    this.tools = tools;
    this.printSteps = true;
    this.debug = false;

    this.acknowledgeSafetyCheckCallback = acknowledgeSafetyCheckCallback;
    this.isInterrupted = false;

    this.tools.push({
      type: "computer-preview",
      display_width: this.computer.dimensions[0],
      display_height: this.computer.dimensions[1],
      environment: this.computer.environment,
    });
  }



  async handleModelResponse(
    responseElement: ResponseItem,
    messageCallback?: (message: string, type: AgentMessageType) => void
  ): Promise<ResponseItem[]> {
    // Handle each responseElement; may cause a computer action + screenshot
    if (responseElement.type === "message") {
      const messageItem = responseElement as MessageItem;
      if (this.printSteps && messageItem.content?.[0]?.text) {
        console.log(messageItem.content[0].text);
        messageCallback?.(messageItem.content[0].text, "thinking");
      }
    }

    if (responseElement.type === "function_call") {
      const functionItem = responseElement as FunctionCallItem;
      const name = functionItem.name;
      const args = JSON.parse(functionItem.arguments);

      if (this.printSteps) {
        console.log(`${name}(${JSON.stringify(args)})`);
        messageCallback?.(`${name}(${JSON.stringify(args)})`, "action");
      }

      if (this.computer) {
        const result = await tools[name].handler(args, {
          computer: this.computer,
        });
        return [
          {
            type: "function_call_output",
            call_id: functionItem.call_id,
            output: result,
          },
        ];
      }

      return [
        {
          type: "function_call_output",
          call_id: functionItem.call_id,
          output: "page not found",
        },
      ];
    }

    if (responseElement.type === "computer_call") {
      const computerItem = responseElement as ComputerCallItem;
      const action = computerItem.action;
      const actionType = action.type;
      // Create a new object without the type property instead of using delete
      const { type, ...actionArgs } = action;

      if (this.printSteps) {
        console.log(`${actionType}(${JSON.stringify(actionArgs)})`);
        messageCallback?.(
          `${actionType}(${JSON.stringify(actionArgs)})`,
          "action"
        );
      }

      if (this.computer) {
        // Execute the appropriate computer action based on type
        switch (actionType) {
          case "click": {
            if ("x" in actionArgs && "y" in actionArgs) {
              const { x, y, button = "left" } = actionArgs as ClickAction;
              await this.computer.click(x, y, button);
            }
            break;
          }
          case "scroll": {
            if (
              "x" in actionArgs &&
              "y" in actionArgs &&
              "scroll_x" in actionArgs &&
              "scroll_y" in actionArgs
            ) {
              const { x, y, scroll_x, scroll_y } = actionArgs as ScrollAction;
              await this.computer.scroll(x, y, scroll_x, scroll_y);
            }
            break;
          }
          case "keypress": {
            if ("keys" in actionArgs) {
              const { keys } = actionArgs as KeypressAction;
              await this.computer.keypress(keys);
            }
            break;
          }
          case "type": {
            if ("text" in actionArgs) {
              const { text } = actionArgs as TypeAction;
              await this.computer.type(text);
            }
            break;
          }
          case "wait": {
            const { ms = 2000 } = actionArgs as WaitAction;
            await this.computer.wait(ms);
            break;
          }
          default: {
            // For other methods, check if they exist on the computer object
            if (typeof (this.computer as any)[actionType] === "function") {
              await (this.computer as any)[actionType](actionArgs);
            } else {
              console.warn(`Unknown computer action type: ${actionType}`);
            }
            break;
          }
        }
      }

      // Take a screenshot
      let screenshotBase64 = "";
      if (this.computer) {
        screenshotBase64 = await this.computer.screenshot();
      }

      // if user doesn't ack all safety checks exit with error
      const pendingChecks = computerItem.pending_safety_checks || [];
      for (const check of pendingChecks) {
        const message = check.message;
        if (!this.acknowledgeSafetyCheckCallback(message)) {
          throw new Error(
            `Safety check failed: ${message}. Cannot continue with unacknowledged safety checks.`
          );
        }
      }

      // Get the current URL for browser environments
      let currentUrl = "";
      if (this.computer?.environment === "browser") {
        try {
          currentUrl = await this.computer.get_current_url();
          checkBlocklistedUrl(currentUrl);
        } catch (error) {
          console.error("Error getting current URL:", error);
        }
      }

      const callOutput = {
        type: "computer_call_output",
        call_id: computerItem.call_id,
        acknowledged_safety_checks: pendingChecks,
        output: {
          type: "input_image",
          image_url: `data:image/png;base64,${screenshotBase64}`,
          current_url: currentUrl,
        },
      };

      return [callOutput];
    }

    return [];
  }

  async runFullTurn(
    conversationHistory: any[],
    options: {
      printSteps?: boolean;
      debug?: boolean;
      messageCallback?: (message: string, type: AgentMessageType) => void;
    } = {}
  ): Promise<any[]> {
    const {
      printSteps = true,
      debug = false,

      messageCallback,
    } = options;

    this.printSteps = printSteps;
    this.debug = debug;

    // Reset interruption flag at the start of a new turn
    this.isInterrupted = false;

    let modelResponses: any[] = [];

    // Keep looping until we get a final response from the assistant or until interrupted
    while (
      !this.isInterrupted &&
      (!modelResponses.length ||
        modelResponses[modelResponses.length - 1]?.role !== "assistant")
    ) {

      // Get response from the model
      let response: ResponseOutput;
      try {
        response = (await createResponse(
          this.model,
          conversationHistory.concat(modelResponses),
          this.tools,
          "auto"
        )) as ResponseOutput;

      } catch (error) {
        console.error("Error creating OpenAI response:", error);
        if (messageCallback) {
          messageCallback(
            "An error occurred while processing your request. Please try again.",
            "error"
          );
        }

        // Add error message to model responses
        modelResponses.push({
          role: "assistant",
          content: [
            {
              type: "text",
              text: "I encountered an error while processing your request. Please try again.",
            },
          ],
        });

        // Break the loop to stop further processing
        break;
      }

      // Check if interrupted
      if (this.isInterrupted) {
        if (messageCallback) {
          messageCallback("Agent execution was interrupted.", "interrupted");
        }
        console.log("Agent execution was interrupted.");
        break;
      }

      // Handle response output
      if (!response.output) {
        if (this.debug) {
          console.log(response);
          throw new Error("No output from model");
        }
        continue;
      }

      // Add response output to model responses
      modelResponses = modelResponses.concat(response.output);

      // Process each response element
      for (const responseElement of response.output) {
        // Check if interrupted before processing each response element
        if (this.isInterrupted) {
          if (messageCallback) {
            messageCallback("Agent execution was interrupted.", "interrupted");
          }
          console.log("Agent execution was interrupted.");
          break;
        }
        const responseResults = await this.handleModelResponse(
          responseElement,
          messageCallback
        );
        modelResponses = modelResponses.concat(responseResults);
      }
    }

    // If interrupted, add a message to the responses
    if (this.isInterrupted && messageCallback) {
      messageCallback("Agent execution was interrupted.", "interrupted");
      modelResponses.push({
        role: "assistant",
        content: [{ type: "text", text: "Agent execution was interrupted." }],
      });
    }

    // If we completed successfully (not interrupted), send a completion message
    if (!this.isInterrupted && messageCallback) {
      messageCallback("Agent execution completed.", "complete");
    }

    return modelResponses;
  }

  /**
   * Interrupts the agent's execution loop
   */
  interrupt(): void {
    this.isInterrupted = true;
    console.log("Agent interruption requested.");
  }
}
