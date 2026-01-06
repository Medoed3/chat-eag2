# backend/create_admin.py
from database import SessionLocal
from models import User
from utils.security import get_password_hash

# Создаём сессию
db = SessionLocal()

# Проверяем, существует ли уже админ с логином "admin"
admin = db.query(User).filter(User.login == "admin").first()

if admin:
    print("Администратор с логином 'admin' уже существует.")
else:
    new_admin = User(
        login="admin",
        full_name="Администратор ИТ",
        password_hash=get_password_hash("admin123"),
        role="admin",
        is_active=True
    )
    db.add(new_admin)
    db.commit()
    print("✅ Администратор успешно создан: login='admin', password='admin123'")

# Закрываем сессию
db.close()