// frontend/src/pages/admin/DashboardPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  MessageSquare,
  BarChart3,
  Shield,
  Settings,
  UserPlus,
  MessageCircle
} from 'lucide-react'
import { api } from '../../services/api'

interface Stats {
  total_users: number
  active_users: number
  total_chats: number
  total_messages: number
  active_chats: number
  group_chats: number
  personal_chats: number
  new_users_24h: number
  new_messages_24h: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/admin/stats')
      setStats(response.data)
    } catch (err) {
      console.error('Ошибка загрузки статистики')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-600">Статистика системы</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-xl p-6 border shadow-sm">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
          <Shield className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Админ-панель</h1>
          <p className="text-gray-600">Обзор системы и статистика</p>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="text-blue-600" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{stats?.total_users || 0}</div>
              <div className="text-sm text-green-600">
                +{stats?.new_users_24h || 0} за 24ч
              </div>
            </div>
          </div>
          <div className="text-gray-600">Всего пользователей</div>
          <div className="text-sm text-gray-500 mt-1">
            Активных: {stats?.active_users || 0}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="text-green-600" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{stats?.total_chats || 0}</div>
              <div className="text-sm text-green-600">
                {stats?.group_chats || 0} групповых
              </div>
            </div>
          </div>
          <div className="text-gray-600">Всего чатов</div>
          <div className="text-sm text-gray-500 mt-1">
            Личных: {stats?.personal_chats || 0}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="text-purple-600" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{stats?.total_messages || 0}</div>
              <div className="text-sm text-green-600">
                +{stats?.new_messages_24h || 0} за 24ч
              </div>
            </div>
          </div>
          <div className="text-gray-600">Сообщений</div>
          <div className="text-sm text-gray-500 mt-1">
            В системе
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="text-orange-600" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">{stats?.active_chats || 0}</div>
              <div className="text-sm text-green-600">
                {Math.round(((stats?.active_chats || 0) / (stats?.total_chats || 1)) * 100)}%
              </div>
            </div>
          </div>
          <div className="text-gray-600">Активных чатов</div>
          <div className="text-sm text-gray-500 mt-1">
            От общего числа
          </div>
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="bg-white rounded-xl border p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Быстрые действия</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/users/create')}
            className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                <UserPlus size={20} />
              </div>
              <div>
                <div className="font-semibold text-blue-900">Добавить пользователя</div>
                <div className="text-sm text-blue-700 mt-1">Новый сотрудник</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/chats/create')}
            className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 p-4 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center">
                <MessageCircle size={20} />
              </div>
              <div>
                <div className="font-semibold text-green-900">Создать чат</div>
                <div className="text-sm text-green-700 mt-1">Групповой чат</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/users')}
            className="bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 p-4 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600 text-white rounded-lg flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <div className="font-semibold text-purple-900">Управление пользователями</div>
                <div className="text-sm text-purple-700 mt-1">Список сотрудников</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/admin/chats')}
            className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-200 p-4 rounded-xl hover:from-orange-100 hover:to-orange-200 transition-all duration-200 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-600 text-white rounded-lg flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <div>
                <div className="font-semibold text-orange-900">Управление чатами</div>
                <div className="text-sm text-orange-700 mt-1">Список чатов</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
