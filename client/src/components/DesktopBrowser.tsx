import React, { useEffect, useState, useCallback } from 'react';

type BrowserStatus = 'initializing' | 'ready' | 'closed' | 'error';

interface BrowserConsoleMessage {
  type: string;
  text: string;
}

interface DesktopBrowserProps {
  onScreenshotUpdate?: (screenshot: string) => void;
  onConsoleMessage?: (message: BrowserConsoleMessage) => void;
  onStatusChange?: (status: BrowserStatus) => void;
}

const DesktopBrowser: React.FC<DesktopBrowserProps> = ({
  onScreenshotUpdate,
  onConsoleMessage,
  onStatusChange,
}) => {
  const [status, setStatus] = useState<BrowserStatus>('closed');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [urlInput, setUrlInput] = useState<string>('');

  // Initialize browser
  const initBrowser = useCallback(async () => {
    try {
      setStatus('initializing');
      if (onStatusChange) onStatusChange('initializing');
      
      const success = await window.electronAPI.initBrowser();
      
      if (success) {
        setStatus('ready');
        if (onStatusChange) onStatusChange('ready');
        
        // Get the current URL
        const url = await window.electronAPI.getCurrentUrl();
        if (url) {
          setCurrentUrl(url);
          setUrlInput(url);
        }
        
        // Take a screenshot
        await takeScreenshot();
      } else {
        setStatus('error');
        if (onStatusChange) onStatusChange('error');
      }
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      setStatus('error');
      if (onStatusChange) onStatusChange('error');
    }
  }, [onStatusChange]);

  // Take screenshot
  const takeScreenshot = useCallback(async () => {
    try {
      const base64Image = await window.electronAPI.takeScreenshot();
      if (base64Image) {
        setScreenshot(base64Image);
        if (onScreenshotUpdate) onScreenshotUpdate(base64Image);
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }, [onScreenshotUpdate]);

  // Navigate to URL
  const navigate = useCallback(async (url: string) => {
    try {
      setIsNavigating(true);
      
      // Add http:// prefix if missing
      let navigateUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        navigateUrl = `https://${url}`;
      }
      
      await window.electronAPI.navigate(navigateUrl);
      
      // Update the current URL
      const newUrl = await window.electronAPI.getCurrentUrl();
      if (newUrl) {
        setCurrentUrl(newUrl);
        setUrlInput(newUrl);
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
        setUrlInput(newUrl);
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
        setUrlInput(newUrl);
      }
      
      // Take a screenshot after navigation
      await takeScreenshot();
      
      setIsNavigating(false);
    } catch (error) {
      console.error('Failed to go forward:', error);
      setIsNavigating(false);
    }
  }, [takeScreenshot]);

  // Handle URL input change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
  };

  // Handle URL form submission
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      navigate(urlInput);
    }
  };

  // Set up event listeners
  useEffect(() => {
    if (status === 'ready') {
      // Listen for screenshot updates
      window.electronAPI.onScreenshot((data) => {
        if (data && data.image) {
          setScreenshot(data.image);
          if (onScreenshotUpdate) onScreenshotUpdate(data.image);
        }
      });
      
      // Listen for console messages
      window.electronAPI.onConsole((data) => {
        if (data && onConsoleMessage) {
          onConsoleMessage(data);
        }
      });
    }
  }, [status, onScreenshotUpdate, onConsoleMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* Browser controls */}
      <div className="flex items-center p-2 bg-gray-100 border-b">
        <button
          onClick={goBack}
          disabled={status !== 'ready' || isNavigating}
          className="p-1 mr-1 rounded hover:bg-gray-200 disabled:opacity-50"
          aria-label="Go back"
        >
          ←
        </button>
        <button
          onClick={goForward}
          disabled={status !== 'ready' || isNavigating}
          className="p-1 mr-2 rounded hover:bg-gray-200 disabled:opacity-50"
          aria-label="Go forward"
        >
          →
        </button>
        
        <form onSubmit={handleUrlSubmit} className="flex-1 flex">
          <input
            type="text"
            value={urlInput}
            onChange={handleUrlChange}
            disabled={status !== 'ready' || isNavigating}
            className="flex-1 px-2 py-1 border rounded"
            placeholder="Enter URL"
          />
          <button
            type="submit"
            disabled={status !== 'ready' || isNavigating}
            className="ml-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Go
          </button>
        </form>
        
        <button
          onClick={takeScreenshot}
          disabled={status !== 'ready' || isNavigating}
          className="ml-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
          aria-label="Refresh"
        >
          ↻
        </button>
      </div>
      
      {/* Browser content */}
      <div className="flex-1 relative overflow-hidden">
        {status === 'closed' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <button
              onClick={initBrowser}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Open Browser
            </button>
          </div>
        )}
        
        {status === 'initializing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <p>Initializing browser...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
            <p className="text-red-500 mb-2">Failed to initialize browser</p>
            <button
              onClick={initBrowser}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        )}
        
        {status === 'ready' && screenshot && (
          <div className="h-full w-full overflow-auto">
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Browser screenshot"
              className="w-full"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DesktopBrowser;
