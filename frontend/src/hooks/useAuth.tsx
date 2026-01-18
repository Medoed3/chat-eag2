// frontend/src/hooks/useAuth.tsx - ДОБАВЛЯЕМ ЭКСПОРТ AuthContext
import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../services/api';
import { User } from '../types';
import { messageSyncService } from '../services/messageSync';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// СОЗДАЕМ И ЭКСПОРТИРУЕМ КОНТЕКСТ
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Проверка токена при загрузке
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      validateToken(token);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateToken = async (token: string) => {
    try {
      api.setAuthHeader(token);
      const response = await api.get<User>('/api/me');
      setUser(response.data);
      localStorage.setItem('user_data', JSON.stringify(response.data));
    } catch (error: any) {
      console.error('Token validation failed:', error);
      api.setAuthHeader(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (login: string, password: string) => {
    setIsLoading(true);
    try {
      console.log('Attempting login...');
      const response = await api.post<LoginResponse>('/login', {
        login,
        password
      });

      console.log('Login successful:', response.data);

      const { access_token, user: userData } = response.data;

      api.setAuthHeader(access_token);
      setUser(userData);
      localStorage.setItem('user_data', JSON.stringify(userData));
      await messageSyncService.restoreFromLocalStorage();

    } catch (error: any) {
      console.error('Login error details:', error);

      let errorMessage = 'Ошибка входа';

      if (error.response) {
        errorMessage = error.response.data?.detail || error.response.statusText || 'Ошибка сервера';
      } else if (error.request) {
        errorMessage = 'Нет ответа от сервера. Проверьте подключение к интернету.';
      } else {
        errorMessage = error.message || 'Ошибка при выполнении запроса';
      }

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Вызываем logout на сервере
      await api.logout();

      // Очищаем локальные данные
      setUser(null);
      messageSyncService.clearQueue();

      // Определяем, куда редиректить
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/admin')) {
        window.location.href = '/login?from=admin';
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Logout error:', error);
      // В любом случае очищаем данные и редиректим
      api.clearAuthData();
      setUser(null);
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => prev ? { ...prev, ...userData } : null);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default useAuth;