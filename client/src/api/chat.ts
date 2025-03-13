const API_URL = import.meta.env.VITE_API_URL

export const sendChatMessage = async (message: string): Promise<Response> => {
  const response = await fetch(`${API_URL}/chat`, {
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
