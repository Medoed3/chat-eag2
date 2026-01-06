// frontend/src/components/MessageInput.tsx - упрощенная версия
import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, X } from 'lucide-react'
import api from '../services/api'
import { useWebSocket } from '../hooks/useWebSocket'

interface MessageInputProps {
  chatId: number
  onMessageSent: () => void
  currentUserId?: number
}

const MessageInput = ({ chatId, onMessageSent, currentUserId }: MessageInputProps) => {
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [typing, setTyping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const { send } = useWebSocket(chatId)

  // Отправка индикатора набора текста
  const sendTypingIndicator = (isTyping: boolean) => {
    if (send) {
      send({
        type: "typing",
        chat_id: chatId,
        is_typing: isTyping,
        user_id: currentUserId
      })
    }
  }

  // Обработка изменения текста с индикатором набора
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setContent(value)

    // Отправляем индикатор набора текста
    if (value.trim() && !typing) {
      sendTypingIndicator(true)
      setTyping(true)
    }

    // Сбрасываем таймер при каждом вводе
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Через 3 секунды бездействия отправляем "перестал печатать"
    typingTimeoutRef.current = setTimeout(() => {
      if (typing) {
        sendTypingIndicator(false)
        setTyping(false)
      }
    }, 3000)
  }

  // Отправка сообщения
  const sendMessage = async () => {
    if ((!content.trim() && !file) || uploading) return

    // Сбрасываем индикатор набора
    if (typing) {
      sendTypingIndicator(false)
      setTyping(false)
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    setUploading(true)
    try {
      let fileUrl = null
      let fileType = null

      // Если есть файл, загружаем его
      if (file) {
        const formData = new FormData()
        formData.append('file', file)

        try {
          const uploadResponse = await api.post('/api/upload', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })

          fileUrl = uploadResponse.data.file_url
          fileType = uploadResponse.data.file_type
        } catch (uploadErr) {
          console.error('Ошибка загрузки файла:', uploadErr)
          alert('Не удалось загрузить файл')
          setUploading(false)
          return
        }
      }

      // Отправляем сообщение через REST API
      await api.post('/api/messages', {
        chat_id: chatId,
        content: content.trim(),
        file_url: fileUrl,
        file_type: fileType
      })

      // Очищаем форму
      setContent('')
      setFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      onMessageSent()

      // Сбрасываем высоту textarea
      const textarea = document.querySelector('textarea')
      if (textarea) {
        textarea.style.height = 'auto'
      }

    } catch (err: any) {
      console.error('Ошибка отправки сообщения:', err)
      if (err.response?.status === 400) {
        alert(err.response.data.detail || 'Ошибка отправки сообщения')
      } else if (err.response?.status === 403) {
        alert('Нет доступа к этому чату')
      } else {
        alert('Ошибка соединения с сервером')
      }
    } finally {
      setUploading(false)
    }
  }

  // Обработка нажатия клавиш
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Выбор файла (без изменений)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]

      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 10MB')
        return
      }

      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
        'video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'application/zip', 'application/x-rar-compressed'
      ]

      if (!allowedTypes.includes(selectedFile.type)) {
        alert('Недопустимый тип файла')
        return
      }

      setFile(selectedFile)
    }
  }

  // Удаление выбранного файла
  const removeFile = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Определение типа файла для отображения
  const getFileTypeIcon = () => {
    if (!file) return '📎'

    const type = file.type.split('/')[0]
    if (type === 'image') return '🖼️'
    if (type === 'video') return '🎥'
    if (file.type.includes('pdf')) return '📄'
    if (file.type.includes('word') || file.type.includes('document')) return '📝'
    if (file.type.includes('excel') || file.type.includes('sheet')) return '📊'
    if (file.type.includes('zip') || file.type.includes('rar')) return '📦'
    return '📎'
  }

  // Автоматическое изменение высоты textarea
  const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`
  }

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="border-t bg-white p-3">
      {/* Превью файла */}
      {file && (
        <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getFileTypeIcon()}</span>
              <div>
                <div className="text-sm font-medium truncate max-w-xs">{file.name}</div>
                <div className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
            </div>
            <button
              onClick={removeFile}
              className="p-1 hover:bg-red-100 rounded-full text-red-500"
              type="button"
              disabled={uploading}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Форма ввода */}
      <div className="flex items-end gap-2">
        {/* Кнопка прикрепления файла */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          title="Прикрепить файл"
          disabled={uploading}
        >
          <Paperclip size={20} />
        </button>

        {/* Скрытый input для файлов */}
        <input
          ref={fileInputRef}
          id="file-upload"
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
          disabled={uploading}
        />

        {/* Поле ввода текста */}
        <div className="flex-1 relative">
          <textarea
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onInput={handleTextareaInput}
            placeholder="Напишите сообщение..."
            className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={1}
            disabled={uploading}
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />

          {/* Индикатор набора текста */}
          {typing && (
            <div className="absolute -top-6 left-0 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              печатает...
            </div>
          )}
        </div>

        {/* Кнопка отправки */}
        <button
          onClick={sendMessage}
          disabled={(!content.trim() && !file) || uploading}
          className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="button"
        >
          {uploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </div>

      {/* Подсказки по форматам файлов */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        Поддерживаются: фото, видео, PDF, документы (до 10MB)
      </div>
    </div>
  )
}

export default MessageInput