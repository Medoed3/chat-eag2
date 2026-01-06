// frontend/src/pages/admin/DashboardPage.tsx
import { useState, useEffect } from 'react'
import {
  Users,
  MessageSquare,
  BarChart3,
  TrendingUp,
  Activity,
  Clock,
  Shield
} from 'lucide-react'
import api from '../../services/api'

interface Stats {
  total_users: number
  active_users: number
  total_chats: number
  total_messages: number
  online_users?: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week')

  useEffect(() => {
    loadStats()
  }, [timeRange])

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

  const statCards = [
    {
      title: 'Всего пользователей',
      value: stats?.total_users || 0,
      change: '+12%',
      icon: <Users className="text-blue-600" size={24} />,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Активных сейчас',
      value: stats?.active_users || 0,
      change: '+5%',
      icon: <Activity className="text-green-600" size={24} />,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Чатов',
      value: stats?.total_chats || 0,
      change: '+8%',
      icon: <MessageSquare className="text-purple-600" size={24} />,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Сообщений',
      value: stats?.total_messages || 0,
      change: '+23%',
      icon: <BarChart3 className="text-orange-600" size={24} />,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50'
    }
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Дашборд</h1>
            <p className="text-gray-600">Статистика системы</p>
          </div>
          <div className="animate-pulse bg-gray-200 rounded-lg w-32 h-10" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
              <Shield className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Админ-панель</h1>
              <p className="text-gray-600">Обзор системы и статистика</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimeRange('day')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === 'day'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            День
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === 'week'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Неделя
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeRange === 'month'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Месяц
          </button>
        </div>
      </div>

      {/* Карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden card-hover"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${card.bgColor} rounded-xl`}>
                  {card.icon}
                </div>
                <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <TrendingUp size={16} />
                  {card.change}
                </div>
              </div>

              <div className="mb-2">
                <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                <div className="text-gray-600 text-sm">{card.title}</div>
              </div>

              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${card.color} rounded-full`}
                  style={{ width: `${Math.min((card.value as number / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Графики и таблицы (заглушки) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Активность пользователей */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Активность пользователей</h3>
              <p className="text-gray-600 text-sm">За последние 7 дней</p>
            </div>
            <Clock className="text-gray-400" size={20} />
          </div>

          <div className="space-y-4">
            {[
              { label: 'Понедельник', value: 85 },
              { label: 'Вторник', value: 92 },
              { label: 'Среда', value: 78 },
              { label: 'Четверг', value: 95 },
              { label: 'Пятница', value: 88 },
              { label: 'Суббота', value: 65 },
              { label: 'Воскресенье', value: 45 }
            ].map((day, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{day.label}</span>
                  <span className="font-medium">{day.value}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"
                    style={{ width: `${day.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Быстрые действия */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Быстрые действия</h3>

          <div className="space-y-3">
            <button className="w-full text-left p-4 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 transition-all duration-200">
              <div className="font-medium text-blue-900">Добавить пользователя</div>
              <div className="text-sm text-blue-700 mt-1">Создать нового сотрудника</div>
            </button>

            <button className="w-full text-left p-4 bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 transition-all duration-200">
              <div className="font-medium text-green-900">Создать чат</div>
              <div className="text-sm text-green-700 mt-1">Новый групповой чат</div>
            </button>

            <button className="w-full text-left p-4 bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 transition-all duration-200">
              <div className="font-medium text-purple-900">Настройки системы</div>
              <div className="text-sm text-purple-700 mt-1">Общие параметры</div>
            </button>
          </div>
        </div>
      </div>

      {/* Последние активности */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Последние активности</h3>

        <div className="space-y-4">
          {[
            { user: 'Иван Петров', action: 'отправил сообщение', time: '2 мин назад', type: 'message' },
            { user: 'Анна Сидорова', action: 'создала групповой чат', time: '15 мин назад', type: 'chat' },
            { user: 'Сергей Иванов', action: 'зарегистрировался', time: '1 час назад', type: 'user' },
            { user: 'Мария Козлова', action: 'загрузила файл', time: '2 часа назад', type: 'file' },
            { user: 'Администратор', action: 'обновил настройки', time: '5 часов назад', type: 'settings' }
          ].map((activity, i) => (
            <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                activity.type === 'message' ? 'bg-blue-100 text-blue-600' :
                activity.type === 'chat' ? 'bg-green-100 text-green-600' :
                activity.type === 'user' ? 'bg-purple-100 text-purple-600' :
                'bg-orange-100 text-orange-600'
              }`}>
                {activity.type === 'message' && <MessageSquare size={20} />}
                {activity.type === 'chat' && <Users size={20} />}
                {activity.type === 'user' && <Users size={20} />}
                {activity.type === 'file' && <BarChart3 size={20} />}
                {activity.type === 'settings' && <Settings size={20} />}
              </div>

              <div className="flex-1">
                <div className="font-medium text-gray-900">{activity.user}</div>
                <div className="text-sm text-gray-600">{activity.action}</div>
              </div>

              <div className="text-sm text-gray-500">{activity.time}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}