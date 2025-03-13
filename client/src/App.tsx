import ChatComponent from './components/Chat'

function PlaceholderComponent() {
  return (
    <div className="p-5 text-center text-gray-600">
      <h2 className="mb-2.5 text-gray-800">Content Area</h2>
      <p>This is a placeholder for future content.</p>
    </div>
  )
}

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="flex-none w-2/5 border-r border-gray-200 bg-gray-50">
        <ChatComponent />
      </div>
      <div className="flex-1 p-5 bg-white">
        <PlaceholderComponent />
      </div>
    </div>
  )
}

export default App
