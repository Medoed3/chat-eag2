// frontend/src/services/contacts.ts
import { api } from './api';
import { Contact, ContactsResponse, User } from '../types';

class ContactsService {
  private cache: {
    contacts: Contact[] | null;
    timestamp: number | null;
  } = {
    contacts: null,
    timestamp: null
  };

  private CACHE_TTL = 5 * 60 * 1000; // 5 минут

  // Получение списка контактов
  async getContacts(forceRefresh = false): Promise<Contact[]> {
    const now = Date.now();

    // Проверяем кэш
    if (!forceRefresh &&
        this.cache.contacts &&
        this.cache.timestamp &&
        (now - this.cache.timestamp) < this.CACHE_TTL) {
      return this.cache.contacts;
    }

    try {
      const response = await api.get<Contact[]>('/api/users/contacts');
      const contacts = response.data;

      // Обновляем кэш
      this.cache.contacts = contacts;
      this.cache.timestamp = now;

      return contacts;
    } catch (error) {
      console.error('Error fetching contacts:', error);

      // Fallback: если endpoint недоступен, используем admin endpoint
      if (error.response?.status === 404) {
        return this.getContactsFallback();
      }

      throw error;
    }
  }

  // Fallback метод через admin endpoint
  private async getContactsFallback(): Promise<Contact[]> {
    try {
      const response = await api.get<User[]>('/api/users');
      const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');

      const contacts = response.data
        .filter(user => user.id !== currentUser.id && user.is_active)
        .map(user => ({
          ...user,
          is_online: false,
          last_seen: new Date().toISOString()
        } as Contact));

      return contacts;
    } catch (error) {
      console.error('Error in fallback contacts:', error);
      return [];
    }
  }

  // Поиск контактов
  async searchContacts(query: string): Promise<Contact[]> {
    const contacts = await this.getContacts();
    const searchTerm = query.toLowerCase();

    return contacts.filter(contact =>
      contact.full_name.toLowerCase().includes(searchTerm) ||
      contact.login.toLowerCase().includes(searchTerm) ||
      contact.department?.toLowerCase().includes(searchTerm) ||
      contact.position?.toLowerCase().includes(searchTerm)
    );
  }

  // Получение контакта по ID
  async getContactById(id: number): Promise<Contact | null> {
    const contacts = await this.getContacts();
    return contacts.find(contact => contact.id === id) || null;
  }

  // Создание/получение личного чата
  async createPersonalChat(userId: number) {
    try {
      const response = await api.post(`/api/chats/personal/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error creating personal chat:', error);

      // Fallback через стандартный endpoint
      try {
        const fallbackResponse = await api.post('/api/chats', {
          is_group: false,
          member_ids: [userId]
        });
        return fallbackResponse.data;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  // Очистка кэша
  clearCache() {
    this.cache.contacts = null;
    this.cache.timestamp = null;
  }

  // Получение статистики контактов
  async getContactsStats(): Promise<{
    total: number;
    online: number;
    byDepartment: Record<string, number>;
  }> {
    const contacts = await this.getContacts();

    const stats = {
      total: contacts.length,
      online: contacts.filter(c => c.is_online).length,
      byDepartment: {} as Record<string, number>
    };

    // Группируем по отделам
    contacts.forEach(contact => {
      const dept = contact.department || 'Без отдела';
      stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;
    });

    return stats;
  }
}

export const contactsService = new ContactsService();