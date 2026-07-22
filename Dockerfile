# Next.js 16 + Payload CMS 3 + sharp. Единый образ (сборка и рантайм вместе),
# как было на Render: полный исходник + node_modules + .next. Так на старте
# работает `payload migrate` — ему нужны payload.config, src/migrations и CLI
# (в standalone-образе их нет). Медиа — во внешних R2/Kinescope, в образ не едет.

FROM node:20-bookworm-slim
WORKDIR /app

# ca-certificates/openssl — для TLS к Postgres/R2/Kinescope.
# libvips для sharp идёт prebuilt в самом пакете sharp (доп. системных либ на
# Debian не требуется).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# 1) Зависимости отдельным слоем (кэш). Ставим ВСЕ (включая dev) — нужны и для
#    сборки, и для `payload migrate` (загрузка TS-конфига).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2) Исходники.
COPY . .

# 3) next.config подставляет R2_PUBLIC_URL в images.remotePatterns НА ЭТАПЕ
#    СБОРКИ — иначе next/image не пропустит картинки с R2. Это публичный URL
#    (не секрет), передаём build-аргументом. В Timeweb задать в разделе
#    Build Arguments приложения: R2_PUBLIC_URL=https://pub-xxxx.r2.dev
ARG R2_PUBLIC_URL
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL

# 4) Сборка (next build). Тянет next/font/google по сети — build-окружение
#    должно иметь интернет. Для надёжности лучше перевести шрифты на локальные.
RUN npm run build

# Рантайм
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Миграции + старт (точь-в-точь как Start Command на Render). next start слушает
# $PORT на 0.0.0.0. Все секреты (DATABASE_URI, PAYLOAD_SECRET, R2_*, KINESCOPE_*)
# передаются РАНТАЙМ-переменными окружения контейнера, НЕ в образ.
CMD ["sh", "-c", "npm run migrate && npm run start"]
