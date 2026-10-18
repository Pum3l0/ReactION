# Многоступенчатая сборка: собираем Vite-проект и отдаём статику через nginx.
# Сборка происходит прямо в образе, поэтому на сервере Node.js не нужен.

# --- Сборка ---
FROM node:22-alpine AS build

WORKDIR /app

# Сначала только манифесты — кэш слоёв npm install
COPY package.json package-lock.json ./
RUN npm ci

# Затем исходники
COPY . .
RUN npm run build

# --- Раздача ---
FROM nginx:1.27-alpine

# Конфиг nginx для SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Готовые файлы
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
