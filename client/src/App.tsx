import ChatComponent from './components/Chat'
import BrowserConnections from './components/BrowserConnections'

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="flex-none w-2/5 border-r border-gray-200 bg-gray-50">
        <ChatComponent />
      </div>
      <div className="flex-1 bg-white">
        <BrowserConnections />
      </div>
    </div>
  )
}

export default App
