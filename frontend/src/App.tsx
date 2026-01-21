// frontend/src/App.tsx - ОБНОВЛЕННАЯ ВЕРСИЯ
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import ContactsPage from './pages/ContactsPage'; // ДОБАВЛЯЕМ ИМПОРТ
import ProfilePage from './pages/ProfilePage'; // ДОБАВЛЯЕМ ИМПОРТ
import BottomNav from './components/BottomNav'; // ДОБАВЛЯЕМ ИМПОРТ
import AdminLayout from './components/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/UsersPage';
import AdminChatsPage from './pages/admin/AdminChatsPage';
import ChatMembersPage from './pages/admin/ChatMembersPage';
import CreateUserPage from './pages/admin/CreateUserPage';
import EditUserPage from './pages/admin/EditUserPage';
import CreateChatPage from './pages/admin/CreateChatPage';
import EditChatPage from './pages/admin/EditChatPage';
import { useAuth, AuthProvider } from './hooks/useAuth';
import { messageSyncService } from './services/messageSync';
import LoadingScreen from './components/LoadingScreen';
import './index.css';

// Компонент для защищенных роутов
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Проверка авторизации..." />;
  }

  if (!isAuthenticated) {
    // Сохраняем текущий путь для редиректа после входа
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Компонент для административных роутов
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Проверка прав доступа..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    // Перенаправляем в мессенджер, если не админ
    return <Navigate to="/chat" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Обертка для страниц с Bottom Navigation
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  // Не показываем BottomNav на некоторых страницах
  const hideBottomNav = location.pathname === '/login' ||
                        location.pathname.startsWith('/admin') ||
                        location.pathname.match(/^\/chat\/\d+$/); // Не показываем в конкретном чате

  return (
    <>
      {children}
      {!hideBottomNav && <BottomNav />}
    </>
  );
};

// Основной компонент приложения с маршрутами
function AppContent() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineWarning, setShowOfflineWarning] = useState(false);

  // Отслеживаем онлайн/оффлайн статус
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineWarning(false);

      // При восстановлении соединения восстанавливаем очередь
      messageSyncService.restoreFromLocalStorage().catch(console.error);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineWarning(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Восстанавливаем очередь при загрузке
  useEffect(() => {
    messageSyncService.restoreFromLocalStorage().catch(console.error);
  }, []);

  return (
    <div className="App">
      {/* Оффлайн предупреждение */}
      {showOfflineWarning && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
          <div className="container mx-auto flex items-center justify-between">
            <span>⚠️ Вы сейчас не в сети. Сообщения будут сохранены и отправлены позже.</span>
            <button
              onClick={() => setShowOfflineWarning(false)}
              className="text-white hover:text-gray-200 text-xl"
              aria-label="Закрыть уведомление"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Онлайн уведомление */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-green-500 text-white p-2 text-center z-50">
          <div className="container mx-auto flex items-center justify-between">
            <span>✅ Восстановлено соединение. Синхронизация...</span>
            <button
              onClick={() => setShowOfflineWarning(false)}
              className="text-white hover:text-gray-200 text-xl"
              aria-label="Закрыть уведомление"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <Routes>
        {/* Публичные маршруты */}
        <Route path="/login" element={<LoginPage />} />

        {/* Защищенные маршруты мессенджера с MainLayout */}
        <Route
          path="/chat/:chatId?"
          element={
            <PrivateRoute>
              <MainLayout>
                <ChatPage />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* НОВЫЕ МАРШРУТЫ: */}
        <Route
          path="/contacts"
          element={
            <PrivateRoute>
              <MainLayout>
                <ContactsPage />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <MainLayout>
                <ProfilePage />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* Дефолтный маршрут */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <MainLayout>
                <Navigate to="/chat" replace />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* Административные маршруты */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/create" element={<CreateUserPage />} />
          <Route path="users/:userId/edit" element={<EditUserPage />} />
          <Route path="chats" element={<AdminChatsPage />} />
          <Route path="chats/create" element={<CreateChatPage />} />
          <Route path="chats/:chatId/edit" element={<EditChatPage />} />
          <Route path="chats/:chatId/members" element={<ChatMembersPage />} />
        </Route>

        {/* 404 - перенаправляем в мессенджер */}
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </div>
  );
}

// Главный компонент с провайдерами
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;