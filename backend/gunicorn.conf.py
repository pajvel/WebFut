import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = 1
timeout = 60

# Оптимизация для 1GB RAM
worker_class = "sync"
worker_connections = 10
max_requests = 100
max_requests_jitter = 10
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
