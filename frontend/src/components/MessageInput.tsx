// frontend/src/components/MessageInput.tsx - ОБНОВЛЕННЫЙ
import React, { useState, useRef, useEffect, useContext } from 'react';
import Button from './ui/Button';
import Input from './ui/Input';
import { useMessageSync } from '../hooks/useMessageSync';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { AuthContext } from '../hooks/useAuth';

interface MessageInputProps {
  chatId: number;
  currentUserId: number;
  onSendMessage: (content: string, file?: File) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  chatId,
  currentUserId,
  onSendMessage,
  disabled = false,
  placeholder = 'Введите сообщение...'
}) => {
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoadingAccess, setIsLoadingAccess] = useState(true);

  const { isAuthenticated } = useContext(AuthContext);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { sendMessage, queueStats } = useMessageSync({
    chatId,
    autoSync: true
  });

  const { sendTypingIndicator, isConnected } = useWebSocket({
    chatId,
    autoConnect: true
  });

  // Проверяем доступ к чату
  useEffect(() => {
    const checkChatAccess = async () => {
      if (!chatId || !isAuthenticated) {
        setHasAccess(false);
        setIsLoadingAccess(false);
        return;
      }

      try {
        setIsLoadingAccess(true);
        // Используем новый эндпоинт для проверки доступа
        const response = await api.get(`/api/chats/${chatId}/access`);
        const accessData = response.data;

        // Доступ есть если пользователь имеет доступ И чат активен
        setHasAccess(accessData.has_access && accessData.is_active);
      } catch (error) {
        console.error('Error checking chat access:', error);
        setHasAccess(false);
      } finally {
        setIsLoadingAccess(false);
      }
    };

    checkChatAccess();
  }, [chatId, isAuthenticated]);

  // Отправка индикатора набора текста
  const handleTyping = () => {
    if (!isConnected || !hasAccess) return;

    sendTypingIndicator(true);

    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    const timeout = setTimeout(() => {
      sendTypingIndicator(false);
    }, 3000);

    setTypingTimeout(timeout);
  };

  // Очистка таймаута при размонтировании
  useEffect(() => {
    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
        sendTypingIndicator(false);
      }
    };
  }, [typingTimeout, sendTypingIndicator]);

  // Обработка изменения текста
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMessage(value);

    if (value.trim().length > 0 && hasAccess) {
      handleTyping();
    }
  };

  // Выбор файла
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('Файл слишком большой. Максимальный размер: 10MB');
        return;
      }

      setFile(selectedFile);
      e.target.value = '';
    }
  };

  // Удаление выбранного файла
  const handleRemoveFile = () => {
    setFile(null);
  };

  // Загрузка файла на сервер
  const uploadFile = async (fileToUpload: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', fileToUpload);

    setIsUploading(true);

    try {
      const fileType = fileToUpload.type.startsWith('image/') ? 'image' :
                      fileToUpload.type.startsWith('video/') ? 'video' : 'document';

      formData.append('type', fileType);

      const response = await api.post('/api/media/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (!response.data || !response.data.url) {
        throw new Error('Некорректный ответ от сервера');
      }

      return response.data.url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('Ошибка загрузки файла');
    } finally {
      setIsUploading(false);
    }
  };

  // Отправка сообщения
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((!message.trim() && !file) || !hasAccess || disabled || isUploading) {
      return;
    }

    const messageContent = message.trim();
    const selectedFile = file;

    setMessage('');
    setFile(null);

    try {
      await onSendMessage(messageContent, selectedFile || undefined);

      if (typingTimeout) {
        clearTimeout(typingTimeout);
        setTypingTimeout(null);
      }
      sendTypingIndicator(false);

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      setMessage(messageContent);
      setFile(selectedFile);
      alert('Не удалось отправить сообщение. Попробуйте еще раз.');
    }
  };

  // Обработка клавиш
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && hasAccess) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Вычисляем финальное состояние disabled
  const isInputDisabled = disabled || !hasAccess || isLoadingAccess || isUploading;

  if (isLoadingAccess) {
    return (
      <div className="border-t bg-white p-4 text-center text-gray-500">
        Проверка доступа к чату...
      </div>
    );
  }

  return (
    <div className="border-t bg-white p-4">
      {/* Информация о статусе */}
      {!hasAccess && (
        <div className="mb-3 p-2 bg-yellow-50 text-yellow-800 rounded-lg text-sm">
          ⚠️ Вы не можете отправлять сообщения в этом чате.
          Возможно, вы не являетесь участником или у вас нет доступа.
        </div>
      )}

      {/* Выбранный файл */}
      {file && (
        <div className="mb-3 p-2 bg-blue-50 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm truncate max-w-xs">{file.name}</span>
            <span className="text-xs text-gray-500 ml-2">
              ({(file.size / 1024 / 1024).toFixed(2)} MB)
            </span>
          </div>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="text-red-500 hover:text-red-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Статус очереди */}
      {queueStats.total > 0 && (
        <div className="mb-3 text-xs text-gray-600">
          {queueStats.pending > 0 && (
            <span className="mr-3">
              ⏳ {queueStats.pending} в очереди
            </span>
          )}
          {queueStats.failed > 0 && (
            <span className="text-red-500">
              ⚠️ {queueStats.failed} не отправлено
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center space-x-2">
        {/* Кнопка прикрепления файла */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
          disabled={isInputDisabled}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isInputDisabled}
          className="p-2 text-gray-500 hover:text-blue-500 disabled:text-gray-300 disabled:cursor-not-allowed"
          title="Прикрепить файл"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        {/* Поле ввода */}
        <div className="flex-1">
          <Input
            type="text"
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={hasAccess ? placeholder : "Нет доступа к отправке сообщений"}
            disabled={isInputDisabled}
            className="w-full"
          />
        </div>

        {/* Кнопка отправки */}
        <Button
          type="submit"
          disabled={isInputDisabled || (!message.trim() && !file)}
          className="px-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Загрузка...
            </div>
          ) : (
            'Отправить'
          )}
        </Button>
      </form>

      {/* Подсказка */}
      {hasAccess && (
        <div className="mt-2 text-xs text-gray-500 text-center">
          Нажмите Enter для отправки, Ctrl+Enter для новой строки
        </div>
      )}
    </div>
  );
};

export default MessageInput;