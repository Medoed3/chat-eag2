// frontend/src/components/MessageList.tsx - ОБНОВЛЕННЫЙ для гарантированной доставки
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Message, DeliveryStatus } from '../types';
import Avatar from './ui/Avatar';
import { formatTime } from '../utils/formatTime';
import { useMessageSync } from '../hooks/useMessageSync';
import { useWebSocket } from '../hooks/useWebSocket';

interface MessageListProps {
  chatId: number;
  currentUserId: number;
  messages: Message[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  chatId,
  currentUserId,
  messages,
  onLoadMore,
  hasMore = false,
  isLoading = false
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [unreadMarker, setUnreadMarker] = useState<number | null>(null);

  // Используем сервис синхронизации
  const {
    sync,
    confirmDelivery,
    confirmRead,
    markAsRead,
    isSyncing,
    queueStats
  } = useMessageSync({
    chatId,
    autoSync: true,
    syncInterval: 30000,
    onNewMessages: (newMessages) => {
      // Автоматически помечаем как прочитанные сообщения, которые мы видим
      const unreadIds = newMessages
        .filter(msg => msg.sender_id !== currentUserId && msg.delivery_status !== DeliveryStatus.READ)
        .map(msg => msg.id);

      if (unreadIds.length > 0) {
        markAsRead(unreadIds, currentUserId);
      }
    }
  });

  // Используем WebSocket для уведомлений
  const { isConnected, sendTypingIndicator } = useWebSocket({
    chatId,
    autoConnect: true,
    onMessage: (message) => {
      // Новое сообщение уже обрабатывается через useMessageSync
    },
    onNotification: (notification) => {
      console.log('New message notification:', notification);
    }
  });

  // Прокрутка к последнему сообщению при добавлении новых
  useEffect(() => {
    if (isScrolledToBottom && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScrolledToBottom]);

  // Обработка прокрутки
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    setIsScrolledToBottom(isAtBottom);

    // Загрузка предыдущих сообщений при прокрутке вверх
    if (container.scrollTop < 100 && hasMore && !isLoading && onLoadMore) {
      onLoadMore();
    }

    // Определяем, какие сообщения видны для отметки как прочитанные
    if (isAtBottom) {
      const visibleMessages = getVisibleMessages();
      markVisibleMessagesAsRead(visibleMessages);
    }
  }, [hasMore, isLoading, onLoadMore, currentUserId]);

  // Получение видимых сообщений
  const getVisibleMessages = useCallback(() => {
    if (!messagesContainerRef.current) return [];

    const container = messagesContainerRef.current;
    const messageElements = container.querySelectorAll('[data-message-id]');
    const visibleMessages: number[] = [];

    messageElements.forEach(element => {
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Сообщение считается видимым, если оно в пределах контейнера
      if (
        rect.top >= containerRect.top &&
        rect.bottom <= containerRect.bottom
      ) {
        const messageId = parseInt(element.getAttribute('data-message-id') || '0', 10);
        if (messageId) {
          visibleMessages.push(messageId);
        }
      }
    });

    return visibleMessages;
  }, []);

  // Отметка видимых сообщений как прочитанных
  const markVisibleMessagesAsRead = useCallback((messageIds: number[]) => {
    const unreadMessages = messageIds.filter(id => {
      const message = messages.find(m => m.id === id);
      return message &&
             message.sender_id !== currentUserId &&
             message.delivery_status !== DeliveryStatus.READ;
    });

    if (unreadMessages.length > 0) {
      markAsRead(unreadMessages, currentUserId);
    }
  }, [messages, currentUserId, markAsRead]);

  // Ручная синхронизация
  const handleManualSync = useCallback(() => {
    sync();
  }, [sync]);

  // Обработка подтверждения доставки
  useEffect(() => {
    // Подтверждаем доставку для всех наших сообщений, которые еще не подтверждены
    const myMessages = messages.filter(
      msg => msg.sender_id === currentUserId &&
             msg.delivery_status === DeliveryStatus.DELIVERED &&
             !msg.delivered_at
    );

    myMessages.forEach(async (msg) => {
      await confirmDelivery(msg.id, currentUserId);
    });
  }, [messages, currentUserId, confirmDelivery]);

  // Отображение статуса доставки
  const renderDeliveryStatus = (message: Message) => {
    if (message.sender_id !== currentUserId) {
      return null;
    }

    switch (message.delivery_status) {
      case DeliveryStatus.SENDING:
        return (
          <div className="text-xs text-gray-500 mt-1">
            <span className="inline-flex items-center">
              <span className="animate-pulse mr-1">●</span>
              Отправляется...
            </span>
          </div>
        );

      case DeliveryStatus.PENDING:
        return (
          <div className="text-xs text-yellow-500 mt-1">
            <span className="inline-flex items-center">
              <span className="mr-1">●</span>
              Ожидает доставки
            </span>
          </div>
        );

      case DeliveryStatus.DELIVERED:
        return (
          <div className="text-xs text-blue-500 mt-1">
            <span className="inline-flex items-center">
              <span className="mr-1">✓</span>
              Доставлено
              {message.delivered_at && ` ${formatTime(new Date(message.delivered_at))}`}
            </span>
          </div>
        );

      case DeliveryStatus.READ:
        return (
          <div className="text-xs text-green-500 mt-1">
            <span className="inline-flex items-center">
              <span className="mr-1">✓✓</span>
              Прочитано
              {message.read_at && ` ${formatTime(new Date(message.read_at))}`}
            </span>
          </div>
        );

      case DeliveryStatus.FAILED:
        return (
          <div className="text-xs text-red-500 mt-1">
            <span className="inline-flex items-center">
              <span className="mr-1">✗</span>
              Ошибка доставки
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  // Группировка сообщений по датам
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach(message => {
      const date = new Date(message.timestamp).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="flex flex-col h-full">
      {/* Панель статуса */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-600">
            {isConnected ? 'В сети' : 'Не в сети'}
          </span>

          {queueStats.total > 0 && (
            <div className="ml-4 flex items-center space-x-2">
              {queueStats.pending > 0 && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                  {queueStats.pending} в очереди
                </span>
              )}
              {queueStats.failed > 0 && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  {queueStats.failed} не отправлено
                </span>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="text-sm text-blue-500 hover:text-blue-700 disabled:text-gray-400"
        >
          {isSyncing ? 'Синхронизация...' : 'Обновить'}
        </button>
      </div>

      {/* Список сообщений */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-lg mb-2">Нет сообщений</div>
            <div className="text-sm">Начните общение первым!</div>
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Дата */}
              <div className="flex justify-center my-4">
                <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {date}
                </div>
              </div>

              {/* Сообщения */}
              {dateMessages.map((message) => (
                <div
                  key={message.id}
                  data-message-id={message.id}
                  className={`flex mb-4 ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md rounded-lg p-3 ${message.sender_id === currentUserId
                        ? 'bg-blue-500 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                      }`}
                  >
                    {/* Заголовок сообщения */}
                    <div className="flex items-center mb-1">
                      {message.sender_id !== currentUserId && (
                        <Avatar
                          size="sm"
                          src={message.sender?.avatar_url}
                          name={message.sender?.full_name}
                          className="mr-2"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-medium ${message.sender_id === currentUserId ? 'text-blue-100' : 'text-gray-700'}`}>
                            {message.sender_id === currentUserId ? 'Вы' : message.sender?.full_name}
                          </span>
                          <span className={`text-xs ${message.sender_id === currentUserId ? 'text-blue-100' : 'text-gray-500'}`}>
                            {formatTime(new Date(message.timestamp))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Содержимое сообщения */}
                    <div className="mb-1">
                      {message.content && (
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      )}

                      {message.file_url && (
                        <div className="mt-2">
                          {message.file_type === 'image' ? (
                            <img
                              src={message.file_url}
                              alt="Прикрепленное изображение"
                              className="max-w-full rounded"
                              loading="lazy"
                            />
                          ) : message.file_type === 'video' ? (
                            <video
                              src={message.file_url}
                              controls
                              className="max-w-full rounded"
                            />
                          ) : (
                            <a
                              href={message.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-blue-400 hover:text-blue-300"
                            >
                              <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                              Документ
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Статус доставки */}
                    {renderDeliveryStatus(message)}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* Маркер для прокрутки к новым сообщениям */}
        {unreadMarker && (
          <div className="flex justify-center my-4">
            <div className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full">
              Новые сообщения
            </div>
          </div>
        )}

        {/* Элемент для автоматической прокрутки */}
        <div ref={messagesEndRef} />

        {/* Индикатор загрузки */}
        {isLoading && messages.length > 0 && (
          <div className="flex justify-center my-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
          </div>
        )}
      </div>

      {/* Индикатор непрочитанных сообщений */}
      {!isScrolledToBottom && (
        <button
          onClick={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setIsScrolledToBottom(true);
          }}
          className="fixed bottom-20 right-4 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default MessageList;