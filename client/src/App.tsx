

import ChatComponent from './components/Chat'
import BrowserConnections from './components/BrowserConnections'
import DesktopBrowser from './components/DesktopBrowser'
import DesktopBrowserBridge from './components/DesktopBrowserBridge'

import { ConversationProvider } from './context/ConversationContext'
import { useEffect, useState } from 'react'

function App() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running in Electron
    setIsElectron('electronAPI' in window);
  }, []);

  return (
    <ConversationProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <div className="flex-none w-2/5 border-r border-gray-200 bg-gray-50">
          <ChatComponent />
        </div>
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1">
            {isElectron ? (
              <>
                <DesktopBrowser />
                <DesktopBrowserBridge />
              </>
            ) : (
              <BrowserConnections />
            )}
          </div>
        </div>
      </div>
    </ConversationProvider>
  )
}

export default App
