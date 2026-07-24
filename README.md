# Content Box

White-label платформа подписок для авторов, контент-мейкеров и инфлюэнсеров.
Каждый автор получает своё приложение на своём домене (или бесплатном поддомене
`*.contentbox.site`), студию управления контентом и сайт с подпиской для аудитории.

## Стек

- **Next.js 16** (App Router, Turbopack), **React 19**
- **Payload CMS 3.85** на **PostgreSQL** — миграции обязательны, `db.push` отключён
- Плагины Payload: `multiTenantPlugin` (мультитенант), `nestedDocsPlugin` (дерево категорий)
- Медиа — **Cloudflare R2** (S3-совместимо, `s3Storage`)
- Видео — **Kinescope**
- Деплой — **Timeweb Cloud** через Docker

## Архитектура

Роутинг по хосту (`src/proxy.ts` → `src/middleware.ts`):

- **Платформенный домен** (`contentbox.site`, `www`): на `/` — лендинг
  (`public/landing.html`), витрина проектов на `/explore`, регистрация на
  `/signup`, студия автора на `/studio`, админка Payload на `/admin`.
- **Поддомен автора** (`<sub>.contentbox.site`): резолвится по полю
  `tenants.subdomain` — бесплатный «резервный» адрес, всегда доступен.
- **Собственный домен автора**: резолвится по `tenants.domain` (после
  подтверждения). Поддомен продолжает работать как резерв.

Тенант (`tenants`) — рабочее пространство автора. Пользователи (`users`, auth
Payload) привязаны к тенанту через `tenant` + `tenantRole`; суперадмин —
платформенная роль без тенанта. Изоляция данных — в `src/access/`.

Регистрация оформлена как онбординг: `/signup` (2 поля) → `/api/register-author`
(создаёт tenant + user + site-settings) → автологин → мастер `/studio/onboarding`
(бренд, адрес-поддомен, категория, аватар) → дашборд студии.

## Локальный запуск

Нужен Node 20+ и PostgreSQL.

```bash
cp .env.example .env      # заполните переменные (см. комментарии в файле)
npm install
npm run migrate           # применить миграции к базе
npm run dev               # http://localhost:3000
```

Первого суперадмина создайте через `/admin`.

## Миграции

Схема управляется только миграциями (`db.push:false`). После изменения
коллекций:

```bash
npm run payload -- migrate:create <название>   # сгенерировать по diff со схемой
npm run migrate                                # применить
```

Миграции лежат в `src/migrations/` и регистрируются в `src/migrations/index.ts`.
На старте контейнера в проде прогоняется `npm run migrate` (см. `Dockerfile`).

## Медиа и видео

- Картинки грузятся в Cloudflare R2 и раздаются с публичного домена
  `R2_PUBLIC_URL` (минуя приложение).
- Видео — через Kinescope (`KINESCOPE_*`). Импорт и загрузка — из студии.

## Деплой (Timeweb Cloud, Docker)

Сборка из `Dockerfile` в корне. Ключевое:

- **Build Argument:** `R2_PUBLIC_URL` (нужен для `next build`).
- **Рантайм-переменные:** весь список из `.env.example` (особенно
  `DATABASE_URL` и `PAYLOAD_SECRET`).
- Порт контейнера — **3000**. Старт-команда зашита в образ:
  `npm run migrate && npm run start`.

Для поддоменов авторов нужен wildcard-DNS `*.contentbox.site` → приложение и
соответствующий TLS.

## Структура

```
public/landing.html          Лендинг платформы
src/proxy.ts                 Роутинг по хосту (платформа / тенант)
src/payload.config.ts        Конфиг Payload (коллекции, плагины, R2)
src/collections/             Коллекции (Tenants, Users, Publications, …)
src/access/                  Контроль доступа и изоляция тенантов
src/migrations/              SQL-миграции Payload
src/app/(frontend)/          Публичный сайт тенанта + витрина /explore
src/app/(signup)/            Регистрация автора /signup
src/app/(studio)/            Студия автора /studio (+ онбординг)
src/app/(payload)/           Админка Payload /admin
```

## Скрипты

```bash
npm run dev        # дев-сервер
npm run build      # прод-сборка
npm run start      # прод-сервер
npm run migrate    # применить миграции
npm run generate:types   # перегенерировать payload-types.ts
npm run test:e2e   # Playwright e2e
```
