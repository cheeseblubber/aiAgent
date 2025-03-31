import OpenAI from "openai";
import { Tool } from "openai/resources/responses/responses";
import { Page } from "playwright";
import { RemoteComputer } from "./remoteComputer";


type Success = "success" | "error";

export const tools: Record<
  string,
  {
    spec: Tool;
    handler: (args: any, opts: { computer: RemoteComputer }) => Promise<Success>;
  }
> = {
  goto: {
    spec: {
      name: "goto",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL to navigate to."
          }
        },
        required: ["url"],
        additionalProperties: false
      },
      strict: true,
      type: "function"
    },
    handler: async ({ url }: { url: string }, { computer }: { computer: RemoteComputer }) => {
      if (!computer) {
        throw new Error("Computer object is required for navigation");
      }
      try {
        // Increase timeout to 60 seconds and set waitUntil to 'domcontentloaded' instead of 'load'
        // This will make the navigation complete once the DOM is ready, without waiting for all resources
        await computer.goto(url);
        return "success";
      } catch (error) {
        console.error(`Navigation error to ${url}:`, error);
        return "error"; // Return error instead of re-throwing
      }
    },
  },
};

export const toolsList = Object.values(tools).map(({ spec }) => spec);

