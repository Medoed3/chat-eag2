// frontend/src/pages/admin/UsersPage.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Search,
  Filter,
  UserPlus,
  MoreVertical,
  Mail,
  Phone,
  UserCheck,
  UserX,
  Edit,
  Trash2
} from 'lucide-react'
import api from '../../services/api'
import Avatar from '../../components/ui/Avatar'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedUsers, setSelectedUsers] = useState<number[]>([])
  const [showActions, setShowActions] = useState<number | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, search, roleFilter, statusFilter])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/users')
      setUsers(response.data)
    } catch (err) {
      console.error('Ошибка загрузки пользователей')
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
    try {
      await api.patch(`/api/users/${userId}/toggle-active`)
      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, is_active: !user.is_active } : user
      ))
    } catch (err) {
      console.error('Не удалось обновить статус')
    }
  }

  const deleteUser = async (userId: number) => {
    if (!confirm('Вы уверены, что хотите удалить пользователя?')) return
    try {
      await api.delete(`/api/users/${userId}`)
      setUsers(prev => prev.filter(user => user.id !== userId))
    } catch (err) {
      console.error('Не удалось удалить пользователя')
    }
  }

  const toggleSelectUser = (userId: number) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const bulkActivate = async () => {
    if (!selectedUsers.length) return

    try {
      for (const userId of selectedUsers) {
        await api.patch(`/api/users/${userId}/toggle-active`)
      }
      await loadUsers()
      setSelectedUsers([])
    } catch (err) {
      console.error('Не удалось выполнить массовое действие')
    }
  }

  const getRoleColor = (role: string) => {
    return role === 'admin'
      ? 'bg-purple-100 text-purple-800 border-purple-200'
      : 'bg-blue-100 text-blue-800 border-blue-200'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
            <p className="text-gray-600">Управление сотрудниками</p>
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
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center">
              <Users className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
              <p className="text-gray-600">Всего {users.length} сотрудников</p>
            </div>
          </div>
        </div>

        <Link to="/admin/users/create">
          <Button className="gap-2">
            <UserPlus size={18} />
            Добавить пользователя
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
                placeholder="Поиск по имени или логину..."
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
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-300 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Все роли</option>
                <option value="admin">Администраторы</option>
                <option value="user">Пользователи</option>
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
                <option value="active">Только активные</option>
                <option value="inactive">Неактивные</option>
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Массовые действия */}
      {selectedUsers.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                {selectedUsers.length}
              </div>
              <div>
                <div className="font-medium text-blue-900">Выбрано {selectedUsers.length} пользователей</div>
                <div className="text-sm text-blue-700">Выберите действие</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={bulkActivate}
                variant="outline"
                className="border-blue-300 text-blue-700"
              >
                <UserCheck size={18} />
                Активировать
              </Button>
              <Button variant="outline" className="border-red-300 text-red-700">
                <UserX size={18} />
                Деактивировать
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Список пользователей */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-4 px-6 text-left">
                  <input
                    type="checkbox"
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onChange={() => {
                      if (selectedUsers.length === filteredUsers.length) {
                        setSelectedUsers([])
                      } else {
                        setSelectedUsers(filteredUsers.map(u => u.id))
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-4 px-6 text-left font-medium text-gray-900">Пользователь</th>
                <th className="py-4 px-6 text-left font-medium text-gray-900">Контакт</th>
                <th className="py-4 px-6 text-left font-medium text-gray-900">Роль</th>
                <th className="py-4 px-6 text-left font-medium text-gray-900">Статус</th>
                <th className="py-4 px-6 text-left font-medium text-gray-900">Дата</th>
                <th className="py-4 px-6 text-left font-medium text-gray-900">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleSelectUser(user.id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={user.avatar_url}
                        name={user.full_name}
                        size="md"
                        status={user.is_active ? "online" : "offline"}
                      />
                      <div>
                        <div className="font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500">@{user.login}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail size={14} />
                        <span>{user.login}@company.ru</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={14} />
                        <span>+7 (XXX) XXX-XX-XX</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(user.role)}`}>
                      {user.role === 'admin' ? 'Администратор' : 'Сотрудник'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      user.is_active
                        ? 'bg-green-100 text-green-800 border border-green-200'
                        : 'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                      {user.is_active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </td>
                  <td className="py-4 px-6">
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
                        title={user.is_active ? 'Заблокировать' : 'Активировать'}
                      >
                        {user.is_active ? <UserX size={18} /> : <UserCheck size={18} />}
                      </button>
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button
                        onClick={() => setShowActions(showActions === user.id ? null : user.id)}
                        className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors relative"
                      >
                        <MoreVertical size={18} />
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
            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Users className="text-gray-400" size={40} />
            </div>
            <div className="text-gray-500 text-lg mb-2">Пользователи не найдены</div>
            <div className="text-gray-400">Попробуйте изменить параметры поиска</div>
          </div>
        )}
      </div>

      {/* Пагинация */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Показано {filteredUsers.length} из {users.length} пользователей
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
    </div>
  )
}