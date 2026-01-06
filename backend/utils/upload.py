# backend/utils/upload.py
import os
import uuid
from pathlib import Path
from fastapi import UploadFile
from typing import Tuple

# Настройки загрузки файлов
UPLOAD_DIR = "static/media"
ALLOWED_IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
ALLOWED_VIDEO_TYPES = ['.mp4', '.avi', '.mov', '.mkv', '.webm']
ALLOWED_DOCUMENT_TYPES = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.zip', '.rar']

# Создаем директории если не существуют
for subdir in ['images', 'videos', 'documents']:
    os.makedirs(os.path.join(UPLOAD_DIR, subdir), exist_ok=True)


def get_file_type(filename: str) -> str:
    """
    Определяет тип файла по расширению
    Возвращает: 'image', 'video' или 'document'
    """
    ext = Path(filename).suffix.lower()

    if ext in ALLOWED_IMAGE_TYPES:
        return 'image'
    elif ext in ALLOWED_VIDEO_TYPES:
        return 'video'
    elif ext in ALLOWED_DOCUMENT_TYPES:
        return 'document'
    else:
        return 'document'  # По умолчанию обрабатываем как документ


async def save_upload_file(file: UploadFile, subfolder: str) -> str:
    """
    Сохраняет загруженный файл и возвращает URL
    """
    # Генерируем уникальное имя файла
    file_ext = Path(file.filename).suffix.lower()
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"

    # Путь для сохранения
    save_path = Path(UPLOAD_DIR) / subfolder / unique_filename

    # Сохраняем файл
    content = await file.read()
    with open(save_path, "wb") as buffer:
        buffer.write(content)

    # Возвращаем относительный URL
    return f"/static/media/{subfolder}/{unique_filename}"


async def validate_file_size(file: UploadFile, max_size_mb: int = 10) -> bool:
    """
    Проверяет размер файла (асинхронно)
    """
    # Читаем файл для определения размера
    content = await file.read()
    file_size = len(content)

    # Перематываем файл обратно для дальнейшего использования
    await file.seek(0)

    max_size = max_size_mb * 1024 * 1024  # Конвертируем в байты
    return file_size <= max_size


def get_max_file_size(file_type: str) -> int:
    """
    Возвращает максимальный размер файла в MB в зависимости от типа
    """
    max_sizes = {
        'image': 5,  # 5MB для изображений
        'video': 50,  # 50MB для видео
        'document': 10  # 10MB для документов
    }
    return max_sizes.get(file_type, 10)  # По умолчанию 10MB


def is_allowed_file(filename: str) -> bool:
    """
    Проверяет, разрешен ли тип файла
    """
    ext = Path(filename).suffix.lower()
    allowed_extensions = ALLOWED_IMAGE_TYPES + ALLOWED_VIDEO_TYPES + ALLOWED_DOCUMENT_TYPES
    return ext in allowed_extensions
