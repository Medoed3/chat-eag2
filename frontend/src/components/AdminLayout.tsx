// frontend/src/components/AdminLayout.tsx - ИСПРАВЛЯЕМ меню и logout
import React, { useState } from 'react'
import { useNavigate, Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  Shield,
  Home
} from 'lucide-react'
import LogoutButton from './LogoutButton'

interface AdminLayoutProps {
  children?: React.ReactNode
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const goToChat = () => {
    navigate('/chat')
  }

  const menuItems = [
    {
      icon: <LayoutDashboard size={20} />,
      label: 'Дашборд',
      path: '/admin/dashboard',
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
    }
  ]

  const isActive = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
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
      <div className="hidden lg:flex min-h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r shadow-sm flex-shrink-0 flex flex-col">
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
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                {user?.full_name?.charAt(0) || 'А'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user?.full_name}</div>
                <div className="text-xs text-purple-600 font-semibold">Администратор</div>
              </div>
            </div>
          </div>

          {/* Меню */}
          <nav className="p-4 space-y-1 flex-1">
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
          <div className="p-4 border-t bg-white space-y-3">
            <button
              onClick={goToChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Home size={18} />
              К чатам
            </button>
            <LogoutButton className="w-full justify-center" />
          </div>
        </div>

        {/* Основной контент */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Outlet будет рендерить дочерние маршруты */}
          <Outlet />
          {/* Также рендерим children если переданы напрямую */}
          {children}
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
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-xl flex flex-col">
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
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.full_name?.charAt(0) || 'А'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user?.full_name}</div>
                  <div className="text-xs text-purple-600 font-semibold">Администратор</div>
                </div>
              </div>
            </div>

            {/* Меню для мобилки */}
            <nav className="p-4 space-y-1 flex-1">
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
            <div className="p-4 border-t bg-white space-y-3">
              <button
                onClick={goToChat}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <ChevronLeft size={18} />
                К чатам
              </button>
              <LogoutButton mobile className="justify-center" />
            </div>
          </div>
        </div>
      )}

      {/* Контент для мобилки */}
      <div className="lg:hidden">
        {/* Outlet будет рендерить дочерние маршруты */}
        <Outlet />
        {/* Также рендерим children если переданы напрямую */}
        {children}
      </div>
    </div>
  )
}

export default AdminLayout