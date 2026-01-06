// public/sw.js
const CACHE_NAME = 'messenger-v2';
const OFFLINE_URL = '/offline.html';

// Ресурсы для кэширования при установке
const PRECACHE_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/offline.html'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Кэширование ресурсов при установке');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        console.log('✅ Service Worker установлен');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker активирован');
      return self.clients.claim();
    })
  );
});

// Перехват сетевых запросов (стратегия: Network First, Fallback to Cache)
self.addEventListener('fetch', event => {
  // Пропускаем не-GET запросы
  if (event.request.method !== 'GET') return;

  // Пропускаем chrome-extension
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Клонируем ответ для кэширования
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Если сеть недоступна, пробуем получить из кэша
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }

            // Если страница не в кэше, показываем offline страницу
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }

            return new Response('Нет подключения к сети', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Получение push-уведомлений
self.addEventListener('push', event => {
  let data = {};

  if (event.data) {
    data = event.data.json();
  } else {
    data = {
      title: 'Новое сообщение',
      body: 'У вас новое сообщение в чате',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png'
    };
  }

  const options = {
    body: data.body || 'Новое сообщение',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: 'Открыть чат',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Закрыть',
        icon: '/icons/icon-96x96.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Мессенджер', options)
  );
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const chatId = event.notification.data?.chat_id;
  let url = '/chat';

  if (chatId) {
    url += `?chat=${chatId}`;
  }

  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then(clientList => {
        // Ищем открытое окно с мессенджером
        for (const client of clientList) {
          if (client.url.includes('/chat') && 'focus' in client) {
            return client.focus();
          }
        }

        // Если окно не найдено, открываем новое
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
    );
  } else if (event.action === 'dismiss') {
    // Просто закрываем уведомление
    return;
  } else {
    // Клик по самому уведомлению
    event.waitUntil(
      clients.openWindow(url)
    );
  }
});

// Синхронизация в фоне (для офлайн работы)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    console.log('🔄 Фоновая синхронизация сообщений');
    // Здесь можно реализовать синхронизацию неотправленных сообщений
  }
});

// Получение сообщений через каналы (для обновления UI)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
