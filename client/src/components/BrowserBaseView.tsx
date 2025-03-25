import { useEffect, useState } from 'react'
import { useConversation } from '../context/ConversationContext'
import { fetchLiveViewLink } from '../api'

export default function BrowserBaseView() {
  const [liveViewLink, setLiveViewLink] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { conversationId, isLoading: isConversationLoading } = useConversation()

  useEffect(() => {
    if (isConversationLoading || !conversationId) return

    const getLiveViewLink = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetchLiveViewLink(conversationId)
        
        if (response.success && response.liveViewLink) {
          setLiveViewLink(response.liveViewLink)
        } else {
          setError(response.error || 'Failed to get live view link')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    getLiveViewLink()
  }, [conversationId, isConversationLoading])

  return (
    <div className="h-full p-6 flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">BrowserBase Live View</h2>
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900 border-t-transparent"></div>
        )}
      </div>

      <div className="flex-1 relative rounded-lg border border-gray-200 bg-white overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center p-4">
              <p className="text-red-500 font-medium mb-2">Error</p>
              <p className="text-gray-700">{error}</p>
              <button 
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          </div>
        ) : liveViewLink ? (
          <iframe
            src={liveViewLink}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts"
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <p className="text-gray-500">No live view available</p>
          </div>
        )}
      </div>
    </div>
  )
}
