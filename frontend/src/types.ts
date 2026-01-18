// frontend/src/types.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ

export enum DeliveryStatus {
  SENDING = 'SENDING',
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED'
}

// Базовый интерфейс пользователя для сообщений
export interface MessageSender {
  id: number;
  login: string;
  full_name: string;
  avatar_url?: string | null;
}

export interface User extends MessageSender {
  name?: string; // для обратной совместимости
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
}

export interface Chat {
  id: number;
  name: string | null;
  is_group: boolean;
  owner_id: number | null;
  created_at: string;
  is_active: boolean;
  members: User[];
  last_message: Message | null;
  unread_count: number;
}

export interface Message {
  id: number;
  client_message_id: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  sender_id: number;
  chat_id: number;
  timestamp: string;
  server_timestamp: string;
  delivery_status: DeliveryStatus;
  is_read: boolean;
  delivered_at: string | null;
  read_at: string | null;
  sender?: MessageSender;
}

// Обновлено: UnreadMessage теперь использует Message вместо отдельной структуры
export interface UnreadMessage {
  message_id: number;
  chat_id: number;
  stored_at: string;
  delivered_at: string | null;
  message?: Message; // Оставляем для обратной совместимости
}

export interface MessageDelivery {
  message_id: number;
  user_id: number;
  status: DeliveryStatus;
  delivered_at: string | null;
  read_at: string | null;
  retry_count: number;
}

export interface MessageNotification {
  type: string;
  message_id: number;
  chat_id: number;
  sender_id: number;
  client_message_id: string;
  timestamp?: string;
  content_preview?: string;
  file_type?: string;
}

export interface DeliveryConfirmation {
  user_id: number;
  delivered_at?: string;
  client_request_id?: string;
}

export interface ReadConfirmation {
  user_id: number;
  read_at?: string;
  client_request_id?: string;
}

export interface SyncRequest {
  chat_id: number;
  last_sync_timestamp?: string;
  limit?: number;
}

// ИСПРАВЛЕНО: unread_messages теперь содержит Message[], а не UnreadMessage[]
export interface SyncResponse {
  messages: Message[];
  unread_messages: Message[]; // ИЗМЕНЕНО С UnreadMessage[] на Message[]
  unread_count: number;
  last_sync_timestamp: string;
  has_more: boolean;
}

export interface MessageStatusUpdate {
  message_id: number;
  delivery_status: DeliveryStatus;
  delivered_at?: string | null;
  read_at?: string | null;
}

export interface MessageCreate {
  content?: string;
  chat_id: number;
  file_url?: string;
  file_type?: string;
  client_message_id?: string;
  client_request_id?: string;
}

// Типы для WebSocket
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ConnectionEstablishedMessage {
  type: 'connection_established';
  chat_id: number;
  user_id: number;
  connection_id: string;
  timestamp: string;
}

export interface NewMessageNotification {
  type: 'new_message' | 'new_message_notification';
  message_id: number;
  chat_id: number;
  sender_id: number;
  client_message_id: string;
  timestamp?: string;
  content?: string;
}

export interface UserTypingMessage {
  type: 'user_typing';
  user_id: number;
  user_name: string;
  chat_id: number;
  is_typing: boolean;
}

export interface DeliveryConfirmedMessage {
  type: 'delivery_confirmed';
  message_id: number;
  user_id: number;
  delivered_at: string | null;
  chat_id: number;
}

export interface ReadConfirmedMessage {
  type: 'read_confirmed';
  message_id: number;
  user_id: number;
  read_at: string | null;
  chat_id: number;
}

export interface InitialStateMessage {
  type: 'initial_state';
  unread_count: number;
  has_pending: boolean;
}

// Типы для API ответов
export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export interface ErrorResponse {
  detail: string;
  status_code: number;
}

// Типы для статистики
export interface DeliveryStats {
  total_messages: number;
  delivered: number;
  read: number;
  pending: number;
  failed: number;
  online_users: number;
  delivery_rate: number;
  read_rate: number;
}

// Типы для очереди сообщений
export interface MessageQueueItem {
  id: string;
  message: Partial<Message>;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  clientMessageId: string;
  timestamp: Date;
  retryCount: number;
  lastAttempt?: Date;
}

// Типы для чата и доступа
export interface ChatAccessResponse {
  chat_id: number;
  chat_name: string;
  is_group: boolean;
  is_active: boolean;
  is_member: boolean;
  has_access: boolean;
  owner_id?: number;
  members_count: number;
  unread_count: number;
  last_activity?: string;
}

// Типы для медиа
export interface MediaUploadResponse {
  url: string;
  type: string;
  filename: string;
}