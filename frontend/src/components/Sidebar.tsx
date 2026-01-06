import { Link, useLocation } from 'react-router-dom'

const menuItems = [
  { path: '/admin', label: 'Статистика', icon: '📊' },
  { path: '/admin/users', label: 'Пользователи', icon: '👥' },
  { path: '/admin/chats', label: 'Чаты', icon: '💬' }
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen fixed">
      <div className="p-6 text-xl font-bold border-b border-gray-700">
        Админ-панель
      </div>
      <nav className="mt-4">
        {menuItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-6 py-3 hover:bg-gray-700 transition ${
              location.pathname === item.path ? 'bg-gray-700' : ''
            }`}
          >
            <span className="mr-3 text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}