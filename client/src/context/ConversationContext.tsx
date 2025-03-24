import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchConversationId } from '../api';
import LoadingIndicator from '../components/LoadingIndicator';

interface ConversationContextType {
  conversationId: string;
  isLoading: boolean;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

interface ConversationProviderProps {
  children: ReactNode;
}

export function ConversationProvider({ children }: ConversationProviderProps) {
  const [conversationId, setConversationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchOrCreateConversationId = async () => {
      try {
        // Fetch conversation ID from the API
        const id = await fetchConversationId();
        setConversationId(id);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching conversation ID:', error);
        setIsLoading(false);
      }
    };

    fetchOrCreateConversationId();
  }, []);

  if (isLoading) {
    return <LoadingIndicator message="Initializing conversation..." />;
  }

  return (
    <ConversationContext.Provider value={{ conversationId, isLoading }}>
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
