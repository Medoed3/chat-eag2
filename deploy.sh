#!/bin/bash

# Скрипт деплоя корпоративного мессенджера
# Использование: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$TIMESTAMP"

echo "🚀 Деплой корпоративного мессенджера"
echo "Окружение: $ENVIRONMENT"
echo "Время: $(date)"
echo ""

# Создаем директорию для бэкапов
mkdir -p "$BACKUP_DIR"

# Функция для бэкапа базы данных
backup_database() {
    echo "📦 Создание бэкапа базы данных..."

    if [ -f "./backend/messenger.db" ]; then
        cp "./backend/messenger.db" "$BACKUP_DIR/messenger.db"
        echo "✅ Бэкап создан: $BACKUP_DIR/messenger.db"
    else
        echo "ℹ️  База данных не найдена, пропускаем бэкап"
    fi
}

# Функция для установки зависимостей
install_dependencies() {
    echo "📦 Установка зависимостей..."

    # Бэкенд
    echo "Установка Python зависимостей..."
    cd backend
    pip install -r requirements.txt --upgrade
    cd ..

    # Фронтенд
    echo "Установка Node.js зависимостей..."
    cd frontend
    npm install --production
    cd ..

    echo "✅ Зависимости установлены"
}

# Функция для сборки фронтенда
build_frontend() {
    echo "🏗️  Сборка фронтенда..."

    cd frontend

    # Устанавливаем переменные окружения
    if [ "$ENVIRONMENT" = "production" ]; then
        export VITE_API_URL="https://api.your-domain.com"
    else
        export VITE_API_URL="https://staging-api.your-domain.com"
    fi

    # Сборка
    npm run build

    # Копируем сборку в папку статики бэкенда
    rm -rf ../backend/static/*
    cp -r dist/* ../backend/static/

    cd ..

    echo "✅ Фронтенд собран"
}

# Функция для применения миграций
run_migrations() {
    echo "🔄 Применение миграций..."

    cd backend

    # Простая миграция для SQLite
    python -c "
from backend.database import migrate_database
migrate_database()
print('Миграции применены')
    "

    # Оптимизация базы данных
    python performance_optimization.py --optimize

    cd ..

    echo "✅ Миграции применены"
}

# Функция для перезапуска сервисов
restart_services() {
    echo "🔄 Перезапуск сервисов..."

    # Останавливаем старые процессы
    pkill -f "uvicorn main:app" || true
    pkill -f "python monitoring_dashboard.py" || true

    # Запускаем Redis если не запущен
    if ! pgrep redis-server > /dev/null; then
        echo "Запуск Redis..."
        redis-server --daemonize yes
        sleep 2
    fi

    # Запускаем бэкенд
    echo "Запуск бэкенда..."
    cd backend
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4 > ../logs/backend_$TIMESTAMP.log 2>&1 &
    cd ..

    # Запускаем дашборд мониторинга
    echo "Запуск дашборда мониторинга..."
    nohup python monitoring_dashboard.py > ./logs/dashboard_$TIMESTAMP.log 2>&1 &

    # Запускаем скрипт для периодической оптимизации
    echo "Настройка периодических задач..."
    crontab -l > /tmp/cron_backup || true
    echo "0 2 * * * cd $(pwd) && python backend/performance_optimization.py --cleanup >> ./logs/cleanup.log 2>&1" >> /tmp/cron_backup
    echo "0 3 * * 0 cd $(pwd) && python backend/performance_optimization.py --optimize >> ./logs/optimization.log 2>&1" >> /tmp/cron_backup
    crontab /tmp/cron_backup

    echo "✅ Сервисы перезапущены"
}

# Функция для проверки здоровья
health_check() {
    echo "🏥 Проверка здоровья системы..."

    sleep 5  # Даем время на запуск

    # Проверяем бэкенд
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Бэкенд работает"
    else
        echo "❌ Бэкенд не отвечает"
        exit 1
    fi

    # Проверяем дашборд
    if curl -f http://localhost:5000/ > /dev/null 2>&1; then
        echo "✅ Дашборд работает"
    else
        echo "⚠️  Дашборд не отвечает (может потребоваться время для запуска)"
    fi

    # Проверяем Redis
    if redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis работает"
    else
        echo "❌ Redis не отвечает"
        exit 1
    fi

    echo "✅ Все системы работают нормально"
}

# Функция для отката
rollback() {
    echo "🔙 Откат к предыдущей версии..."

    # Находим последний бэкап
    LAST_BACKUP=$(ls -td ./backups/* | head -1)

    if [ -z "$LAST_BACKUP" ]; then
        echo "❌ Нет доступных бэкапов для отката"
        exit 1
    fi

    echo "Откат из бэкапа: $LAST_BACKUP"

    # Восстанавливаем базу данных
    if [ -f "$LAST_BACKUP/messenger.db" ]; then
        cp "$LAST_BACKUP/messenger.db" ./backend/messenger.db
        echo "✅ База данных восстановлена"
    fi

    # Перезапускаем сервисы
    restart_services

    echo "✅ Откат завершен"
}

# Основной процесс деплоя
main() {
    echo "Начало деплоя..."

    # Создаем директории для логов
    mkdir -p ./logs

    case "$ENVIRONMENT" in
        production|staging)
            backup_database
            install_dependencies
            build_frontend
            run_migrations
            restart_services
            health_check

            echo ""
            echo "🎉 Деплой завершен успешно!"
            echo "Бэкенд: http://localhost:8000"
            echo "Документация: http://localhost:8000/docs"
            echo "Дашборд: http://localhost:5000"
            echo "Бэкап: $BACKUP_DIR"
            ;;

        rollback)
            rollback
            ;;

        *)
            echo "Использование: $0 [production|staging|rollback]"
            exit 1
            ;;
    esac
}

# Запуск
main