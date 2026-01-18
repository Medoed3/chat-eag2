// frontend/src/services/api.ts - ОБНОВЛЕНИЕ с повторными попытками
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ErrorResponse } from '../types';

class ApiService {
  private api: AxiosInstance;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 секунд
      withCredentials: true,
    });

    // Добавляем токен авторизации если есть
    const token = localStorage.getItem('token');
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Интерцептор запросов
    this.api.interceptors.request.use(
      (config) => {
        // Добавляем уникальный ID запроса для идемпотентности
        if (config.method?.toUpperCase() === 'POST' || config.method?.toUpperCase() === 'PUT') {
          const requestId = crypto.randomUUID();
          config.headers['X-Request-ID'] = requestId;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Интерцептор ответов с повторными попытками
    this.api.interceptors.response.use(
      (response) => {
        console.log('API Response:', response.config.url, response.status, response.data);
        return response;
      },
      async (error: AxiosError<ErrorResponse>) => {
        console.error('API Error:', error.config?.url, error.code, error.message);
        const originalRequest = error.config as any;

        // Если это ошибка сети или таймаут, пробуем повторить
        if (!error.response || error.code === 'ECONNABORTED' || error.code === 'NETWORK_ERROR') {
          if (originalRequest._retryCount === undefined) {
            originalRequest._retryCount = 0;
          }

          if (originalRequest._retryCount < this.retryAttempts) {
            originalRequest._retryCount++;

            // Экспоненциальная задержка
            const delay = this.retryDelay * Math.pow(2, originalRequest._retryCount - 1);

            console.log(`Retry attempt ${originalRequest._retryCount} after ${delay}ms`);

            await new Promise(resolve => setTimeout(resolve, delay));
            return this.api(originalRequest);
          }
        }

        // Обработка ошибок авторизации
        if (error.response?.status === 401) {
          this.clearAuthData();
          // Редирект на страницу входа
          if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/admin')) {
            window.location.href = '/login';
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // GET запрос с повторными попытками
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.withRetry(() => this.api.get<T>(url, config));
  }

  // POST запрос с повторными попытками
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.withRetry(() => this.api.post<T>(url, data, config));
  }

  // PUT запрос с повторными попытками
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.withRetry(() => this.api.put<T>(url, data, config));
  }

  // DELETE запрос с повторными попытками
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.withRetry(() => this.api.delete<T>(url, config));
  }

  // PATCH запрос с повторными попытками
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.withRetry(() => this.api.patch<T>(url, data, config));
  }

  // Обертка для повторных попыток
  private async withRetry<T>(requestFn: () => Promise<AxiosResponse<T>>): Promise<AxiosResponse<T>> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;

        // Не повторяем для ошибок клиента (4xx), кроме 408 (Timeout) и 429 (Too Many Requests)
        if (error.response && error.response.status >= 400 && error.response.status < 500) {
          if (error.response.status !== 408 && error.response.status !== 429) {
            throw error;
          }
        }

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // Установка токена авторизации
  setAuthHeader(token: string | null): void {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
      localStorage.setItem('auth_time', Date.now().toString());
    } else {
      this.clearAuthData();
    }
  }

  // Очистка данных аутентификации
  clearAuthData(): void {
    delete this.api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
    localStorage.removeItem('auth_time');
    localStorage.removeItem('user_data');
    // Очищаем все данные, связанные с пользователем
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('chat_') || key.startsWith('message_') || key.startsWith('sync_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  // Вызов logout на сервере
  async logout(): Promise<void> {
    try {
      await this.post('/logout');
    } catch (error) {
      console.log('Logout API call failed, but continuing with local cleanup');
    } finally {
      this.clearAuthData();
    }
  }

  // Проверка соединения с сервером
  async checkConnection(): Promise<boolean> {
    try {
      await this.get('/health', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const api = new ApiService();