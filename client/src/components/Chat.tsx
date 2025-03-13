import { useState } from 'react'
import { sendChatMessage } from '../api/chat'

interface Message {
  content: string
  sender: 'user' | 'ai'
}

function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const newMessage = { content: input, sender: 'user' as const }
    setMessages([...messages, newMessage])
    setInput('')

    try {
      await sendChatMessage(input)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2.5">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-xl max-w-[80%] break-words ${
              msg.sender === 'user'
                ? 'self-end bg-blue-600 text-white'
                : 'self-start bg-gray-200 text-gray-900'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="flex p-5 gap-2.5 bg-white border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 p-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button 
          type="submit"
          className="px-5 py-2.5 bg-blue-500 text-white rounded-lg text-base cursor-pointer transition-colors hover:bg-blue-700"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default ChatComponent
