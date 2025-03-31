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
  const { webSocket, conversationId, wsStatus } = useConversation();
  // Track the current screenshot but don't need to display it directly
  // as it's passed to the parent component via callback
  const [_, setScreenshot] = useState<string | null>(null);
  const [browserStatus, setBrowserStatus] = useState<'initializing' | 'ready' | 'closed' | 'error'>('closed');
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

  // Listen for computer action commands from the server
  useEffect(() => {
    if (!webSocket) return;

    const handleMessage = async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        console.log('Received message:', data);
        // Handle computer action commands from the server
        if (data.type === 'computer-action' && data.action) {
          // Process the action based on its type
          switch (data.action) {
            case 'click':
              await window.electronAPI.click(
                data.params.x, 
                data.params.y, 
                data.params.button || 'left'
              );
              // Send updated screenshot after action
              const screenshot = await window.electronAPI.takeScreenshot();
              if (screenshot) handleScreenshotUpdate(screenshot);
              break;
              
            case 'doubleClick':
              await window.electronAPI.doubleClick(
                data.params.x, 
                data.params.y
              );
              // Send updated screenshot after action
              const dblClickScreenshot = await window.electronAPI.takeScreenshot();
              if (dblClickScreenshot) handleScreenshotUpdate(dblClickScreenshot);
              break;
              
            case 'move':
              await window.electronAPI.move(
                data.params.x, 
                data.params.y
              );
              break;
              
            case 'drag':
              await window.electronAPI.drag(data.params.path);
              // Send updated screenshot after action
              const dragScreenshot = await window.electronAPI.takeScreenshot();
              if (dragScreenshot) handleScreenshotUpdate(dragScreenshot);
              break;
              
            case 'scroll':
              await window.electronAPI.scroll(
                data.params.x, 
                data.params.y, 
                data.params.scrollX, 
                data.params.scrollY
              );
              // Send updated screenshot after action
              const scrollScreenshot = await window.electronAPI.takeScreenshot();
              if (scrollScreenshot) handleScreenshotUpdate(scrollScreenshot);
              break;
              
            case 'keypress':
              await window.electronAPI.keypress(data.params.keys);
              // Send updated screenshot after action
              const keypressScreenshot = await window.electronAPI.takeScreenshot();
              if (keypressScreenshot) handleScreenshotUpdate(keypressScreenshot);
              break;
              
            case 'type':
              await window.electronAPI.type(data.params.text);
              // Send updated screenshot after action
              const typeScreenshot = await window.electronAPI.takeScreenshot();
              if (typeScreenshot) handleScreenshotUpdate(typeScreenshot);
              break;
              
            case 'wait':
              await window.electronAPI.wait(data.params.ms);
              break;
              
            case 'navigate':
              await window.electronAPI.navigate(data.params.url);
              // URL and screenshot will be updated via events
              break;
              
            case 'back':
              await window.electronAPI.goBack();
              // URL and screenshot will be updated via events
              break;
              
            case 'forward':
              await window.electronAPI.goForward();
              // URL and screenshot will be updated via events
              break;
              
            case 'getCurrentUrl':
              const url = await window.electronAPI.getCurrentUrl();
              if (webSocket && wsStatus === 'connected') {
                webSocket.send(JSON.stringify({
                  type: 'desktop-browser',
                  action: 'url',
                  data: { url }
                }));
              }
              break;
              
            case 'takeScreenshot':
              console.log('Taking screenshot...')
              const actionScreenshot = await window.electronAPI.takeScreenshot();
              if (actionScreenshot) handleScreenshotUpdate(actionScreenshot);
              break;
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    };

    webSocket.addEventListener('message', handleMessage);
    
    // Send initial connection message
    if (wsStatus === 'connected') {
      webSocket.send(JSON.stringify({
        type: 'desktop-browser',
        action: 'connect',
        data: { conversationId }
      }));
    }

    return () => {
      webSocket.removeEventListener('message', handleMessage);
    };
  }, [webSocket, wsStatus, conversationId, handleScreenshotUpdate]);

  // Periodically send heartbeat with current state
  useEffect(() => {
    if (!webSocket || wsStatus !== 'connected') return;
    
    const intervalId = setInterval(async () => {
      // Only send if we have an active screenshot
      if (lastScreenshotRef.current && browserStatus === 'ready') {
        const url = await window.electronAPI.getCurrentUrl();
        webSocket.send(JSON.stringify({
          type: 'desktop-browser',
          action: 'heartbeat',
          data: { 
            status: browserStatus,
            url,
            // Don't send the screenshot on every heartbeat to reduce bandwidth
          }
        }));
      }
    }, 10000); // Every 10 seconds
    
    return () => clearInterval(intervalId);
  }, [webSocket, wsStatus, browserStatus]);

  return (
    <DesktopBrowser
      onScreenshotUpdate={handleScreenshotUpdate}
      onConsoleMessage={handleConsoleMessage}
      onStatusChange={handleStatusChange}
    />
  );
};

export default DesktopBrowserBridge;
