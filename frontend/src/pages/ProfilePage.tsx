// frontend/src/pages/ProfilePage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, Calendar, LogOut, Settings, Bell, Lock } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types';
import Avatar from '../components/ui/Avatar';
import LoadingScreen from '../components/LoadingScreen';
import MobileHeader from '../components/MobileHeader';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChats: 0,
    totalMessages: 0,
    unreadMessages: 0
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setLoading(true);
    try {
      // Загружаем данные текущего пользователя
      const response = await api.get<UserType>('/api/me');
      setUser(response.data);

      // Загружаем статистику (если есть endpoint)
      try {
        const statsResponse = await api.get('/api/me/stats');
        setStats(statsResponse.data);
      } catch (statsError) {
        console.log('Stats endpoint not available');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Если не удалось загрузить, редирект на логин
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  if (loading) {
    return <LoadingScreen message="Загрузка профиля..." />;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20"> {/* Увеличиваем padding-bottom для BottomNav */}
      <MobileHeader
        title="Профиль"
        showBackButton={true}
      />

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Карточка профиля */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col items-center mb-6">
            <Avatar
              userId={user.id}
              name={user.full_name}
              avatarUrl={user.avatar_url}
              size="xl"
              className="mb-4"
            />

            <h2 className="text-2xl font-bold text-gray-900">{user.full_name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-gray-600">@{user.login}</span>
              {user.role === 'admin' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                  <Shield size={12} />
                  Администратор
                </span>
              )}
            </div>
          </div>

          {/* Статистика */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-blue-50 rounded-xl">
              <div className="text-2xl font-bold text-blue-700">{stats.totalChats}</div>
              <div className="text-sm text-blue-600">Чаты</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-xl">
              <div className="text-2xl font-bold text-green-700">{stats.totalMessages}</div>
              <div className="text-sm text-green-600">Сообщения</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-xl">
              <div className="text-2xl font-bold text-red-700">{stats.unreadMessages}</div>
              <div className="text-sm text-red-600">Непрочитанные</div>
            </div>
          </div>

          {/* Информация */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
              <Mail className="text-gray-400" size={20} />
              <div>
                <div className="text-sm text-gray-500">Логин</div>
                <div className="font-medium">{user.login}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
              <User className="text-gray-400" size={20} />
              <div>
                <div className="text-sm text-gray-500">Полное имя</div>
                <div className="font-medium">{user.full_name}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg">
              <Calendar className="text-gray-400" size={20} />
              <div>
                <div className="text-sm text-gray-500">Дата регистрации</div>
                <div className="font-medium">
                  {new Date(user.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Настройки */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Настройки</h3>
          </div>

          <div className="divide-y divide-gray-100">
            <button
              onClick={() => console.log('Open settings')}
              className="flex items-center justify-between w-full p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Settings className="text-gray-400" size={20} />
                <span className="font-medium">Настройки аккаунта</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>

            <button
              onClick={() => console.log('Open notifications')}
              className="flex items-center justify-between w-full p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Bell className="text-gray-400" size={20} />
                <span className="font-medium">Уведомления</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>

            <button
              onClick={() => console.log('Open security')}
              className="flex items-center justify-between w-full p-4 hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Lock className="text-gray-400" size={20} />
                <span className="font-medium">Безопасность</span>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>

        {/* Выход */}
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full p-4 bg-red-50 text-red-700 hover:bg-red-100 rounded-2xl font-medium transition-colors"
        >
          <LogOut size={20} />
          Выйти из аккаунта
        </button>
      </div>

      {/* Добавляем отступ для BottomNav */}
      <div className="h-20"></div>
    </div>
  );
};

export default ProfilePage;