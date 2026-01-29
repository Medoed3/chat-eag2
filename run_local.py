#!/usr/bin/env python3
"""
Скрипт для запуска и остановки мессенджера без Docker
Устанавливает Redis локально (требует sudo) или использует существующий
"""

import subprocess
import sys
import os
import time
import signal
import atexit
import psutil
from pathlib import Path

# Глобальные переменные для хранения процессов
backend_proc = None
redis_proc_windows = None  # Для хранения процесса Redis на Windows
stopping = False  # Флаг для предотвращения повторной остановки


def check_redis():
    """Проверяет, запущен ли Redis"""
    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, socket_connect_timeout=2)
        return r.ping()
    except:
        return False


def is_backend_running():
    """Проверяет, запущен ли бэкенд"""
    global backend_proc
    if backend_proc is None:
        return False

    # Проверяем, жив ли процесс
    try:
        return backend_proc.poll() is None
    except:
        return False


def install_redis_linux():
    """Устанавливает Redis на Linux (Ubuntu/Debian)"""
    print("Установка Redis...")
    try:
        subprocess.run(['sudo', 'apt-get', 'update'], check=True)
        subprocess.run(['sudo', 'apt-get', 'install', '-y', 'redis-server'], check=True)
        subprocess.run(['sudo', 'systemctl', 'enable', 'redis-server'], check=True)
        subprocess.run(['sudo', 'systemctl', 'start', 'redis-server'], check=True)
        print("Redis успешно установлен и запущен")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Ошибка установки Redis: {e}")
        return False


def start_redis_windows():
    """Запускает Redis на Windows (если установлен вручную)"""
    global redis_proc_windows

    print("Поиск Redis на Windows...")

    # Возможные пути установки Redis на Windows
    possible_paths = [
        "C:\\Program Files\\Redis\\redis-server.exe",
        "C:\\Redis\\redis-server.exe",
        os.path.expanduser("~\\Redis\\redis-server.exe"),
    ]

    redis_path = None
    for path in possible_paths:
        if os.path.exists(path):
            redis_path = path
            break

    if redis_path:
        print(f"Найден Redis: {redis_path}")
        try:
            redis_proc_windows = subprocess.Popen([redis_path])
            time.sleep(3)  # Даем Redis время на запуск
            if check_redis():
                print("✓ Redis успешно запущен")
                return True
            else:
                print("Не удалось подключиться к Redis после запуска")
                return False
        except Exception as e:
            print(f"Ошибка запуска Redis: {e}")
            return False
    else:
        print("Redis не найден. Пожалуйста, установите Redis вручную.")
        print("Скачайте Redis for Windows: https://github.com/tporadowski/redis/releases")
        return False


def install_redis_windows():
    """Инструкции для установки Redis на Windows"""
    print("""
Для Windows необходимо установить Redis вручную:
1. Скачайте Redis for Windows: https://github.com/tporadowski/redis/releases
2. Распакуйте архив
3. Запустите redis-server.exe
4. Оставьте окно Redis открытым

Или используйте WSL2:
1. Установите WSL2: https://docs.microsoft.com/ru-ru/windows/wsl/install
2. В WSL выполните: sudo apt-get install redis-server
3. Запустите: sudo service redis-server start
""")

    # Предлагаем запустить Redis если он уже установлен
    response = input("Хотите попробовать запустить Redis автоматически? (y/n): ").lower()
    if response == 'y':
        return start_redis_windows()
    return False


def install_redis_macos():
    """Устанавливает Redis на macOS"""
    print("Установка Redis на macOS...")
    try:
        # Проверяем наличие Homebrew
        subprocess.run(['brew', '--version'], check=True, capture_output=True)
    except:
        print("Сначала установите Homebrew: https://brew.sh/")
        return False

    try:
        subprocess.run(['brew', 'install', 'redis'], check=True)
        subprocess.run(['brew', 'services', 'start', 'redis'], check=True)
        print("Redis успешно установлен и запущен")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Ошибка установки Redis: {e}")
        return False


def start_backend():
    """Запускает бэкенд FastAPI"""
    global backend_proc
    print("Запуск бэкенда FastAPI...")
    backend_dir = Path(__file__).parent / "backend"

    # ПЕРЕХОДИМ В ДИРЕКТОРИЮ BACKEND
    os.chdir(str(backend_dir))

    # Создаем .env файл если его нет
    env_file = Path(".env")
    if not env_file.exists():
        # Относительный путь - создаст в текущей директории (backend/)
        db_path = "messenger.db"
        with open(env_file, 'w') as f:
            f.write("REDIS_HOST=localhost\n")
            f.write("REDIS_PORT=6379\n")
            # Будет использовать DATABASE_URL из config.production.py, но можно переопределить здесь
            # f.write(f"DATABASE_URL=sqlite:///{db_path}\n")  # Закомментировано, чтобы использовать config

    # Запускаем сервер ИЗ ТЕКУЩЕЙ ДИРЕКТОРИИ (backend/)
    backend_proc = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "main:app",
        "--host", "localhost", "--port", "8000", "--reload"
    ])

    # Даем время на запуск
    time.sleep(2)
    return backend_proc


def stop_servers():
    """Останавливает все запущенные серверы"""
    global backend_proc, redis_proc_windows, stopping

    if stopping:
        return  # Уже выполняем остановку

    stopping = True

    print("\n" + "=" * 60)
    print("Остановка серверов...")

    # Останавливаем бэкенд
    if is_backend_running():
        print("Остановка FastAPI сервера...")
        try:
            backend_proc.terminate()
            # Ждем завершения с таймаутом
            for _ in range(10):  # 10 попыток по 0.5 секунды = 5 секунд
                if backend_proc.poll() is not None:
                    break
                time.sleep(0.5)

            if backend_proc.poll() is None:
                print("Принудительное завершение FastAPI...")
                backend_proc.kill()
                backend_proc.wait(timeout=2)
        except Exception as e:
            print(f"Ошибка при остановке FastAPI: {e}")
        finally:
            backend_proc = None
            print("✓ FastAPI сервер остановлен")
    else:
        print("FastAPI сервер уже остановлен")

    # Останавливаем Redis на Windows (если запускали через скрипт)
    if redis_proc_windows and redis_proc_windows.poll() is None:
        print("Остановка Redis...")
        try:
            redis_proc_windows.terminate()
            redis_proc_windows.wait(timeout=3)
            print("✓ Redis остановлен")
        except Exception as e:
            print(f"Ошибка при остановке Redis: {e}")
            try:
                redis_proc_windows.kill()
                print("Redis принудительно завершен")
            except:
                pass
        finally:
            redis_proc_windows = None

    # Проверяем, остались ли процессы uvicorn
    try:
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and 'uvicorn' in ' '.join(cmdline):
                    if proc.pid != os.getpid():
                        print(f"Найден оставшийся процесс uvicorn (PID: {proc.pid}), завершаем...")
                        proc.terminate()
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
    except ImportError:
        print("Библиотека psutil не установлена, пропускаем проверку процессов")

    print("\n✓ Все серверы остановлены")
    print("=" * 60)

    # Даем время для вывода сообщений перед выходом
    time.sleep(0.5)


def signal_handler(sig, frame):
    """Обработчик сигналов остановки"""
    print(f"\nПолучен сигнал остановки ({signal.Signals(sig).name})...")
    stop_servers()
    sys.exit(0)


def register_signal_handlers():
    """Регистрирует обработчики сигналов"""
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Игнорируем второй SIGINT чтобы избежать повторной обработки
    original_int_handler = signal.getsignal(signal.SIGINT)

    def graceful_exit(sig, frame):
        if sig == signal.SIGINT:
            print("\nЗавершение... (нажмите Ctrl+C еще раз для принудительного выхода)")
            signal.signal(signal.SIGINT, original_int_handler)
        else:
            signal_handler(sig, frame)

    signal.signal(signal.SIGINT, graceful_exit)


def main():
    """Основная функция запуска"""
    global backend_proc, stopping

    # Сбрасываем флаг остановки
    stopping = False

    # Регистрируем обработчики сигналов
    register_signal_handlers()

    # Регистрируем функцию остановки при выходе
    atexit.register(lambda: stop_servers() if not stopping else None)

    print("=" * 60)
    print("Запуск корпоративного мессенджера с гарантированной доставкой")
    print("=" * 60)

    # Проверяем Python зависимости
    print("\n1. Проверка зависимостей Python...")
    try:
        import fastapi
        import redis
        print("✓ Зависимости установлены")
    except ImportError:
        print("Установка Python зависимостей...")
        backend_dir = Path(__file__).parent / "backend"
        requirements = backend_dir / "requirements.txt"
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", "-r", str(requirements)],
                           check=True, capture_output=True, text=True)
            print("✓ Зависимости установлены")
        except subprocess.CalledProcessError as e:
            print(f"Ошибка установки зависимостей: {e}")
            print("Установите зависимости вручную:")
            print(f"pip install -r {requirements}")
            return

    # Проверяем Redis
    print("\n2. Проверка Redis...")
    redis_manually_started = False

    if check_redis():
        print("✓ Redis уже запущен")
    else:
        print("Redis не найден или не запущен")

        # Предлагаем установить
        response = input("Установить/запустить Redis локально? (y/n): ").lower()
        if response == 'y':
            if sys.platform == "linux":
                success = install_redis_linux()
            elif sys.platform == "darwin":
                success = install_redis_macos()
            elif sys.platform == "win32":
                success = install_redis_windows()
                redis_manually_started = success
            else:
                print(f"Платформа {sys.platform} не поддерживается автоматической установкой")
                success = False

            if not success:
                print("\nМожно использовать Redis в облаке или пропустить:")
                print("1. Redis Cloud: https://redis.com/try-free/")
                print("2. Затем установите переменные окружения:")
                print("   REDIS_HOST=<ваш хост>")
                print("   REDIS_PORT=<ваш порт>")
                print("   REDIS_PASSWORD=<ваш пароль>")
                return
        else:
            print("\nRedis необходим для гарантированной доставки сообщений.")
            print("Приложение запустится, но некоторые функции будут ограничены.")
            print("Продолжить без Redis? (y/n): ")
            if input().lower() != 'y':
                return

    # Ждем пока Redis запустится
    if check_redis():
        print("\n3. Запуск бэкенда...")
        backend_proc = start_backend()

        if not is_backend_running():
            print("Ошибка: не удалось запустить бэкенд")
            stop_servers()
            return

        print("\n" + "=" * 60)
        print("✅ Приложение успешно запущено!")
        print("\nСервисы:")
        print("  • FastAPI API:    http://localhost:8000")
        print("  • Документация:   http://localhost:8000/docs")
        print("  • Redis:          localhost:6379")

        print("\n📋 Управление:")
        print("  Для остановки нажмите Ctrl+C")
        print(f"  Для остановки из другого терминала: {sys.argv[0]} stop")
        print("=" * 60)
        print("\nЛоги сервера (нажмите Ctrl+C для остановки):")
        print("-" * 60)

        try:
            # Ждем завершения процесса
            while is_backend_running():
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nОстановка по запросу пользователя...")
            stop_servers()

    else:
        print("\nНе удалось подключиться к Redis.")
        print("Запустите Redis вручную и попробуйте снова.")


def stop_app():
    """Функция для остановки приложения через аргумент командной строки"""
    print("Проверка запущенных серверов...")

    # Проверяем запущен ли Redis
    redis_running = check_redis()

    # Проверяем запущен ли бэкенд по порту
    backend_running = False
    try:
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', 8000))
        backend_running = (result == 0)
        sock.close()
    except:
        pass

    if redis_running or backend_running:
        print("Найдены запущенные серверы, останавливаем...")
        stop_servers()
    else:
        print("Серверы не запущены или уже остановлены")

    # Дополнительная проверка процессов uvicorn
    try:
        import psutil
        uvicorn_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                cmdline = proc.info.get('cmdline', [])
                if cmdline and 'uvicorn' in ' '.join(cmdline):
                    uvicorn_processes.append(proc)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        if uvicorn_processes:
            print(f"Найдено процессов uvicorn: {len(uvicorn_processes)}")
            for proc in uvicorn_processes:
                print(f"  - PID {proc.pid}: {proc.info['cmdline']}")
            response = input("Завершить эти процессы? (y/n): ").lower()
            if response == 'y':
                for proc in uvicorn_processes:
                    try:
                        proc.terminate()
                        print(f"  Процесс {proc.pid} завершен")
                    except:
                        pass
    except ImportError:
        print("Установите psutil для более точной проверки процессов: pip install psutil")


if __name__ == "__main__":
    # Обработка аргументов командной строки
    if len(sys.argv) > 1:
        if sys.argv[1] == "stop":
            stop_app()
        elif sys.argv[1] == "start":
            main()
        elif sys.argv[1] == "status":
            print("Проверка состояния серверов...")
            print(f"Redis: {'✅ запущен' if check_redis() else '❌ остановлен'}")

            # Проверка FastAPI
            try:
                import socket
                import requests

                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                result = sock.connect_ex(('localhost', 8000))
                if result == 0:
                    try:
                        response = requests.get('http://localhost:8000/docs', timeout=2)
                        print(f"FastAPI: ✅ запущен (http://localhost:8000)")
                    except:
                        print(f"FastAPI: ⚠ порт 8000 занят, но сервер может не отвечать")
                else:
                    print(f"FastAPI: ❌ остановлен")
                sock.close()
            except:
                print(f"FastAPI: ❌ остановлен")
        elif sys.argv[1] == "help":
            print("""
Использование:
  python run_local.py [команда]

Команды:
  start     - Запустить приложение (по умолчанию)
  stop      - Остановить запущенные серверы
  status    - Показать состояние серверов
  help      - Показать эту справку

Примеры:
  python run_local.py          # Запустить приложение
  python run_local.py start    # Явно запустить приложение
  python run_local.py stop     # Остановить приложение
  python run_local.py status   # Показать состояние серверов

Серверы:
  - FastAPI сервер: http://localhost:8000
  - Redis сервер: localhost:6379

Управление:
  • Для остановки нажмите Ctrl+C
  • Не закрывайте окно терминала пока работает приложение
  • Для принудительной остановки: python run_local.py stop
            """)
        else:
            print(f"Неизвестная команда: {sys.argv[1]}")
            print("Используйте: python run_local.py [start|stop|status|help]")
    else:
        # Если аргументов нет, запускаем приложение
        main()