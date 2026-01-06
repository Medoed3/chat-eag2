// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './hooks/useAuth'
import App from './App'
import './index.css'

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker зарегистрирован:', registration.scope)
        
        // Проверка обновлений каждые 1 час
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)
      })
      .catch(error => {
        console.error('❌ Ошибка регистрации Service Worker:', error)
      })
  })
}

// Функция для подписки на push-уведомления
async function subscribeToPushNotifications() {
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready
      
      // Проверяем разрешение на уведомления
      const permission = await Notification.requestPermission()
      
      if (permission === 'granted') {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            'BHcJn6Q6Qx_5YV8kxV7Yv3d9Z2JmQlJg6KEmW2oHk7dTcKZ3Kz5GZ6a1jZ9Wm2J4kzZ9wXJ3YzJ6Z1J1Z1Z1Z1J1'
          )
        })
        
        // Отправляем подписку на сервер
        try {
          const response = await fetch('http://localhost:8000/api/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify(subscription)
          })
          
          if (response.ok) {
            console.log('✅ Подписка на push-уведомления успешна')
          }
        } catch (err) {
          console.warn('⚠️ Не удалось отправить подписку на сервер:', err)
        }
      }
    } catch (error) {
      console.error('❌ Ошибка подписки на push-уведомления:', error)
    }
  }
}

// Вспомогательная функция для конвертации ключа
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)))
}

// Инициализация приложения
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
)

// Экспортируем функцию подписки для использования в компонентах
export { subscribeToPushNotifications }