#!/bin/bash

# Создаем директорию для логов
sudo mkdir -p /var/log/webfut

# Даем права пользователю
sudo chown -R $USER:$USER /var/log/webfut
sudo chmod 755 /var/log/webfut

# Создаем logrotate конфиг
sudo tee /etc/logrotate.d/webfut > /dev/null <<EOF
/var/log/webfut/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
}
EOF

echo "Логи настроены: /var/log/webfut/"
echo "Access log: /var/log/webfut/access.log"
echo "Error log: /var/log/webfut/error.log"
