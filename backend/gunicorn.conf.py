import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
# Оптимизация для 1GB RAM и конкурентности
workers = 4
worker_class = "gthread"
threads = 2
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
keepalive = 2
preload_app = True

# Логирование (в файлы для продакшена)
if os.getenv("FLASK_ENV") == "production":
    accesslog = "/var/log/webfut/access.log"
    errorlog = "/var/log/webfut/error.log"
    loglevel = "warning"
else:
    # В разработке - в консоль
    accesslog = "-"
    errorlog = "-"
    loglevel = "info"

access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
