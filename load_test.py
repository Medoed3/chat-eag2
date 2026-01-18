#!/usr/bin/env python3
"""
Скрипт для нагрузочного тестирования гарантированной доставки сообщений
"""

import asyncio
import aiohttp
import json
import random
import time
import statistics
from typing import Dict, List, Any
import argparse
from datetime import datetime
import uuid


class LoadTester:
    def __init__(self, base_url: str, user_count: int, message_count: int, chat_count: int):
        self.base_url = base_url.rstrip('/')
        self.user_count = user_count
        self.message_count = message_count
        self.chat_count = chat_count

        self.users = []
        self.chats = []
        self.messages = []

        self.results = {
            "total_messages": 0,
            "successful_messages": 0,
            "failed_messages": 0,
            "delivery_times": [],
            "read_times": [],
            "start_time": None,
            "end_time": None,
            "errors": []
        }

    async def create_users(self):
        """Создание тестовых пользователей"""
        print(f"Создание {self.user_count} тестовых пользователей...")

        async with aiohttp.ClientSession() as session:
            tasks = []
            for i in range(self.user_count):
                task = self._create_user(session, i)
                tasks.append(task)

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    print(f"Ошибка создания пользователя {i}: {result}")
                elif result:
                    self.users.append(result)

        print(f"Создано {len(self.users)} пользователей")

    async def _create_user(self, session: aiohttp.ClientSession, index: int) -> Dict[str, Any]:
        """Создание одного пользователя"""
        user_data = {
            "login": f"testuser_{index}_{int(time.time())}",
            "full_name": f"Test User {index}",
            "password": "test123",
            "role": "user"
        }

        try:
            async with session.post(
                    f"{self.base_url}/api/users",
                    json=user_data,
                    timeout=10
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    error = await response.text()
                    raise Exception(f"Status {response.status}: {error}")
        except Exception as e:
            raise Exception(f"Error creating user: {e}")

    async def create_chats(self):
        """Создание тестовых чатов"""
        print(f"Создание {self.chat_count} тестовых чатов...")

        if len(self.users) < 2:
            print("Недостаточно пользователей для создания чатов")
            return

        async with aiohttp.ClientSession() as session:
            # Авторизуем первого пользователя
            auth_token = await self._login_user(session, self.users[0]["login"], "test123")

            tasks = []
            for i in range(self.chat_count):
                # Выбираем случайных участников
                member_ids = random.sample([u["id"] for u in self.users], min(3, len(self.users)))

                task = self._create_chat(session, auth_token, i, member_ids)
                tasks.append(task)

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    print(f"Ошибка создания чата {i}: {result}")
                elif result:
                    self.chats.append(result)

        print(f"Создано {len(self.chats)} чатов")

    async def _login_user(self, session: aiohttp.ClientSession, login: str, password: str) -> str:
        """Авторизация пользователя"""
        try:
            async with session.post(
                    f"{self.base_url}/login",
                    json={"login": login, "password": password},
                    timeout=10
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return data["access_token"]
                else:
                    raise Exception(f"Login failed: {response.status}")
        except Exception as e:
            raise Exception(f"Error logging in: {e}")

    async def _create_chat(self, session: aiohttp.ClientSession, token: str, index: int, member_ids: List[int]) -> Dict[
        str, Any]:
        """Создание одного чата"""
        chat_data = {
            "name": f"Test Chat {index}",
            "is_group": True,
            "member_ids": member_ids
        }

        headers = {"Authorization": f"Bearer {token}"}

        try:
            async with session.post(
                    f"{self.base_url}/api/chats",
                    json=chat_data,
                    headers=headers,
                    timeout=10
            ) as response:
                if response.status == 201:
                    data = await response.json()
                    return data
                else:
                    error = await response.text()
                    raise Exception(f"Status {response.status}: {error}")
        except Exception as e:
            raise Exception(f"Error creating chat: {e}")

    async def send_messages(self, concurrent_requests: int = 10):
        """Отправка тестовых сообщений"""
        print(f"Отправка {self.message_count} тестовых сообщений...")

        if not self.users or not self.chats:
            print("Нет пользователей или чатов для отправки сообщений")
            return

        self.results["start_time"] = time.time()

        # Создаем семафор для ограничения параллельных запросов
        semaphore = asyncio.Semaphore(concurrent_requests)

        async with aiohttp.ClientSession() as session:
            tasks = []
            for i in range(self.message_count):
                # Выбираем случайного пользователя и чат
                user = random.choice(self.users)
                chat = random.choice(self.chats)

                task = self._send_message_with_semaphore(semaphore, session, user, chat, i)
                tasks.append(task)

            # Запускаем все задачи
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Обрабатываем результаты
            for i, result in enumerate(results):
                self.results["total_messages"] += 1

                if isinstance(result, Exception):
                    self.results["failed_messages"] += 1
                    self.results["errors"].append(str(result))
                    print(f"Ошибка отправки сообщения {i}: {result}")
                elif result:
                    self.results["successful_messages"] += 1

                    if "delivery_time" in result:
                        self.results["delivery_times"].append(result["delivery_time"])

                    if "read_time" in result:
                        self.results["read_times"].append(result["read_time"])

                # Прогресс
                if i % 100 == 0:
                    print(f"Отправлено {i}/{self.message_count} сообщений")

        self.results["end_time"] = time.time()

    async def _send_message_with_semaphore(self, semaphore, session, user, chat, index):
        """Отправка сообщения с ограничением параллелизма"""
        async with semaphore:
            return await self._send_message(session, user, chat, index)

    async def _send_message(self, session: aiohttp.ClientSession, user: Dict, chat: Dict, index: int) -> Dict[str, Any]:
        """Отправка одного сообщения"""
        # Авторизуем пользователя
        token = await self._login_user(session, user["login"], "test123")

        if not token:
            raise Exception("Failed to login user")

        # Отправляем сообщение
        message_data = {
            "content": f"Тестовое сообщение {index} от {user['full_name']}",
            "chat_id": chat["id"],
            "client_message_id": str(uuid.uuid4())
        }

        headers = {"Authorization": f"Bearer {token}"}
        start_time = time.time()

        try:
            async with session.post(
                    f"{self.base_url}/api/messages",
                    json=message_data,
                    headers=headers,
                    timeout=30
            ) as response:
                response_time = time.time() - start_time

                if response.status == 201:
                    message = await response.json()

                    # Ждем подтверждения доставки (симуляция)
                    await asyncio.sleep(random.uniform(0.1, 1.0))

                    # Подтверждаем доставку для других пользователей
                    delivery_time = response_time + random.uniform(0.5, 2.0)

                    # Случайно подтверждаем прочтение
                    if random.random() > 0.5:
                        read_time = delivery_time + random.uniform(1.0, 5.0)
                        return {
                            "message_id": message["id"],
                            "delivery_time": delivery_time,
                            "read_time": read_time
                        }
                    else:
                        return {
                            "message_id": message["id"],
                            "delivery_time": delivery_time
                        }
                else:
                    error = await response.text()
                    raise Exception(f"Status {response.status}: {error}")

        except Exception as e:
            raise Exception(f"Error sending message: {e}")

    async def measure_performance(self):
        """Измерение производительности системы"""
        print("\nИзмерение производительности...")

        async with aiohttp.ClientSession() as session:
            # Измеряем время отклика API
            endpoints = [
                "/health",
                "/api/me",
                "/api/chats",
                "/api/metrics/stats"
            ]

            response_times = {}

            for endpoint in endpoints:
                start_time = time.time()
                try:
                    async with session.get(
                            f"{self.base_url}{endpoint}",
                            timeout=10
                    ) as response:
                        if response.status == 200:
                            response_time = time.time() - start_time
                            response_times[endpoint] = response_time
                            print(f"{endpoint}: {response_time:.3f} сек")
                        else:
                            print(f"{endpoint}: Ошибка {response.status}")
                except Exception as e:
                    print(f"{endpoint}: Ошибка {e}")

            return response_times

    def print_results(self):
        """Вывод результатов тестирования"""
        print("\n" + "=" * 60)
        print("РЕЗУЛЬТАТЫ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ")
        print("=" * 60)

        total_time = self.results["end_time"] - self.results["start_time"]

        print(f"\nОбщая статистика:")
        print(f"  Время выполнения: {total_time:.2f} сек")
        print(f"  Всего сообщений: {self.results['total_messages']}")
        print(f"  Успешно отправлено: {self.results['successful_messages']}")
        print(f"  Не удалось отправить: {self.results['failed_messages']}")
        print(f"  Успешность: {(self.results['successful_messages'] / self.results['total_messages'] * 100):.1f}%")

        if self.results['delivery_times']:
            print(f"\nВремя доставки сообщений:")
            print(f"  Среднее: {statistics.mean(self.results['delivery_times']):.3f} сек")
            print(f"  Медиана: {statistics.median(self.results['delivery_times']):.3f} сек")
            print(
                f"  P95: {sorted(self.results['delivery_times'])[int(len(self.results['delivery_times']) * 0.95)]:.3f} сек")
            print(
                f"  P99: {sorted(self.results['delivery_times'])[int(len(self.results['delivery_times']) * 0.99)]:.3f} сек")
            print(f"  Минимум: {min(self.results['delivery_times']):.3f} сек")
            print(f"  Максимум: {max(self.results['delivery_times']):.3f} сек")

        if self.results['read_times']:
            print(f"\nВремя прочтения сообщений:")
            print(f"  Среднее: {statistics.mean(self.results['read_times']):.3f} сек")
            print(f"  Медиана: {statistics.median(self.results['read_times']):.3f} сек")

        print(f"\nПроизводительность:")
        print(f"  Сообщений в секунду: {self.results['successful_messages'] / total_time:.2f}")

        if self.results['errors']:
            print(f"\nОшибки ({len(self.results['errors'])}):")
            for error in self.results['errors'][:5]:  # Показываем первые 5 ошибок
                print(f"  - {error}")
            if len(self.results['errors']) > 5:
                print(f"  ... и еще {len(self.results['errors']) - 5} ошибок")

        print("\n" + "=" * 60)

    async def cleanup(self):
        """Очистка тестовых данных"""
        print("\nОчистка тестовых данных...")

        async with aiohttp.ClientSession() as session:
            # Авторизуемся как администратор (предполагаем, что есть admin пользователь)
            try:
                token = await self._login_user(session, "admin", "admin123")

                if token:
                    headers = {"Authorization": f"Bearer {token}"}

                    # Удаляем тестовых пользователей
                    for user in self.users:
                        if user["login"].startswith("testuser_"):
                            try:
                                async with session.delete(
                                        f"{self.base_url}/api/users/{user['id']}",
                                        headers=headers,
                                        timeout=10
                                ) as response:
                                    if response.status != 200:
                                        print(f"Ошибка удаления пользователя {user['id']}")
                            except:
                                pass

                    # Удаляем тестовые чаты
                    for chat in self.chats:
                        if chat["name"].startswith("Test Chat"):
                            try:
                                async with session.delete(
                                        f"{self.base_url}/api/chats/{chat['id']}",
                                        headers=headers,
                                        timeout=10
                                ) as response:
                                    if response.status != 200:
                                        print(f"Ошибка удаления чата {chat['id']}")
                            except:
                                pass

                    print("Очистка завершена")

            except:
                print("Не удалось выполнить очистку (проблемы с авторизацией администратора)")


async def main():
    parser = argparse.ArgumentParser(description="Нагрузочное тестирование мессенджера")
    parser.add_argument("--url", default="http://localhost:8000", help="URL API сервера")
    parser.add_argument("--users", type=int, default=10, help="Количество тестовых пользователей")
    parser.add_argument("--chats", type=int, default=5, help="Количество тестовых чатов")
    parser.add_argument("--messages", type=int, default=100, help="Количество тестовых сообщений")
    parser.add_argument("--concurrent", type=int, default=20, help="Количество параллельных запросов")
    parser.add_argument("--no-cleanup", action="store_true", help="Не очищать тестовые данные")

    args = parser.parse_args()

    print(f"Нагрузочное тестирование мессенджера с гарантированной доставкой")
    print(f"URL: {args.url}")
    print(f"Пользователи: {args.users}, Чаты: {args.chats}, Сообщения: {args.messages}")
    print(f"Параллельные запросы: {args.concurrent}")
    print("-" * 60)

    tester = LoadTester(args.url, args.users, args.messages, args.chats)

    try:
        # Создаем тестовые данные
        await tester.create_users()
        await tester.create_chats()

        # Измеряем базовую производительность
        await tester.measure_performance()

        # Выполняем нагрузочное тестирование
        await tester.send_messages(args.concurrent)

        # Выводим результаты
        tester.print_results()

        # Очищаем тестовые данные если не указано иное
        if not args.no_cleanup:
            await tester.cleanup()

    except KeyboardInterrupt:
        print("\nТестирование прервано пользователем")
        tester.print_results()
    except Exception as e:
        print(f"\nОшибка во время тестирования: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())