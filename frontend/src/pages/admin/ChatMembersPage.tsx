// frontend/src/pages/admin/ChatMembersPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Users, UserPlus, X, UserCheck, UserX, ArrowLeft } from 'lucide-react'
import { api } from '../../services/api'

export default function ChatMembersPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [chat, setChat] = useState<any>(null)
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [addingUsers, setAddingUsers] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (id) {
      loadChat()
      loadAllUsers()
    }
  }, [id])

  const loadChat = async () => {
    try {
      const response = await api.get(`/api/admin/chats/${id}`)
      setChat(response.data)
    } catch (err: any) {
      console.error('Ошибка загрузки чата:', err)
      alert(err.response?.data?.detail || 'Чат не найден')
      navigate('/admin/chats')
    }
  }

  const loadAllUsers = async () => {
    try {
      const response = await api.get('/api/admin/users')
      setAllUsers(response.data)
    } catch (err) {
      console.error('Ошибка загрузки пользователей:', err)
      alert('Не удалось загрузить пользователей')
    }
  }

  const isMember = (userId: number) => {
    return chat?.members?.some((m: any) => m.id === userId) || false
  }

  const toggleMember = async (userId: number) => {
    if (!chat) return

    const user = allUsers.find(u => u.id === userId)
    const action = isMember(userId) ? 'удалить' : 'добавить'

    if (!confirm(`Вы уверены, что хотите ${action} пользователя ${user?.full_name}?`)) return

    setLoading(true)
    try {
      if (isMember(userId)) {
        // Удалить пользователя из чата
        await api.delete(`/api/chats/${id}/members/${userId}`)
        setChat(prev => ({
          ...prev,
          members: prev.members.filter((m: any) => m.id !== userId)
        }))
        alert('Пользователь удален из чата')
      } else {
        // Добавить пользователя в чат
        await api.post(`/api/chats/${id}/members`, { user_id: userId })
        const user = allUsers.find(u => u.id === userId)
        setChat(prev => ({
          ...prev,
          members: [...prev.members, user]
        }))
        alert('Пользователь добавлен в чат')
      }
    } catch (err: any) {
      console.error('Ошибка обновления участника:', err)
      if (err.response?.status === 422) {
        alert('Ошибка валидации данных. Проверьте формат отправляемых данных.')
      } else {
        alert(err.response?.data?.detail || 'Не удалось обновить участника')
      }
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setSelectedUserIds([])
    setErrorMessage('')
    setShowAddModal(true)
  }

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const addSelectedUsers = async () => {
    if (selectedUserIds.length === 0) {
      alert('Выберите пользователей для добавления')
      return
    }

    setAddingUsers(true)
    setErrorMessage('')

    try {
      // Используем массовый эндпоинт для добавления нескольких пользователей
      const response = await api.post(`/api/chats/${id}/members/bulk`, {
        user_ids: selectedUserIds
      })

      // Перезагружаем чат для обновления списка участников
      await loadChat()
      alert(`Добавлено ${selectedUserIds.length} пользователей в чат`)
      setShowAddModal(false)
      setSelectedUserIds([])
    } catch (err: any) {
      console.error('Ошибка добавления пользователей:', err)
      if (err.response?.status === 422) {
        setErrorMessage('Ошибка валидации данных. Проверьте формат отправляемых данных.')
      } else {
        setErrorMessage(err.response?.data?.detail || 'Не удалось добавить пользователей')
      }
    } finally {
      setAddingUsers(false)
    }
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="mt-4 text-gray-600">Загрузка данных чата...</div>
        </div>
      </div>
    )
  }

  // Пользователи, которые еще не в чате
  const availableUsers = allUsers.filter(user => !isMember(user.id))

  return (
    <>
      <div className="space-y-6">
        {/* Заголовок и кнопки */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to="/admin/chats" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2">
              <ArrowLeft size={18} />
              Назад к списку чатов
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              Участники чата: {chat.is_group ? (chat.name || 'Групповой чат') : 'Личный чат'}
            </h1>
            <p className="text-gray-600 mt-1">
              ID: {chat.id} • {chat.members.length} участников •
              <span className={`ml-2 ${chat.is_active ? 'text-green-600' : 'text-red-600'}`}>
                {chat.is_active ? 'Активен' : 'Неактивен'}
              </span>
            </p>
          </div>

          <button
            onClick={openAddModal}
            disabled={!chat.is_group}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              chat.is_group
                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <UserPlus size={20} />
            Добавить участников
          </button>
        </div>

        {/* Список участников чата */}
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-6 border-b bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">Участники чата</h2>
            <p className="text-gray-600 text-sm">
              {chat.members.length} пользователей
            </p>
          </div>

          <div className="divide-y">
            {chat.members.map((member: any) => (
              <div key={member.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {member.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{member.full_name}</div>
                      <div className="text-sm text-gray-500">@{member.login}</div>
                      <div className="text-xs text-gray-400">
                        {member.id === chat.owner_id ? 'Создатель чата' : 'Участник'} •
                        Роль: {member.role === 'admin' ? 'Администратор' : 'Пользователь'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded-full text-sm ${
                      member.is_active
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {member.is_active ? 'Активен' : 'Неактивен'}
                    </div>
                    {member.id !== chat.owner_id && chat.is_group && (
                      <button
                        onClick={() => toggleMember(member.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors flex items-center gap-2"
                      >
                        <UserX size={16} />
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {chat.members.length === 0 && (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <div className="text-gray-500 text-lg">В чате нет участников</div>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно добавления пользователей */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Заголовок */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Добавить участников в чат</h3>
                <p className="text-gray-600 mt-1">
                  Выберите пользователей для добавления в "{chat.is_group ? (chat.name || 'Групповой чат') : 'Личный чат'}"
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>

            {/* Сообщение об ошибке */}
            {errorMessage && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-red-700 text-sm">{errorMessage}</div>
              </div>
            )}

            {/* Список доступных пользователей */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {availableUsers.length > 0 ? (
                  availableUsers.map(user => (
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
                          <div className="text-xs text-gray-400">
                            Роль: {user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                          </div>
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
                  ))
                ) : (
                  <div className="text-center py-8">
                    <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <div className="text-gray-500">Все пользователи уже добавлены в этот чат</div>
                  </div>
                )}
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="p-6 border-t bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="text-gray-600">
                  Выбрано: <span className="font-semibold">{selectedUserIds.length}</span> пользователей
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={addSelectedUsers}
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