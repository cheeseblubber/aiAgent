const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_BASE = API_BASE.replace(/^http/, 'ws')

export const API_ENDPOINTS = {
  chat: `${API_BASE}/chat`,
  browserWs: `${WS_BASE}/browser`,
} as const

// Generate a large random number for conversation ID
export const generateConversationId = (): string => {
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString()
}

// HTTP API functions
interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const sendChatMessage = async (message: string, conversationId: string): Promise<ChatResponse> => {
  const response = await fetch(API_ENDPOINTS.chat, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Conversation-Id': conversationId,
    },
    body: JSON.stringify({ message }),
  })

  const data = await response.json()

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to send message')
  }

  return data
}

// WebSocket API functions
export const createWebSocket = (url: string, conversationId: string): WebSocket => {
  const wsUrl = new URL(url)
  wsUrl.searchParams.append('conversationId', conversationId)
  const ws = new WebSocket(wsUrl)
  return ws
}

export const createBrowserWebSocket = (conversationId: string): WebSocket => {
  return createWebSocket(API_ENDPOINTS.browserWs, conversationId)
}
