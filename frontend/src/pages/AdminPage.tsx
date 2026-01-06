// frontend/src/pages/AdminPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  Users,
  MessageSquare,
  BarChart3,
  Shield,
  UserCheck,
  UserX,
  LogOut,
  Home
} from 'lucide-react'
import api from '../services/api'
import { User, Chat, Message } from '../types'

interface AdminStats {
  total_users: number
  active_users: number
  total_chats: number
  total_messages: number
}

const AdminPage = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'users' | 'chats' | 'stats'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Проверка прав администратора
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    if (user.role !== 'admin') {
      navigate('/chat', { replace: true })
      return
    }

    loadData()
  }, [user, navigate])

  const loadData = async () => {
    try {
      setLoading(true)

      if (activeTab === 'users') {
        const usersRes = await api.get('/api/admin/users')
        setUsers(usersRes.data)
      } else if (activeTab === 'chats') {
        const chatsRes = await api.get('/api/chats')
        setChats(chatsRes.data)
      } else if (activeTab === 'stats') {
        const statsRes = await api.get('/api/admin/stats')
        setStats(statsRes.data)
      }
    } catch (err) {
      console.error('Ошибка загрузки данных:', err)
      alert('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      loadData()
    }
  }, [activeTab, user])

  const toggleUserActive = async (userId: number) => {
    if (window.confirm('Изменить статус пользователя?')) {
      try {
        await api.patch(`/api/users/${userId}/toggle-active`)
        setUsers(prev => prev.map(u =>
          u.id === userId ? { ...u, is_active: !u.is_active } : u
        ))
      } catch (err) {
        alert('Не удалось обновить статус')
      }
    }
  }

  const toggleChatActive = async (chatId: number) => {
    if (window.confirm('Изменить статус чата?')) {
      try {
        await api.patch(`/api/chats/${chatId}/toggle-active`)
        setChats(prev => prev.map(c =>
          c.id === chatId ? { ...c, is_active: !c.is_active } : c
        ))
      } catch (err) {
        alert('Не удалось обновить статус чата')
      }
    }
  }

  const deleteChat = async (chatId: number) => {
    if (window.confirm('Удалить этот чат? Все сообщения будут потеряны.')) {
      try {
        await api.delete(`/api/chats/${chatId}`)
        setChats(prev => prev.filter(c => c.id !== chatId))
      } catch (err) {
        alert('Не удалось удалить чат')
      }
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const goToChat = () => {
    navigate('/chat')
  }

  // Фильтрация пользователей
  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.login.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Фильтрация чатов
  const filteredChats = chats.filter(c =>
    (c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    c.members.some(m =>
      m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  if (!user || user.role !== 'admin') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-purple-600 text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={24} />
            <div>
              <h1 className="text-lg font-semibold">Админ-панель</h1>
              <div className="text-xs text-purple-100">
                {user.full_name}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToChat}
              className="p-2 hover:bg-purple-700 rounded-lg transition-colors"
              title="Вернуться к чатам"
            >
              <Home size={20} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-purple-700 rounded-lg transition-colors"
              title="Выйти"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Навигация */}
      <div className="bg-white border-b">
        <div className="flex px-4">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-purple-500'
            }`}
          >
            <Users size={18} />
            Пользователи
          </button>
          <button
            onClick={() => setActiveTab('chats')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'chats'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-purple-500'
            }`}
          >
            <MessageSquare size={18} />
            Чаты
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'stats'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-purple-500'
            }`}
          >
            <BarChart3 size={18} />
            Статистика
          </button>
        </div>
      </div>

      {/* Поиск */}
      <div className="p-4 bg-white border-b">
        <input
          type="text"
          placeholder={`Поиск по ${activeTab === 'users' ? 'пользователям' : 'чатам'}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Контент */}
      <div className="p-4 max-w-4xl mx-auto">
        {loading ? (
          <div className="text-center py-10">
            <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="mt-2 text-gray-600">Загрузка...</div>
          </div>
        ) : activeTab === 'users' ? (
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Управление пользователями</h2>
              <div className="text-sm text-gray-500">
                Всего: {users.length} | Активных: {users.filter(u => u.is_active).length}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Пользователь</th>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Логин</th>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Роль</th>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Статус</th>
                    <th className="py-3 px-4 text-left font-medium text-gray-700">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(userItem => (
                    <tr key={userItem.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium">
                            {userItem.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{userItem.full_name}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(userItem.created_at).toLocaleDateString('ru-RU')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-sm">@{userItem.login}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          userItem.role === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {userItem.role === 'admin' ? 'Администратор' : 'Пользователь'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          userItem.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {userItem.is_active ? 'Активен' : 'Заблокирован'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleUserActive(userItem.id)}
                            disabled={userItem.id === user.id}
                            className={`px-3 py-1 rounded text-sm font-medium flex items-center gap-1 ${
                              userItem.is_active
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            } ${userItem.id === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={userItem.id === user.id ? 'Нельзя изменить свой статус' : ''}
                          >
                            {userItem.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                            {userItem.is_active ? 'Заблокировать' : 'Активировать'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'chats' ? (
          <div className="space-y-4">
            {filteredChats.map(chat => (
              <div key={chat.id} className="bg-white rounded-lg border p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">
                        {chat.is_group
                          ? `💬 ${chat.name || 'Групповой чат'}`
                          : `👤 Личный чат`
                        }
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs ${
                        chat.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {chat.is_active ? 'Активен' : 'Заблокирован'}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 mb-3">
                      {chat.is_group ? (
                        <div className="flex items-center gap-1">
                          <Users size={14} />
                          <span>{chat.members.length} участников</span>
                        </div>
                      ) : (
                        <div>
                          Участники: {chat.members.map(m => m.full_name).join(', ')}
                        </div>
                      )}
                      <div className="mt-1">
                        Создан: {new Date(chat.created_at).toLocaleDateString('ru-RU')}
                      </div>
                    </div>

                    {chat.last_message && (
                      <div className="text-sm border-t pt-3">
                        <div className="font-medium text-gray-700">Последнее сообщение:</div>
                        <div className="text-gray-600 truncate">
                          {chat.last_message.content || '📎 Файл'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(chat.last_message.timestamp).toLocaleString('ru-RU')}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    <button
                      onClick={() => toggleChatActive(chat.id)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        chat.is_active
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {chat.is_active ? 'Деактивировать' : 'Активировать'}
                    </button>
                    {chat.is_group && (
                      <button
                        onClick={() => deleteChat(chat.id)}
                        className="px-3 py-1 rounded text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'stats' && stats ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="text-blue-600" size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total_users}</div>
                  <div className="text-sm text-gray-600">Всего пользователей</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">
                Активных: {stats.active_users}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="text-green-600" size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total_chats}</div>
                  <div className="text-sm text-gray-600">Всего чатов</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="text-purple-600" size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats.total_messages}</div>
                  <div className="text-sm text-gray-600">Всего сообщений</div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default AdminPage