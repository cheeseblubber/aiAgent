import { useEffect, useState } from 'react'
import { createBrowserWebSocket } from '../api'

interface BrowserConnection {
  id: string
  url: string
  timestamp: string
}

export default function BrowserConnections() {
  const [connections, setConnections] = useState<BrowserConnection[]>([])
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  useEffect(() => {
    const ws = createBrowserWebSocket()

    ws.onopen = () => {
      setWsStatus('connected')
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setConnections(data)
    }

    ws.onclose = () => {
      setWsStatus('disconnected')
    }

    return () => {
      ws.close()
    }
  }, [])

  return (
    <div className="h-full p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Browser Connections</h2>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            wsStatus === 'connected' ? 'bg-green-500' :
            wsStatus === 'connecting' ? 'bg-yellow-500' :
            'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600 capitalize">{wsStatus}</span>
        </div>
      </div>
      
      <div className="space-y-4">
        {connections.length === 0 ? (
          <div className="rounded-lg border border-gray-200 p-4 text-center text-gray-500">
            No active browser connections
          </div>
        ) : (
          connections.map((connection) => (
            <div
              key={connection.id}
              className="rounded-lg border border-gray-200 p-4 hover:border-gray-300"
            >
              <div className="flex items-center justify-between">
                <div className="truncate">
                  <p className="font-medium text-gray-800">{connection.url}</p>
                  <p className="text-sm text-gray-500">ID: {connection.id}</p>
                </div>
                <time className="text-sm text-gray-500">
                  {new Date(connection.timestamp).toLocaleTimeString()}
                </time>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
