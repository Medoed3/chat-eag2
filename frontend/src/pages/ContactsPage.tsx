// frontend/src/pages/ContactsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, Users, Mail, Phone, Building, Filter } from 'lucide-react';
import { api } from '../services/api';
import { User, Chat } from '../types';
import Avatar from '../components/ui/Avatar';
import LoadingScreen from '../components/LoadingScreen';
import MobileHeader from '../components/MobileHeader';

const ContactsPage: React.FC = () => {
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<User[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Загружаем контакты
  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<User[]>('/api/users/contacts');
      setContacts(response.data);
      setFilteredContacts(response.data);
    } catch (error) {
      console.error('Ошибка загрузки контактов:', error);
      // Если endpoint недоступен, пробуем получить через admin (для админов)
      try {
        const adminResponse = await api.get<User[]>('/api/users');
        const currentUser = JSON.parse(localStorage.getItem('user_data') || '{}');
        const filtered = adminResponse.data.filter(user => user.id !== currentUser.id && user.is_active);
        setContacts(filtered);
        setFilteredContacts(filtered);
      } catch (adminError) {
        console.error('Ошибка загрузки через admin endpoint:', adminError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Фильтрация контактов
  useEffect(() => {
    let result = contacts;

    // Поиск по имени или логину
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(contact =>
        contact.full_name.toLowerCase().includes(term) ||
        contact.login.toLowerCase().includes(term)
      );
    }

    // Фильтр по отделу (если есть поле department)
    if (departmentFilter !== 'all') {
      // Здесь можно добавить логику фильтрации по отделу, если такое поле есть в User
    }

    setFilteredContacts(result);
  }, [searchTerm, departmentFilter, contacts]);

  // Обработчик клика по контакту - создание/переход в личный чат
  const handleContactClick = async (contact: User) => {
    try {
      // Создаем или получаем личный чат
      const response = await api.post<Chat>(`/api/chats/personal/${contact.id}`);
      const chat = response.data;

      // Переходим в чат
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      console.error('Ошибка создания/получения чата:', error);
      // Если endpoint не работает, создаем чат через стандартный endpoint
      try {
        const chatResponse = await api.post<Chat>('/api/chats', {
          is_group: false,
          member_ids: [contact.id]
        });
        navigate(`/chat/${chatResponse.data.id}`);
      } catch (fallbackError) {
        console.error('Ошибка создания чата через fallback:', fallbackError);
        alert('Не удалось начать чат с пользователем');
      }
    }
  };

  // Статистика контактов
  const totalContacts = contacts.length;
  const onlineContacts = contacts.length; // Здесь можно добавить логику онлайн статуса

  if (loading) {
    return <LoadingScreen message="Загрузка контактов..." />;
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <MobileHeader
        title="Контакты"
        showBackButton={true}
        rightContent={
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users size={16} />
            <span>{totalContacts}</span>
          </div>
        }
      />

      {/* Поиск и фильтры */}
      <div className="p-4 bg-white border-b">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Поиск по имени или логину..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-500" />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-gray-700"
            >
              <option value="all">Все отделы</option>
              <option value="it">IT</option>
              <option value="hr">HR</option>
              <option value="sales">Продажи</option>
              <option value="support">Поддержка</option>
            </select>
          </div>
          <div className="text-gray-600">
            Найдено: {filteredContacts.length}
          </div>
        </div>
      </div>

      {/* Список контактов */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <Users className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              {searchTerm ? 'Контакты не найдены' : 'Нет контактов'}
            </h3>
            <p className="text-gray-500 text-center mb-6">
              {searchTerm
                ? 'Попробуйте изменить поисковый запрос'
                : 'Все сотрудники компании появятся здесь'}
            </p>
            {!searchTerm && (
              <button
                onClick={loadContacts}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Обновить список
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className="flex items-center p-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
              >
                {/* Аватар */}
                <div className="flex-shrink-0 mr-3">
                  <Avatar
                    userId={contact.id}
                    name={contact.full_name}
                    avatarUrl={contact.avatar_url}
                    size="lg"
                  />
                </div>

                {/* Информация о контакте */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900 truncate">
                      {contact.full_name}
                    </h4>
                    {contact.role === 'admin' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        Админ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center text-sm text-gray-500 mb-1">
                    <span className="truncate">@{contact.login}</span>
                    {contact.is_active ? (
                      <span className="ml-2 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                        онлайн
                      </span>
                    ) : (
                      <span className="ml-2 text-gray-400">не в сети</span>
                    )}
                  </div>

                  {/* Дополнительная информация */}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `mailto:${contact.login}@company.com`;
                      }}
                      className="flex items-center hover:text-blue-600"
                    >
                      <Mail size={12} className="mr-1" />
                      Написать
                    </button>

                    <div className="flex items-center">
                      <Building size={12} className="mr-1" />
                      <span>Отдел</span>
                    </div>
                  </div>
                </div>

                {/* Кнопка начала чата */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContactClick(contact);
                  }}
                  className="ml-2 p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Начать чат"
                >
                  <Mail size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Информационная панель */}
      <div className="bg-white border-t p-4">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Всего контактов: <span className="font-medium">{totalContacts}</span>
          </div>
          <div className="text-gray-600">
            Онлайн: <span className="font-medium text-green-600">{onlineContacts}</span>
          </div>
          <button
            onClick={loadContacts}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Обновить
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;