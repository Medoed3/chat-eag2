// frontend/src/utils/localStorage.ts
export class LocalStorageService {
  private dbName = 'MessengerDB';
  private version = 1;

  // Инициализация базы данных
  async init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Хранилище для очереди сообщений
        if (!db.objectStoreNames.contains('messageQueue')) {
          const store = db.createObjectStore('messageQueue', { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('clientMessageId', 'clientMessageId', { unique: true });
        }

        // Хранилище для кэша сообщений
        if (!db.objectStoreNames.contains('messageCache')) {
          const store = db.createObjectStore('messageCache', { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Хранилище для настроек
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  // Сохранение в очередь сообщений
  async saveToQueue(item: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messageQueue', 'readwrite');
      const store = tx.objectStore('messageQueue');

      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Получение всех элементов из очереди
  async getAllFromQueue(): Promise<any[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messageQueue', 'readonly');
      const store = tx.objectStore('messageQueue');

      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Удаление из очереди
  async removeFromQueue(id: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messageQueue', 'readwrite');
      const store = tx.objectStore('messageQueue');

      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Очистка очереди
  async clearQueue(): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messageQueue', 'readwrite');
      const store = tx.objectStore('messageQueue');

      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Сохранение в кэш сообщений
  async saveToCache(chatId: number, messages: any[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messageCache', 'readwrite');
      const store = tx.objectStore('messageCache');

      // Удаляем старые сообщения этого чата
      const index = store.index('chatId');
      const range = IDBKeyRange.only(chatId);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Сохраняем новые сообщения
          messages.forEach(message => {
            store.put({
              id: message.id,
              chatId,
              ...message,
              cachedAt: new Date().toISOString()
            });
          });
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Получение из кэша
  async getFromCache(chatId: number): Promise<any[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('messageCache', 'readonly');
      const store = tx.objectStore('messageCache');

      const index = store.index('chatId');
      const range = IDBKeyRange.only(chatId);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Сохранение настроек
  async saveSetting(key: string, value: any): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');

      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Получение настроек
  async getSetting(key: string): Promise<any> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');

      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // Проверка поддержки IndexedDB
  isSupported(): boolean {
    return 'indexedDB' in window;
  }

  // Fallback на localStorage если IndexedDB не поддерживается
  saveToLocalStorage(key: string, value: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  getFromLocalStorage(key: string): any {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return null;
    }
  }

  removeFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from localStorage:', error);
    }
  }
}

// Экспортируем глобальный экземпляр
export const localStorageService = new LocalStorageService();