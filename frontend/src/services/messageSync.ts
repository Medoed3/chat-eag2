// frontend/src/services/messageSync.ts - БАЗОВЫЙ ФАЙЛ
import { Message, SyncResponse, MessageStatusUpdate, DeliveryStatus } from '../types';
import { api } from './api';

class MessageSyncService {
  private messagesByChat: Map<number, Message[]> = new Map();
  private pendingMessages: Map<string, Message> = new Map();
  private offlineQueue: Message[] = [];
  private eventListeners: Map<string, Function[]> = new Map();
  private lastSyncTimestamps: Map<number, Date> = new Map();

  async syncChat(params: {
    chatId: number;
    lastSyncTimestamp?: Date;
    limit?: number;
    retryAttempts?: number;
    retryDelay?: number;
  }): Promise<SyncResponse> {
    console.log('MessageSyncService.syncChat called', {
      chatId: params.chatId,
      lastSyncTimestamp: params.lastSyncTimestamp?.toISOString(),
      lastSyncFromMap: this.lastSyncTimestamps.get(params.chatId)?.toISOString(),
      limit: params.limit
    });
    
    try {
      // Всегда используем переданный lastSyncTimestamp, если он есть, иначе запрашиваем все сообщения
      const lastSyncToUse = params.lastSyncTimestamp;

      const response = await api.get<SyncResponse>(`/api/chats/${params.chatId}/sync`, {
        params: {
          last_sync_timestamp: lastSyncToUse?.toISOString(),
          limit: params.limit || 100
        }
      });

      // Сохраняем время последней синхронизации
      if (response.data.last_sync_timestamp) {
        this.lastSyncTimestamps.set(params.chatId, new Date(response.data.last_sync_timestamp));
      }

      // Объединяем сообщения и непрочитанные
      const allMessages = [...response.data.messages];

      // Обрабатываем непрочитанные сообщения
      if (response.data.unread_messages && response.data.unread_messages.length > 0) {
        response.data.unread_messages.forEach(msg => {
          if (!allMessages.some(m => m.id === msg.id)) {
            allMessages.push(msg);
          }
        });
      }

      // Сортируем по времени
      allMessages.sort((a, b) =>
        new Date(a.server_timestamp).getTime() - new Date(b.server_timestamp).getTime()
      );

      // Сохраняем сообщения в кэш по чатам
      this.messagesByChat.set(params.chatId, allMessages);

      // Генерируем событие синхронизации
      console.log('Emitting sync event', { chatId: params.chatId, messageCount: allMessages.length, unreadCount: response.data.unread_count });
      this.emit('sync', params.chatId, allMessages, response.data.unread_count);
      
      return {
        ...response.data,
        messages: allMessages,
        unread_count: response.data.unread_count || 0
      };
    } catch (error) {
      console.error('Error syncing chat:', error);
      throw error;
    }
  }

  async sendMessage(params: {
    content?: string;
    file_url?: string;
    file_type?: string;
    chat_id: number;
    sender_id: number;
    client_message_id?: string;
  }): Promise<Message> {
    try {
      const response = await api.post<Message>('/api/messages', {
        content: params.content,
        file_url: params.file_url,
        file_type: params.file_type,
        chat_id: params.chat_id,
        sender_id: params.sender_id,
        client_message_id: params.client_message_id || `client_${Date.now()}`
      });

      // Обновляем время последней синхронизации
      this.lastSyncTimestamps.set(params.chat_id, new Date());

      return response.data;
    } catch (error) {
      console.error('Error sending message:', error);

      // Сохраняем в очередь оффлайн сообщений
      if (!navigator.onLine || (error as any).response?.status === 0) {
        const offlineMessage: Message = {
          id: -Date.now(),
          client_message_id: params.client_message_id || `offline_${Date.now()}`,
          content: params.content || null,
          file_url: params.file_url || null,
          file_type: params.file_type || null,
          sender_id: params.sender_id,
          chat_id: params.chat_id,
          timestamp: new Date(),
          server_timestamp: new Date(),
          delivery_status: DeliveryStatus.PENDING,
          is_read: false,
          delivered_at: null,
          read_at: null,
          sender: null
        };

        this.offlineQueue.push(offlineMessage);
        this.saveToLocalStorage();
        this.emit('queue-update', this.offlineQueue.length);

        // Возвращаем сообщение для локального отображения
        return offlineMessage;
      }
      throw error;
    }
  }

  async confirmDelivery(messageId: number, userId: number): Promise<void> {
    try {
      await api.post(`/api/messages/${messageId}/delivered`, {
        user_id: userId,
        delivered_at: new Date()
      });
    } catch (error) {
      console.error('Error confirming delivery:', error);
      throw error;
    }
  }

  async confirmRead(messageId: number, userId: number): Promise<void> {
    try {
      await api.post(`/api/messages/${messageId}/read`, {
        user_id: userId,
        read_at: new Date()
      });
    } catch (error) {
      console.error('Error confirming read:', error);
      throw error;
    }
  }

  async updateMessageStatuses(updates: MessageStatusUpdate[]): Promise<void> {
    try {
      await api.post('/api/messages/batch/status', updates);
      this.emit('status-update', updates);
    } catch (error) {
      console.error('Error updating message statuses:', error);
      throw error;
    }
  }

  async getUndeliveredMessages(userId: number): Promise<Message[]> {
    try {
      const response = await api.get<Message[]>(`/api/users/${userId}/undelivered`);
      return response.data;
    } catch (error) {
      console.error('Error getting undelivered messages:', error);
      throw error;
    }
  }

  async processMessageQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];

    for (const message of queue) {
      try {
        // Удаляем из очереди перед отправкой
        const index = this.offlineQueue.findIndex(m =>
          m.client_message_id === message.client_message_id
        );
        if (index !== -1) {
          this.offlineQueue.splice(index, 1);
        }

        await this.sendMessage({
          content: message.content || undefined,
          file_url: message.file_url || undefined,
          file_type: message.file_type || undefined,
          chat_id: message.chat_id,
          sender_id: message.sender_id,
          client_message_id: message.client_message_id.replace('offline_', 'retry_')
        });

        console.log('Offline message sent:', message.client_message_id);
      } catch (error) {
        console.error('Error processing offline message:', error);
        // Возвращаем обратно в очередь
        if (!this.offlineQueue.some(m => m.client_message_id === message.client_message_id)) {
          this.offlineQueue.push(message);
        }
      }
    }

    this.saveToLocalStorage();
    this.emit('queue-update', this.offlineQueue.length);
  }

  getQueueStats() {
    return {
      pending: this.offlineQueue.length,
      failed: 0, // Можно добавить подсчет неудачных
      total: this.offlineQueue.length
    };
  }

  clearQueue(): void {
    this.offlineQueue = [];
    this.pendingMessages.clear();
    localStorage.removeItem('message_queue');
    this.emit('queue-update', 0);
  }

  // Очистка сообщений для конкретного чата
  clearChatMessages(chatId: number): void {
    this.messagesByChat.delete(chatId);
  }

  // Получение сообщений из кэша для чата
  getChatMessages(chatId: number): Message[] {
    return this.messagesByChat.get(chatId) || [];
  }

  async restoreFromLocalStorage(): Promise<void> {
    try {
      const stored = localStorage.getItem('message_queue');
      if (stored) {
        const data = JSON.parse(stored);
        this.offlineQueue = data.offlineQueue || [];
        this.emit('queue-update', this.offlineQueue.length);
      }
    } catch (error) {
      console.error('Error restoring from localStorage:', error);
    }
  }

  saveToLocalStorage(): void {
    try {
      const data = {
        offlineQueue: this.offlineQueue,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('message_queue', JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  onSync(callback: (chatId: number, messages: Message[], unreadCount: number) => void): () => void {
    return this.addEventListener('sync', callback);
  }

  onStatusUpdate(callback: (updates: MessageStatusUpdate[]) => void): () => void {
    return this.addEventListener('status-update', callback);
  }

  onQueueUpdate(callback: (queueSize: number) => void): () => void {
    return this.addEventListener('queue-update', callback);
  }

  private addEventListener(event: string, callback: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    const listeners = this.eventListeners.get(event)!;
    listeners.push(callback);

    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  private emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }
}

export const messageSyncService = new MessageSyncService();