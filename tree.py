import os
import sys
from datetime import datetime

# Папки и файлы, которые нужно игнорировать
EXCLUDED = {
    '.venv', 'venv', '__pycache__', '.git', 'node_modules',
    '.DS_Store', '.pytest_cache', '.mypy_cache',
    '.idea', '.vscode', '.env', 'dist', 'build', '*.egg-info'
}


def is_excluded(name):
    # Точные совпадения
    if name in EXCLUDED:
        return True
    # Скрытие скрытых файлов/папок (начинающихся с .), кроме .git
    if name.startswith('.') and name != '.git':
        return True
    # Проверка по маскам (например, заканчивается на .egg-info)
    if any(name.endswith(exc[1:]) for exc in EXCLUDED if isinstance(exc, str) and exc.startswith('*')):
        return True
    return False


def collect_tree(path='.', prefix=''):
    """Собирает строки структуры, не выводя сразу."""
    output_lines = []
    try:
        items = sorted(item for item in os.listdir(path) if not is_excluded(item))
    except PermissionError:
        output_lines.append(f"{prefix}├── [Permission denied]")
        return output_lines

    for i, item in enumerate(items):
        item_path = os.path.join(path, item)
        is_last = i == len(items) - 1
        branch = "└── " if is_last else "├── "
        line = f"{prefix}{branch}{item}"
        output_lines.append(line)

        if os.path.isdir(item_path):
            extension = "    " if is_last else "│   "
            output_lines.extend(collect_tree(item_path, prefix + extension))

    return output_lines


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else '.'

    print("Generating project structure...\n")

    # Собираем структуру
    lines = [
                f"Project Structure ({root})",
                f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "=" * 50
            ] + collect_tree(root)

    # Вывод в консоль
    print("\n".join(lines))

    # Сохранение в файл в корне проекта
    output_file = os.path.join(root, "project_structure.txt")
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        print(f"\n✅ Structure saved to: {output_file}")
    except Exception as e:
        print(f"\n❌ Failed to save file: {e}")
