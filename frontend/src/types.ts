// frontend/src/types.ts
// Общие типы для приложения

export interface User {
  id: number
  login: string
  full_name: string
  role: 'user' | 'admin'
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

export interface Message {
  id: number
  content: string | null
  file_url: string | null
  file_type: 'image' | 'video' | 'document' | null
  sender_id: number
  chat_id: number
  timestamp: string
  is_read: boolean
}

export interface Chat {
  id: number
  name: string | null
  is_group: boolean
  owner_id: number | null
  created_at: string
  members: User[]
  last_message?: Message
}

export interface GroupChatForm {
  name: string
  member_ids: number[]
}