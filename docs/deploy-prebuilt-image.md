# Деплой из готового образа (убрать окно 502 при выкате)

## Проблема
Сейчас Timeweb собирает образ **на проде**: по деплой-логу он останавливает
контейнер `app` (21:33:55), ~3 минуты собирает новый образ и только потом
поднимает его (21:36:51). Всё это время — **≈3 минуты полного простоя (502)**.
Причина — сборке `next build` нужно ~3 ГБ RAM, и на инстансе не помещаются
«работающее приложение + билд» одновременно, поэтому приложение гасится.

## Решение
Собирать образ в **GitHub Actions** (простоя прода при этом нет) и настроить
Timeweb тянуть **готовый образ** из GHCR. Тогда деплой = «скачать образ +
подменить контейнер» = секунды.

Workflow сборки уже добавлен: `.github/workflows/deploy-image.yml`. Он на каждый
push в `main` собирает и пушит `ghcr.io/dvasincom-sketch/content-box:latest`
(и тег `:<sha>`).

## Разовая настройка

### 1. Переменная сборки S3_PUBLIC_URL
GitHub → репозиторий `content-box` → Settings → Secrets and variables → Actions →
вкладка **Variables** → New variable:
- Name: `S3_PUBLIC_URL`
- Value: публичный URL хранилища, тот же, что в Timeweb (например
  `https://s3.twcstorage.ru/<твой-бакет>`).

Это нужно, потому что адрес хранилища вшивается в сборку (`images.remotePatterns`).

### 2. Первый прогон сборки
Сделай любой push в `main` (или Actions → «Build image» → Run workflow). Дождись
зелёного. После этого в репозитории появится пакет: вкладка **Packages** →
`content-box`.

### 3. Сделать пакет публичным
Чтобы Timeweb мог тянуть образ без логина: Packages → `content-box` → Package
settings → Danger Zone → Change visibility → **Public**.
(Альтернатива — оставить приватным и завести в Timeweb креды GHCR; публичный проще.)

### 4. Переключить docker-compose на образ
В `docker-compose.yml` у сервиса `app` заменить блок `build:` на `image:`. Было:

```yaml
  app:
    build:
      context: .
      args:
        - S3_PUBLIC_URL=${S3_PUBLIC_URL}
        - R2_PUBLIC_URL=${R2_PUBLIC_URL}
    ports:
      - '3000:3000'
```

Стало:

```yaml
  app:
    image: ghcr.io/dvasincom-sketch/content-box:latest
    pull_policy: always
    ports:
      - '3000:3000'
```

Остальное (environment, depends_on, restart) — без изменений. `pull_policy: always`
заставляет Timeweb на каждом деплое тянуть свежий `:latest`.

### 5. (Рекомендуется) Деплой строго после сборки образа
Чтобы Timeweb не подтянул старый `:latest` раньше, чем CI соберёт новый:
1. В Timeweb (панель приложения) найди **Deploy Hook** (URL для повторного
   деплоя по webhook).
2. Добавь его в GitHub: Settings → Secrets and variables → Actions → **Secrets** →
   New secret → `TIMEWEB_DEPLOY_HOOK` = этот URL.
3. В Timeweb **отключи авто-деплой по git-push** (иначе Timeweb стартует деплой
   параллельно со сборкой). Теперь порядок такой: push → CI собирает и пушит
   образ → CI дёргает хук → Timeweb тянет уже новый образ.

Если Deploy Hook в Timeweb недоступен — можно оставить авто-деплой по push: тогда
Timeweb на первый push подтянет ещё старый `:latest`, а следующий деплой — новый.
С `pull_policy: always` рассинхрон самолечится на следующем выкате; для чистоты
лучше вариант с хуком.

## Что в итоге
- Деплой перестаёт собирать образ на проде → окно 502 схлопывается с ~3 минут до
  секунд подмены контейнера.
- Плюс в этом же образе — `wait-for-db` (ждёт готовности БД перед миграцией,
  убирает креш-цикл старта) и закалённый `/pwa-icon`.

## Откат
Если что-то не так — вернуть в `docker-compose.yml` блок `build:` вместо `image:`,
и Timeweb снова будет собирать из репозитория, как раньше.
