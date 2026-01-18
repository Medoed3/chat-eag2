// frontend/src/pages/admin/ChatsPage.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  MessageSquare,
  Search,
  Filter,
  Plus,
  Users,
  UserPlus,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Lock,
  X
} from 'lucide-react'
import { api } from '../../services/api'

export default function ChatsPage() {
  const [chats, setChats] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [filteredChats, setFilteredChats] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedChats, setSelectedChats] = useState<number[]>([])

  // Состояния для модального окна добавления пользователей
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [addingUsers, setAddingUsers] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    loadChats()
    loadAllUsers()
  }, [])

  useEffect(() => {
    filterChats()
  }, [chats, search, typeFilter, statusFilter])

  const loadChats = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/admin/chats')
      const chatsWithDefaults = response.data.map((chat: any) => ({
        ...chat,
        is_active: chat.is_active !== undefined ? chat.is_active : true
      }))
      setChats(chatsWithDefaults)
    } catch (err) {
      console.error('Ошибка загрузки чатов:', err)
      alert('Ошибка загрузки чатов')
    } finally {
      setLoading(false)
    }
  }

  const loadAllUsers = async () => {
    try {
      const response = await api.get('/api/admin/users')
      setAllUsers(response.data)
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err)
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
    if (!confirm('Вы уверены, что хотите удалить этот чат? Все сообщения будут удалены.')) return
    try {
      await api.delete(`/api/chats/${chatId}`)
      setChats(prev => prev.filter(chat => chat.id !== chatId))
      alert('Чат удален')
    } catch (err: any) {
      console.error('Не удалось удалить чат:', err)
      alert(err.response?.data?.detail || 'Не удалось удалить чат')
    }
  }

  const toggleActive = async (chat: any) => {
    const action = chat.is_active ? 'деактивировать' : 'активировать'
    if (!confirm(`Вы уверены, что хотите ${action} чат "${chat.name || 'Личный чат'}"?`)) return

    try {
      const response = await api.patch(`/api/chats/${chat.id}/toggle-active`)
      setChats(prev =>
        prev.map(c => c.id === chat.id ? { ...c, is_active: response.data.is_active } : c)
      )
      alert(`Чат ${response.data.is_active ? 'активирован' : 'деактивирован'}`)
    } catch (err: any) {
      console.error('Не удалось обновить статус чата:', err)
      alert(err.response?.data?.detail || 'Не удалось обновить статус чата')
    }
  }

  // Открыть модальное окно для добавления пользователей
  const openAddUserModal = (chatId: number) => {
    setSelectedChatId(chatId)
    setSelectedUserIds([])
    setErrorMessage('')
    setShowAddUserModal(true)
  }

  // Переключить выбор пользователя
  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  // Добавить выбранных пользователей в чат (массовое добавление)
  const addUsersToChat = async () => {
    if (!selectedChatId || selectedUserIds.length === 0) {
      alert('Выберите пользователей для добавления')
      return
    }

    setAddingUsers(true)
    setErrorMessage('')

    try {
      const chat = chats.find(c => c.id === selectedChatId)

      // Используем массовый эндпоинт для добавления нескольких пользователей
      const response = await api.post(`/api/chats/${selectedChatId}/members/bulk`, {
        user_ids: selectedUserIds
      })

      // Обновляем данные чата
      const updatedChat = await api.get(`/api/chats/${selectedChatId}`)
      setChats(prev => prev.map(c => c.id === selectedChatId ? updatedChat.data : c))

      alert(`Добавлено ${selectedUserIds.length} пользователей в чат "${chat?.name || 'Личный чат'}"`)
      setShowAddUserModal(false)
      setSelectedUserIds([])
    } catch (err: any) {
      console.error('Ошибка добавления пользователей:', err)
      if (err.response?.status === 422) {
        setErrorMessage('Ошибка валидации данных. Проверьте формат отправляемых данных.')
      } else {
        setErrorMessage(err.response?.data?.detail || 'Не удалось добавить пользователей в чат')
      }
    } finally {
      setAddingUsers(false)
    }
  }

  // Добавить одного пользователя в чат (старый метод для обратной совместимости)
  const addSingleUserToChat = async (chatId: number, userId: number) => {
    try {
      await api.post(`/api/chats/${chatId}/members`, { user_id: userId })
      return true
    } catch (err: any) {
      console.error('Ошибка добавления пользователя:', err)
      throw err
    }
  }

  const selectAllChats = () => {
    if (selectedChats.length === filteredChats.length) {
      setSelectedChats([])
    } else {
      setSelectedChats(filteredChats.map(c => c.id))
    }
  }

  const toggleSelectChat = (chatId: number) => {
    setSelectedChats(prev =>
      prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId]
    )
  }

  const bulkActivateChats = async () => {
    if (selectedChats.length === 0) {
      alert('Выберите чаты')
      return
    }

    if (!confirm(`Активировать ${selectedChats.length} чатов?`)) return

    try {
      // Используем цикл для активации каждого чата
      for (const chatId of selectedChats) {
        await api.patch(`/api/chats/${chatId}/toggle-active`)
      }

      await loadChats() // Перезагружаем чаты
      setSelectedChats([])
      alert('Чаты активированы')
    } catch (err: any) {
      console.error('Не удалось активировать чаты:', err)
      alert(err.response?.data?.detail || 'Не удалось активировать чаты')
    }
  }

  const bulkDeactivateChats = async () => {
    if (selectedChats.length === 0) {
      alert('Выберите чаты')
      return
    }

    if (!confirm(`Деактивировать ${selectedChats.length} чатов?`)) return

    try {
      // Используем цикл для деактивации каждого чата
      for (const chatId of selectedChats) {
        await api.patch(`/api/chats/${chatId}/toggle-active`)
      }

      await loadChats() // Перезагружаем чаты
      setSelectedChats([])
      alert('Чаты деактивированы')
    } catch (err: any) {
      console.error('Не удалось деактивировать чаты:', err)
      alert(err.response?.data?.detail || 'Не удалось деактивировать чаты')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="mt-4 text-gray-600">Загрузка чатов...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Заголовок и кнопка */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Чаты</h1>
            <p className="text-gray-600 mt-1">
              {chats.filter(c => c.is_group).length} групповых • {chats.filter(c => !c.is_group).length} личных
            </p>
          </div>

          <Link to="/admin/chats/create">
            <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg transition-colors">
              <Plus size={20} />
              Создать чат
            </button>
          </Link>
        </div>

        {/* Фильтры и поиск */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Поиск */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Поиск по названию или участникам..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Фильтры */}
            <div className="flex gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="all">Все чаты</option>
                <option value="group">Групповые</option>
                <option value="personal">Личные</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </select>
            </div>
          </div>
        </div>

        {/* Массовые действия */}
        {selectedChats.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                  {selectedChats.length}
                </div>
                <div>
                  <div className="font-semibold text-blue-900">Выбрано {selectedChats.length} чатов</div>
                  <div className="text-sm text-blue-700">Выберите действие</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={bulkActivateChats}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <UserCheck size={18} />
                  Активировать
                </button>
                <button
                  onClick={bulkDeactivateChats}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <UserX size={18} />
                  Деактивировать
                </button>
                <button
                  onClick={() => setSelectedChats([])}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Снять выделение
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Таблица чатов */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-4 text-left">
                    <input
                      type="checkbox"
                      checked={filteredChats.length > 0 && selectedChats.length === filteredChats.length}
                      onChange={selectAllChats}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-900">Чат</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-900">Тип</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-900">Участники</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-900">Статус</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-900">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredChats.map(chat => (
                  <tr key={chat.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedChats.includes(chat.id)}
                        onChange={() => toggleSelectChat(chat.id)}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          chat.is_group
                            ? 'bg-green-100 text-green-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {chat.is_group ? (
                            <MessageSquare size={20} />
                          ) : (
                            <Lock size={20} />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {chat.is_group
                              ? (chat.name || 'Групповой чат')
                              : 'Личный чат'
                            }
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {chat.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        chat.is_group
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {chat.is_group ? <Users size={14} /> : <Lock size={14} />}
                        <span>{chat.is_group ? 'Групповой' : 'Личный'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900">
                          {chat.members.length} участников
                        </div>
                        {chat.is_group && (
                          <button
                            onClick={() => openAddUserModal(chat.id)}
                            className="text-xs text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-1"
                          >
                            <UserPlus size={12} />
                            Добавить участника
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                        chat.is_active
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {chat.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                        <span>{chat.is_active ? 'Активен' : 'Неактивен'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {chat.is_group && (
                          <>
                            <button
                              onClick={() => openAddUserModal(chat.id)}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Добавить участника"
                            >
                              <UserPlus size={18} />
                            </button>
                            <Link
                              to={`/admin/chats/${chat.id}/members`}
                              className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Управление участниками"
                            >
                              <Users size={18} />
                            </Link>
                            <Link
                              to={`/admin/chats/${chat.id}/edit`}
                              className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Редактировать"
                            >
                              <Edit size={18} />
                            </Link>
                          </>
                        )}
                        <button
                          onClick={() => toggleActive(chat)}
                          className={`p-2 rounded-lg transition-colors ${
                            chat.is_active
                              ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                          }`}
                          title={chat.is_active ? 'Деактивировать' : 'Активировать'}
                        >
                          {chat.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                        </button>
                        {chat.is_group && (
                          <button
                            onClick={() => deleteChat(chat.id)}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredChats.length === 0 && (
            <div className="py-12 text-center">
              <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <div className="text-gray-500 text-lg mb-2">Чаты не найдены</div>
              <div className="text-gray-400 mb-6">Попробуйте изменить параметры поиска</div>
              <Link to="/admin/chats/create">
                <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors mx-auto">
                  <Plus size={20} />
                  Создать первый чат
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно для добавления пользователей */}
      {showAddUserModal && selectedChatId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Добавить пользователей в чат</h3>
                <p className="text-gray-600 mt-1">
                  Выберите пользователей для добавления
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            {/* Список пользователей */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Сообщение об ошибке */}
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-700 text-sm">{errorMessage}</div>
                </div>
              )}

              <div className="space-y-3">
                {allUsers
                  .filter(user => {
                    // Фильтруем пользователей, которые уже в чате
                    const chat = chats.find(c => c.id === selectedChatId)
                    return !chat?.members?.some((m: any) => m.id === user.id)
                  })
                  .map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {user.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">@{user.login}</div>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm ${
                        user.is_active
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {user.is_active ? 'Активен' : 'Неактивен'}
                      </div>
                    </label>
                  ))}
              </div>

              {allUsers.filter(user => {
                const chat = chats.find(c => c.id === selectedChatId)
                return !chat?.members?.some((m: any) => m.id === user.id)
              }).length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <div className="text-gray-500">Все пользователи уже добавлены в этот чат</div>
                </div>
              )}
            </div>

            {/* Кнопки действий */}
            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-gray-600">
                  Выбрано: <span className="font-semibold">{selectedUserIds.length}</span> пользователей
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddUserModal(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={addUsersToChat}
                    disabled={selectedUserIds.length === 0 || addingUsers}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {addingUsers ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Добавление...
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        Добавить в чат
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}