import { Page } from "playwright-core";

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

  async double_click(x: number, y: number): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log(`Action: double click at (${x}, ${y})`);
    await this.page.mouse.dblclick(x, y);
  }

  async move(x: number, y: number): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log(`Action: move mouse to (${x}, ${y})`);
    await this.page.mouse.move(x, y);
  }

  async drag(path: Array<[number, number]>): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    if (path.length < 2) {
      throw new Error("Drag path must contain at least two points");
    }

    console.log(`Action: drag from (${path[0][0]}, ${path[0][1]}) to (${path[path.length-1][0]}, ${path[path.length-1][1]})`);
    
    // Move to the start position
    await this.page.mouse.move(path[0][0], path[0][1]);
    
    // Press the mouse button down
    await this.page.mouse.down();
    
    // Move through each point in the path
    for (let i = 1; i < path.length; i++) {
      await this.page.mouse.move(path[i][0], path[i][1]);
    }
    
    // Release the mouse button
    await this.page.mouse.up();
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

  async goto(url: string): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log(`Action: navigate to ${url}`);
    await this.page.goto(url);
  }

  async back(): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log("Action: navigate back");
    await this.page.goBack();
  }

  async forward(): Promise<void> {
    if (!this.page) {
      throw new Error("Page not initialized");
    }

    console.log("Action: navigate forward");
    await this.page.goForward();
  }
}
