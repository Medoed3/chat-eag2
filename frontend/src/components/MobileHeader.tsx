// frontend/src/components/MobileHeader.tsx
import React, { useState } from 'react';
import { LogOut, User, Settings, Shield, MessageSquare, ChevronLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';

interface MobileHeaderProps {
  title?: string;
  showBackButton?: boolean; // Добавили новый пропс
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title = 'Мессенджер',
  showBackButton = false // По умолчанию не показываем кнопку назад
}) => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate(); // Для навигации назад

  const handleLogout = async () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      await logout();
    }
  };

  // Обработчик кнопки "назад"
  const handleBackClick = () => {
    navigate('/chat');
  };

  return (
    <div className="bg-white border-b shadow-sm sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Левая часть - кнопка назад и логотип */}
        <div className="flex items-center gap-3">
          {showBackButton && (
            <button
              onClick={handleBackClick}
              className="p-2 hover:bg-gray-100 rounded-lg mr-1"
              aria-label="Назад к списку чатов"
            >
              <ChevronLeft size={22} className="text-gray-700" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#0088cc] to-[#00a2ff] rounded-xl flex items-center justify-center">
              <MessageSquare size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-gray-900">{title}</h1>
              <p className="text-xs text-gray-500">{user?.full_name || 'Пользователь'}</p>
            </div>
          </div>
        </div>

        {/* Правая часть - меню пользователя с аватаркой (без изменений) */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Меню пользователя"
          >
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
              {user?.full_name?.charAt(0) || 'П'}
            </div>
          </button>

          {/* Выпадающее меню (без изменений) */}
          {showDropdown && (
            <>
              {/* Затемнение фона */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDropdown(false)}
              />

              {/* Меню */}
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border z-50 py-3 animate-fade-in">
                {/* Информация о пользователе */}
                <div className="px-4 py-3 border-b">
                  <div className="font-semibold text-gray-900 truncate">{user?.full_name}</div>
                  <div className="text-sm text-gray-500 truncate">{user?.login}</div>
                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Shield size={14} className="text-purple-600" />
                      <span className="text-xs text-purple-600 font-semibold">Администратор</span>
                    </div>
                  )}
                </div>

                {/* Навигационные ссылки */}
                <div className="py-1">
                  {user?.role === 'admin' && (
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-100 to-purple-50 flex items-center justify-center">
                        <Shield size={18} className="text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">Админ-панель</div>
                        <div className="text-xs text-gray-500">Управление системой</div>
                      </div>
                    </Link>
                  )}

                  <Link
                    to="/settings"
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-gray-100 to-gray-50 flex items-center justify-center">
                      <Settings size={18} className="text-gray-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Настройки</div>
                      <div className="text-xs text-gray-500">Персональные настройки</div>
                    </div>
                  </Link>

                  <Link
                    to="/profile"
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-blue-100 to-cyan-50 flex items-center justify-center">
                      <User size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">Профиль</div>
                      <div className="text-xs text-gray-500">Личная информация</div>
                    </div>
                  </Link>
                </div>

                {/* Кнопка выхода */}
                <div className="border-t pt-2">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      handleLogout();
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors w-full"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-red-100 to-red-50 flex items-center justify-center">
                      <LogOut size={18} className="text-red-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="font-medium">Выйти</div>
                      <div className="text-xs text-red-500">Завершить сеанс</div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileHeader;