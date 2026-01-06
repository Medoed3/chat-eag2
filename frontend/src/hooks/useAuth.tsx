// frontend/src/hooks/useAuth.tsx
import { useState, useEffect, createContext, useContext } from 'react'
import api from '../services/api'

export interface User {
  id: number
  login: string
  full_name: string
  role: string
  avatar_url: string | null
  is_active: boolean
  created_at: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (token) {
      // Используем interceptor, не устанавливаем напрямую в defaults
      api.get('/api/me')
        .then(res => {
          setUser(res.data)
        })
        .catch((err) => {
          console.error('Ошибка проверки токена:', err)
          localStorage.removeItem('access_token')
          // Не нужно удалять заголовки, interceptor сам их установит
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (login: string, password: string) => {
    try {
      // Сбрасываем заголовки перед логином
      const response = await api.post('/login', { login, password })
      const { access_token, user } = response.data

      if (!access_token || !user) {
        throw new Error('Invalid login response')
      }

      localStorage.setItem('access_token', access_token)
      // Устанавливаем пользователя
      setUser(user)
    } catch (err: any) {
      if (err.response?.status === 401) {
        throw new Error('Неверный логин или пароль')
      } else if (err.response?.status === 403) {
        throw new Error('Аккаунт отключён')
      } else {
        throw new Error('Ошибка сервера. Попробуйте позже.')
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
