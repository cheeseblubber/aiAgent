import { useState } from 'react'
import { Button } from "@/components/ui/button"

import ChatComponent from './components/Chat'
import BrowserConnections from './components/BrowserConnections'
import BrowserBaseView from './components/BrowserBaseView'
import { ConversationProvider } from './context/ConversationContext'

function App() {
  const [activeTab, setActiveTab] = useState<'preview' | 'liveview'>('preview')

  return (
    <ConversationProvider>
      <div className="flex h-screen w-screen overflow-hidden">
        <div className="flex-none w-2/5 border-r border-gray-200 bg-gray-50">
          <ChatComponent />
        </div>
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex border-b border-gray-200">
            <Button
              variant={activeTab === 'preview' ? 'default' : 'ghost'}
              className={`rounded-none ${activeTab === 'preview' ? 'border-b-2 border-primary' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              Browser Preview
            </Button>
            <Button
              variant={activeTab === 'liveview' ? 'default' : 'ghost'}
              className={`rounded-none ${activeTab === 'liveview' ? 'border-b-2 border-primary' : ''}`}
              onClick={() => setActiveTab('liveview')}
            >
              Live View
            </Button>
          </div>
          <div className="flex-1">
            {activeTab === 'preview' ? (
              <BrowserConnections />
            ) : (
              <BrowserBaseView />
            )}
          </div>
        </div>
      </div>
    </ConversationProvider>
  )
}

export default App
