interface ElectronAPI {
  // Browser initialization
  initBrowser: () => Promise<boolean>;
  
  // Browser navigation
  navigate: (url: string) => Promise<boolean>;
  goBack: () => Promise<boolean>;
  goForward: () => Promise<boolean>;
  getCurrentUrl: () => Promise<string | null>;
  
  // Screenshot
  takeScreenshot: () => Promise<string | null>;
  
  // Computer actions
  click: (x: number, y: number, button?: string) => Promise<boolean>;
  doubleClick: (x: number, y: number) => Promise<boolean>;
  move: (x: number, y: number) => Promise<boolean>;
  drag: (path: Array<[number, number]>) => Promise<boolean>;
  scroll: (x: number, y: number, scrollX: number, scrollY: number) => Promise<boolean>;
  keypress: (keys: string[]) => Promise<boolean>;
  type: (text: string) => Promise<boolean>;
  wait: (ms?: number) => Promise<boolean>;
  
  // Event listeners
  onScreenshot: (callback: (data: any) => void) => void;
  onConsole: (callback: (data: any) => void) => void;
}

declare interface Window {
  electronAPI: ElectronAPI;
}
