# backend/api/media.py
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import Optional

from utils.upload import save_upload_file, get_file_type, is_allowed_file, get_max_file_size, validate_file_size
from auth import get_current_user

router = APIRouter()


@router.post("/upload")
async def upload_file(
        file: UploadFile = File(...),
        current_user=Depends(get_current_user)
):
    """
    Загружает файл и возвращает URL.
    Используется при отправке сообщений с вложением.
    """
    # Проверка типа файла
    if not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail="Недопустимый тип файла"
        )

    # Определяем тип файла
    file_type = get_file_type(file.filename)

    # Проверка размера файла
    max_size_mb = get_max_file_size(file_type)
    if not await validate_file_size(file, max_size_mb):
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой. Максимальный размер: {max_size_mb}MB"
        )

    # Определяем подпапку для сохранения
    subfolders = {
        "image": "images",
        "video": "videos",
        "document": "documents"
    }
    subfolder = subfolders.get(file_type, "documents")

    # Сохраняем файл
    file_url = await save_upload_file(file, subfolder)

    return {
        "file_url": file_url,
        "file_type": file_type,
        "filename": file.filename
    }