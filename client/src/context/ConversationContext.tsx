import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { fetchConversationId, createBrowserWebSocket } from '../api';
import LoadingIndicator from '../components/LoadingIndicator';

interface ConversationContextType {
  conversationId: string;
  isLoading: boolean;
  webSocket: WebSocket | null;
  wsStatus: 'connecting' | 'connected' | 'disconnected';
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [conversationId, setConversationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch conversation ID
  useEffect(() => {
    const fetchOrCreateConversationId = async () => {
      try {
        // Fetch conversation ID from the API
        const id = await fetchConversationId();
        console.log(`Conversation ID fetched: ${id}`);
        setConversationId(id);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching conversation ID:', error);
        setIsLoading(false);
      }
    };

    fetchOrCreateConversationId();
  }, []);

  // Set up WebSocket connection when conversation ID is available
  useEffect(() => {
    if (!conversationId) return;

    // Clean up any existing connection
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      console.log('Closing existing WebSocket connection');
      wsRef.current.close();
    }

    console.log(`Creating shared WebSocket connection for conversation: ${conversationId}`);
    const ws = createBrowserWebSocket(conversationId);
    wsRef.current = ws;
    setWsStatus('connecting');

    ws.onopen = () => {
      console.log(`Shared WebSocket connected for conversation: ${conversationId}`);
      setWsStatus('connected');
    };

    ws.onclose = () => {
      console.log(`Shared WebSocket disconnected for conversation: ${conversationId}`);
      setWsStatus('disconnected');
    };

    ws.onerror = (error) => {
      console.error(`Shared WebSocket error for conversation: ${conversationId}`, error);
      setWsStatus('disconnected');
    };

    // Clean up function
    return () => {
      console.log(`Cleaning up shared WebSocket for conversation: ${conversationId}`);
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.close();
      }
    };
  }, [conversationId]);

  if (isLoading) {
    return <LoadingIndicator message="Initializing conversation..." />;
  }

  return (
    <ConversationContext.Provider value={{ 
      conversationId, 
      isLoading, 
      webSocket: wsRef.current,
      wsStatus
    }}>
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
}
