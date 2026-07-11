#!/usr/bin/env python3
"""
Парсер статей Fandom через MediaWiki API.
Запускать ЛОКАЛЬНО (у Claude нет доступа к bts.fandom.com).

Читает data/fandom-map.txt (формат: наш-путь | Fandom_страница),
тянет статьи пачками по 20 с паузой, сохраняет markdown в content/fandom/.

Установка зависимостей:
    pip install requests html2text

Запуск:
    python3 scripts/fetch-fandom.py
    python3 scripts/fetch-fandom.py --start 40 --limit 20   # с 40-й, 20 штук
    python3 scripts/fetch-fandom.py --only rm                # одна категория

ЛИЦЕНЗИЯ: контент Fandom под CC BY-SA. Использование — ответственность
пользователя. Скрипт сохраняет исходный URL в шапке каждого файла
для указания источника при необходимости.
"""

import argparse
import os
import re
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("Нужен requests: pip install requests")

try:
    import html2text
except ImportError:
    sys.exit("Нужен html2text: pip install html2text")


WIKI_API = "https://bts.fandom.com/api.php"
WIKI_BASE = "https://bts.fandom.com/wiki/"
BATCH_SIZE = 20
PAUSE_BETWEEN_BATCHES = 5.0  # секунд между пачками
PAUSE_BETWEEN_REQUESTS = 1.0  # секунд между запросами внутри пачки

MAP_FILE = "data/fandom-map.txt"
OUT_DIR = "content/fandom"

USER_AGENT = "COCO-JAMBO-content-import/1.0 (personal translation project)"


def parse_map(path: str):
    """Читает файл маппинга: наш-путь | Fandom_страница."""
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 2 or not parts[1]:
                continue
            rows.append({"path": parts[0], "page": parts[1]})
    return rows


def fetch_html(page_title):
    """Тянет отрендеренный HTML статьи через MediaWiki parse API."""
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "text",
        "format": "json",
        "formatversion": "2",
        "redirects": "1",
    }
    try:
        resp = requests.get(
            WIKI_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=30
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"    ! сетевая ошибка: {e}")
        return None

    if "error" in data:
        print(f"    ! API: {data['error'].get('info', 'unknown')}")
        return None

    return data.get("parse", {}).get("text")


def extract_paragraphs(html):
    """Только связный текст: абзацы <p> и заголовки разделов <h2>/<h3>.
    Всё структурное (списки, таблицы, инфобоксы, галереи, оглавление) отброшено.
    """
    import re as _re

    # Убираем то, что портит даже абзацы: сноски, теги-обёртки картинок.
    html = _re.sub(r"<sup[^>]*>.*?</sup>", "", html, flags=_re.S)
    html = _re.sub(r"<aside\b.*?</aside>", "", html, flags=_re.S)

    blocks = []
    # Идём по документу, вылавливая <p>, <h2>, <h3>.
    for m in _re.finditer(r"<(p|h2|h3)\b[^>]*>(.*?)</\1>", html, flags=_re.S):
        tag, inner = m.group(1), m.group(2)

        # Текст внутри тега: срезаем вложенную разметку.
        text = _re.sub(r"<[^>]+>", "", inner)
        # Раскодируем частые сущности.
        text = (text.replace("&amp;", "&").replace("&nbsp;", " ")
                    .replace("&lt;", "<").replace("&gt;", ">")
                    .replace("&#160;", " ").replace("&quot;", '"'))
        text = _re.sub(r"\[\d+\]", "", text)  # остатки сносок [1]
        text = _re.sub(r"\s+", " ", text).strip()

        if not text:
            continue
        # Отбрасываем заголовки-служебки.
        if tag in ("h2", "h3"):
            low = text.lower().rstrip("[]").strip()
            if low in ("references", "navigation", "gallery", "official links",
                       "audio", "videos", "tracklist", "editions", "trivia",
                       "discography", "filmography", "concerts", "see also"):
                continue
            blocks.append(f"\n## {text}\n")
        else:
            # Абзац должен быть содержательным (не одна ссылка-огрызок).
            if len(text) >= 40:
                blocks.append(text)

    return "\n\n".join(blocks).strip()


def html_to_markdown(html):
    """Конвертирует HTML в markdown, вычищая вики-мусор.

    Fandom не использует классы infobox/navbox — режем по структуре:
    таблицы, галереи, aside-инфобоксы, сноски.
    """
    # Инфобокс у Fandom — <aside>. Вырезаем целиком.
    html = re.sub(r"<aside\b.*?</aside>", "", html, flags=re.S)
    # Таблицы (дискографии, награды).
    html = re.sub(r"<table\b.*?</table>", "", html, flags=re.S)
    # Галереи и блоки с картинками.
    html = re.sub(r'<div[^>]*class="[^"]*(gallery|thumb|wikia-gallery)[^"]*".*?</div>', "", html, flags=re.S)
    html = re.sub(r"<figure\b.*?</figure>", "", html, flags=re.S)
    # Сноски [1][2], блоки references.
    html = re.sub(r"<sup[^>]*>.*?</sup>", "", html, flags=re.S)
    html = re.sub(r'<ol class="references".*?</ol>', "", html, flags=re.S)
    # Навигационные шаблоны внизу.
    html = re.sub(r'<div[^>]*class="[^"]*(navbox|toc|nav-)[^"]*".*?</div>', "", html, flags=re.S)

    h = html2text.HTML2Text()
    h.body_width = 0
    h.ignore_images = True
    h.ignore_links = True   # ссылки не нужны в переводе — только текст
    h.mark_code = False
    md = h.handle(html)

    # Построчная чистка остатков.
    lines = md.split("\n")
    cleaned = []
    for line in lines:
        s = line.strip()
        # Картинки с CDN Fandom.
        if "nocookie.net" in s or "static.wikia" in s:
            continue
        # Лицензионные плашки Wikipedia/CC.
        if "Creative Commons" in s or "view authors" in s or "uses" in s and "content from" in s:
            continue
        # Пустые ссылки, edit.
        if re.match(r"^\[\s*\]", s) or re.match(r"^\[edit\]", s, re.I):
            continue
        # Строки оглавления: "1 Early life", "3.2 2014-2016: ..."
        if re.match(r"^\d+(\.\d+)*\s+\S", s):
            continue
        cleaned.append(line)
    md = "\n".join(cleaned)

    md = re.sub(r"\[\]\([^)]*\)", "", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def slug_from_path(path):
    """Последний сегмент пути → имя файла."""
    return path.rstrip("/").split("/")[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=0, help="с какой строки начать")
    ap.add_argument("--limit", type=int, default=None, help="сколько всего обработать")
    ap.add_argument("--only", type=str, default=None, help="только категория с этим slug")
    ap.add_argument("--force", action="store_true", help="перезаписать существующие")
    ap.add_argument("--paragraphs-only", action="store_true",
                    help="только связный текст (абзацы), без списков и таблиц")
    args = ap.parse_args()

    if not os.path.exists(MAP_FILE):
        sys.exit(f"Нет файла маппинга {MAP_FILE}. Создай его: наш-путь | Fandom_страница")

    rows = parse_map(MAP_FILE)
    if args.only:
        rows = [r for r in rows if slug_from_path(r["path"]) == args.only]
    if args.start:
        rows = rows[args.start :]
    if args.limit:
        rows = rows[: args.limit]

    if not rows:
        sys.exit("Нечего обрабатывать.")

    Path(OUT_DIR).mkdir(parents=True, exist_ok=True)
    print(f"К обработке: {len(rows)} страниц, пачками по {BATCH_SIZE}\n")

    done, skipped, failed = 0, 0, 0

    for i, row in enumerate(rows):
        slug = slug_from_path(row["path"])
        # Имя файла из полного пути, чтобы избежать коллизий (d-day в двух ветках).
        safe = row["path"].replace("/", "__")
        out_path = os.path.join(OUT_DIR, f"{safe}.md")

        if os.path.exists(out_path) and not args.force:
            print(f"[{i+1}/{len(rows)}] {slug}: уже есть, пропускаю")
            skipped += 1
            continue

        print(f"[{i+1}/{len(rows)}] {slug} ← {row['page']}")
        html = fetch_html(row["page"])

        if not html:
            failed += 1
        else:
            md = extract_paragraphs(html) if args.paragraphs_only else html_to_markdown(html)
            source_url = WIKI_BASE + row["page"].replace(" ", "_")
            header = (
                f"<!--\n"
                f"Категория: {row['path']}\n"
                f"Источник: {source_url}\n"
                f"Лицензия: CC BY-SA (Fandom). Требует указания авторства.\n"
                f"СТАТУС: черновик, требует перевода и вычитки.\n"
                f"-->\n\n"
            )
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(header + md)
            print(f"    ✓ сохранено ({len(md)} симв.)")
            done += 1

        # Пауза между запросами.
        time.sleep(PAUSE_BETWEEN_REQUESTS)

        # Пауза между пачками.
        if (i + 1) % BATCH_SIZE == 0 and i + 1 < len(rows):
            print(f"\n  ── пачка завершена, пауза {PAUSE_BETWEEN_BATCHES}с ──\n")
            time.sleep(PAUSE_BETWEEN_BATCHES)

    print(f"\nГотово. Сохранено: {done}, пропущено: {skipped}, ошибок: {failed}.")
    print(f"Файлы в {OUT_DIR}/")


if __name__ == "__main__":
    main()
