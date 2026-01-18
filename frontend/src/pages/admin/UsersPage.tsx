// frontend/src/pages/admin/UsersPage.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Search,
  Filter,
  UserPlus,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Shield,
  User as UserIcon
} from 'lucide-react'
import { api } from '../../services/api'
import Avatar from '../../components/ui/Avatar'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, search, roleFilter, statusFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/admin/users')
      setUsers(response.data)
    } catch (err) {
      console.error('Ошибка загрузки пользователей')
      alert('Ошибка загрузки пользователей')
    } finally {
      setLoading(false)
    }
  }

  const filterUsers = () => {
    let filtered = users

    if (search) {
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(search.toLowerCase()) ||
        user.login.toLowerCase().includes(search.toLowerCase())
      )
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user =>
        statusFilter === 'active' ? user.is_active : !user.is_active
      )
    }

    setFilteredUsers(filtered)
  }

  const toggleUserActive = async (userId: number) => {
    const user = users.find(u => u.id === userId)
    const action = user?.is_active ? 'деактивировать' : 'активировать'

    if (!confirm(`Вы уверены, что хотите ${action} пользователя ${user?.full_name}?`)) return

    try {
      await api.patch(`/api/admin/users/${userId}/toggle-active`)
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, is_active: !user.is_active } : user
      ))
    } catch (err) {
      console.error('Не удалось обновить статус')
      alert('Не удалось обновить статус пользователя')
    }
  }

  const deleteUser = async (userId: number) => {
    const user = users.find(u => u.id === userId)
    if (!confirm(`Вы уверены, что хотите деактивировать пользователя ${user?.full_name}?`)) return

    try {
      await api.delete(`/api/users/${userId}`)
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_active: false } : u
      ))
    } catch (err) {
      console.error('Не удалось деактивировать пользователя')
      alert('Не удалось деактивировать пользователя')
    }
  }

  const toggleSelectUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id))
    }
  }

  const bulkActivate = async () => {
    if (selectedUsers.length === 0) {
      alert('Выберите пользователей')
      return
    }

    if (!confirm(`Активировать ${selectedUsers.length} пользователей?`)) return

    try {
      await api.post('/api/admin/users/bulk-activate', { user_ids: selectedUsers })
      await loadUsers()
      setSelectedUsers([])
      alert('Пользователи активированы')
    } catch (err) {
      console.error('Не удалось выполнить массовое действие')
      alert('Не удалось активировать пользователей')
    }
  }

  const bulkDeactivate = async () => {
    if (selectedUsers.length === 0) {
      alert('Выберите пользователей')
      return
    }

    if (!confirm(`Деактивировать ${selectedUsers.length} пользователей?`)) return

    try {
      await api.post('/api/admin/users/bulk-deactivate', { user_ids: selectedUsers })
      await loadUsers()
      setSelectedUsers([])
      alert('Пользователи деактивированы')
    } catch (err) {
      console.error('Не удалось выполнить массовое действие')
      alert('Не удалось деактивировать пользователей')
    }
  }

  const getRoleColor = (role: string) => {
    return role === 'admin'
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="mt-4 text-gray-600">Загрузка пользователей...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
          <p className="text-gray-600 mt-1">
            Всего {users.length} сотрудников • Активных: {users.filter(u => u.is_active).length}
          </p>
        </div>

        <Link to="/admin/users/create">
          <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg transition-colors">
            <UserPlus size={20} />
            Добавить пользователя
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
                placeholder="Поиск по имени или логину..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Фильтры */}
          <div className="flex gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
            >
              <option value="all">Все роли</option>
              <option value="admin">Администраторы</option>
              <option value="user">Пользователи</option>
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
      {selectedUsers.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                {selectedUsers.length}
              </div>
              <div>
                <div className="font-semibold text-blue-900">Выбрано {selectedUsers.length} пользователей</div>
                <div className="text-sm text-blue-700">Выберите действие</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={bulkActivate}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <UserCheck size={18} />
                Активировать
              </button>
              <button
                onClick={bulkDeactivate}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <UserX size={18} />
                Деактивировать
              </button>
              <button
                onClick={() => setSelectedUsers([])}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Снять выделение
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Таблица пользователей */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-left">
                  <input
                    type="checkbox"
                    checked={filteredUsers.length > 0 && selectedUsers.length === filteredUsers.length}
                    onChange={selectAllUsers}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </th>
                <th className="py-3 px-4 text-left font-semibold text-gray-900">Пользователь</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-900">Логин</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-900">Роль</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-900">Статус</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-900">Дата регистрации</th>
                <th className="py-3 px-4 text-left font-semibold text-gray-900">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {user.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">ID: {user.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-gray-900 font-mono">@{user.login}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${getRoleColor(user.role)}`}>
                      {user.role === 'admin' ? <Shield size={14} /> : <UserIcon size={14} />}
                      <span>{user.role === 'admin' ? 'Админ' : 'Пользователь'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                      user.is_active
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {user.is_active ? <UserCheck size={14} /> : <UserX size={14} />}
                      <span>{user.is_active ? 'Активен' : 'Неактивен'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/admin/users/${user.id}/edit`}
                        className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit size={18} />
                      </Link>
                      <button
                        onClick={() => toggleUserActive(user.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.is_active
                            ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                            : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                        }`}
                        title={user.is_active ? 'Деактивировать' : 'Активировать'}
                      >
                        {user.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Деактивировать"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="py-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <div className="text-gray-500 text-lg mb-2">Пользователи не найдены</div>
            <div className="text-gray-400 mb-6">Попробуйте изменить параметры поиска</div>
            <Link to="/admin/users/create">
              <button className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors mx-auto">
                <UserPlus size={20} />
                Добавить первого пользователя
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}