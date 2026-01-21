// frontend/src/hooks/useMessageSync.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { useState, useEffect, useCallback, useRef, useContext } from 'react';
import { Message, SyncResponse, MessageStatusUpdate, DeliveryStatus } from '../types';
import { messageSyncService } from '../services/messageSync';
import { AuthContext } from './useAuth'; // Импортируем контекст

export interface UseMessageSyncOptions {
  chatId?: number;
  autoSync?: boolean;
  syncInterval?: number;
  onNewMessages?: (messages: Message[]) => void;
  onStatusUpdate?: (updates: MessageStatusUpdate[]) => void;
}

export function useMessageSync(options: UseMessageSyncOptions = {}) {
  const {
    chatId,
    autoSync = true,
    syncInterval = 30000,
    onNewMessages,
    onStatusUpdate
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [queueStats, setQueueStats] = useState(messageSyncService.getQueueStats());

  // Получаем текущего пользователя из контекста аутентификации
  const authContext = useContext(AuthContext);
  const currentUser = authContext?.user || null;

  // Используем useRef для хранения таймстампов и интервалов
  const lastSyncTimestamp = useRef<number>(0);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOnlineRef = useRef<boolean>(navigator.onLine);

  // Восстанавливаем очередь при монтировании
  useEffect(() => {
    messageSyncService.restoreFromLocalStorage().catch(console.error);

    // Настраиваем обработчики онлайн/оффлайн статуса
    const handleOnline = () => {
      isOnlineRef.current = true;
      console.log('App is online, processing message queue...');
      messageSyncService.processMessageQueue();
    };

    const handleOffline = () => {
      isOnlineRef.current = false;
      console.log('App is offline, messages will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Подписка на обновления синхронизации
  useEffect(() => {
    if (!chatId) return;

    // Удаляем очистку сообщений при смене чата - это вызывало потерю сообщений
    // if (chatId) {
    //   setMessages([]);
    //   setLastSync(null);
    //   lastSyncTimestamp.current = 0;
    // }

    const unsubscribe = messageSyncService.onSync((syncChatId, newMessages) => {
      if (syncChatId === chatId) {
        // Устанавливаем новые сообщения
        setMessages(newMessages);

        // Обновляем lastSync на основе последнего сообщения
        if (newMessages.length > 0) {
          const lastMessageTime = new Date(newMessages[newMessages.length - 1].timestamp);
          if (!lastSync || lastMessageTime > lastSync) {
            setLastSync(lastMessageTime);
          }
        }

        // Временно отключаем обработчик новых сообщений из-за циклических обновлений
        // onNewMessages?.(newMessages);
        console.log('New messages received:', newMessages);
      }
    });

    return unsubscribe;
  }, [chatId]);

  // Подписка на обновления статусов
  useEffect(() => {
    const unsubscribe = messageSyncService.onStatusUpdate((updates) => {
      setMessages(prev => prev.map(msg => {
        const update = updates.find(u => u.message_id === msg.id);
        if (update) {
          return {
            ...msg,
            delivery_status: update.delivery_status,
            delivered_at: update.delivered_at || msg.delivered_at,
            read_at: update.read_at || msg.read_at,
            is_read: update.delivery_status === DeliveryStatus.READ
          };
        }
        return msg;
      }));

      onStatusUpdate?.(updates);
    });

    return unsubscribe;
  }, [onStatusUpdate]);

  // Периодическая проверка очереди
  useEffect(() => {
    const interval = setInterval(() => {
      setQueueStats(messageSyncService.getQueueStats());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Синхронизация чата
  const sync = useCallback(async (since?: Date, force: boolean = false) => {
    console.log('useMessageSync.sync called', { chatId, since: since?.toISOString(), force, lastSync: lastSync?.toISOString(), isSyncing });
    
    if (!chatId) {
      console.log('No chatId provided for sync');
      return null;
    }

    // Проверка на активное соединение
    if (!isOnlineRef.current && !force) {
      console.log('Sync skipped: offline');
      setError(new Error('Нет подключения к интернету'));
      return null;
    }

    // Удаляем проверку на частоту синхронизации при принудительном вызове
    // Это позволяет загружать сообщения при первом входе в чат
    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimestamp.current;
    const minSyncInterval = 5000;

    if (!force && timeSinceLastSync < minSyncInterval) {
      console.log(`Sync skipped: too frequent (${timeSinceLastSync}ms < ${minSyncInterval}ms)`);
      return null;
    }

    // Если уже синхронизируемся, не запускаем новую синхронизацию
    if (isSyncing && !force) {
      console.log('Sync skipped: already syncing', { chatId, isSyncing, force });
      return null;
    }

    setIsSyncing(true);
    setError(null);
    lastSyncTimestamp.current = now;

    try {
      console.log('Starting sync for chat ' + chatId + (since ? ' since ' + since.toISOString() : ' from last sync'));

      const response = await messageSyncService.syncChat({
        chatId,
        lastSyncTimestamp: since || lastSync || undefined,
        limit: 100,
        retryAttempts: 3,
        retryDelay: 1000
      });

      console.log('Sync completed for chat ' + chatId + ': ' + response.messages.length + ' messages, unread: ' + (response.unread_count || 0));

      if (response.messages.length > 0) {
        const lastMessageTime = new Date(response.messages[response.messages.length - 1].timestamp);
        if (!since && (!lastSync || lastMessageTime > lastSync)) {
          setLastSync(lastMessageTime);
        }
      }

      if (response.unread_messages && response.unread_messages.length > 0) {
        console.log('Found ' + response.unread_messages.length + ' unread messages:', response.unread_messages.map(m => m.id));
      }

      return response;
    } catch (err: any) {
      console.error('Sync error:', err);

      if (err.response) {
        switch (err.response.status) {
          case 404:
            setError(new Error('Чат с ID ' + chatId + ' не найден или нет доступа'));
            break;
          case 401:
            setError(new Error('Требуется авторизация'));
            break;
          case 403:
            setError(new Error('Доступ к чату запрещен'));
            break;
          case 429:
            setError(new Error('Слишком много запросов. Попробуйте позже.'));
            const delay = Math.min(60000, 1000 * Math.pow(2, 3));
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = setTimeout(() => sync(since, true), delay);
            break;
          default:
            setError(new Error('Ошибка сервера: ' + err.response.status));
        }
      } else if (err.request) {
        setError(new Error('Нет ответа от сервера. Проверьте подключение к интернету.'));
      } else {
        setError(new Error('Ошибка при выполнении запроса: ' + err.message));
      }

      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [chatId, lastSync, isSyncing]);

  // Автоматическая синхронизация
  useEffect(() => {
    if (!autoSync || !chatId) return;

    const syncIntervalMs = Math.max(syncInterval, 10000);

    const safeSync = () => {
      if (isOnlineRef.current) {
        sync().catch(err => {
          console.error('Auto-sync error:', err);
        });
      }
    };

    const initialDelay = 1000;
    const initialTimer = setTimeout(safeSync, initialDelay);

    const intervalId = setInterval(safeSync, syncIntervalMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [autoSync, chatId, syncInterval, sync]);

  // ОТПРАВКА СООБЩЕНИЯ - ИСПРАВЛЕННАЯ ВЕРСИЯ
  const sendMessage = useCallback(async (content: string, fileUrl?: string, fileType?: string) => {
    if (!chatId) {
      throw new Error('Chat ID is required');
    }

    // Получаем ID пользователя из контекста аутентификации
    if (!currentUser || !currentUser.id) {
      throw new Error('User not authenticated');
    }

    const currentUserId = currentUser.id;

    // Создаем оптимистичное сообщение
    const optimisticMessage: Message = {
      id: -Date.now(),
      client_message_id: `temp_${Date.now()}_${Math.random()}`,
      content: content || null,
      file_url: fileUrl || null,
      file_type: fileType || null,
      sender_id: currentUserId,
      chat_id: chatId,
      timestamp: new Date(),
      server_timestamp: new Date(),
      delivery_status: DeliveryStatus.SENDING, // Изменено с SENDING на PENDING
      is_read: false,
      delivered_at: null,
      read_at: null,
      sender: {
        id: currentUserId,
        name: currentUser?.full_name || currentUser?.login || 'Пользователь', // Исправлено поле
        avatar_url: currentUser?.avatar_url
      }
    };

    // Сразу добавляем в список сообщений
    setMessages(prev => [...prev, optimisticMessage].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ));

    try {
      // Отправляем через сервис
      const realMessage = await messageSyncService.sendMessage({
        content,
        file_url: fileUrl,
        file_type: fileType,
        chat_id: chatId,
        sender_id: currentUserId
      });

      // Заменяем оптимистичное сообщение реальным
      setMessages(prev => prev.map(msg =>
        msg.id === optimisticMessage.id ? realMessage as Message : msg
      ));

      return realMessage;
    } catch (error) {
      // Если отправка не удалась, обновляем статус оптимистичного сообщения
      setMessages(prev => prev.map(msg =>
          msg.id === optimisticMessage.id
            ? {
                ...msg,
                delivery_status: DeliveryStatus.FAILED,
                error: "Не удалось отправить сообщение"
              }
            : msg
      ));
      throw error;
    }
  }, [chatId, currentUser?.id]); // Добавляем currentUser в зависимости

  // Подтверждение доставки
  const confirmDelivery = useCallback(async (messageId: number, userId: number, maxRetries: number = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await messageSyncService.confirmDelivery(messageId, userId);
        return;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }, []);

  // Подтверждение прочтения
  const confirmRead = useCallback(async (messageId: number, userId: number, maxRetries: number = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await messageSyncService.confirmRead(messageId, userId);
        return;
      } catch (error) {
        if (attempt === maxRetries) throw error;
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }, []);

  // Массовое подтверждение прочтения
  const markAsRead = useCallback(async (messageIds: number[], userId: number) => {
    setMessages(prev => prev.map(msg =>
      messageIds.includes(msg.id)
        ? {
            ...msg,
            delivery_status: DeliveryStatus.READ,
            read_at: new Date(),
            is_read: true
          }
        : msg
    ));

    const updates = messageIds.map(id => ({
      message_id: id,
      delivery_status: DeliveryStatus.READ as const,
      read_at: new Date()
    }));

    messageSyncService.updateMessageStatuses(updates).catch(console.error);
  }, []);

  // Получение не доставленных сообщений
  const getUndelivered = useCallback(async (userId: number) => {
    try {
      return await messageSyncService.getUndeliveredMessages(userId);
    } catch (error) {
      console.error('Failed to get undelivered messages:', error);
      return [];
    }
  }, []);

  // Очистка сообщений
  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastSync(null);
    setError(null);
    lastSyncTimestamp.current = 0;
  }, []);

  // Принудительная обработка очереди
  const processQueue = useCallback(async () => {
    try {
      await messageSyncService.processMessageQueue();
      setQueueStats(messageSyncService.getQueueStats());
    } catch (error) {
      console.error('Failed to process message queue:', error);
    }
  }, []);

  // Принудительная синхронизация
  const forceSync = useCallback(async () => {
    return sync(undefined, true);
  }, [sync]);

  return {
    messages,
    isSyncing,
    lastSync,
    error,
    queueStats,

    // Методы
    sync,
    forceSync,
    sendMessage,
    confirmDelivery,
    confirmRead,
    markAsRead,
    getUndelivered,
    clearMessages,
    processQueue,

    // Состояние
    hasPendingMessages: queueStats.pending > 0,
    hasFailedMessages: queueStats.failed > 0,
    totalQueuedMessages: queueStats.total,
    isOnline: isOnlineRef.current
  };
}
