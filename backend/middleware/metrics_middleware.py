# backend/middleware/metrics_middleware.py
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

from services.metrics import metrics_service

logger = logging.getLogger(__name__)


class MetricsMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Игнорируем метрики и health-check
        if request.url.path in ["/metrics", "/health", "/"]:
            return await call_next(request)

        start_time = time.time()

        try:
            response = await call_next(request)

            # Записываем метрики
            duration = time.time() - start_time

            # Метрика времени выполнения
            metrics_service.observe("request_duration_seconds", duration, {
                "method": request.method,
                "path": request.url.path,
                "status": str(response.status_code)
            })

            # Метрика счетчика запросов
            metrics_service.increment("requests_total", 1, {
                "method": request.method,
                "path": request.url.path,
                "status": str(response.status_code)
            })

            # Если ошибка, записываем в метрики ошибок
            if response.status_code >= 400:
                metrics_service.increment("errors_total", 1, {
                    "status": str(response.status_code),
                    "path": request.url.path
                })

            return response

        except Exception as e:
            duration = time.time() - start_time

            # Записываем метрику для ошибки
            metrics_service.observe("request_duration_seconds", duration, {
                "method": request.method,
                "path": request.url.path,
                "status": "500"
            })

            metrics_service.increment("errors_total", 1, {
                "status": "500",
                "path": request.url.path,
                "error_type": type(e).__name__
            })

            raise


class WebSocketMetricsMiddleware:
    """Middleware для сбора метрик WebSocket"""

    async def __call__(self, scope, receive, send):
        if scope["type"] != "websocket":
            # Пропускаем не WebSocket соединения
            return

        start_time = time.time()

        # Увеличиваем счетчик подключений
        metrics_service.increment("websocket_connections", 1)

        async def send_wrapper(message):
            await send(message)

        try:
            # Получаем путь
            path = scope.get("path", "")

            # Получаем query параметры для получения chat_id
            query_string = scope.get("query_string", b"").decode()
            chat_id = None
            if "chat_id" in path:
                # Извлекаем chat_id из пути /ws/chat/{chat_id}
                try:
                    chat_id = int(path.split("/")[-1])
                except:
                    pass

            # Отправляем метрику подключения
            metrics_service.increment("websocket_connections_total", 1, {
                "chat_id": str(chat_id) if chat_id else "unknown"
            })

            # Продолжаем обработку
            return

        except Exception as e:
            logger.error(f"WebSocket metrics error: {e}")
            metrics_service.increment("errors_total", 1, {
                "type": "websocket",
                "error": type(e).__name__
            })
            raise