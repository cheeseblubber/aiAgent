import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserWebSocket } from '../api'
import { useConversation } from '../context/ConversationContext'

interface BrowserState {
  url?: string
  title?: string
  isLoading: boolean
}

export default function BrowserConnections() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [browserState, setBrowserState] = useState<BrowserState>({
    isLoading: true
  })
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const { conversationId, isLoading: isConversationLoading } = useConversation()

  const updateCanvas = useCallback((imageData: string) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
    }
    img.src = `data:image/jpeg;base64,${imageData}`
  }, [])

  useEffect(() => {
    if (isConversationLoading || !conversationId) return;
    
    const ws = createBrowserWebSocket(conversationId)

    ws.onopen = () => {
      setWsStatus('connected')
      setBrowserState(prev => ({ ...prev, isLoading: true }))
    }

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      
      if (update.type === 'screenshot') {
        updateCanvas(update.data.image)
        setBrowserState(prev => ({ ...prev, isLoading: false }))
      } else if (update.type === 'page') {
        setBrowserState(prev => ({
          ...prev,
          url: update.data.url,
          title: update.data.title,
          isLoading: true
        }))
      }
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
    }

    return () => {
      ws.close()
    }
  }, [updateCanvas, conversationId, isConversationLoading])



  return (
    <div className="h-full p-6 flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Browser Preview</h2>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-green-500' :
            wsStatus === 'connecting' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600 capitalize">{wsStatus}</span>
        </div>
      </div>

      {browserState.url && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="font-medium text-gray-800 truncate">{browserState.title || 'Untitled'}</p>
          <p className="text-sm text-gray-600 truncate">{browserState.url}</p>
        </div>
      )}
      
      <div className="flex-1 relative rounded-lg border border-gray-200 bg-white overflow-hidden">
        {browserState.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-900 border-t-transparent"></div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
        />
      </div>
    </div>
  )
}
