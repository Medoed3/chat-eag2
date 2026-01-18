import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../services/api'

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    login: '',
    full_name: '',
    password: '',
    role: 'user' as 'user' | 'admin',
    avatar_url: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    try {
      const response = await api.get(`/api/users/${id}`)
      const user = response.data
      setFormData({
        login: user.login,
        full_name: user.full_name,
        password: '', // не подгружаем
        role: user.role,
        avatar_url: user.avatar_url || ''
      })
    } catch (err) {
      alert('Пользователь не найден')
      navigate('/admin/users')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const payload = { ...formData }
    if (!payload.password) delete payload.password // Если пуст — не отправляем

    try {
      await api.patch(`/api/users/${id}`, payload)
      alert('Пользователь обновлён')
      navigate('/admin/users')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка обновления')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Редактировать пользователя</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2">Логин *</label>
            <input
              type="text"
              required
              value={formData.login}
              onChange={e => setFormData({ ...formData, login: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Отображаемое имя *</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Новый пароль (оставьте пустым, чтобы не менять)</label>
            <input
              type="password"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              placeholder="Оставить пустым, чтобы не менять"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Роль</label>
            <select
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value as 'user' | 'admin' })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="user">Пользователь</option>
              <option value="admin">Администратор</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Аватар (URL)</label>
            <input
              type="url"
              placeholder="https://..."
              value={formData.avatar_url}
              onChange={e => setFormData({ ...formData, avatar_url: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/users')}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}