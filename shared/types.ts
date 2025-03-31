/**
 * Shared type definitions for computer actions between client and server
 */

// Base interface for all computer actions
export interface ComputerActionBase {
  type: 'computer-action';
  action: string;
  params: any;
  id: string; // Unique ID for tracking actions
}

// Mouse button types
export type MouseButton = 'left' | 'right' | 'wheel' | 'back' | 'forward';

// Click action
export interface ClickAction extends ComputerActionBase {
  action: 'click';
  params: {
    x: number;
    y: number;
    button?: MouseButton;
  };
}

// Double click action
export interface DoubleClickAction extends ComputerActionBase {
  action: 'doubleClick';
  params: {
    x: number;
    y: number;
  };
}

// Move action
export interface MoveAction extends ComputerActionBase {
  action: 'move';
  params: {
    x: number;
    y: number;
  };
}

// Drag action
export interface DragAction extends ComputerActionBase {
  action: 'drag';
  params: {
    path: Array<[number, number]>;
  };
}

// Scroll action
export interface ScrollAction extends ComputerActionBase {
  action: 'scroll';
  params: {
    x: number;
    y: number;
    scrollX: number;
    scrollY: number;
  };
}

// Keypress action
export interface KeypressAction extends ComputerActionBase {
  action: 'keypress';
  params: {
    keys: string[];
  };
}

// Type action
export interface TypeAction extends ComputerActionBase {
  action: 'type';
  params: {
    text: string;
  };
}

// Wait action
export interface WaitAction extends ComputerActionBase {
  action: 'wait';
  params: {
    ms?: number;
  };
}

// Navigate action
export interface NavigateAction extends ComputerActionBase {
  action: 'navigate';
  params: {
    url: string;
  };
}

// Back action
export interface BackAction extends ComputerActionBase {
  action: 'back';
  params: {};
}

// Forward action
export interface ForwardAction extends ComputerActionBase {
  action: 'forward';
  params: {};
}

// Screenshot action
export interface ScreenshotAction extends ComputerActionBase {
  action: 'takeScreenshot';
  params: {};
}

// GetCurrentUrl action
export interface GetCurrentUrlAction extends ComputerActionBase {
  action: 'getCurrentUrl';
  params: {};
}

// Union type of all computer actions
export type ComputerAction = 
  | ClickAction
  | DoubleClickAction
  | MoveAction
  | DragAction
  | ScrollAction
  | KeypressAction
  | TypeAction
  | WaitAction
  | NavigateAction
  | BackAction
  | ForwardAction
  | ScreenshotAction
  | GetCurrentUrlAction;

// Browser status types
export type BrowserStatus = 'initializing' | 'ready' | 'closed' | 'error';

// Browser update message types
export type BrowserUpdateType = 'page' | 'console' | 'network' | 'screenshot' | 'status' | 'action-response';

// Browser update message
export interface BrowserUpdate {
  type: 'desktop-browser';
  action: BrowserUpdateType;
  data: any;
  id?: string; // Optional ID for response tracking
}

// Screenshot update
export interface ScreenshotUpdate extends BrowserUpdate {
  action: 'screenshot';
  data: {
    image: string; // Base64 encoded image
  };
}

// Console update
export interface ConsoleUpdate extends BrowserUpdate {
  action: 'console';
  data: {
    type: 'log' | 'info' | 'warn' | 'error';
    text: string;
  };
}

// Status update
export interface StatusUpdate extends BrowserUpdate {
  action: 'status';
  data: {
    status: BrowserStatus;
  };
}

// URL update
export interface UrlUpdate extends BrowserUpdate {
  action: 'page';
  data: {
    url: string;
  };
}

// Action response
export interface ActionResponse extends BrowserUpdate {
  action: 'action-response';
  id: string; // Must match the ID of the original action
  data: {
    success: boolean;
    error?: string;
    result?: any;
  };
}
