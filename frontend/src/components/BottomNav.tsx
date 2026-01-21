// frontend/src/components/BottomNav.tsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, Users, User } from 'lucide-react';

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Определяем активный маршрут
  const getActiveRoute = () => {
    const path = location.pathname;
    if (path.startsWith('/chat')) return 'chats';
    if (path.startsWith('/contacts')) return 'contacts';
    if (path.startsWith('/profile')) return 'profile';
    return 'chats'; // По умолчанию активен "Чаты"
  };

  const activeRoute = getActiveRoute();

  const navItems = [
    {
      id: 'chats',
      label: 'Чаты',
      icon: MessageSquare,
      path: '/chat',
      showLabel: false
    },
    {
      id: 'contacts',
      label: 'Контакты',
      icon: Users,
      path: '/contacts',
      showLabel: false
    },
    {
      id: 'profile',
      label: 'Профиль',
      icon: User,
      path: '/profile',
      showLabel: false
    }
  ];

  // Не показываем нижнюю навигацию на странице логина и админке
  if (location.pathname === '/login' || location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="flex items-center justify-around px-2 py-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRoute === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`
                flex flex-col items-center justify-center
                w-20 h-16 rounded-xl
                transition-all duration-200
                ${isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              `}
              aria-label={item.label}
              title={item.label}
            >
              <div className="relative">
                <Icon
                  size={26}
                  className={isActive ? 'text-blue-600' : ''}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full"></div>
                )}
              </div>

              {/* Надпись только на десктопе */}
              <span className={`
                text-xs mt-1 font-medium
                ${isActive ? 'text-blue-600' : 'text-gray-500'}
                hidden md:block
              `}>
                {item.label}
              </span>

              {/* Активный индикатор для мобильных */}
              {isActive && (
                <div className="md:hidden absolute -top-1 w-12 h-1 bg-blue-600 rounded-full"></div>
              )}
            </button>
          );
        })}
      </div>

      {/* Безопасная зона для iOS */}
      <div className="h-4 bg-white md:hidden"></div>
    </nav>
  );
};

export default BottomNav;