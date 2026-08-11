#!/usr/bin/env bash
# Перенос объектов из Cloudflare R2 в Timeweb Cloud S3 (обложки, галерея,
# файлы для скачивания, видео — всё, что лежит в одном бакете медиа).
#
# Приложение отдаёт файлы по имени: URL = ${S3_PUBLIC_URL||R2_PUBLIC_URL}/<filename>.
# В БД хранится только имя файла, поэтому после копирования объектов и
# переключения S3_PUBLIC_URL на Timeweb все ссылки заработают сами — миграция
# БД не нужна. Копируем «как есть», ключи (имена) сохраняются.
#
# Требуется rclone (brew install rclone). Скрипт НИЧЕГО не удаляет в R2 —
# только копирует. Источник (R2) удалите вручную в панели Cloudflare после
# проверки, что всё отдаётся с Timeweb.
#
# Заполните переменные ниже (или экспортируйте перед запуском):
set -euo pipefail

# --- Источник: Cloudflare R2 ---
: "${CF_R2_ENDPOINT:?напр. https://<accountid>.r2.cloudflarestorage.com}"
: "${CF_R2_BUCKET:?имя бакета R2, напр. content-box}"
: "${CF_R2_ACCESS_KEY_ID:?}"
: "${CF_R2_SECRET_ACCESS_KEY:?}"

# --- Приёмник: Timeweb Cloud S3 ---
: "${TW_S3_ENDPOINT:=https://s3.twcstorage.ru}"
: "${TW_S3_REGION:=ru-1}"
: "${TW_S3_BUCKET:?имя бакета Timeweb, напр. 4633c187-...}"
: "${TW_S3_ACCESS_KEY_ID:?}"
: "${TW_S3_SECRET_ACCESS_KEY:?}"

RCLONE_CONF="$(mktemp)"
trap 'rm -f "$RCLONE_CONF"' EXIT

cat > "$RCLONE_CONF" <<CONF
[r2]
type = s3
provider = Cloudflare
access_key_id = ${CF_R2_ACCESS_KEY_ID}
secret_access_key = ${CF_R2_SECRET_ACCESS_KEY}
endpoint = ${CF_R2_ENDPOINT}
acl = private

[timeweb]
type = s3
provider = Other
access_key_id = ${TW_S3_ACCESS_KEY_ID}
secret_access_key = ${TW_S3_SECRET_ACCESS_KEY}
endpoint = ${TW_S3_ENDPOINT}
region = ${TW_S3_REGION}
force_path_style = true
acl = public-read
CONF

echo "==> Объектов в источнике (R2/${CF_R2_BUCKET}):"
rclone --config "$RCLONE_CONF" size "r2:${CF_R2_BUCKET}" || true

echo "==> Копирую R2 -> Timeweb (без удаления в источнике)…"
rclone --config "$RCLONE_CONF" copy \
  "r2:${CF_R2_BUCKET}" "timeweb:${TW_S3_BUCKET}" \
  --transfers=8 --checkers=16 --s3-no-check-bucket --progress

echo "==> Сверяю (rclone check):"
rclone --config "$RCLONE_CONF" check \
  "r2:${CF_R2_BUCKET}" "timeweb:${TW_S3_BUCKET}" --one-way || {
    echo "!! Есть расхождения — проверьте вывод выше перед удалением R2."; exit 1;
  }

echo "==> Объектов в приёмнике (Timeweb/${TW_S3_BUCKET}):"
rclone --config "$RCLONE_CONF" size "timeweb:${TW_S3_BUCKET}"

echo "==> Готово. Все объекты скопированы и сверены."
echo "   Дальше: в панели Timeweb выставьте S3_* (см. claude/storage-drop-r2-plan.md),"
echo "   передеплойте, проверьте обложки на сайте, затем удалите бакет в Cloudflare R2."
