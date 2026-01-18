#!/usr/bin/env python3
"""
Простой дашборд для мониторинга мессенджера
"""

from flask import Flask, render_template, jsonify
import requests
import time
from datetime import datetime, timedelta
import json
from threading import Thread
import logging

app = Flask(__name__)

# Конфигурация
API_URL = "http://localhost:8000"
UPDATE_INTERVAL = 10  # секунд

# Кэш для данных
cache = {
    "stats": None,
    "metrics": None,
    "health": None,
    "last_update": None
}


def fetch_data():
    """Фоновая задача для получения данных"""
    while True:
        try:
            # Получаем статистику
            response = requests.get(f"{API_URL}/api/metrics/stats", timeout=5)
            if response.status_code == 200:
                cache["stats"] = response.json()

            # Получаем метрики
            response = requests.get(f"{API_URL}/api/metrics/json", timeout=5)
            if response.status_code == 200:
                cache["metrics"] = response.json()

            # Получаем health-check
            response = requests.get(f"{API_URL}/api/metrics/system/health", timeout=5)
            if response.status_code == 200:
                cache["health"] = response.json()

            cache["last_update"] = datetime.now().isoformat()

        except Exception as e:
            logging.error(f"Error fetching data: {e}")

        time.sleep(UPDATE_INTERVAL)


@app.route('/')
def dashboard():
    """Главная страница дашборда"""
    return render_template('dashboard.html')


@app.route('/api/dashboard/data')
def dashboard_data():
    """API для получения данных дашборда"""
    if not cache["stats"]:
        return jsonify({"error": "No data available"}), 503

    # Подготавливаем данные для графиков
    chart_data = prepare_chart_data()

    return jsonify({
        "stats": cache["stats"],
        "health": cache["health"],
        "charts": chart_data,
        "last_update": cache["last_update"],
        "timestamp": datetime.now().isoformat()
    })


def prepare_chart_data():
    """Подготовка данных для графиков"""
    if not cache["stats"] or not cache["metrics"]:
        return {}

    charts = {}

    # График онлайн пользователей
    try:
        users_online = cache["metrics"].get("users_online", {})
        if users_online and "value" in users_online:
            charts["users_online"] = {
                "current": users_online["value"] if isinstance(users_online["value"], (int, float)) else 0,
                "history": []  # В реальной системе можно добавить историю
            }
    except:
        pass

    # График сообщений
    try:
        messages_stats = cache["stats"].get("messages", {})
        if messages_stats:
            charts["messages"] = {
                "total": messages_stats.get("total", 0),
                "delivered": messages_stats.get("delivered", 0),
                "read": messages_stats.get("read", 0),
                "pending": messages_stats.get("pending", 0),
                "failed": messages_stats.get("failed", 0)
            }
    except:
        pass

    # График времени доставки
    try:
        delivery_stats = cache["stats"].get("delivery_stats", {})
        if delivery_stats:
            # Берем первый чат для примера
            first_chat_id = next(iter(delivery_stats))
            stats = delivery_stats[first_chat_id]

            charts["delivery_times"] = {
                "mean": stats.get("mean", 0),
                "median": stats.get("median", 0),
                "p95": stats.get("p95", 0),
                "p99": stats.get("p99", 0)
            }
    except:
        pass

    return charts


@app.route('/api/dashboard/alerts')
def get_alerts():
    """Получение алертов"""
    alerts = []

    if cache["health"]:
        health_status = cache["health"].get("status")
        if health_status != "healthy":
            alerts.append({
                "level": "error",
                "message": f"Система работает в деградированном режиме: {health_status}",
                "timestamp": cache["last_update"]
            })

        # Проверка компонентов
        components = cache["health"].get("components", {})
        for name, component in components.items():
            if component.get("status") != "healthy":
                alerts.append({
                    "level": "warning",
                    "message": f"Компонент {name} не работает нормально",
                    "details": component,
                    "timestamp": cache["last_update"]
                })

    # Проверка очереди сообщений
    if cache["metrics"]:
        messages_pending = cache["metrics"].get("messages_pending", {})
        if isinstance(messages_pending, dict) and "value" in messages_pending:
            pending = messages_pending["value"]
            if isinstance(pending, dict):
                pending = pending.get("_default", 0)

            if pending > 100:
                alerts.append({
                    "level": "warning",
                    "message": f"Большая очередь сообщений: {pending}",
                    "timestamp": cache["last_update"]
                })

    return jsonify({"alerts": alerts})


if __name__ == '__main__':
    # Запускаем фоновую задачу для получения данных
    thread = Thread(target=fetch_data, daemon=True)
    thread.start()

    # Запускаем веб-сервер
    app.run(debug=True, port=5000, host='0.0.0.0')