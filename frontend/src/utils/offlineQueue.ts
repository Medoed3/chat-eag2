import { Message } from '../types';

export class OfflineQueue {
  private queue: Message[] = [];
  private storageKey = 'offline_message_queue';

  constructor() {
    this.loadFromStorage();
    window.addEventListener('online', () => this.processQueue());
  }

  add(message: Message): void {
    this.queue.push(message);
    this.saveToStorage();
  }

  getQueue(): Message[] {
    return this.queue;
  }

  removeFromQueue(messageId: string): void {
    this.queue = this.queue.filter(m => m.client_message_id !== messageId);
    this.saveToStorage();
  }

  async processQueue(): Promise<void> {
    if (!navigator.onLine || this.queue.length === 0) return;

    for (const message of [...this.queue]) {
      try {
        // Здесь будет логика отправки сообщения
        console.log('Processing offline message:', message);
        this.removeFromQueue(message.client_message_id);
      } catch (error) {
        console.error('Failed to send offline message:', error);
      }
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save queue to localStorage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.queue = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load queue from localStorage:', error);
    }
  }
}

export const offlineQueue = new OfflineQueue();