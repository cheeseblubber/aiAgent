const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_BASE = API_BASE.replace(/^http/, 'ws')

export const API_ENDPOINTS = {
  chat: `${API_BASE}/chat`,
  browserWs: `${WS_BASE}/browser`,
  conversation: `${API_BASE}/conversation`,
  liveView: (conversationId: string) => `${API_BASE}/conversation/${conversationId}/liveview`,
  interrupt: (conversationId: string) => `${API_BASE}/interrupt/${conversationId}`,
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

export const fetchConversationId = async (): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.conversation, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch conversation ID');
    }

    const data = await response.json();
    return data.conversationId;
  } catch (error) {
    console.error('Error fetching conversation ID:', error);
    // Fallback to generating a local ID if the API call fails
    return generateConversationId();
  }
};

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

// Function to interrupt an agent for a specific conversation
export const interruptAgent = async (conversationId: string): Promise<ChatResponse> => {
  try {
    const response = await fetch(API_ENDPOINTS.interrupt(conversationId), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'interrupt' }), // Add a body to the request
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to interrupt agent')
    }

    return data
  } catch (error) {
    console.error('Error interrupting agent:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Interface for the live view link response
interface LiveViewResponse {
  success: boolean;
  liveViewLink?: string;
  error?: string;
}

// Function to fetch the BrowserBase live view link for a conversation
export const fetchLiveViewLink = async (conversationId: string): Promise<LiveViewResponse> => {
  try {
    const response = await fetch(API_ENDPOINTS.liveView(conversationId), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to fetch live view link')
    }

    return data
  } catch (error) {
    console.error('Error fetching live view link:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
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
