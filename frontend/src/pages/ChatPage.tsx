// frontend/src/pages/ChatPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  Menu,
  LogOut,
  ChevronLeft,
  Users,
  User,
  Search,
  Plus,
  MoreVertical,
  Phone,
  Video,
  Image as ImageIcon,
  File
} from 'lucide-react'
import ChatList from '../components/ChatList'
import MessageList from '../components/MessageList'
import MessageInput from '../components/MessageInput'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { Chat } from '../types'

export default function ChatPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isOnline, setIsOnline] = useState(true)

  // Проверка авторизации
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
    }
  }, [user, navigate])

  // Симуляция онлайн статуса
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat)
    setShowMenu(false)
  }

  const goBack = () => {
    setSelectedChat(null)
    setSearchQuery('')
  }

  const goToAdmin = () => {
    if (user?.role === 'admin') {
      navigate('/admin')
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen gradient-bg">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white max-w-md mx-auto relative overflow-hidden">
      {/* Header */}
      <header className={`px-4 py-3 shadow-sm transition-all duration-300 ${
        selectedChat ? 'bg-white' : 'gradient-primary text-white'
      }`}>
        <div className="flex items-center justify-between">
          {selectedChat ? (
            <>
              <div className="flex items-center gap-3 flex-1">
                <button
                  onClick={goBack}
                  className={`p-2 rounded-full transition-colors ${
                    selectedChat ? 'hover:bg-gray-100 text-gray-700' : 'hover:bg-white/20'
                  }`}
                >
                  <ChevronLeft size={24} />
                </button>

                <div
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => setShowProfile(true)}
                >
                  <Avatar
                    src={null}
                    name={selectedChat.is_group
                      ? selectedChat.name || 'Группа'
                      : selectedChat.members.find(m => m.id !== user.id)?.full_name || 'Пользователь'
                    }
                    status="online"
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {selectedChat.is_group
                        ? selectedChat.name || 'Групповой чат'
                        : selectedChat.members.find(m => m.id !== user.id)?.full_name || 'Личный чат'
                      }
                    </div>
                    {selectedChat.is_group ? (
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Users size={12} />
                        <span>{selectedChat.members.length} участников</span>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        {isOnline ? 'в сети' : 'был(а) недавно'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button className="p-2 text-gray-600 hover:text-[#0088cc] rounded-full hover:bg-gray-100">
                  <Phone size={20} />
                </button>
                <button className="p-2 text-gray-600 hover:text-[#0088cc] rounded-full hover:bg-gray-100">
                  <Video size={20} />
                </button>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 text-gray-600 hover:text-[#0088cc] rounded-full hover:bg-gray-100"
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Avatar
                  src={user.avatar_url}
                  name={user.full_name}
                  status={isOnline ? "online" : "offline"}
                  size="md"
                  className="border-2 border-white/30"
                />
                <div>
                  <h1 className="text-lg font-semibold">Чаты</h1>
                  <div className="text-sm text-white/90">
                    {isOnline ? 'в сети' : 'оффлайн'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <Menu size={24} />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Поиск */}
      {!selectedChat && (
        <div className="px-4 py-3 bg-white border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Поиск чатов и сообщений..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0088cc] focus:bg-white"
            />
          </div>
        </div>
      )}

      {/* Выпадающее меню */}
      {showMenu && (
        <div className="absolute top-16 right-4 bg-white rounded-2xl shadow-xl border z-50 min-w-48 overflow-hidden animate-in slide-in-from-top-5">
          <div className="py-2">
            <button
              onClick={() => setShowProfile(true)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <User size={18} />
              <span>Мой профиль</span>
            </button>
            {user.role === 'admin' && (
              <button
                onClick={goToAdmin}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 transition-colors"
              >
                <Users size={18} />
                <span>Админ-панель</span>
              </button>
            )}
            <div className="border-t my-1" />
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-red-600 transition-colors"
            >
              <LogOut size={18} />
              <span>Выйти</span>
            </button>
          </div>
        </div>
      )}

      {/* Модалка профиля */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 bg-gradient-to-br from-[#0088cc] to-[#00a2ff] text-white">
              <div className="flex items-center gap-4">
                <Avatar
                  src={user.avatar_url}
                  name={user.full_name}
                  size="xl"
                  className="border-4 border-white/30"
                />
                <div>
                  <h2 className="text-xl font-bold">{user.full_name}</h2>
                  <div className="text-white/90">@{user.login}</div>
                  <div className="mt-1">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin'
                        ? 'bg-purple-500/30 text-white'
                        : 'bg-white/30 text-white'
                    }`}>
                      {user.role === 'admin' ? 'Администратор' : 'Сотрудник'}
                    </span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                      user.is_active
                        ? 'bg-green-500/30 text-white'
                        : 'bg-red-500/30 text-white'
                    }`}>
                      {user.is_active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Роль</div>
                  <div className="font-semibold">
                    {user.role === 'admin' ? 'Администратор' : 'Сотрудник'}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Статус</div>
                  <div className="font-semibold">
                    {user.is_active ? 'Активен' : 'Неактивен'}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-sm text-gray-500">Дата регистрации</div>
                <div className="font-semibold">
                  {new Date(user.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t">
              <Button
                onClick={() => setShowProfile(false)}
                fullWidth
                variant="outline"
              >
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Основной контент */}
      <div className="flex-1 overflow-hidden relative">
        {!selectedChat ? (
          <>
            {/* Список чатов */}
            <div className="h-full overflow-y-auto scrollbar-thin">
              <ChatList
                onSelectChat={handleChatSelect}
                currentChatId={null}
                currentUser={user}
              />
            </div>

            {/* Кнопка нового чата */}
            <button className="absolute bottom-6 right-6 w-14 h-14 gradient-primary text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-all duration-200 hover:scale-110 active:scale-95">
              <Plus size={24} />
            </button>
          </>
        ) : (
          <div className="flex flex-col h-full">
            {/* Сообщения */}
            <div className="flex-1 overflow-hidden bg-gradient-to-b from-white to-gray-50">
              <MessageList
                key={selectedChat.id}
                chatId={selectedChat.id}
                currentUser={user}
              />
            </div>

            {/* Ввод сообщения */}
            <MessageInput
              chatId={selectedChat.id}
              onMessageSent={() => {}}
            />
          </div>
        )}
      </div>
    </div>
  )
}