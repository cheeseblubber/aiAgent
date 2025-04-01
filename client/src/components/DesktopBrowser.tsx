import React, { useEffect, useState } from 'react';

type BrowserStatus = 'initializing' | 'ready' | 'closed' | 'error';

interface DesktopBrowserProps {
  status: BrowserStatus;
  screenshot: string | null;
  currentUrl: string;
  isNavigating: boolean;
  onInitBrowser: () => void;
  onNavigate: (url: string) => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onTakeScreenshot: () => void;
}

const DesktopBrowser: React.FC<DesktopBrowserProps> = ({
  status,
  screenshot,
  currentUrl,
  isNavigating,
  onInitBrowser,
  onNavigate,
  onGoBack,
  onGoForward,
  onTakeScreenshot,
}) => {
  const [urlInput, setUrlInput] = useState<string>(currentUrl || '');

  // Update URL input when currentUrl changes
  useEffect(() => {
    setUrlInput(currentUrl || '');
  }, [currentUrl]);

  // Handle URL input change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInput(e.target.value);
  };

  // Handle URL form submission
  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      // Prepare URL (add https:// if missing)
      let navigateUrl = urlInput;
      if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://')) {
        navigateUrl = `https://${urlInput}`;
      }
      onNavigate(navigateUrl);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Browser controls */}
      <div className="flex items-center p-2 bg-gray-100 border-b">
        <button
          onClick={onGoBack}
          disabled={status !== 'ready' || isNavigating}
          className="p-1 mr-1 rounded hover:bg-gray-200 disabled:opacity-50"
          aria-label="Go back"
        >
          ←
        </button>
        <button
          onClick={onGoForward}
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
          onClick={onTakeScreenshot}
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
              onClick={onInitBrowser}
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
              onClick={onInitBrowser}
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
