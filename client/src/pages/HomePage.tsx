import ChatComponent from '../components/Chat'
import BrowserConnections from '../components/BrowserConnections'
import DesktopBrowserBridge from '../components/DesktopBrowserBridge'
import { useEffect, useState } from 'react'

const HomePage = () => {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    setIsElectron('electronAPI' in window);
  }, []);

  return (
    <div className="flex h-full w-full">
      <div className="flex-none w-2/5 border-r border-gray-200 bg-gray-50 overflow-hidden">
        <ChatComponent />
      </div>
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {isElectron ? (
            <DesktopBrowserBridge />
          ) : (
            <BrowserConnections />
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;
