// frontend/src/components/MessageList.tsx - упрощенная версия
import { useEffect, useRef, useState } from 'react'
import { Message, User } from '../types'
import { formatTime } from '../utils/formatTime'
import api from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'

const MessageList = ({
  chatId,
  currentUser
}: {
  chatId: number
  currentUser: User | null
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Загрузка сообщений при смене чата
  useEffect(() => {
    const loadMessages = async () => {
      if (!chatId || !currentUser) return

      setLoading(true)
      try {
        const response = await api.get(`/api/chats/${chatId}/messages`, {
          params: { limit: 100 }
        })
        setMessages(response.data || [])
      } catch (err: any) {
        console.error('Ошибка загрузки сообщений:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
  }, [chatId, currentUser])

  // WebSocket соединение
  const { send } = useWebSocket(chatId, {
    onMessage: (data) => {
      if (data.type === 'new_message' && data.message) {
        const newMessage = data.message
        if (newMessage.chat_id === chatId) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === newMessage.id)
            if (exists) return prev

            const updated = [...prev, newMessage]
            updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
            return updated
          })

          // Показываем уведомление если это не наше сообщение
          if (newMessage.sender_id !== currentUser?.id) {
            showNotification(newMessage)
          }
        }
      }
      else if (data.type === 'user_typing') {
        const userId = data.user_id
        const isTyping = data.is_typing !== false

        setTypingUsers(prev => {
          const newSet = new Set(prev)
          if (isTyping && userId !== currentUser?.id) {
            newSet.add(userId)
          } else {
            newSet.delete(userId)
          }
          return newSet
        })
      }
      else if (data.type === 'message_read') {
        setMessages(prev => prev.map(msg =>
          msg.id === data.message_id ? { ...msg, is_read: true } : msg
        ))
      }
    }
  })

  // Автопрокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Запрос разрешения на уведомления
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Показ уведомления
  const showNotification = (msg: Message) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return
    }

    if (document.visibilityState === 'visible') {
      return
    }

    const senderName = msg.sender_id === currentUser?.id ? 'Вы' :
                      (msg as any).sender_name || 'Пользователь'
    const body = msg.content ?
                (msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content) :
                '📎 Фото, видео или файл'

    new Notification(`${senderName}:`, {
      body,
      icon: '/pwa-192x192.png',
      tag: `chat_${chatId}`
    })
  }

  // Рендер вложения (без изменений)
  const renderFile = (fileUrl: string, fileType: string) => {
    const fullUrl = fileUrl.startsWith('http') ? fileUrl : `http://localhost:8000${fileUrl}`

    if (fileType === 'image') {
      return (
        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={fullUrl}
            alt="Вложение"
            className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            style={{ maxHeight: '300px' }}
            loading="lazy"
          />
        </a>
      )
    } else if (fileType === 'video') {
      return (
        <video
          src={fullUrl}
          controls
          className="max-w-full rounded cursor-pointer"
          style={{ maxHeight: '300px' }}
          preload="metadata"
        >
          Ваш браузер не поддерживает видео
        </video>
      )
    } else {
      const fileName = fileUrl.split('/').pop() || 'Документ'
      return (
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <span className="text-lg">📎</span>
          <span className="text-blue-600 font-medium truncate max-w-xs">{fileName}</span>
        </a>
      )
    }
  }

  // Группировка сообщений по дням (без изменений)
  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {}

    messages.forEach(msg => {
      const date = new Date(msg.timestamp).toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(msg)
    })

    return groups
  }

  // Индикатор набора текста
  const renderTypingIndicator = () => {
    if (typingUsers.size === 0) return null

    const typingCount = typingUsers.size
    return (
      <div className="flex mb-3 justify-start">
        <div className="max-w-[80%] px-4 py-2 rounded-2xl bg-white text-gray-800 rounded-bl-none shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-gray-600">
              {typingCount === 1 ? 'Кто-то печатает...' : `${typingCount} человека печатают...`}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Загрузка сообщений...</div>
      </div>
    )
  }

  const messageGroups = groupMessagesByDate()

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100 p-2 md:p-4">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <div className="text-lg mb-2">Нет сообщений</div>
          <div className="text-sm">Начните общение первым!</div>
        </div>
      ) : (
        <>
          {Object.entries(messageGroups).map(([date, dateMessages]) => (
            <div key={date} className="mb-6">
              {/* Дата */}
              <div className="flex justify-center mb-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {date}
                </div>
              </div>

              {/* Сообщения */}
              {dateMessages.map((msg) => {
                const isOwn = msg.sender_id === currentUser?.id

                return (
                  <div
                    key={msg.id}
                    className={`flex mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${isOwn
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white text-gray-800 rounded-bl-none shadow-sm'
                    }`}>
                      {/* Текст сообщения */}
                      {msg.content && (
                        <div className="whitespace-pre-wrap break-words mb-2">
                          {msg.content}
                        </div>
                      )}

                      {/* Файл */}
                      {msg.file_url && msg.file_type && (
                        <div className="mb-2">
                          {renderFile(msg.file_url, msg.file_type)}
                        </div>
                      )}

                      {/* Время */}
                      <div className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                        {formatTime(new Date(msg.timestamp))}
                        {msg.is_read && isOwn && ' ✓✓'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}

          {/* Индикатор набора текста */}
          {renderTypingIndicator()}
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList