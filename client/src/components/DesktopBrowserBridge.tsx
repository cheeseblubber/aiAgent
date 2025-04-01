import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useConversation } from '../context/ConversationContext';
import { BrowserStatus } from '../types/computerActions';
import DesktopBrowser from './DesktopBrowser';

// Define browser console message type
interface BrowserConsoleMessage {
  type: "log" | "info" | "warn" | "error";
  text: string;
}

interface DesktopBrowserBridgeProps {
  // Any additional props can be added here
}

const DesktopBrowserBridge: React.FC<DesktopBrowserBridgeProps> = () => {
  const { webSocket, wsStatus } = useConversation();
  // Track the current screenshot but don't need to display it directly
  const [_, setScreenshot] = useState<string | null>(null);
  const [browserStatus, setBrowserStatus] = useState<'initializing' | 'ready' | 'closed' | 'error'>('closed');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const lastScreenshotRef = useRef<string | null>(null);

  // Handle screenshot updates from the desktop browser
  const handleScreenshotUpdate = useCallback((base64Image: string) => {
    setScreenshot(base64Image);
    lastScreenshotRef.current = base64Image;

    // Send the screenshot to the server via WebSocket
    if (webSocket && wsStatus === 'connected') {
      webSocket.send(JSON.stringify({
        type: 'desktop-browser',
        action: 'screenshot',
        data: { image: base64Image }
      }));
    }
  }, [webSocket, wsStatus]);

  // Handle console messages from the desktop browser
  const handleConsoleMessage = useCallback((message: any) => {
    // Validate and normalize the message format
    const consoleMessage: BrowserConsoleMessage = {
      type: (typeof message.type === 'string' &&
        ['log', 'info', 'warn', 'error'].includes(message.type)) ?
        message.type as "log" | "info" | "warn" | "error" : "log",
      text: typeof message.text === 'string' ? message.text : String(message.text || '')
    };

    // Send console messages to the server via WebSocket
    if (webSocket && wsStatus === 'connected') {
      webSocket.send(JSON.stringify({
        type: 'desktop-browser',
        action: 'console',
        data: consoleMessage
      }));
    }
  }, [webSocket, wsStatus]);

  // Handle browser status changes
  const handleStatusChange = useCallback((status: BrowserStatus) => {
    setBrowserStatus(status);

    // Send status updates to the server via WebSocket
    if (webSocket && wsStatus === 'connected') {
      webSocket.send(JSON.stringify({
        type: 'desktop-browser',
        action: 'status',
        data: { status }
      }));
    }
  }, [webSocket, wsStatus]);

  // Helper function to send action response
  const sendActionResponse = useCallback((id: string, success: boolean, result?: any, error?: string) => {
    if (webSocket && wsStatus === 'connected') {
      webSocket.send(JSON.stringify({
        type: 'desktop-browser',
        action: 'action-response',
        id,
        data: {
          success,
          ...(success ? { result } : { error })
        }
      }));
    }
  }, [webSocket, wsStatus]);

  // Helper function to handle actions with common error handling
  const handleAction = useCallback(async (id: string, actionName: string, actionFn: () => Promise<void>, takeScreenshotAfter = false) => {
    try {
      await actionFn();

      // Take screenshot after action if requested
      if (takeScreenshotAfter) {
        const screenshot = await window.electronAPI.takeScreenshot();
        if (screenshot) handleScreenshotUpdate(screenshot);
      }

      // Send success response
      sendActionResponse(id, true, `${actionName} performed successfully`);
    } catch (error: any) {
      console.error(`${actionName} error:`, error);
      sendActionResponse(id, false, undefined, error.message || `Failed to perform ${actionName.toLowerCase()}`);
    }
  }, [handleScreenshotUpdate, sendActionResponse]);

  // Listen for computer action commands from the server
  useEffect(() => {
    if (!webSocket || wsStatus !== 'connected') return;

    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        console.log('Received message:', data);
        // Handle computer action commands from the server
        if (data.type === 'computer-action' && data.action) {
          // Process the action based on its type
          switch (data.action) {
            case 'click':
              await handleAction(data.id, 'Click', async () => {
                await window.electronAPI.click(
                  data.params.x,
                  data.params.y,
                  data.params.button || 'left'
                );
              }, true);
              break;

            case 'doubleClick':
              await handleAction(data.id, 'Double-click', async () => {
                await window.electronAPI.doubleClick(
                  data.params.x,
                  data.params.y
                );
              }, true);
              break;

            case 'move':
              await handleAction(data.id, 'Move', async () => {
                await window.electronAPI.move(
                  data.params.x,
                  data.params.y
                );
              }, false);
              break;

            case 'drag':
              await handleAction(data.id, 'Drag', async () => {
                await window.electronAPI.drag(data.params.path);
              }, true);
              break;

            case 'scroll':
              await handleAction(data.id, 'Scroll', async () => {
                await window.electronAPI.scroll(
                  data.params.x,
                  data.params.y,
                  data.params.scrollX,
                  data.params.scrollY
                );
              }, true);
              break;

            case 'keypress':
              await handleAction(data.id, 'Keypress', async () => {
                await window.electronAPI.keypress(data.params.keys);
              }, true);
              break;

            case 'type':
              await handleAction(data.id, 'Type', async () => {
                await window.electronAPI.type(data.params.text);
              }, true);
              break;

            case 'wait':
              await handleAction(data.id, 'Wait', async () => {
                await window.electronAPI.wait(data.params.ms);
              }, false);
              break;

            case 'navigate':
              await handleAction(data.id, 'Navigation', async () => {
                await window.electronAPI.navigate(data.params.url);
                // URL and screenshot will be updated via events
              }, false);
              break;

            case 'back':
              await handleAction(data.id, 'Back navigation', async () => {
                await window.electronAPI.goBack();
                // URL and screenshot will be updated via events
              }, false);
              break;

            case 'forward':
              await handleAction(data.id, 'Forward navigation', async () => {
                await window.electronAPI.goForward();
                // URL and screenshot will be updated via events
              }, false);
              break;

            case 'getCurrentUrl':
              await handleAction(data.id, 'Get current URL', async () => {
                const url = await window.electronAPI.getCurrentUrl();
                // Send the URL update
                if (webSocket && wsStatus === 'connected') {
                  webSocket.send(JSON.stringify({
                    type: 'desktop-browser',
                    action: 'url',
                    data: { url }
                  }));
                }
              }, false);
              break;

            case 'takeScreenshot':
              console.log('Taking screenshot...');
              await handleAction(data.id, 'Screenshot', async () => {
                const actionScreenshot = await window.electronAPI.takeScreenshot();
                if (actionScreenshot) {
                  handleScreenshotUpdate(actionScreenshot);
                } else {
                  throw new Error('Failed to take screenshot');
                }
              }, false);
              break;

            default:
              console.warn(`Unknown action: ${data.action}`);
              if (data.id) {
                sendActionResponse(data.id, false, undefined, `Unknown action: ${data.action}`);
              }
              break;
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    webSocket.addEventListener('message', handleMessage);

    return () => {
      webSocket.removeEventListener('message', handleMessage);
    };
  }, [webSocket, wsStatus, handleAction, sendActionResponse, handleScreenshotUpdate]);

  // Initialize the desktop browser when the component mounts
  useEffect(() => {
    // Check if the browser is already initialized
    if (browserStatus === 'closed') {
      // Initialize the browser
      window.electronAPI.initBrowser()
        .then(() => {
          console.log('Browser initialized');
          // Set initial status
          handleStatusChange('ready');
        })
        .catch((error: any) => {
          console.error('Error initializing browser:', error);
          handleStatusChange('error');
        });
    }

    // Clean up when the component unmounts
    return () => {
      // Note: We don't need to explicitly close the browser
      // The browser will be closed when the component unmounts
      // or when the app is closed
      console.log('DesktopBrowserBridge component unmounting');
    };
  }, [browserStatus, handleStatusChange]);

  // Take screenshot
  const takeScreenshot = useCallback(async () => {
    try {
      const base64Image = await window.electronAPI.takeScreenshot();
      if (base64Image) {
        handleScreenshotUpdate(base64Image);
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }, [handleScreenshotUpdate]);

  // Browser interaction methods
  const initBrowser = useCallback(async () => {
    try {
      setBrowserStatus('initializing');
      
      const success = await window.electronAPI.initBrowser();
      
      if (success) {
        setBrowserStatus('ready');
        
        // Get the current URL
        const url = await window.electronAPI.getCurrentUrl();
        if (url) {
          setCurrentUrl(url);
        }
        
        // Take a screenshot
        await takeScreenshot();
      } else {
        setBrowserStatus('error');
      }
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      setBrowserStatus('error');
    }
  }, [takeScreenshot]);

  // Navigate to URL
  const navigate = useCallback(async (url: string) => {
    try {
      setIsNavigating(true);
      
      await window.electronAPI.navigate(url);
      
      // Update the current URL
      const newUrl = await window.electronAPI.getCurrentUrl();
      if (newUrl) {
        setCurrentUrl(newUrl);
      }
      
      // Take a screenshot after navigation
      await takeScreenshot();
      
      setIsNavigating(false);
    } catch (error) {
      console.error('Failed to navigate:', error);
      setIsNavigating(false);
    }
  }, [takeScreenshot]);

  // Go back
  const goBack = useCallback(async () => {
    try {
      setIsNavigating(true);
      await window.electronAPI.goBack();
      
      // Update the current URL
      const newUrl = await window.electronAPI.getCurrentUrl();
      if (newUrl) {
        setCurrentUrl(newUrl);
      }
      
      // Take a screenshot after navigation
      await takeScreenshot();
      
      setIsNavigating(false);
    } catch (error) {
      console.error('Failed to go back:', error);
      setIsNavigating(false);
    }
  }, [takeScreenshot]);

  // Go forward
  const goForward = useCallback(async () => {
    try {
      setIsNavigating(true);
      await window.electronAPI.goForward();
      
      // Update the current URL
      const newUrl = await window.electronAPI.getCurrentUrl();
      if (newUrl) {
        setCurrentUrl(newUrl);
      }
      
      // Take a screenshot after navigation
      await takeScreenshot();
      
      setIsNavigating(false);
    } catch (error) {
      console.error('Failed to go forward:', error);
      setIsNavigating(false);
    }
  }, [takeScreenshot]);

  // Set up event listeners
  useEffect(() => {
    if (browserStatus === 'ready') {
      // Listen for screenshot updates
      window.electronAPI.onScreenshot((data) => {
        if (data && data.image) {
          handleScreenshotUpdate(data.image);
        }
      });
      
      // Listen for console messages
      window.electronAPI.onConsole((data) => {
        if (data) {
          handleConsoleMessage(data);
        }
      });
    }
  }, [browserStatus, handleScreenshotUpdate, handleConsoleMessage]);

  // Render the desktop browser component
  return (
    <div className="desktop-browser-bridge">
      <DesktopBrowser
        status={browserStatus}
        screenshot={lastScreenshotRef.current}
        currentUrl={currentUrl}
        isNavigating={isNavigating}
        onInitBrowser={initBrowser}
        onNavigate={navigate}
        onGoBack={goBack}
        onGoForward={goForward}
        onTakeScreenshot={takeScreenshot}
      />
    </div>
  );
};

export default DesktopBrowserBridge;
