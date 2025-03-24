import OpenAI from "openai";
import { Tool } from "openai/resources/responses/responses";
import { Page } from "playwright";


type Success = "success" | "error";

export const tools: Record<
  string,
  {
    spec: Tool;
    handler: (args: any, opts: { page: Page }) => Promise<Success>;
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
    handler: async ({ url }: { url: string }, { page }: { page: Page }) => {
      if (!page) {
        throw new Error("Page object is required for navigation");
      }
      try {
        // Increase timeout to 60 seconds and set waitUntil to 'domcontentloaded' instead of 'load'
        // This will make the navigation complete once the DOM is ready, without waiting for all resources
        await page.goto(url, { 
          timeout: 60000, 
          waitUntil: 'domcontentloaded' 
        });
        return "success";
      } catch (error) {
        console.error(`Navigation error to ${url}:`, error);
        // Return partial success if we at least got to the domain
        if (page.url().includes(new URL(url).hostname)) {
          console.log("Page partially loaded, returning success");
          return "success";
        }
        return "error"; // Return error instead of re-throwing
      }
    },
  },
};

export const toolsList = Object.values(tools).map(({ spec }) => spec);

