import { useState } from 'react'
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
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'preview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
              onClick={() => setActiveTab('preview')}
            >
              Browser Preview
            </button>
            <button
              className={`px-4 py-2 font-medium ${activeTab === 'liveview' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
              onClick={() => setActiveTab('liveview')}
            >
              Live View
            </button>
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
