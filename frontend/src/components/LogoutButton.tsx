// frontend/src/components/LogoutButton.tsx
import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Button from './ui/Button';

interface LogoutButtonProps {
  mobile?: boolean;
  className?: string;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ mobile = false, className = '' }) => {
  const { logout, isLoading } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      await logout();
    }
  };

  if (mobile) {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className={`flex items-center gap-2 px-4 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all w-full ${className}`}
      >
        <LogOut size={20} />
        <span className="font-medium">Выйти</span>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      loading={isLoading}
      className={`text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 ${className}`}
    >
      <LogOut size={18} className="mr-2" />
      Выйти
    </Button>
  );
};

export default LogoutButton;