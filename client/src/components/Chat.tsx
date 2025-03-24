import { useState, useEffect, useRef } from 'react'
import { sendChatMessage } from '../api'
import { useConversation } from '../context/ConversationContext'

interface Message {
  content: string
  sender: 'user' | 'ai'
  id?: string // Add an optional ID for deduplication
}

function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const processedMessages = useRef<Set<string>>(new Set()) // Track processed message contents
  const { conversationId, isLoading, webSocket } = useConversation()

  // Set up WebSocket message handler
  useEffect(() => {
    if (isLoading || !conversationId || !webSocket) return;
    
    console.log(`Chat component using shared WebSocket for conversation: ${conversationId}`);
    
    // Listen for messages from the server
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)

        // Handle chat messages
        if (data.type === 'chat') {
          const { content, sender } = data.data

          // Create a simple hash of the message to use for deduplication
          const messageHash = `${content}-${Date.now()}`

          // Only add the message if we haven't seen it in the last second
          // This prevents duplicates that arrive close together
          if (!processedMessages.current.has(content)) {
            processedMessages.current.add(content)

            // Add the message to the UI
            setMessages(prev => [...prev, { content, sender, id: messageHash }])

            // Remove from processed set after a delay to allow for future identical messages
            setTimeout(() => {
              processedMessages.current.delete(content)
            }, 1000)
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    };
    
    webSocket.addEventListener('message', handleMessage);

    // Clean up event listener on unmount
    return () => {
      webSocket.removeEventListener('message', handleMessage);
    };
  }, [conversationId, isLoading, webSocket])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    // Create a unique ID for the user message
    const userMessageId = `user-${Date.now()}`
    const userMessage = { content: input, sender: 'user' as const, id: userMessageId }
    setMessages([...messages, userMessage])
    setInput('')

    try {
      // Send the message with conversation ID
      await sendChatMessage(input, conversationId)
      // This prevents duplicate messages
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessageId = `error-${Date.now()}`
      const errorMessage = {
        content: 'Sorry, something went wrong. Please try again.',
        sender: 'ai' as const,
        id: errorMessageId
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2.5">
        {messages.map((msg, idx) => (
          <div
            key={msg.id || idx} /* Use the message id if available, otherwise fall back to index */
            className={`p-3 rounded-xl max-w-[80%] break-words ${msg.sender === 'user'
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
