import { Page } from "playwright";
import OpenAI from "openai";
import { Tool, EasyInputMessage, Response } from "openai/resources/responses/responses";
import { APIPromise } from "openai/core";
import { tools } from "./tools";

// TypeScript equivalent of the Python Computer class
export class Computer {
  dimensions: [number, number];
  environment: "mac" | "windows" | "ubuntu" | "browser";
  page?: Page;

  constructor(
    dimensions: [number, number] = [1024, 768],
    environment: "mac" | "windows" | "ubuntu" | "browser" = "browser",
    page?: Page
  ) {
    this.dimensions = dimensions;
    this.environment = environment;
    this.page = page;
  }

  async click(
    x: number,
    y: number,
    button: "left" | "right" | "wheel" | "back" | "forward" = "left"
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    const mappedButton =
      button === "wheel"
        ? "middle"
        : button === "back" || button === "forward"
        ? "left"
        : button;

    console.log(`Action: click at (${x}, ${y}) with button '${button}'`);
    //TODO: temporary hack to deal multiple tabs
    //Bing opens new tab every search result

    await this.page.evaluate(() => {
      document.querySelectorAll('a[target="_blank"]').forEach((element) => {
        const anchor = element as HTMLAnchorElement;
        anchor.target = "_self";
      });
    });
    await this.page.mouse.click(x, y, { button: mappedButton });
  }

  async scroll(
    x: number,
    y: number,
    scroll_x: number,
    scroll_y: number
  ): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log(
      `Action: scroll at (${x}, ${y}) with offsets (scrollX=${scroll_x}, scrollY=${scroll_y})`
    );
    await this.page.mouse.move(x, y);
    await this.page.evaluate(`window.scrollBy(${scroll_x}, ${scroll_y})`);
  }

  async keypress(keys: string[]): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    for (const k of keys) {
      console.log(`Action: keypress '${k}'`);
      if (k.includes("ENTER")) {
        await this.page.keyboard.press("Enter");
      } else if (k.includes("SPACE")) {
        await this.page.keyboard.press(" ");
      } else {
        await this.page.keyboard.press(k);
      }
    }
  }

  async type(text: string): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log(`Action: type text '${text}'`);
    await this.page.keyboard.type(text);
  }

  async wait(ms: number = 2000): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log(`Action: wait for ${ms}ms`);
    await this.page.waitForTimeout(ms);
  }

  async screenshot(): Promise<string> {
    console.log("Action: screenshot");
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    // Take an actual screenshot using Playwright
    const screenshotBuffer = await this.page.screenshot({ type: "png" });
    return screenshotBuffer.toString("base64");
  }

  async get_current_url(): Promise<string> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    return this.page.url();
  }
}

// Utility functions
export function createResponse(
  model: string,
  input: EasyInputMessage[],
  tools: Array<Tool>,
  truncation: 'auto' | 'disabled' | null
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

export function showImage(base64Image: string): void {
  console.log("Displaying image (not implemented in this environment)");
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

// Types for the Agent class

// Import ComputerTool from OpenAI SDK
import { ComputerTool } from "openai/resources/responses/responses";

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
  computer: Computer;
  tools: Array<Tool | ComputerPreviewTool>;
  printSteps: boolean;
  debug: boolean;
  showImages: boolean;
  acknowledgeSafetyCheckCallback: (message: string) => boolean;

  constructor(
    computer: Computer,
    model: string = "computer-use-preview",
    tools: Array<Tool> = [],
    acknowledgeSafetyCheckCallback: (message: string) => boolean = () => false
  ) {
    this.model = model;
    this.computer = computer;
    this.tools = tools;
    this.printSteps = true;
    this.debug = false;
    this.showImages = false;
    this.acknowledgeSafetyCheckCallback = acknowledgeSafetyCheckCallback;

    this.tools.push({
      type: "computer-preview",
      display_width: this.computer.dimensions[0],
      display_height: this.computer.dimensions[1],
      environment: this.computer.environment,
    });
  }

  debugPrint(...args: unknown[]): void {
    if (this.debug) {
      pp(...args);
    }
  }

  async handleModelResponse(responseElement: ResponseItem, messageCallback?: (message: string) => void): Promise<ResponseItem[]> {
    // Handle each responseElement; may cause a computer action + screenshot
    if (responseElement.type === "message") {
      const messageItem = responseElement as MessageItem;
      if (this.printSteps && messageItem.content?.[0]?.text) {
        console.log(messageItem.content[0].text);
      }
    }

    if (responseElement.type === "function_call") {
      const functionItem = responseElement as FunctionCallItem;
      const name = functionItem.name;
      const args = JSON.parse(functionItem.arguments);

      if (this.printSteps) {
        console.log(`${name}(${JSON.stringify(args)})`);
        messageCallback?.(`${name}(${JSON.stringify(args)})`);
      }

      if (this.computer.page) {
        const result = await tools[name].handler(args, {
          page: this.computer.page,
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
        messageCallback?.(`${actionType}(${JSON.stringify(actionArgs)})`);
      }

      if (this.computer) {
        // Execute the appropriate computer action based on type
        switch (actionType) {
          case "click": {
            if ('x' in actionArgs && 'y' in actionArgs) {
              const { x, y, button = "left" } = actionArgs as ClickAction;
              await this.computer.click(x, y, button);
            }
            break;
          }
          case "scroll": {
            if ('x' in actionArgs && 'y' in actionArgs && 'scroll_x' in actionArgs && 'scroll_y' in actionArgs) {
              const { x, y, scroll_x, scroll_y } = actionArgs as ScrollAction;
              await this.computer.scroll(x, y, scroll_x, scroll_y);
            }
            break;
          }
          case "keypress": {
            if ('keys' in actionArgs) {
              const { keys } = actionArgs as KeypressAction;
              await this.computer.keypress(keys);
            }
            break;
          }
          case "type": {
            if ('text' in actionArgs) {
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

      if (this.showImages) {
        showImage(screenshotBase64);
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
      showImages?: boolean;
      messageCallback?: (message: string) => void;
    } = {}
  ): Promise<any[]> {
    const { printSteps = true, debug = false, showImages = false, messageCallback } = options;

    this.printSteps = printSteps;
    this.debug = debug;
    this.showImages = showImages;

    let modelResponses: any[] = [];

    // Keep looping until we get a final response from the assistant
    while (
      !modelResponses.length ||
      modelResponses[modelResponses.length - 1]?.role !== "assistant"
    ) {
      // Debug print the sanitized conversation history and model responses
      this.debugPrint(
        conversationHistory.concat(modelResponses).map(sanitizeMessage)
      );

      // Get response from the model
      const response = (await createResponse(
        this.model,
        conversationHistory.concat(modelResponses),
        this.tools,
        "auto"
      )) as ResponseOutput;

      this.debugPrint(response);

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
        const responseResults = await this.handleModelResponse(responseElement, messageCallback);
        modelResponses = modelResponses.concat(responseResults);
      }
    }

    return modelResponses;
  }
}
