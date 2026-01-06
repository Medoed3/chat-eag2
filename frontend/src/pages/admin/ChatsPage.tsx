// frontend/src/pages/admin/ChatsPage.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquare,
  Search,
  Filter,
  Plus,
  Users,
  MoreVertical,
  Lock,
  Globe,
  Edit,
  Trash2,
  UserCheck,
  UserX
} from 'lucide-react'
import api from '../../services/api'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function ChatsPage() {
  const [chats, setChats] = useState<any[]>([])
  const [filteredChats, setFilteredChats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadChats()
  }, [])

  useEffect(() => {
    filterChats()
  }, [chats, search, typeFilter, statusFilter])

  const loadChats = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/chats')
      const chatsWithDefaults = response.data.map((chat: any) => ({
        ...chat,
        is_active: chat.is_active !== undefined ? chat.is_active : true
      }))
      setChats(chatsWithDefaults)
    } catch (err) {
      console.error('Ошибка загрузки чатов')
    } finally {
      setLoading(false)
    }
  }

  const filterChats = () => {
    let filtered = chats

    if (search) {
      filtered = filtered.filter(chat =>
        chat.name?.toLowerCase().includes(search.toLowerCase()) ||
        chat.members.some((m: any) =>
          m.full_name.toLowerCase().includes(search.toLowerCase())
        )
      )
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(chat =>
        typeFilter === 'group' ? chat.is_group : !chat.is_group
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(chat =>
        statusFilter === 'active' ? chat.is_active : !chat.is_active
      )
    }

    setFilteredChats(filtered)
  }

  const deleteChat = async (chatId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот чат?')) return
    try {
      await api.delete(`/api/chats/${chatId}`)
      setChats(prev => prev.filter(chat => chat.id !== chatId))
    } catch (err) {
      console.error('Не удалось удалить чат')
    }
  }

  const toggleActive = async (chat: any) => {
    try {
      const response = await api.patch(`/api/chats/${chat.id}/toggle-active`)
      setChats(prev =>
        prev.map(c => c.id === chat.id ? { ...c, is_active: response.data.is_active } : c)
      )
    } catch (err) {
      console.error('Не удалось обновить статус чата')
    }
  }

  const getLastMessage = (chat: any) => {
    if (!chat.last_message) return 'Нет сообщений'

    const sender = chat.members.find((m: any) => m.id === chat.last_message.sender_id)
    const senderName = sender ? (sender.id === chat.owner_id ? 'Вы' : sender.full_name.split(' ')[0]) : 'Пользователь'

    if (chat.last_message.content) {
      return `${senderName}: ${chat.last_message.content.substring(0, 50)}${chat.last_message.content.length > 50 ? '...' : ''}`
    } else if (chat.last_message.file_url) {
      return `${senderName}: 📎 Файл`
    }

    return 'Нет сообщений'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Чаты</h1>
            <p className="text-gray-600">Управление групповыми чатами</p>
          </div>
          <div className="animate-pulse bg-gray-200 rounded-lg w-40 h-10" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-32" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center">
              <MessageSquare className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Чаты</h1>
              <p className="text-gray-600">
                {chats.filter(c => c.is_group).length} групповых, {chats.filter(c => !c.is_group).length} личных
              </p>
            </div>
          </div>
        </div>

        <Link to="/admin/chats/create">
          <Button className="gap-2">
            <Plus size={18} />
            Создать чат
          </Button>
        </Link>
      </div>

      {/* Фильтры и поиск */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Поиск */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <Input
                type="text"
                placeholder="Поиск по названию или участникам..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>
          </div>

          {/* Фильтры */}
          <div className="flex gap-2">
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Все чаты</option>
                <option value="group">Групповые</option>
                <option value="personal">Личные</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Сетка чатов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredChats.map(chat => (
          <div
            key={chat.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden card-hover"
          >
            {/* Шапка чата */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    chat.is_group
                      ? 'bg-gradient-to-br from-green-100 to-green-200'
                      : 'bg-gradient-to-br from-blue-100 to-blue-200'
                  }`}>
                    {chat.is_group ? (
                      <Users className="text-green-600" size={24} />
                    ) : (
                      <MessageSquare className="text-blue-600" size={24} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {chat.is_group
                          ? (chat.name || 'Без названия')
                          : 'Личный чат'
                        }
                      </h3>
                      {!chat.is_active && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                          Неактивен
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      {chat.is_group ? (
                        <>
                          <Users size={14} />
                          <span>{chat.members.length} участников</span>
                        </>
                      ) : (
                        <>
                          <Lock size={14} />
                          <span>Личный</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                  <MoreVertical size={20} />
                </button>
              </div>

              {/* Участники */}
              <div className="flex -space-x-2">
                {chat.members.slice(0, 5).map((member: any, index: number) => (
                  <Avatar
                    key={member.id}
                    src={member.avatar_url}
                    name={member.full_name}
                    size="sm"
                    className="border-2 border-white"
                    style={{ zIndex: 5 - index }}
                  />
                ))}
                {chat.members.length > 5 && (
                  <div className="w-8 h-8 bg-gray-200 rounded-full border-2 border-white flex items-center justify-center text-xs text-gray-600 font-medium">
                    +{chat.members.length - 5}
                  </div>
                )}
              </div>
            </div>

            {/* Информация */}
            <div className="p-6 space-y-4">
              {/* Последнее сообщение */}
              <div>
                <div className="text-sm text-gray-500 mb-1">Последнее сообщение</div>
                <div className="text-gray-900 text-sm truncate">
                  {getLastMessage(chat)}
                </div>
              </div>

              {/* Дата создания */}
              <div>
                <div className="text-sm text-gray-500 mb-1">Создан</div>
                <div className="text-gray-900 text-sm">
                  {new Date(chat.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>

              {/* Действия */}
              <div className="flex gap-2 pt-4 border-t">
                {chat.is_group ? (
                  <>
                    <Link
                      to={`/admin/chats/${chat.id}/edit`}
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" fullWidth>
                        <Edit size={16} />
                        Редактировать
                      </Button>
                    </Link>
                    <Link
                      to={`/admin/chats/${chat.id}/members`}
                      className="flex-1"
                    >
                      <Button variant="outline" size="sm" fullWidth>
                        <Users size={16} />
                        Участники
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Button variant="outline" size="sm" fullWidth disabled>
                    Личный чат
                  </Button>
                )}
              </div>

              {/* Кнопки управления */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(chat)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    chat.is_active
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                      : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  {chat.is_active ? (
                    <>
                      <UserX size={16} />
                      Деактивировать
                    </>
                  ) : (
                    <>
                      <UserCheck size={16} />
                      Активировать
                    </>
                  )}
                </button>
                <button
                  onClick={() => deleteChat(chat.id)}
                  className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                  title="Удалить"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredChats.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <MessageSquare className="text-gray-400" size={40} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Чаты не найдены</h3>
          <p className="text-gray-600 mb-6">Попробуйте изменить параметры поиска</p>
          <Link to="/admin/chats/create">
            <Button className="gap-2">
              <Plus size={18} />
              Создать первый чат
            </Button>
          </Link>
        </div>
      )}

      {/* Пагинация */}
      {filteredChats.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Показано {filteredChats.length} из {chats.length} чатов
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              ← Назад
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              Вперед →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}