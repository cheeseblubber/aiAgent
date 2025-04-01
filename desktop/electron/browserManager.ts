import { BrowserWindow, ipcMain, app } from "electron";
import {
  chromium,
  Browser,
  BrowserContext,
  Page,
  ConsoleMessage,
} from "playwright";
import { ComputerPage } from "./computerPage.js";
import path from "path";
import fs from "fs";

interface BrowserSession {
  context: BrowserContext;
  page: Page;
  computer: ComputerPage;
  lastActivity: number;
}

export class BrowserManager {
  private mainWindow: BrowserWindow;
  private session: BrowserSession | null = null;
  private isInitializing: boolean = false;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    // Initialize browser
    ipcMain.handle("browser:init", async () => {
      return await this.initBrowser();
    });

    // Browser actions
    ipcMain.handle("browser:screenshot", async () => {
      return await this.takeScreenshot();
    });

    ipcMain.handle("browser:navigate", async (_, url: string) => {
      return await this.navigate(url);
    });

    ipcMain.handle("browser:back", async () => {
      return await this.goBack();
    });

    ipcMain.handle("browser:forward", async () => {
      return await this.goForward();
    });

    ipcMain.handle("browser:getCurrentUrl", async () => {
      return await this.getCurrentUrl();
    });

    // Computer actions
    ipcMain.handle(
      "computer:click",
      async (_, x: number, y: number, button: string) => {
        return await this.computerClick(x, y, button as any);
      }
    );

    ipcMain.handle("computer:doubleClick", async (_, x: number, y: number) => {
      return await this.computerDoubleClick(x, y);
    });

    ipcMain.handle("computer:move", async (_, x: number, y: number) => {
      return await this.computerMove(x, y);
    });

    ipcMain.handle(
      "computer:drag",
      async (_, path: Array<[number, number]>) => {
        return await this.computerDrag(path);
      }
    );

    ipcMain.handle(
      "computer:scroll",
      async (_, x: number, y: number, scrollX: number, scrollY: number) => {
        return await this.computerScroll(x, y, scrollX, scrollY);
      }
    );

    ipcMain.handle("computer:keypress", async (_, keys: string[]) => {
      return await this.computerKeypress(keys);
    });

    ipcMain.handle("computer:type", async (_, text: string) => {
      return await this.computerType(text);
    });

    ipcMain.handle("computer:wait", async (_, ms: number) => {
      return await this.computerWait(ms);
    });
  }

  /**
   * Gets the user data directory for persistent browser sessions
   */
  private getUserDataDir(): string {
    const userDataPath = path.join(app.getPath("userData"), "playwright-data");

    // Ensure the directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    return userDataPath;
  }

  async initBrowser(): Promise<boolean> {
    try {
      // Check if browser session already exists
      if (this.session) {
        console.log("Browser session already exists");
        this.session.lastActivity = Date.now();
        return true;
      }

      // Check if browser is already initializing
      if (this.isInitializing) {
        console.log("Browser initialization already in progress");
        return true;
      }

      // Set initializing flag
      this.isInitializing = true;
      console.log("Creating new persistent browser session");

      // Get user data directory for persistent session
      const userDataDir = this.getUserDataDir();
      console.log(`Using persistent browser data directory: ${userDataDir}`);

      // Launch persistent context instead of browser + context
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: { width: 1280, height: 720 },
        // Keep the browser open if the app crashes
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
      });

      // With launchPersistentContext, we don't need a separate browser instance
      // as the context manages the browser lifecycle

      // Get existing page or create a new one
      let page: Page
      const pages = context.pages();

      if (pages.length > 0) {
        page = pages[0];
        console.log("Using existing page from persistent context");
        await page.goto("https://www.bing.com");
      } else {
        page = await context.newPage();
        console.log("Created new page in persistent context");

        // Navigate to bing.com for new pages
        await page.goto("https://www.bing.com");
      }

      // Create Computer instance
      const computer = new ComputerPage([1280, 720], "browser", page);

      // Create new session
      this.session = {
        context,
        page,
        computer,
        lastActivity: Date.now(),
      };

      // Set up page event listeners
      page.on("console", async (msg: ConsoleMessage) => {
        this.mainWindow.webContents.send("browser:console", {
          type: msg.type(),
          text: msg.text(),
        });
      });

      page.on("load", async () => {
        const screenshot = await page.screenshot({ type: "jpeg", quality: 80 });
        this.mainWindow.webContents.send("browser:screenshot", {
          image: screenshot.toString("base64"),
        });
      });

      return true;
    } catch (error) {
      console.error("Failed to initialize browser:", error);
      return false;
    } finally {
      // Reset initializing flag
      this.isInitializing = false;
    }
  }

  async takeScreenshot(): Promise<string | null> {
    if (!this.session) {
      console.error("No active browser session");
      return null;
    }

    try {
      const screenshot = await this.session.page.screenshot({
        type: "jpeg",
        quality: 80,
      });
      return screenshot.toString("base64");
    } catch (error) {
      console.error("Failed to take screenshot:", error);
      return null;
    }
  }

  async navigate(url: string): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.page.goto(url);
      return true;
    } catch (error) {
      console.error(`Failed to navigate to ${url}:`, error);
      return false;
    }
  }

  async goBack(): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.page.goBack();
      return true;
    } catch (error) {
      console.error("Failed to go back:", error);
      return false;
    }
  }

  async goForward(): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.page.goForward();
      return true;
    } catch (error) {
      console.error("Failed to go forward:", error);
      return false;
    }
  }

  async getCurrentUrl(): Promise<string | null> {
    if (!this.session) {
      console.error("No active browser session");
      return null;
    }

    try {
      return this.session.page.url();
    } catch (error) {
      console.error("Failed to get current URL:", error);
      return null;
    }
  }

  // Computer methods
  async computerClick(
    x: number,
    y: number,
    button: "left" | "right" | "wheel" | "back" | "forward" = "left"
  ): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.click(x, y, button);
      return true;
    } catch (error) {
      console.error(`Failed to click at (${x}, ${y}):`, error);
      return false;
    }
  }

  async computerDoubleClick(x: number, y: number): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.double_click(x, y);
      return true;
    } catch (error) {
      console.error(`Failed to double click at (${x}, ${y}):`, error);
      return false;
    }
  }

  async computerMove(x: number, y: number): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.move(x, y);
      return true;
    } catch (error) {
      console.error(`Failed to move to (${x}, ${y}):`, error);
      return false;
    }
  }

  async computerDrag(path: Array<[number, number]>): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.drag(path);
      return true;
    } catch (error) {
      console.error("Failed to drag:", error);
      return false;
    }
  }

  async computerScroll(
    x: number,
    y: number,
    scrollX: number,
    scrollY: number
  ): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.scroll(x, y, scrollX, scrollY);
      return true;
    } catch (error) {
      console.error(`Failed to scroll at (${x}, ${y}):`, error);
      return false;
    }
  }

  async computerKeypress(keys: string[]): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.keypress(keys);
      return true;
    } catch (error) {
      console.error("Failed to press keys:", error);
      return false;
    }
  }

  async computerType(text: string): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.type(text);
      return true;
    } catch (error) {
      console.error("Failed to type text:", error);
      return false;
    }
  }

  async computerWait(ms: number = 2000): Promise<boolean> {
    if (!this.session) {
      console.error("No active browser session");
      return false;
    }

    try {
      await this.session.computer.wait(ms);
      return true;
    } catch (error) {
      console.error(`Failed to wait for ${ms}ms:`, error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    if (this.session) {
      try {
        // Close the context which will handle browser cleanup as well
        await this.session.context.close();
        this.session = null;
        console.log("Browser session closed");
      } catch (error) {
        console.error("Error closing browser session:", error);
      }
    }
  }
}
