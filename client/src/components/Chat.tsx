import { useState, useEffect, useRef } from 'react'
import { sendChatMessage } from '../api'
import { useConversation } from '../context/ConversationContext'
import { XCircleIcon } from '@heroicons/react/24/solid'
import { Button } from "@/components/ui/button"

interface Message {
  content: string
  sender: 'user' | 'ai'
  id?: string // Add an optional ID for deduplication
}

function ChatComponent() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const processedMessages = useRef<Set<string>>(new Set()) // Track processed message contents
  const { 
    conversationId, 
    isLoading, 
    webSocket, 
    isAgentRunning, 
    setIsAgentRunning, 
    interruptAgent 
  } = useConversation()

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
          const { content, sender, messageType } = data.data

          // Update agent running state based on message type
          if (messageType) {
            switch (messageType) {
              case 'complete':
              case 'interrupted':
              case 'error':
                // These message types indicate the agent is no longer running
                setIsAgentRunning(false)
                break
              case 'action':
              case 'thinking':
                // These message types indicate the agent is still running
                // No need to change state as it should already be set to running
                break
              default:
                // For backward compatibility or unknown types
                // Fall back to the old behavior
                if (content === 'Agent execution was interrupted.' || 
                    (sender === 'ai' && content.includes('interrupted'))) {
                  setIsAgentRunning(false)
                }
                break
            }
          } else {
            // Fallback for messages without a type (backward compatibility)
            if (content === 'Agent execution was interrupted.' || 
                (sender === 'ai' && content.includes('interrupted'))) {
              setIsAgentRunning(false)
            } else if (sender === 'ai' && !content.includes('interrupted')) {
              // Set agent as no longer running when we receive a normal AI message
              // This assumes the agent sends a final message when it completes
              setIsAgentRunning(false)
            }
          }

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
      // Set agent as running before sending the message
      setIsAgentRunning(true)
      
      // Send the message with conversation ID
      await sendChatMessage(input, conversationId)
      
      // Note: We'll set isAgentRunning to false when we receive the final message
      // from the agent via WebSocket, or when the agent is interrupted
    } catch (error) {
      console.error('Error sending message:', error)
      // Reset agent running state on error
      setIsAgentRunning(false)
      
      const errorMessageId = `error-${Date.now()}`
      const errorMessage = {
        content: 'Sorry, something went wrong. Please try again.',
        sender: 'ai' as const,
        id: errorMessageId
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }
  
  // Handle agent interruption
  const handleInterrupt = async () => {
    if (!isAgentRunning) return
    
    try {
      await interruptAgent()
      // We'll wait for the WebSocket message to update the UI
    } catch (error) {
      console.error('Error interrupting agent:', error)
      setIsAgentRunning(false) // Force reset the state if there's an error
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
      <form onSubmit={handleSubmit} className="flex p-5 gap-2.5 bg-white border-t border-gray-200 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isAgentRunning}
          className="flex-1 p-2.5 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isAgentRunning ? (
          <Button
            type="button"
            onClick={handleInterrupt}
            variant="destructive"
            className="flex items-center gap-2 h-10"
          >
            <XCircleIcon className="h-5 w-5" />
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            variant="default"
            className="h-10"
          >
            Send
          </Button>
        )}
      </form>
    </div>
  )
}

export default ChatComponent
