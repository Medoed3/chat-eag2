// frontend/src/components/NetworkStatus.tsx
import React, { useState, useEffect } from 'react';
import { messageSyncService } from '../services/messageSync';

export const NetworkStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueStats, setQueueStats] = useState({ pending: 0, failed: 0, total: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // Периодически проверяем статистику очереди
    const interval = setInterval(() => {
      const stats = messageSyncService.getQueueStats();
      setQueueStats(stats);

      // Показываем уведомление если есть сообщения в очереди
      if (stats.total > 0 && !isVisible) {
        setIsVisible(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible && queueStats.total === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border p-4 max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800">
            {isOnline ? '✅ В сети' : '⚠️ Не в сети'}
          </h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        {queueStats.total > 0 && (
          <div className="mt-2">
            <div className="text-sm text-gray-600 mb-2">
              Очередь сообщений:
            </div>

            {queueStats.pending > 0 && (
              <div className="flex items-center mb-1">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span className="text-sm">
                  {queueStats.pending} ожидают отправки
                </span>
              </div>
            )}

            {queueStats.failed > 0 && (
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm">
                  {queueStats.failed} не удалось отправить
                </span>
              </div>
            )}

            <button
              onClick={() => messageSyncService.processMessageQueue()}
              disabled={!isOnline}
              className="mt-3 w-full bg-blue-500 text-white py-1 px-3 rounded text-sm hover:bg-blue-600 disabled:bg-gray-300"
            >
              {isOnline ? 'Попробовать снова' : 'Ожидание сети...'}
            </button>
          </div>
        )}

        {!isOnline && queueStats.total === 0 && (
          <div className="text-sm text-gray-600">
            Сообщения будут сохранены локально и отправлены при восстановлении соединения.
          </div>
        )}
      </div>
    </div>
  );
};