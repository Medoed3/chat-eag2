// src-sw.js
// Кастомный Service Worker для PWA push-уведомлений

// Слушаем push-уведомления
self.addEventListener('push', function(event) {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    data: { chat_id: data.chat_id }
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const chatId = event.notification.data?.chat_id;
  const urlToOpen = new URL('/chat', self.location.origin);
  if (chatId) {
    urlToOpen.searchParams.set('chat', chatId);
  }
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existingClient = windowClients.find(client => client.url.includes('/chat'));
      if (existingClient) {
        return existingClient.focus();
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Работа с Workbox (автоматически вставится vite-plugin-pwa)
// Не удаляйте этот комментарий — нужен для инъекции