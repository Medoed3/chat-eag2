// frontend/src/pages/ChatPage.tsx - С ДОБАВЛЕНИЕМ MOBILEHEADER
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatList from '../components/ChatList';
import MessageList from '../components/MessageList';
import MessageInput from '../components/MessageInput';
import LoadingScreen from '../components/LoadingScreen';
import MobileHeader from '../components/MobileHeader'; // Добавили импорт
import { useMessageSync } from '../hooks/useMessageSync';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { Chat, User, Message } from '../types';
import { messageSyncService } from '../services/messageSync';

const ChatPage: React.FC = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [chatAccess, setChatAccess] = useState<{
    has_access: boolean;
    is_member: boolean;
    is_active: boolean;
  } | null>(null);

  const numericChatId = chatId ? parseInt(chatId, 10) : 0;

  // Получаем текущего пользователя
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/api/me');
        setCurrentUser(response.data);
      } catch (error) {
        console.error('Error fetching current user:', error);
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUser();
  }, [navigate]);

  // Проверяем доступ к чату
  useEffect(() => {
    const checkChatAccess = async () => {
      if (!numericChatId || !currentUser) {
        setChatAccess(null);
        return;
      }

      try {
        const response = await api.get(`/api/chats/${numericChatId}/access`);
        setChatAccess(response.data);
      } catch (error) {
        console.error('Error checking chat access:', error);
        setChatAccess({
          has_access: false,
          is_member: false,
          is_active: false
        });
      }
    };

    if (numericChatId && currentUser) {
      checkChatAccess();
    }
  }, [numericChatId, currentUser]);

  // Используем сервис синхронизации сообщений
  const {
    messages: syncedMessages,
    sync,
    sendMessage: syncSendMessage,
    isSyncing,
    queueStats,
    processQueue,
    clearMessages
  } = useMessageSync({
    chatId: numericChatId,
    autoSync: true,
    syncInterval: 30000,
    onNewMessages: () => {}
  });

  // Очистка сообщений при смене чата
  useEffect(() => {
    if (numericChatId && syncedMessages.length > 0) {
      clearMessages();
    }
  }, [numericChatId, clearMessages]);

  // WebSocket для уведомлений
  const { isConnected, reconnect } = useWebSocket({
    chatId: numericChatId,
    autoConnect: true,
    reconnectAttempts: 10,
    reconnectDelay: 1000,
    onMessage: () => {
      if (numericChatId) {
        sync(undefined, true);
      }
    },
    onConnectionChange: (connected) => {
      if (connected && numericChatId) {
        sync();
      }
    }
  });

  // Обработчик выбора чата
  const handleSelectChat = useCallback((chat: Chat) => {
    navigate(`/chat/${chat.id}`);
  }, [navigate]);

  // Обработчик отправки сообщения
  const handleSendMessage = useCallback(async (content: string, file?: File) => {
    if (!currentUser || !numericChatId) return;

    try {
      let fileUrl: string | undefined;
      let fileType: string | undefined;

      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const fileResponse = await api.post('/api/media/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });

        fileUrl = fileResponse.data.url;
        fileType = fileResponse.data.type;
      }

      await syncSendMessage(content, fileUrl, fileType);

    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      throw error;
    }
  }, [currentUser, numericChatId, syncSendMessage]);

  // Загрузка предыдущих сообщений
  const handleLoadMoreMessages = useCallback(async () => {
    if (!numericChatId || !hasMoreMessages) return;

    try {
      const response = await api.get<Message[]>(`/api/chats/${numericChatId}/messages`, {
        params: {
          limit: 50,
          before: new Date().toISOString()
        }
      });

      if (response.data.length < 50) {
        setHasMoreMessages(false);
      }

    } catch (error) {
      console.error('Error loading more messages:', error);
    }
  }, [numericChatId, hasMoreMessages]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Если нет выбранного чата - показываем список чатов с MobileHeader
  if (!numericChatId) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        {/* MobileHeader вместо старого хедера */}
        <MobileHeader title="Чаты" />

        <div className="flex-1 overflow-hidden">
          <ChatList
            onSelectChat={handleSelectChat}
            currentChatId={null}
            currentUser={currentUser}
          />
        </div>
      </div>
    );
  }

  // Если нет доступа к чату - показываем сообщение с MobileHeader
  if (chatAccess && !chatAccess.has_access) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        <MobileHeader
          title="Доступ запрещен"
          showBackButton={true} // Добавляем кнопку назад
        />

        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center p-8 max-w-md bg-white rounded-xl shadow-sm">
            <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold mb-4">Доступ запрещен</h2>
            <p className="text-gray-600 mb-6">
              У вас нет доступа к этому чату. Возможно, вы не являетесь участником или чат был удален.
            </p>
            <button
              onClick={() => navigate('/chat')}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Вернуться к списку чатов
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Если есть выбранный чат и есть доступ - показываем переписку с MobileHeader
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* MobileHeader вместо старого хедера */}
      <MobileHeader
        title={`Чат ${chatId}`}
        showBackButton={true}
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Список чатов - скрыт на мобильных устройствах когда выбран чат */}
        <div className={`
          ${numericChatId ? 'hidden lg:flex' : 'flex'}
          w-full lg:w-80 flex-col border-r bg-white
        `}>
          <ChatList
            onSelectChat={handleSelectChat}
            currentChatId={numericChatId}
            currentUser={currentUser}
          />
        </div>

        {/* Область сообщений */}
        <div className={`
          flex-1 flex-col
          ${numericChatId ? 'flex' : 'hidden lg:flex'}
        `}>
          <div className="flex-1 overflow-hidden">
            <MessageList
              chatId={numericChatId}
              currentUserId={currentUser?.id || 0}
              messages={syncedMessages}
              onLoadMore={handleLoadMoreMessages}
              hasMore={hasMoreMessages}
              isLoading={isSyncing}
            />
          </div>

          <MessageInput
            chatId={numericChatId}
            currentUserId={currentUser?.id || 0}
            onSendMessage={handleSendMessage}
            disabled={!chatAccess?.is_active}
          />

          {queueStats && queueStats.total > 0 && (
            <div className="px-4 py-2 bg-yellow-50 border-t flex justify-between items-center">
              <span className="text-sm text-yellow-800">
                {queueStats.pending > 0 && `⏳ ${queueStats.pending} в очереди`}
                {queueStats.failed > 0 && ` ⚠️ ${queueStats.failed} не отправлено`}
              </span>
              <button
                onClick={processQueue}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Повторить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;