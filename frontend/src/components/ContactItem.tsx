// frontend/src/components/ContactItem.tsx
import React from 'react';
import { User } from '../types';
import Avatar from './ui/Avatar';

interface ContactItemProps {
  contact: User;
  isOnline?: boolean;
  unreadCount?: number;
  onClick: (contact: User) => void;
  onMessageClick: (contact: User) => void;
}

const ContactItem: React.FC<ContactItemProps> = ({
  contact,
  isOnline = false,
  unreadCount = 0,
  onClick,
  onMessageClick,
}) => {
  return (
    <div className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100">
      {/* Аватар с индикатором онлайн */}
      <div className="relative mr-3" onClick={() => onClick(contact)}>
        <Avatar
          userId={contact.id}
          name={contact.full_name}
          avatarUrl={contact.avatar_url}
          size="md"
        />
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
        )}
      </div>

      {/* Информация */}
      <div className="flex-1 min-w-0" onClick={() => onClick(contact)}>
        <div className="flex items-center justify-between mb-1">
          <h4 className="font-medium text-gray-900 truncate">
            {contact.full_name}
          </h4>
          {contact.role === 'admin' && (
            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
              Админ
            </span>
          )}
        </div>

        <div className="flex items-center text-sm text-gray-500">
          <span className="truncate">@{contact.login}</span>
        </div>

        {/* Статус */}
        <div className="flex items-center text-xs mt-1">
          {contact.is_active ? (
            <span className={`flex items-center ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
              <span className={`w-2 h-2 rounded-full mr-1 ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
              {isOnline ? 'В сети' : 'Не в сети'}
            </span>
          ) : (
            <span className="text-red-500 text-xs">Неактивен</span>
          )}
        </div>
      </div>

      {/* Действия */}
      <div className="flex items-center gap-2">
        {unreadCount > 0 && (
          <span className="bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full">
            {unreadCount}
          </span>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onMessageClick(contact);
          }}
          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          title="Написать сообщение"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ContactItem;