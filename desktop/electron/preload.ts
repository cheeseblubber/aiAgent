const { contextBridge, ipcRenderer }  = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Browser initialization
  initBrowser: async () => {
    return await ipcRenderer.invoke('browser:init');
  },
  
  // Browser navigation
  navigate: async (url: string) => {
    return await ipcRenderer.invoke('browser:navigate', url);
  },
  goBack: async () => {
    return await ipcRenderer.invoke('browser:back');
  },
  goForward: async () => {
    return await ipcRenderer.invoke('browser:forward');
  },
  getCurrentUrl: async () => {
    return await ipcRenderer.invoke('browser:getCurrentUrl');
  },
  
  // Screenshot
  takeScreenshot: async () => {
    return await ipcRenderer.invoke('browser:screenshot');
  },
  
  // Computer actions
  click: async (x: number, y: number, button: string = 'left') => {
    return await ipcRenderer.invoke('computer:click', x, y, button);
  },
  doubleClick: async (x: number, y: number) => {
    return await ipcRenderer.invoke('computer:doubleClick', x, y);
  },
  move: async (x: number, y: number) => {
    return await ipcRenderer.invoke('computer:move', x, y);
  },
  drag: async (path: Array<[number, number]>) => {
    return await ipcRenderer.invoke('computer:drag', path);
  },
  scroll: async (x: number, y: number, scrollX: number, scrollY: number) => {
    return await ipcRenderer.invoke('computer:scroll', x, y, scrollX, scrollY);
  },
  keypress: async (keys: string[]) => {
    return await ipcRenderer.invoke('computer:keypress', keys);
  },
  type: async (text: string) => {
    return await ipcRenderer.invoke('computer:type', text);
  },
  wait: async (ms: number = 2000) => {
    return await ipcRenderer.invoke('computer:wait', ms);
  },
  
  // Event listeners
  onScreenshot: (callback: (data: any) => void) => {
    ipcRenderer.on('browser:screenshot', (_: any, data: any) => callback(data));
  },
  onConsole: (callback: (data: any) => void) => {
    ipcRenderer.on('browser:console', (_: any, data: any) => callback(data));
  }
});
