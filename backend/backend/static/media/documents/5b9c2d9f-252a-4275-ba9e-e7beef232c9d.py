from django.apps import AppConfig


class AudiobooksConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'audiobooks'
    verbose_name = 'Аудио и книги'

    def ready(self):
        import audiobooks.signals
