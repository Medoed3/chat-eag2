// frontend/src/components/AdminLayout.tsx
import React, { useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronLeft,
  BarChart3,
  Shield,
  Home
} from 'lucide-react'
import Avatar from './ui/Avatar'
import Button from './ui/Button'

interface AdminLayoutProps {
  children: React.ReactNode
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const goToChat = () => {
    navigate('/chat')
  }

  const menuItems = [
    {
      icon: <LayoutDashboard size={20} />,
      label: 'Дашборд',
      path: '/admin',
      exact: true
    },
    {
      icon: <Users size={20} />,
      label: 'Пользователи',
      path: '/admin/users'
    },
    {
      icon: <MessageSquare size={20} />,
      label: 'Чаты',
      path: '/admin/chats'
    },
    {
      icon: <BarChart3 size={20} />,
      label: 'Статистика',
      path: '/admin/stats'
    },
    {
      icon: <Settings size={20} />,
      label: 'Настройки',
      path: '/admin/settings'
    }
  ]

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="text-purple-600" size={20} />
              <span className="font-semibold">Админ-панель</span>
            </div>
          </div>
          <button
            onClick={goToChat}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <Home size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar для десктопа */}
      <div className="hidden lg:flex">
        {/* Sidebar */}
        <div className="w-64 min-h-screen bg-white border-r shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-xl flex items-center justify-center">
                <Shield className="text-white" size={24} />
              </div>
              <div>
                <h1 className="font-bold text-lg text-gray-900">Админ-панель</h1>
                <p className="text-sm text-gray-500">Управление системой</p>
              </div>
            </div>

            {/* Профиль админа */}
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl mb-6">
              <Avatar
                src={user?.avatar_url}
                name={user?.full_name || 'Админ'}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user?.full_name}</div>
                <div className="text-xs text-purple-600 font-semibold">Администратор</div>
              </div>
            </div>
          </div>

          {/* Меню */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive(item.path, item.exact)
                    ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-purple-600'
                }`}
              >
                <div className={`${isActive(item.path, item.exact) ? 'text-white' : 'text-gray-500'}`}>
                  {item.icon}
                </div>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* Футер сайдбара */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
            <Button
              onClick={goToChat}
              variant="outline"
              fullWidth
              className="mb-3"
            >
              <Home size={18} />
              К чатам
            </Button>
            <Button
              onClick={handleLogout}
              variant="ghost"
              fullWidth
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut size={18} />
              Выйти
            </Button>
          </div>
        </div>

        {/* Основной контент */}
        <div className="flex-1">
          <div className="p-6 max-w -7xl mx-auto">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Затемнение */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Боковая панель */}
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl animate-in slide-in-from-left-5">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Shield className="text-purple-600" size={24} />
                  <h1 className="font-bold text-lg">Админ-панель</h1>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Профиль */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl">
                <Avatar
                  src={user?.avatar_url}
                  name={user?.full_name || 'Админ'}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user?.full_name}</div>
                  <div className="text-xs text-purple-600 font-semibold">Администратор</div>
                </div>
              </div>
            </div>

            {/* Меню для мобилки */}
            <nav className="p-4 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive(item.path, item.exact)
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-purple-600'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>

            {/* Футер для мобилки */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white space-y-3">
              <Button
                onClick={goToChat}
                variant="outline"
                fullWidth
              >
                <ChevronLeft size={18} />
                К чатам
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                fullWidth
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut size={18} />
                Выйти
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Контент для мобилки */}
      <div className="lg:hidden p-4">
        <div className="max-w-4xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

export default AdminLayout