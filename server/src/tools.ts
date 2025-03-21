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
      await page.goto(url);
      return "success";
    },
  },
};

export const toolsList = Object.values(tools).map(({ spec }) => spec);

