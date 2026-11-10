# Деплой ReactION на VPS

Схема:

```
GitHub (push в main)
      ↓  GitHub Actions: npm ci → npm run build → rsync
VPS: /opt/reaction/dist/          ← статика
      ↓  docker volume (read-only)
Контейнер reaction-game (nginx)
      ↓  docker network
nginx-proxy-manager → поддомен → браузер
```
