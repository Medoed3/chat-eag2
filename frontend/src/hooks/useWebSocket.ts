// frontend/src/hooks/useWebSocket.ts - ПЕРЕРАБОТКА для уведомительной модели
import { useState, useEffect, useCallback, useRef } from 'react';
import { Message, MessageNotification } from '../types';
import { api } from '../services/api';

export interface UseWebSocketOptions {
  chatId?: number;
  token?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  onMessage?: (message: Message) => void;
  onNotification?: (notification: MessageNotification) => void;
  onTyping?: (userId: number, isTyping: boolean) => void;
  onDeliveryConfirmed?: (messageId: number, userId: number) => void;
  onReadConfirmed?: (messageId: number, userId: number) => void;
  onConnectionChange?: (connected: boolean) => void;
  onChatUpdate?: (chatId: number) => void; // ДОБАВЛЕНО для обновления списка чатов
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    chatId,
    token,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    onMessage,
    onNotification,
    onTyping,
    onDeliveryConfirmed,
    onReadConfirmed,
    onConnectionChange,
    onChatUpdate // ДОБАВЛЕНО
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef(0);

  // Получение полного сообщения по уведомлению
  const fetchMessage = useCallback(async (messageId: number) => {
    try {
      const response = await api.get<Message>(`/api/messages/${messageId}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching message:', err);
      // Создаем минимальное сообщение в случае ошибки
      return {
        id: messageId,
        client_message_id: `temp_${messageId}`,
        content: null,
        file_url: null,
        file_type: null,
        sender_id: 0,
        chat_id: chatId || 0,
        timestamp: new Date(),
        server_timestamp: new Date(),
        delivery_status: 'PENDING' as any,
        is_read: false,
        delivered_at: null,
        read_at: null,
        sender: null
      };
    }
  }, [chatId]);

  // Обработка уведомления о новом сообщении
  const handleMessageNotification = useCallback(async (notification: any) => {
    try {
      // Получаем полное сообщение
      const message = await fetchMessage(notification.message_id);

      // Обновляем поля из уведомления
      if (notification.client_message_id) {
        message.client_message_id = notification.client_message_id;
      }
      if (notification.sender_id) {
        message.sender_id = notification.sender_id;
      }
      if (notification.chat_id) {
        message.chat_id = notification.chat_id;
      }
      if (notification.content) {
        message.content = notification.content;
      }
      if (notification.timestamp) {
        message.timestamp = new Date(notification.timestamp);
        message.server_timestamp = new Date(notification.timestamp);
      }

      // Уведомляем о новом сообщении
      onMessage?.(message);

      // Уведомляем об обновлении чата (для списка чатов)
      onChatUpdate?.(notification.chat_id);

      // Также передаем само уведомление
      onNotification?.(notification);

    } catch (err) {
      console.error('Error handling message notification:', err);
    }
  }, [fetchMessage, onMessage, onNotification, onChatUpdate]);

  // Обработка входящих сообщений WebSocket
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      console.log('WebSocket message received:', data.type, data);

      switch (data.type) {
        case 'connection_established':
          setIsConnected(true);
          setConnectionId(data.connection_id);
          setError(null);
          reconnectAttemptRef.current = 0;
          onConnectionChange?.(true);

          // Начинаем отправлять ping
          if (pingIntervalRef.current) {
            clearInterval(pingIntervalRef.current);
          }
          pingIntervalRef.current = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000); // Ping каждые 30 секунд
          break;

        case 'new_message': // ИСПРАВЛЕНО: было 'new_message_notification'
          handleMessageNotification(data);
          break;

        case 'user_typing':
          onTyping?.(data.user_id, data.is_typing);
          break;

        case 'delivery_confirmed':
          onDeliveryConfirmed?.(data.message_id, data.user_id);
          break;

        case 'read_confirmed':
          onReadConfirmed?.(data.message_id, data.user_id);
          break;

        case 'initial_state':
          console.log('Initial state:', data);
          if (data.has_pending) {
            // Уведомляем, что есть непрочитанные
            onChatUpdate?.(chatId!);
          }
          break;

        case 'pong':
          // Ответ на ping, соединение активно
          break;

        case 'error':
          console.error('WebSocket error:', data.error);
          setError(new Error(data.error));
          break;

        default:
          console.warn('Unknown WebSocket message type:', data.type);
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  }, [handleMessageNotification, onTyping, onDeliveryConfirmed, onReadConfirmed, onConnectionChange, onChatUpdate, chatId]);

  // Подключение к WebSocket
  const connect = useCallback(() => {
    if (!chatId || !token || isConnecting || wsRef.current) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Создаем URL с токеном
      const wsUrl = new URL(`/ws/chat/${chatId}`, window.location.origin);
      wsUrl.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl.searchParams.set('token', token);

      console.log('Connecting to WebSocket:', wsUrl.toString());
      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnecting(false);
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError(new Error('WebSocket connection error'));
        setIsConnecting(false);
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        onConnectionChange?.(false);

        // Очищаем ping интервал
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Пытаемся переподключиться
        if (autoConnect && reconnectAttemptRef.current < reconnectAttempts) {
          reconnectAttemptRef.current++;
          setReconnectCount(prev => prev + 1);

          const delay = Math.min(reconnectDelay * Math.pow(1.5, reconnectAttemptRef.current - 1), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
          }

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptRef.current >= reconnectAttempts) {
          setError(new Error('Max reconnection attempts exceeded'));
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      setError(err as Error);
      setIsConnecting(false);
    }
  }, [chatId, token, autoConnect, reconnectAttempts, reconnectDelay, handleWebSocketMessage, onConnectionChange]);

  // Отключение от WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setConnectionId(null);
    reconnectAttemptRef.current = 0;
    onConnectionChange?.(false);
  }, [onConnectionChange]);

  // Отправка индикатора набора текста
  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_indicator',
        is_typing: isTyping
      }));
    }
  }, []);

  // Переподключение
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptRef.current = 0;
    setReconnectCount(0);
    connect();
  }, [disconnect, connect]);

  // Автоматическое подключение при изменении параметров
  useEffect(() => {
    if (autoConnect && chatId && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, chatId, token, connect, disconnect]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Состояние
    isConnected,
    isConnecting,
    connectionId,
    error,
    reconnectCount,

    // Методы
    connect,
    disconnect,
    reconnect,
    sendTypingIndicator,

    // Утилиты
    canSend: isConnected && wsRef.current?.readyState === WebSocket.OPEN
  };
}