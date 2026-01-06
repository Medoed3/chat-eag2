import { useState, useEffect } from 'react'
import { Chat, User } from '../types'
import api from '../services/api'
import CreateGroupModal from './CreateGroupModal' // ✅ Добавлен импорт

interface ChatListProps {
  onSelectChat: (chat: Chat) => void
  currentChatId: number | null
  currentUser: User | null
}

const ChatList = ({ onSelectChat, currentChatId, currentUser }: ChatListProps) => {
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
      const response = await api.get('/api/chats')
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
    const other = chat.members.find(m => m.id !== currentUser?.id)
    return other?.full_name || 'Личный чат'
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Загрузка чатов...</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Хедер с фильтром */}
      <div className="p-3 bg-white border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Чаты</h2>
        <button
          onClick={() => setShowModal(true)}
          className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm hover:bg-blue-700"
        >
          +
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex px-3 py-2 bg-gray-50 border-b">
        {['all', 'personal', 'group'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-3 py-1 text-sm rounded-full mr-2 ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
            }`}
          >
            {f === 'all' && 'Все'}
            {f === 'personal' && 'Личные'}
            {f === 'group' && 'Группы'}
          </button>
        ))}
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">Нет чатов</div>
        ) : (
          filteredChats.map(chat => (
            <div
              key={chat.id}
              onClick={() => onSelectChat(chat)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                currentChatId === chat.id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="font-medium">{getChatName(chat)}</div>
              {chat.last_message && (
                <div className="text-gray-500 text-sm truncate">
                  <span>{chat.last_message.sender_id === currentUser?.id ? 'Вы: ' : ''}</span>
                  {chat.last_message.content || '📎 Файл'}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Модалка создания группового чата */}
      <CreateGroupModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={loadChats}
      />
    </div>
  )
}

export default ChatList