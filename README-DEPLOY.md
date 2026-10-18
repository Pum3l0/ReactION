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

Сборка идёт в облаке GitHub. На сервере Node.js не нужен.

---

## 1. Что настроить на сервере (один раз)

### 1.1. Папка для статики

```sh
sudo mkdir -p /opt/reaction/dist
sudo chown -R $USER:$USER /opt/reaction
```

### 1.2. Имя docker-сети, где живёт nginx-proxy-manager

```sh
docker network ls
```

Найди сеть, в которой крутится NPM (обычно её имя содержит `nginx-proxy-manager`
или названа по проекту, например `nginx-proxy-manager_default`). Впиши это имя
в `docker-compose.yml` вместо `npm_network`.

> Если NPM запущен в другой сети/стеке, можно подключить его к нашей сети
> позже: `docker network connect <сеть_игры> <имя_контейнера_NPM>`.

### 1.3. Ключ для деплоя с GitHub

На сервере:

```sh
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy   # приватный ключ — скопируй целиком
```

### 1.4. Запуск контейнера

```sh
cd /opt/reaction        # куда положишь docker-compose.yml и nginx.conf
docker compose up -d
docker compose ps       # reaction-game должен быть healthy
```

---

## 2. Секреты в GitHub

Репозиторий → **Settings → Secrets and variables → Actions → New repository secret**:

| Имя | Что положить | Пример |
|---|---|---|
| `DEPLOY_HOST` | IP или домен VPS | `203.0.113.10` |
| `DEPLOY_USER` | пользователь SSH | `root` или `deploy` |
| `DEPLOY_SSH_KEY` | приватный ключ целиком (из шага 1.3) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_PATH` | куда класть dist | `/opt/reaction/dist/` |

⚠️ `DEPLOY_PATH` **со слэшем на конце** — rsync копирует содержимое папки.

---

## 3. Проверка

После push в `main`:

- GitHub → **Actions** → workflow «Deploy to VPS» должен пройти зелёным
- На сервере: `ls /opt/reaction/dist` — появился `index.html` и `assets/`
- Контейнер видит файлы: `docker exec reaction-game ls /usr/share/nginx/html`

---

## 4. Поддомен в nginx-proxy-manager

В NPM: **Hosts → Proxy Hosts → Add Proxy Host**

| Поле | Значение |
|---|---|
| Domain Names | `твой.поддомен.ru` |
| Scheme | `http` |
| Forward Hostname / IP | `reaction-game` (имя контейнера) |
| Forward Port | `80` |
| Block Common Exploits | ✔ |
| Websockets Support | не нужен |
| SSL | вкладка SSL → Request new certificate |

Сертификат Let's Encrypt выпустится автоматически, если DNS уже указывает на VPS.

---

## 5. Локальная разработка

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # сборка в dist/
```
