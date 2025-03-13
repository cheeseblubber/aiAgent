const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_BASE = API_BASE.replace(/^http/, 'ws')

export const API_ENDPOINTS = {
  chat: `${API_BASE}/chat`,
  browserWs: `${WS_BASE}/browser`,
} as const

// HTTP API functions
export const sendChatMessage = async (message: string): Promise<Response> => {
  const response = await fetch(API_ENDPOINTS.chat, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    throw new Error('Failed to send message')
  }

  return response
}

// WebSocket API functions
export const createWebSocket = (url: string): WebSocket => {
  const ws = new WebSocket(url)
  return ws
}

export const createBrowserWebSocket = (): WebSocket => {
  console.log(API_ENDPOINTS.browserWs)
  return createWebSocket(API_ENDPOINTS.browserWs)
}
