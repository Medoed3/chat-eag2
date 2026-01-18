#!/usr/bin/env python3
"""
Скрипт для оптимизации производительности базы данных
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseOptimizer:
    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row

    def analyze_indexes(self):
        """Анализ индексов базы данных"""
        logger.info("Анализ индексов...")

        cursor = self.conn.cursor()

        # Получаем информацию об индексах
        cursor.execute("""
            SELECT 
                m.name as table_name,
                p.name as column_name,
                il.name as index_name,
                il.origin as index_type,
                il."unique" as is_unique
            FROM sqlite_master AS m
            JOIN pragma_table_info(m.name) AS p
            LEFT JOIN pragma_index_list(m.name) AS il
            LEFT JOIN pragma_index_info(il.name) AS ii ON ii.name = p.name
            WHERE m.type = 'table'
            ORDER BY m.name, p.cid
        """)

        indexes = cursor.fetchall()

        # Группируем по таблицам
        tables = {}
        for idx in indexes:
            table_name = idx['table_name']
            if table_name not in tables:
                tables[table_name] = {
                    'columns': set(),
                    'indexes': []
                }

            tables[table_name]['columns'].add(idx['column_name'])
            if idx['index_name']:
                tables[table_name]['indexes'].append({
                    'name': idx['index_name'],
                    'type': idx['index_type'],
                    'unique': bool(idx['is_unique'])
                })

        # Анализируем пропущенные индексы
        missing_indexes = []

        for table_name, data in tables.items():
            # Проверяем, есть ли индексы на часто используемых полях
            common_index_fields = ['id', 'user_id', 'chat_id', 'sender_id', 'created_at', 'timestamp']

            for field in common_index_fields:
                if field in data['columns']:
                    # Проверяем, есть ли индекс на этом поле
                    has_index = any(
                        index['name'] and field in index['name'].lower()
                        for index in data['indexes']
                    )

                    if not has_index:
                        missing_indexes.append({
                            'table': table_name,
                            'column': field,
                            'reason': 'Часто используемое поле'
                        })

        return {
            'tables': tables,
            'missing_indexes': missing_indexes
        }

    def analyze_query_performance(self):
        """Анализ производительности запросов"""
        logger.info("Анализ производительности запросов...")

        cursor = self.conn.cursor()

        # Включаем профилирование
        cursor.execute("PRAGMA temp_store = MEMORY;")
        cursor.execute("PRAGMA journal_mode = WAL;")
        cursor.execute("PRAGMA synchronous = NORMAL;")
        cursor.execute("PRAGMA cache_size = -2000;")  # 2MB кэша

        # Анализируем таблицы
        cursor.execute("ANALYZE;")

        # Получаем статистику по таблицам
        cursor.execute("""
            SELECT 
                name as table_name,
                sql
            FROM sqlite_master 
            WHERE type = 'table'
        """)

        tables = cursor.fetchall()

        recommendations = []

        for table in tables:
            table_name = table['table_name']

            # Получаем размер таблицы
            cursor.execute(f"SELECT COUNT(*) as row_count FROM {table_name}")
            row_count = cursor.fetchone()['row_count']

            if row_count > 10000:
                # Для больших таблиц рекомендуем партиционирование
                recommendations.append({
                    'table': table_name,
                    'issue': f'Большая таблица ({row_count} строк)',
                    'recommendation': 'Рассмотреть партиционирование по дате',
                    'priority': 'high'
                })

            # Проверяем наличие текстовых полей без индексов
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = cursor.fetchall()

            for col in columns:
                if col['type'] and 'TEXT' in col['type'].upper() and row_count > 1000:
                    recommendations.append({
                        'table': table_name,
                        'issue': f'Текстовое поле {col["name"]} без индекса',
                        'recommendation': 'Добавить индекс или использовать полнотекстовый поиск',
                        'priority': 'medium'
                    })

        return recommendations

    def optimize_database(self):
        """Выполнение оптимизаций базы данных"""
        logger.info("Выполнение оптимизаций...")

        cursor = self.conn.cursor()

        try:
            # 1. Включаем WAL режим для лучшей параллельности
            cursor.execute("PRAGMA journal_mode = WAL;")
            logger.info("Включен WAL режим")

            # 2. Увеличиваем размер кэша
            cursor.execute("PRAGMA cache_size = -10000;")  # 10MB
            logger.info("Увеличен размер кэша до 10MB")

            # 3. Настраиваем временное хранилище
            cursor.execute("PRAGMA temp_store = MEMORY;")
            logger.info("Временное хранилище настроено на память")

            # 4. Настраиваем синхронность
            cursor.execute("PRAGMA synchronous = NORMAL;")
            logger.info("Синхронность настроена на NORMAL")

            # 5. Перестраиваем базу данных
            logger.info("Перестроение базы данных...")
            cursor.execute("VACUUM;")
            logger.info("База данных перестроена")

            # 6. Обновляем статистику
            cursor.execute("ANALYZE;")
            logger.info("Статистика обновлена")

            self.conn.commit()

            return True

        except Exception as e:
            logger.error(f"Ошибка оптимизации: {e}")
            self.conn.rollback()
            return False

    def create_recommended_indexes(self, missing_indexes):
        """Создание рекомендуемых индексов"""
        logger.info("Создание рекомендуемых индексов...")

        cursor = self.conn.cursor()

        created_indexes = []

        for idx in missing_indexes[:10]:  # Ограничиваем 10 индексами
            try:
                table_name = idx['table']
                column = idx['column']
                index_name = f"idx_{table_name}_{column}"

                cursor.execute(f"""
                    CREATE INDEX IF NOT EXISTS {index_name} 
                    ON {table_name}({column})
                """)

                created_indexes.append(index_name)
                logger.info(f"Создан индекс: {index_name}")

            except Exception as e:
                logger.error(f"Ошибка создания индекса для {table_name}.{column}: {e}")

        self.conn.commit()
        return created_indexes

    def cleanup_old_data(self, days_to_keep: int = 90):
        """Очистка старых данных"""
        logger.info(f"Очистка данных старше {days_to_keep} дней...")

        cursor = self.conn.cursor()
        cutoff_date = (datetime.now() - timedelta(days=days_to_keep)).isoformat()

        tables_to_cleanup = [
            ('messages', 'server_timestamp'),
            ('message_deliveries', 'created_at'),
            ('unread_messages', 'created_at')
        ]

        deleted_counts = {}

        for table, date_column in tables_to_cleanup:
            try:
                # Сначала получаем количество строк для удаления
                cursor.execute(f"""
                    SELECT COUNT(*) as count 
                    FROM {table} 
                    WHERE {date_column} < ?
                """, (cutoff_date,))

                count = cursor.fetchone()['count']

                if count > 0:
                    # Удаляем старые данные
                    cursor.execute(f"""
                        DELETE FROM {table} 
                        WHERE {date_column} < ?
                    """, (cutoff_date,))

                    deleted_counts[table] = count
                    logger.info(f"Удалено {count} строк из {table}")

            except Exception as e:
                logger.error(f"Ошибка очистки {table}: {e}")

        self.conn.commit()
        return deleted_counts

    def generate_report(self):
        """Генерация отчета об оптимизации"""
        logger.info("Генерация отчета...")

        report = {
            'timestamp': datetime.now().isoformat(),
            'database': str(self.db_path),
            'size_mb': self.db_path.stat().st_size / (1024 * 1024),
            'index_analysis': self.analyze_indexes(),
            'performance_recommendations': self.analyze_query_performance(),
            'optimization_applied': {}
        }

        # Применяем оптимизации
        if self.optimize_database():
            report['optimization_applied']['database_optimization'] = 'success'

        # Создаем рекомендуемые индексы
        missing_indexes = report['index_analysis']['missing_indexes']
        if missing_indexes:
            created = self.create_recommended_indexes(missing_indexes)
            report['optimization_applied']['indexes_created'] = created

        # Очищаем старые данные
        deleted = self.cleanup_old_data(90)
        if deleted:
            report['optimization_applied']['old_data_cleaned'] = deleted

        # Сохраняем отчет
        report_path = self.db_path.parent / f"optimization_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        logger.info(f"Отчет сохранен: {report_path}")
        return report

    def close(self):
        """Закрытие соединения с БД"""
        self.conn.close()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Оптимизация базы данных мессенджера")
    parser.add_argument("--db", default="./backend/messenger.db", help="Путь к файлу базы данных")
    parser.add_argument("--optimize", action="store_true", help="Выполнить оптимизацию")
    parser.add_argument("--cleanup", action="store_true", help="Очистить старые данные")
    parser.add_argument("--report", action="store_true", help="Сгенерировать отчет")

    args = parser.parse_args()

    if not Path(args.db).exists():
        print(f"Ошибка: файл базы данных {args.db} не существует")
        return

    optimizer = DatabaseOptimizer(args.db)

    try:
        if args.report or (not args.optimize and not args.cleanup):
            # Генерация полного отчета
            report = optimizer.generate_report()
            print("\n" + "=" * 60)
            print("ОТЧЕТ ОБ ОПТИМИЗАЦИИ БАЗЫ ДАННЫХ")
            print("=" * 60)

            print(f"\n📊 База данных: {report['database']}")
            print(f"📏 Размер: {report['size_mb']:.2f} MB")

            print(f"\n🔍 Анализ индексов:")
            missing = len(report['index_analysis']['missing_indexes'])
            if missing > 0:
                print(f"   ⚠️  Пропущено {missing} индексов:")
                for idx in report['index_analysis']['missing_indexes'][:5]:
                    print(f"      - {idx['table']}.{idx['column']}: {idx['reason']}")
            else:
                print("   ✅ Все необходимые индексы присутствуют")

            print(f"\n⚡ Рекомендации по производительности:")
            if report['performance_recommendations']:
                for rec in report['performance_recommendations'][:5]:
                    print(f"   {rec['priority'].upper()}: {rec['issue']}")
                    print(f"      → {rec['recommendation']}")
            else:
                print("   ✅ Критических проблем не обнаружено")

            print(f"\n🛠️  Примененные оптимизации:")
            if report['optimization_applied']:
                for opt, result in report['optimization_applied'].items():
                    print(f"   ✅ {opt}: {result}")
            else:
                print("   ℹ️  Оптимизации не применялись")

            print("\n" + "=" * 60)

        elif args.optimize:
            # Только оптимизация
            print("Выполнение оптимизации базы данных...")
            if optimizer.optimize_database():
                print("✅ Оптимизация завершена успешно")
            else:
                print("❌ Ошибка оптимизации")

        elif args.cleanup:
            # Только очистка
            print("Очистка старых данных...")
            deleted = optimizer.cleanup_old_data(90)
            if deleted:
                print(f"✅ Очищено:")
                for table, count in deleted.items():
                    print(f"   - {table}: {count} строк")
            else:
                print("ℹ️  Нечего очищать")

    finally:
        optimizer.close()


if __name__ == "__main__":
    main()