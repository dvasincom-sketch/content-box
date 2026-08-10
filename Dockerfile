# Next.js 16 + Payload CMS 3 + sharp. Единый исходник (сборка и рантайм вместе):
# полный код + node_modules + .next — на старте app работает `payload migrate`.
#
# Мульти-таргет: общая база `base` (node+ffmpeg+сборка) → target `app` (лёгкий,
# без whisper) и `worker` (та же база + whisper.cpp). В compose каждый сервис
# берёт свой target, поэтому whisper.cpp (бинарник + ~466МБ модель) едет ТОЛЬКО
# в worker-образ, а app остаётся компактным и деплоится быстро.

# ── Сборка whisper.cpp (для авто-субтитров воркера). Артефакты кладём в
#    канонический /whisper, чтобы worker-target и будущий готовый образ из
#    реестра копировали из одинаковых путей.
#    WHISPER_MODEL_URL — необязательный прямой URL модели (напр. ваш Timeweb S3):
#    быстрее и надёжнее, чем каждый раз тянуть с HuggingFace. Пусто → качаем с HF.
FROM debian:bookworm-slim AS whisper-build
ARG WHISPER_MODEL=small
ARG WHISPER_MODEL_URL=
RUN apt-get update \
  && apt-get install -y --no-install-recommends git build-essential cmake ca-certificates wget curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /opt
RUN git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git
WORKDIR /opt/whisper.cpp
RUN cmake -B build -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON \
  && cmake --build build -j --config Release
RUN if [ -n "$WHISPER_MODEL_URL" ]; then \
      echo "model from URL: $WHISPER_MODEL_URL" && curl -fSL "$WHISPER_MODEL_URL" -o "models/ggml-${WHISPER_MODEL}.bin"; \
    else \
      sh ./models/download-ggml-model.sh "${WHISPER_MODEL}"; \
    fi
RUN mkdir -p /whisper/models \
  && cp build/bin/whisper-cli /whisper/whisper-cli \
  && cp models/ggml-*.bin /whisper/models/

# Хук на ГОТОВЫЙ образ whisper из реестра: собери образ с /whisper/whisper-cli и
# /whisper/models/*.bin один раз, запушь, и задай build-arg
# WHISPER_IMAGE=<registry>/whisper:tag → деплой БЕЗ компиляции и скачивания.
# По умолчанию — локальная стадия whisper-build (компилируем как обычно).
ARG WHISPER_IMAGE=whisper-build
FROM ${WHISPER_IMAGE} AS whisper

# ── База: node + ffmpeg + сборка приложения. Общая для app и worker. ──
FROM node:20-bookworm-slim AS base
# ca-certificates/openssl — TLS к Postgres/S3. curl — healthcheck. ffmpeg — воркер.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl curl ffmpeg \
  && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node
# Зависимости отдельным слоем (кэш). npm install (не ci) — lock с macOS/Node22,
# образ Node20/Linux; ci считал бы lock out-of-sync и падал.
COPY --chown=node:node package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY --chown=node:node . .
# S3_PUBLIC_URL вшивается в next.config (images.remotePatterns) на сборке.
ARG S3_PUBLIC_URL
ENV S3_PUBLIC_URL=$S3_PUBLIC_URL
ARG R2_PUBLIC_URL
ENV R2_PUBLIC_URL=$R2_PUBLIC_URL
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1
# Миграции + старт (app). Воркер переопределяет command в compose.
CMD ["sh", "-c", "node scripts/wait-for-db.mjs && npm run migrate && npm run start"]

# ── app: без whisper (компактный образ, быстрый деплой) ──
FROM base AS app

# ── worker: та же база + whisper.cpp (бинарник + модель) ──
FROM base AS worker
COPY --from=whisper /whisper/whisper-cli /usr/local/bin/whisper-cli
COPY --from=whisper /whisper/models/ggml-*.bin /opt/models/
ENV WHISPER_BIN=/usr/local/bin/whisper-cli
ENV WHISPER_MODEL_PATH=/opt/models/ggml-small.bin
