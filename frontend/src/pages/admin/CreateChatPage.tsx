import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

export default function CreateChatPage() {
  const [formData, setFormData] = useState({
    name: '',
    member_ids: [] as number[]
  })
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users')
      setUsers(response.data)
    } catch (err) {
      alert('Не удалось загрузить пользователей')
    }
  }

  const toggleMember = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(userId)
        ? prev.member_ids.filter(id => id !== userId)
        : [...prev.member_ids, userId]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.member_ids.length === 0) {
      setError('Выберите хотя бы одного участника')
      return
    }
    setError('')
    setLoading(true)

    try {
      await api.post('/api/chats', {
        ...formData,
        is_group: true
      })
      alert('Чат создан')
      navigate('/admin/chats')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка создания чата')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Создать групповой чат</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Название чата *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Участники *</label>
          <div className="border rounded-lg max-h-60 overflow-y-auto">
            {users.length === 0 ? (
              <div className="p-4 text-gray-500">Загрузка пользователей...</div>
            ) : (
              users.map(user => (
                <label
                  key={user.id}
                  className="flex items-center p-3 hover:bg-gray-50 border-b cursor-pointer last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={formData.member_ids.includes(user.id)}
                    onChange={() => toggleMember(user.id)}
                    className="w-4 h-4 mr-3"
                  />
                  <span>{user.full_name} ({user.login})</span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать чат'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/chats')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}