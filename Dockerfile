# Next.js 16 + Payload CMS 3 + sharp. Единый образ (сборка и рантайм вместе),
# как было на Render: полный исходник + node_modules + .next. Так на старте
# работает `payload migrate` — ему нужны payload.config, src/migrations и CLI
# (в standalone-образе их нет). Медиа — во внешних R2/Kinescope, в образ не едет.

# ── Стадия сборки whisper.cpp: self-hosted распознавание речи для авто-субтитров
#    (worker/transcode.mjs). Отдельная стадия — build-инструменты (git/cmake/gcc)
#    в финальный образ НЕ едут; копируем только статический бинарник + ggml-модель.
#    Модель выбирается build-аргументом WHISPER_MODEL: small ≈ 466МБ — разумный
#    CPU-дефолт для русского; base ≈ 140МБ легче/быстрее, но грубее.
FROM debian:bookworm-slim AS whisper
ARG WHISPER_MODEL=small
RUN apt-get update \
  && apt-get install -y --no-install-recommends git build-essential cmake ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git
WORKDIR /opt/whisper.cpp
RUN cmake -B build -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON \
  && cmake --build build -j --config Release
RUN sh ./models/download-ggml-model.sh ${WHISPER_MODEL}


FROM node:20-bookworm-slim

# ca-certificates/openssl — для TLS к Postgres/R2/Kinescope.
# curl — для HEALTHCHECK ниже. ffmpeg — для транскод-воркера (worker/transcode.mjs)
# в том же образе: сервис worker гоняет им HLS ABR + постер/gif/сториборд.
# libvips для sharp идёт prebuilt в самом пакете sharp (доп. системных либ на
# Debian не требуется). apt-get требует root, поэтому ставим ДО смены пользователя.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl curl ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# whisper.cpp: статический бинарник + ggml-модель для авто-субтитров (worker).
# WHISPER_MODEL_PATH по умолчанию указывает на small; при смене build-аргумента
# WHISPER_MODEL обнови и WHISPER_MODEL_PATH (рантайм-переменной воркера).
COPY --from=whisper /opt/whisper.cpp/build/bin/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper /opt/whisper.cpp/models/ggml-*.bin /opt/models/
ENV WHISPER_BIN=/usr/local/bin/whisper-cli
ENV WHISPER_MODEL_PATH=/opt/models/ggml-small.bin

# Дальше всё от непривилегированного `node`, а COPY идут с --chown.
# Отдельный `RUN chown -R /app` не годится: слой overlayfs копирует затронутые
# файлы целиком, и образ вырастает примерно вдвое (node_modules и .next весят
# почти всё).
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# 1) Зависимости отдельным слоем (кэш). Ставим ВСЕ (включая dev) — нужны и для
#    сборки, и для `payload migrate` (загрузка TS-конфига).
#
#    Почему npm install, а НЕ npm ci: npm ci строгий — он заново вычисляет
#    «идеальное дерево» из package.json и требует полного совпадения с
#    package-lock.json. Наш lock сгенерирован на macOS/Node 22, а образ — это
#    Node 20 на Linux; на другой платформе/версии Node дерево зависимостей
#    (picomatch, yaml, транзитивные из @payloadcms/richtext-lexical и
#    @testing-library/react) вычисляется иначе, поэтому npm ci считает lock
#    «out of sync» и падает (апгрейд npm это НЕ лечит). npm install толерантен:
#    примиряет lock с package.json и ставит зависимости — ровно так это и
#    работало на Render.
COPY --chown=node:node package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# 2) Исходники.
COPY --chown=node:node . .

# 3) next.config подставляет публичный URL хранилища в images.remotePatterns НА
#    ЭТАПЕ СБОРКИ — иначе next/image не пропустит картинки. Это публичный URL
#    (не секрет), передаём build-аргументом. Основной — S3_PUBLIC_URL (Timeweb
#    S3), R2_PUBLIC_URL оставлен фолбэком. В Timeweb задать в разделе
#    Build Arguments: S3_PUBLIC_URL=https://s3.twcstorage.ru/<бакет>
ARG S3_PUBLIC_URL
ENV S3_PUBLIC_URL=$S3_PUBLIC_URL
ARG R2_PUBLIC_URL
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL

# 4) Сборка (next build). Шрифты локальные (@fontsource-* в зависимостях), в
#    Google Fonts сборка не ходит — это важно для сборки из РФ-сети.
RUN npm run build

# Рантайм
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Оркестратор должен уметь отличить «контейнер поднялся» от «процесс жив, но
# приложение не отвечает» — иначе битый деплой выглядит здоровым.
#
# start-period с большим запасом: сервер начинает слушать только ПОСЛЕ
# `payload migrate` (см. CMD ниже). На большой базе миграция идёт минуты, и с
# коротким периодом контейнер помечался бы unhealthy, а оркестратор мог убить
# его прямо посреди миграции — и так по кругу.
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

# Миграции + старт. next start слушает $PORT на 0.0.0.0. Все секреты
# (DATABASE_URL, PAYLOAD_SECRET, R2_*, KINESCOPE_*, MEILI_*) передаются
# РАНТАЙМ-переменными окружения контейнера, НЕ в образ.
#
# ВНИМАНИЕ при масштабировании: миграции гоняются на старте КАЖДОГО контейнера.
# С одной репликой это нормально; с несколькими нужен отдельный шаг миграции
# до раскатки, иначе реплики стартуют наперегонки.
# wait-for-db гасит основной сбой старта: `payload migrate` иногда падал на
# подключении к БД (порт ещё закрыт / DNS не раскрутился) и валил весь запуск в
# рестарт-цикл. Ждём открытия TCP-порта БД, потом мигрируем и стартуем.
CMD ["sh", "-c", "node scripts/wait-for-db.mjs && npm run migrate && npm run start"]
