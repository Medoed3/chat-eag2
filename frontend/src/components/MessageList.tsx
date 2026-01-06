// frontend/src/components/MessageList.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { Message, User } from '../types'
import { formatTime } from '../utils/formatTime'
import api from '../services/api'

interface WebSocketMessage {
  type: string
  message?: Message
  data?: any
}

const MessageList = ({
  chatId,
  currentUser
}: {
  chatId: number
  currentUser: User | null
}) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)

  // Загрузка сообщений
  useEffect(() => {
    const loadMessages = async () => {
      if (!chatId) return

      setLoading(true)
      try {
        const response = await api.get(`/api/chats/${chatId}/messages`, {
          params: { limit: 100 }
        })
        setMessages(response.data || [])
      } catch (err: any) {
        console.error('Ошибка загрузки сообщений:', err)
        if (err.response?.status === 403) {
          console.error('Нет доступа к этому чату')
        }
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
  }, [chatId])

  // Автопрокрутка вниз при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // WebSocket подключение
  const connectWebSocket = useCallback(() => {
    if (!chatId || !currentUser) return

    const token = localStorage.getItem('access_token')
    if (!token) {
      console.error('Токен не найден')
      return
    }

    // Закрываем существующее соединение
    if (ws.current) {
      ws.current.close()
    }

    // Создаем новое соединение
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = window.location.port || (protocol === 'wss:' ? '443' : '8000')
    const wsUrl = `${protocol}//${host}:${port}/api/ws/${chatId}?token=${token}`

    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('WebSocket подключён к чату:', chatId)
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
        reconnectTimeout.current = null
      }
    }

    socket.onmessage = (event) => {
      try {
        const data: WebSocketMessage = JSON.parse(event.data)

        if (data.type === 'new_message' && data.message) {
          const newMessage = data.message
          // Проверяем, что сообщение для этого чата и не дублируется
          if (newMessage.chat_id === chatId) {
            setMessages(prev => {
              const exists = prev.some(m => m.id === newMessage.id)
              if (exists) return prev
              return [...prev, newMessage]
            })

            // Показываем уведомление, если сообщение не от текущего пользователя
            if (newMessage.sender_id !== currentUser?.id) {
              showNotification(newMessage)
            }
          }
        } else if (data.type === 'user_typing') {
          // Обработка индикатора набора текста
          console.log('Пользователь печатает:', data)
        }
      } catch (err) {
        console.error('Ошибка парсинга WebSocket сообщения:', err)
      }
    }

    socket.onclose = (event) => {
      console.log('WebSocket закрыт:', event.code, event.reason)

      // Пытаемся переподключиться только при ненормальном закрытии
      if (event.code !== 1000) {
        if (!reconnectTimeout.current) {
          reconnectTimeout.current = setTimeout(() => {
            console.log('Переподключение WebSocket...')
            connectWebSocket()
          }, 3000)
        }
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket ошибка:', error)
    }

    ws.current = socket

    // Очистка при размонтировании
    return () => {
      if (ws.current) {
        ws.current.close()
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
    }
  }, [chatId, currentUser])

  // Инициализация WebSocket
  useEffect(() => {
    if (chatId && currentUser) {
      connectWebSocket()
    }

    return () => {
      if (ws.current) {
        ws.current.close()
        ws.current = null
      }
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
        reconnectTimeout.current = null
      }
    }
  }, [connectWebSocket])

  // Запрос разрешения на уведомления
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Показ уведомления
  const showNotification = (msg: Message) => {
    if ('Notification' in window && Notification.permission === 'granted') {
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
  }

  // Рендер вложения
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
          <span className="text-blue-600 font-medium">{fileName}</span>
        </a>
      )
    }
  }

  // Группировка сообщений по дням
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
        Object.entries(messageGroups).map(([date, dateMessages]) => (
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
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList