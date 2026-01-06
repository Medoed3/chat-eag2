// frontend/src/components/CreateGroupModal.tsx
import { useState, useEffect } from 'react'
import api from '../services/api'
import { User } from '../types'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

const CreateGroupModal = ({ isOpen, onClose, onSuccess }: CreateGroupModalProps) => {
  const [name, setName] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen])

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users')
      setUsers(response.data.filter((user: User) => user.is_active))
    } catch (err) {
      console.error('Ошибка загрузки пользователей', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || selectedUserIds.length === 0) return

    setLoading(true)
    try {
      await api.post('/api/chats', {
        name: name.trim(),
        is_group: true,
        member_ids: selectedUserIds
      })
      onSuccess()
      onClose()
      setName('')
      setSelectedUserIds([])
    } catch (err) {
      console.error('Ошибка создания чата', err)
      alert('Ошибка создания группового чата')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Новый групповой чат</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Название группы
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Введите название"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите участников
            </label>
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              {users.map(user => (
                <div key={user.id} className="flex items-center p-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    id={`user-${user.id}`}
                    checked={selectedUserIds.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds([...selectedUserIds, user.id])
                      } else {
                        setSelectedUserIds(selectedUserIds.filter(id => id !== user.id))
                      }
                    }}
                    className="mr-3"
                  />
                  <label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer">
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-sm text-gray-500">@{user.login}</div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={loading || !name.trim() || selectedUserIds.length === 0}
            >
              {loading ? 'Создание...' : 'Создать чат'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateGroupModal