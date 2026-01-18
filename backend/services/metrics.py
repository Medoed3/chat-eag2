# backend/services/metrics.py
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import time
import logging
from enum import Enum
import statistics
from collections import defaultdict, deque

from utils.redis_client import redis_client

logger = logging.getLogger(__name__)


class MetricType(str, Enum):
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


class MetricsService:
    def __init__(self):
        self.metrics: Dict[str, Dict] = {}
        self.init_default_metrics()

    def init_default_metrics(self):
        """Инициализация стандартных метрик"""
        # Метрики сообщений
        self.register_metric("messages_total", MetricType.GAUGE, "Total number of messages")  # Изменил COUNTER -> GAUGE
        self.register_metric("messages_delivered", MetricType.COUNTER, "Number of delivered messages")
        self.register_metric("messages_read", MetricType.COUNTER, "Number of read messages")
        self.register_metric("messages_failed", MetricType.COUNTER, "Number of failed messages")
        self.register_metric("messages_pending", MetricType.GAUGE, "Number of pending messages")

        # Метрики пользователей
        self.register_metric("users_total", MetricType.GAUGE, "Total number of users")  # Изменил COUNTER -> GAUGE
        self.register_metric("users_online", MetricType.GAUGE, "Number of online users")
        self.register_metric("users_active_24h", MetricType.GAUGE, "Number of active users in last 24h")

        # Метрики чатов
        self.register_metric("chats_total", MetricType.GAUGE, "Total number of chats")  # Изменил COUNTER -> GAUGE
        self.register_metric("chats_active", MetricType.GAUGE, "Number of active chats")

        # Метрики производительности
        self.register_metric("request_duration_seconds", MetricType.HISTOGRAM, "Request duration in seconds")
        self.register_metric("websocket_connections", MetricType.GAUGE, "Number of active WebSocket connections")
        self.register_metric("redis_connections", MetricType.GAUGE, "Number of Redis connections")

        self.register_metric("requests_total", MetricType.COUNTER, "Total number of HTTP requests")

        # Метрики времени доставки
        self.register_metric("delivery_time_seconds", MetricType.HISTOGRAM, "Message delivery time in seconds")
        self.register_metric("read_time_seconds", MetricType.HISTOGRAM, "Message read time in seconds")

        # Метрики очередей
        self.register_metric("queue_size", MetricType.GAUGE, "Size of notification queue")
        self.register_metric("queue_processed", MetricType.COUNTER, "Number of processed queue items")

        # Метрики ошибок
        self.register_metric("errors_total", MetricType.COUNTER, "Total number of errors")
        self.register_metric("errors_by_type", MetricType.COUNTER, "Errors by type", labels=["type"])

    def register_metric(self, name: str, metric_type: MetricType, description: str, labels: List[str] = None):
        """Регистрация новой метрики"""
        if labels is None:
            labels = []

        self.metrics[name] = {
            "type": metric_type,
            "description": description,
            "labels": labels,
            "value": 0 if metric_type in [MetricType.COUNTER, MetricType.GAUGE] else {},
            "buckets": [0.1, 0.5, 1, 2, 5, 10] if metric_type == MetricType.HISTOGRAM else None,
            "last_updated": time.time()
        }

    def increment(self, name: str, value: float = 1, labels: Dict[str, str] = None):
        """Увеличение счетчика или gauge"""
        if name not in self.metrics:
            logger.warning(f"Metric {name} not registered")
            return

        metric = self.metrics[name]
        if metric["type"] not in [MetricType.COUNTER, MetricType.GAUGE]:
            logger.warning(f"Metric {name} is not a counter or gauge")
            return

        if labels:
            label_key = self._get_label_key(labels)

            if isinstance(metric["value"], dict):
                if label_key not in metric["value"]:
                    metric["value"][label_key] = 0
                metric["value"][label_key] += value
            else:
                # Если value не dict (а int/float), конвертируем в dict
                current_value = metric["value"]
                metric["value"] = {
                    "_default": current_value,
                    label_key: value
                }
        else:
            if isinstance(metric["value"], dict):
                metric["value"]["_default"] = metric["value"].get("_default", 0) + value
            else:
                metric["value"] += value

        metric["last_updated"] = time.time()
        # Сохраняем в Redis для распределенного мониторинга
        self._save_to_redis(name, metric)

    def set(self, name: str, value: float, labels: Dict[str, str] = None):
        """Установка значения gauge"""
        if name not in self.metrics:
            logger.warning(f"Metric {name} not registered")
            return

        metric = self.metrics[name]
        if metric["type"] != MetricType.GAUGE:
            logger.warning(f"Metric {name} is not a gauge")
            return

        if labels:
            label_key = self._get_label_key(labels)
            metric["value"][label_key] = value
        else:
            metric["value"] = value

        metric["last_updated"] = time.time()
        self._save_to_redis(name, metric)

    def observe(self, name: str, value: float, labels: Dict[str, str] = None):
        """Наблюдение значения для гистограммы или summary"""
        if name not in self.metrics:
            logger.warning(f"Metric {name} not registered")
            return

        metric = self.metrics[name]
        if metric["type"] not in [MetricType.HISTOGRAM, MetricType.SUMMARY]:
            logger.warning(f"Metric {name} is not a histogram or summary")
            return

        if labels:
            label_key = self._get_label_key(labels)
            if label_key not in metric["value"]:
                metric["value"][label_key] = {
                    "sum": 0,
                    "count": 0,
                    "buckets": defaultdict(int) if metric["type"] == MetricType.HISTOGRAM else None,
                    "values": [] if metric["type"] == MetricType.SUMMARY else None
                }

            data = metric["value"][label_key]
            data["sum"] += value
            data["count"] += 1

            if metric["type"] == MetricType.HISTOGRAM:
                # Распределение по корзинам
                for bucket in metric["buckets"]:
                    if value <= bucket:
                        data["buckets"][bucket] += 1
                # +Inf bucket
                data["buckets"]["+Inf"] = data["count"]
            else:
                # Для summary сохраняем значения для расчета квантилей
                data["values"].append(value)
                if len(data["values"]) > 1000:  # Ограничиваем размер
                    data["values"] = data["values"][-1000:]
        else:
            if "_default" not in metric["value"]:
                metric["value"]["_default"] = {
                    "sum": 0,
                    "count": 0,
                    "buckets": defaultdict(int) if metric["type"] == MetricType.HISTOGRAM else None,
                    "values": [] if metric["type"] == MetricType.SUMMARY else None
                }

            data = metric["value"]["_default"]
            data["sum"] += value
            data["count"] += 1

            if metric["type"] == MetricType.HISTOGRAM:
                for bucket in metric["buckets"]:
                    if value <= bucket:
                        data["buckets"][bucket] += 1
                data["buckets"]["+Inf"] = data["count"]
            else:
                data["values"].append(value)
                if len(data["values"]) > 1000:
                    data["values"] = data["values"][-1000:]

        metric["last_updated"] = time.time()
        self._save_to_redis(name, metric)

    def _get_label_key(self, labels: Dict[str, str]) -> str:
        """Преобразование labels в строковый ключ"""
        return ",".join(f"{k}={v}" for k, v in sorted(labels.items()))

    def _save_to_redis(self, name: str, metric: Dict):
        """Сохранение метрики в Redis"""
        try:
            # Проверяем подключение к Redis
            if not hasattr(redis_client, 'is_connected') or not redis_client.is_connected:
                return

            key = f"metrics:{name}"
            redis_client._redis.setex(key, 300, str(metric["value"]))  # TTL 5 минут
        except AttributeError as e:
            # Redis не подключен - это нормально
            pass
        except Exception as e:
            logger.error(f"Error saving metric to Redis: {e}")

    def get_metric(self, name: str) -> Optional[Dict]:
        """Получение метрики"""
        if name in self.metrics:
            return self.metrics[name].copy()
        return None

    def get_all_metrics(self) -> Dict[str, Dict]:
        """Получение всех метрик"""
        return {name: metric.copy() for name, metric in self.metrics.items()}

    def export_prometheus(self) -> str:
        """Экспорт метрик в формате Prometheus"""
        lines = []

        for name, metric in self.metrics.items():
            # Добавляем HELP
            lines.append(f"# HELP {name} {metric['description']}")

            # Добавляем TYPE
            lines.append(f"# TYPE {name} {metric['type'].value}")

            # Добавляем значения
            if isinstance(metric["value"], dict):
                for label_key, value in metric["value"].items():
                    if metric["type"] in [MetricType.COUNTER, MetricType.GAUGE]:
                        if label_key == "_default":
                            lines.append(f"{name} {value}")
                        else:
                            lines.append(f'{name}{{{label_key}}} {value}')
                    elif metric["type"] == MetricType.HISTOGRAM:
                        # Экспорт гистограммы
                        total = value["count"]
                        sum_value = value["sum"]

                        lines.append(f'{name}_bucket{{le="+Inf"}} {total}')
                        lines.append(f'{name}_sum {sum_value}')
                        lines.append(f'{name}_count {total}')

                        for bucket in metric["buckets"]:
                            count = value["buckets"].get(bucket, 0)
                            lines.append(f'{name}_bucket{{le="{bucket}"}} {count}')
            else:
                lines.append(f"{name} {metric['value']}")

        return "\n".join(lines)

    def record_delivery_time(self, chat_id: int, delivery_time: float):
        """Запись времени доставки сообщения"""
        self.observe("delivery_time_seconds", delivery_time, {"chat_id": str(chat_id)})

        # Также сохраняем в Redis для агрегации
        try:
            if not redis_client.is_connected:
                return

            key = f"stats:delivery_time:chat:{chat_id}"
            redis_client._redis.rpush(key, delivery_time)
            redis_client._redis.ltrim(key, -1000, -1)  # Храним последние 1000 значений
            redis_client._redis.expire(key, 86400)  # TTL 24 часа
        except Exception as e:
            logger.error(f"Error recording delivery time: {e}")

    def record_read_time(self, chat_id: int, read_time: float):
        """Запись времени прочтения сообщения"""
        self.observe("read_time_seconds", read_time, {"chat_id": str(chat_id)})

        try:
            if not redis_client.is_connected:
                return

            key = f"stats:read_time:chat:{chat_id}"
            redis_client._redis.rpush(key, read_time)
            redis_client._redis.ltrim(key, -1000, -1)
            redis_client._redis.expire(key, 86400)
        except Exception as e:
            logger.error(f"Error recording read time: {e}")

    def get_delivery_stats(self, chat_id: int) -> Dict[str, Any]:
        """Получение статистики доставки для чата"""
        try:
            if not redis_client.is_connected:
                return {}

            key = f"stats:delivery_time:chat:{chat_id}"
            times = redis_client._redis.lrange(key, 0, -1)
            times = [float(t) for t in times]

            if not times:
                return {}

            return {
                "count": len(times),
                "mean": statistics.mean(times),
                "median": statistics.median(times),
                "p95": sorted(times)[int(len(times) * 0.95)],
                "p99": sorted(times)[int(len(times) * 0.99)],
                "min": min(times),
                "max": max(times)
            }
        except Exception as e:
            logger.error(f"Error getting delivery stats: {e}")
            return {}

    def update_online_users(self):
        """Обновление метрики онлайн пользователей"""
        try:
            # Проверяем подключение Redis
            if not redis_client.is_connected:
                logger.debug("Redis not connected, setting online users to 0")
                self.set("users_online", 0)
                return

            # Используем безопасный доступ к Redis
            redis_conn = redis_client.get_redis()

            # Получаем все активные соединения из Redis
            pattern = "user:*:connections"
            keys = redis_conn.keys(pattern)
            online_count = 0

            for key in keys:
                connections = redis_conn.smembers(key)
                if connections:
                    online_count += 1

            self.set("users_online", online_count)

            # Также сохраняем историческую статистику
            timestamp = int(time.time())
            redis_conn.zadd("stats:users_online:history", {str(timestamp): online_count})
            redis_conn.zremrangebyscore("stats:users_online:history", "-inf", timestamp - 86400)  # 24 часа

        except RuntimeError as e:
            # Redis не подключен
            logger.debug(f"Redis not connected: {e}")
            self.set("users_online", 0)
        except Exception as e:
            logger.error(f"Error updating online users metric: {e}")
            # В случае ошибки устанавливаем 0
            self.set("users_online", 0)


# Глобальный экземпляр
metrics_service = MetricsService()