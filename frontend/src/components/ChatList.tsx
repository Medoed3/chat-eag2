// frontend/src/components/ChatList.tsx - ОБНОВЛЕННАЯ ВЕРСИЯ
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chat, User } from '../types'
import { api } from '../services/api'
import CreateGroupModal from './CreateGroupModal'
import { Users, MessageSquare, Plus } from 'lucide-react'

interface ChatListProps {
  onSelectChat: (chat: Chat) => void
  currentChatId: number | null
  currentUser: User | null
  compact?: boolean // Для мобильного вида
}

const ChatList = ({ onSelectChat, currentChatId, currentUser, compact = false }: ChatListProps) => {
  const navigate = useNavigate()
  const [chats, setChats] = useState<Chat[]>([])
  const [filter, setFilter] = useState<'all' | 'personal' | 'group'>('all')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadChats()
  }, [])

  const loadChats = async () => {
    setLoading(true)
    try {
      const response = await api.get<Chat[]>('/api/chats')
      setChats(response.data)
    } catch (err) {
      console.error('Ошибка загрузки чатов', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredChats = chats.filter(chat => {
    if (filter === 'personal') return !chat.is_group
    if (filter === 'group') return chat.is_group
    return true
  })

  const getChatName = (chat: Chat) => {
    if (chat.is_group) return chat.name || 'Групповой чат'

    // Для личного чата: находим собеседника
    if (currentUser) {
      const otherMember = chat.members.find(m => m.id !== currentUser.id)
      return otherMember?.full_name || 'Личный чат'
    }
    return 'Личный чат'
  }

  const getChatAvatar = (chat: Chat) => {
    if (chat.is_group) {
      // Для группового чата показываем иконку группы
      return null
    }

    // Для личного чата: находим аватар собеседника
    if (currentUser) {
      const otherMember = chat.members.find(m => m.id !== currentUser.id)
      return otherMember?.avatar_url
    }
    return null
  }

  const formatLastMessage = (chat: Chat) => {
    if (!chat.last_message) return ''

    const prefix = chat.last_message.sender_id === currentUser?.id ? 'Вы: ' : ''
    const content = chat.last_message.content || '📎 Файл'

    return prefix + (content.length > 30 ? content.substring(0, 30) + '...' : content)
  }

  // Переход на страницу контактов
  const goToContacts = () => {
    navigate('/contacts')
  }

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
        Загрузка чатов...
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-col h-full">
        {/* Кнопка контактов */}
        <button
          onClick={goToContacts}
          className="flex items-center justify-center p-3 border-b hover:bg-gray-50"
          title="Контакты"
        >
          <Users size={20} className="text-gray-600" />
        </button>

        {/* Список чатов */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.slice(0, 5).map(chat => (
            <button
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`w-full p-3 text-left hover:bg-gray-50 ${
                currentChatId === chat.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
              }`}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm mr-2">
                  {chat.is_group ? '👥' : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{getChatName(chat)}</div>
                  {chat.unread_count > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {chat.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Заголовок и кнопки */}
      <div className="p-4 bg-white border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Чаты</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToContacts}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Контакты"
            >
              <Users size={20} />
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Создать группу"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'all', label: 'Все', icon: '💬' },
            { key: 'personal', label: 'Личные', icon: '👤' },
            { key: 'group', label: 'Группы', icon: '👥' }
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key as any)}
              className={`flex-1 py-2 px-3 text-sm rounded-md transition-colors flex items-center justify-center gap-1 ${
                filter === item.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">
              {filter === 'personal'
                ? 'У вас пока нет личных чатов'
                : filter === 'group'
                ? 'У вас пока нет групповых чатов'
                : 'У вас пока нет чатов'}
            </p>
            {filter === 'personal' ? (
              <button
                onClick={goToContacts}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Перейти к контактам →
              </button>
            ) : (
              <button
                onClick={() => setShowModal(true)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Создать чат
              </button>
            )}
          </div>
        ) : (
          filteredChats.map(chat => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`p-3 border-b cursor-pointer transition-colors hover:bg-gray-50 ${
                currentChatId === chat.id ? 'bg-blue-50 border-r-2 border-blue-600' : ''
              }`}
            >
              <div className="flex items-center">
                {/* Аватар чата */}
                <div className="flex-shrink-0 mr-3">
                  {getChatAvatar(chat) ? (
                    <img
                      src={getChatAvatar(chat)}
                      alt={getChatName(chat)}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                      chat.is_group ? 'bg-blue-500' : 'bg-purple-500'
                    }`}>
                      {chat.is_group ? '👥' : '👤'}
                    </div>
                  )}
                </div>

                {/* Информация о чате */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-gray-900 truncate">
                      {getChatName(chat)}
                    </h3>
                    {chat.last_message && (
                      <span className="text-xs text-gray-500">
                        {new Date(chat.last_message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>

                  {chat.last_message ? (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 truncate">
                        {formatLastMessage(chat)}
                      </p>
                      {chat.unread_count > 0 && (
                        <span className="bg-red-500 text-white text-xs font-medium px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Нет сообщений</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Модалка создания группового чата */}
      <CreateGroupModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          loadChats()
          setShowModal(false)
        }}
      />
    </div>
  )
}

export default ChatList