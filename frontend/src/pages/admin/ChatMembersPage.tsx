import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../services/api'

export default function ChatMembersPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [chat, setChat] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadChat()
    loadUsers()
  }, [])

  const loadChat = async () => {
    try {
      const response = await api.get(`/api/chats/${id}`)
      setChat(response.data)
    } catch (err) {
      alert('Чат не найден')
      navigate('/admin/chats')
    }
  }

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users')
      setUsers(response.data)
    } catch (err) {
      alert('Не удалось загрузить пользователей')
    }
  }

  const isMember = (userId: number) => {
    return chat.members.some((m: any) => m.id === userId)
  }

  const toggleMember = async (userId: number) => {
    setLoading(true)
    try {
      if (isMember(userId)) {
        // Удалить
        await api.delete(`/api/chats/${id}/members/${userId}`)
        setChat(prev => ({
          ...prev,
          members: prev.members.filter((m: any) => m.id !== userId)
        }))
      } else {
        // Добавить
        await api.post(`/api/chats/${id}/members`, { user_id: userId })
        const user = users.find(u => u.id === userId)
        setChat(prev => ({
          ...prev,
          members: [...prev.members, user]
        }))
      }
    } catch (err) {
      alert('Не удалось обновить участника')
    } finally {
      setLoading(false)
    }
  }

  if (!chat) return <div>Загрузка...</div>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Участники: {chat.name}</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b px-6 py-4 font-medium">Список пользователей</div>
        <div className="max-h-80 overflow-y-auto">
          {users.map(user => (
            <div
              key={user.id}
              className="flex items-center justify-between px-6 py-3 border-b hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">{user.full_name}</div>
                <div className="text-sm text-gray-500">{user.login}</div>
              </div>
              <button
                onClick={() => toggleMember(user.id)}
                disabled={loading}
                className={`px-4 py-1 rounded text-sm ${
                  isMember(user.id)
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isMember(user.id) ? 'Удалить' : 'Добавить'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={() => navigate('/admin/chats')}
          className="text-sm text-gray-600 hover:underline"
        >
          ← Назад к списку чатов
        </button>
      </div>
    </div>
  )
}