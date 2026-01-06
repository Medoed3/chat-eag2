// frontend/src/pages/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MessageSquare, Eye, EyeOff, Smartphone } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function LoginPage() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login: loginFn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await loginFn(login, password)
      navigate('/chat', { replace: true })
    } catch (err: any) {
      setError(err.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setLogin('admin')
    setPassword('admin123')
    // Автоматический вход через 500мс
    setTimeout(() => {
      handleSubmit(new Event('submit') as any)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <div className="pt-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0088cc] to-[#00a2ff] flex items-center justify-center">
              <MessageSquare className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Вход в мессенджер</h1>
              <p className="text-gray-600">Производственная компания</p>
            </div>
          </div>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl p-8">
            {/* Заголовок формы */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Добро пожаловать</h2>
              <p className="text-gray-600">Введите данные для входа</p>
            </div>

            {/* Форма */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-600 text-center">{error}</p>
                </div>
              )}

              <Input
                label="Логин"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Введите ваш логин"
                required
                autoComplete="username"
                className="rounded-xl"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Пароль
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль"
                    required
                    autoComplete="current-password"
                    className="pr-12 rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                fullWidth
                size="lg"
                className="rounded-xl font-semibold"
              >
                Войти
              </Button>
            </form>

            {/* Демо доступ */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={handleDemoLogin}
                className="w-full py-3 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 text-blue-700 rounded-xl font-medium hover:from-blue-100 hover:to-cyan-100 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Smartphone size={18} />
                Быстрый вход (демо)
              </button>
              <p className="text-center text-xs text-gray-500 mt-3">
                Логин: admin | Пароль: admin123
              </p>
            </div>

            {/* PWA подсказка */}
            <div className="mt-8 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0088cc] to-[#00a2ff] rounded-xl flex items-center justify-center">
                  <Smartphone className="text-white" size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Установите приложение
                  </p>
                  <p className="text-xs text-gray-600">
                    Для удобства добавьте на главный экран
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Футер */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Корпоративный мессенджер © 2024
            </p>
          </div>
        </div>
      </div>

      {/* Декоративные элементы */}
      <div className="absolute top-0 left-0 right-0 overflow-hidden -z-10">
        <svg
          className="w-full h-64"
          viewBox="0 0 1440 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 96L48 112C96 128 192 160 288 160C384 160 480 128 576 112C672 96 768 96 864 112C960 128 1056 160 1152 160C1248 160 1344 128 1392 112L1440 96V320H1392C1344 320 1248 320 1152 320C1056 320 960 320 864 320C768 320 672 320 576 320C480 320 384 320 288 320C192 320 96 320 48 320H0V96Z"
            fill="url(#gradient)"
            fillOpacity="0.1"
          />
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#0088cc" />
              <stop offset="1" stopColor="#00a2ff" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  )
}