'use client'
import React, { useEffect, useRef, useState } from 'react'
import Link from '@/components/AppLink'
import { toBlocks, BLOCK_LABEL, type ProfileData, type PBlock } from '@/lib/profileBlocks'
type CategoryRow = { title: string; href?: string; items: { href: string; title: string; posterUrl?: string | null }[] }

type GalleryItem = { url?: string; caption?: string }
type VideoItem = { slug: string; title: string; coverUrl?: string | null }

const css = `
.pf{--pf-acc:var(--brand-primary,#7c3aed);--pf-acc2:var(--brand-accent,#c084fc);
  --pf-bg:var(--brand-bg,#0c0c11);--pf-tx:var(--brand-text,#ececf2);
  --pf-mut:var(--brand-muted,color-mix(in srgb,var(--brand-text,#888) 62%,transparent));
  --pf-card:color-mix(in srgb,var(--brand-text,#fff) 5%,transparent);
  --pf-line:color-mix(in srgb,var(--brand-text,#fff) 12%,transparent);
  color:var(--pf-tx)}
.pf__prog{position:fixed;top:0;left:0;height:3px;width:0;z-index:60;background:linear-gradient(90deg,var(--pf-acc),var(--pf-acc2));transition:width .1s linear}
.pf__hero{position:relative;overflow:hidden;border-radius:24px;border:1px solid var(--pf-line);margin-bottom:28px}
.pf__herobg{position:absolute;inset:0;background:
  radial-gradient(120% 90% at 82% -10%,color-mix(in srgb,var(--pf-acc) 42%,transparent),transparent 60%),
  radial-gradient(90% 70% at 0% 120%,color-mix(in srgb,var(--pf-acc) 26%,transparent),transparent 55%),
  color-mix(in srgb,var(--pf-tx) 5%,transparent)}
.pf__heroin{position:relative;padding:40px 32px;display:grid;grid-template-columns:260px 1fr;gap:34px;align-items:end}
.pf__port{aspect-ratio:2/3;border-radius:18px;overflow:hidden;border:1px solid var(--pf-line);
  background:linear-gradient(160deg,color-mix(in srgb,var(--pf-acc) 40%,transparent),color-mix(in srgb,var(--pf-acc) 8%,transparent));
  position:relative;box-shadow:0 24px 60px rgba(0,0,0,.35)}
.pf__port img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pf__port span{position:absolute;inset:0;display:grid;place-items:center;font-size:14px;color:var(--pf-mut);text-align:center;padding:12px}
.pf__mono{position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:clamp(52px,10vw,104px);color:color-mix(in srgb,#fff 85%,transparent);letter-spacing:.02em;text-shadow:0 4px 18px rgba(0,0,0,.28)}
.pf__members{margin-top:30px;padding-top:26px;border-top:1px solid var(--pf-line)}
.pf__members-h{font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--pf-mut);font-weight:700;margin-bottom:16px}
.pf__members-row{display:flex;flex-wrap:wrap;gap:16px}
.pf__mem{display:flex;flex-direction:column;align-items:center;gap:9px;text-decoration:none;color:var(--pf-mut);width:88px;transition:.15s}
.pf__mem:hover{color:var(--pf-tx)}
.pf__mem-av{width:66px;height:66px;border-radius:50%;overflow:hidden;position:relative;display:grid;place-items:center;font-weight:800;font-size:21px;color:#fff;border:1px solid var(--pf-line);background:linear-gradient(150deg,color-mix(in srgb,var(--pf-acc) 80%,#000),color-mix(in srgb,var(--pf-acc) 35%,#000));box-shadow:0 8px 22px rgba(0,0,0,.28);transition:.15s}
.pf__mem:hover .pf__mem-av{transform:translateY(-3px);box-shadow:0 14px 32px rgba(0,0,0,.38)}
.pf__mem-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pf__mem-nm{font-size:13px;font-weight:600;text-align:center;line-height:1.2}
.pf__eye{font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--pf-acc2);font-weight:700}
.pf__name{font-size:clamp(36px,6vw,72px);font-weight:800;letter-spacing:-.02em;margin:8px 0 6px}
.pf__sub{font-size:17px;color:var(--pf-mut)}
.pf__read{font-size:12.5px;color:var(--pf-mut);font-weight:600;letter-spacing:.02em;margin-top:6px}
.pf__lead{max-width:640px;margin:14px 0 20px;color:var(--pf-tx);opacity:.9}
.pf__qrow{display:flex;flex-wrap:wrap;gap:9px}
.pf__qf{background:var(--pf-card);border:1px solid var(--pf-line);border-radius:12px;padding:8px 13px}
.pf__qf b{display:block;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--pf-mut);font-weight:700;margin-bottom:2px}
.pf__qf i{font-style:normal;font-size:14px;font-weight:600}
.pf__wrap{display:grid;grid-template-columns:220px 1fr;gap:40px;align-items:start}
.pf__toc{position:sticky;top:76px;max-height:calc(100vh - 96px);overflow-y:auto;padding-right:4px;scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--pf-tx) 22%,transparent) transparent}
.pf__toc::-webkit-scrollbar{width:6px}
.pf__toc::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--pf-tx) 18%,transparent);border-radius:99px}
.pf__toc b{display:block;font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--pf-mut);font-weight:700;margin-bottom:8px;padding-left:11px}
.pf__toca{position:relative;display:flex;gap:9px;align-items:baseline;padding:5px 11px;border-radius:8px;color:var(--pf-mut);font-size:13.5px;line-height:1.28;text-decoration:none;transition:color .15s,background .15s}
.pf__toca i{font-style:normal;font-size:11px;font-weight:700;min-width:15px;color:color-mix(in srgb,var(--pf-tx) 45%,transparent);font-variant-numeric:tabular-nums}
.pf__toca:hover{color:var(--pf-tx);background:color-mix(in srgb,var(--pf-tx) 5%,transparent)}
.pf__toca.on,.pf__toca.cur{color:var(--pf-tx);font-weight:650}
.pf__toca.on{background:color-mix(in srgb,var(--pf-acc) 15%,transparent)}
.pf__toca.on i,.pf__toca.cur i{color:var(--pf-acc2)}
.pf__toca.on::before{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:3px;height:15px;border-radius:99px;background:linear-gradient(var(--pf-acc),var(--pf-acc2))}
.pf__tocsub{max-height:0;overflow:hidden;transition:max-height .28s ease;margin:1px 0 3px 18px;border-left:1px solid var(--pf-line)}
.pf__tocsub.show{max-height:1600px}
.pf__tocs{display:flex;gap:8px;align-items:baseline;padding:4px 10px;border-radius:7px;color:var(--pf-mut);font-size:12.5px;line-height:1.25;text-decoration:none;transition:color .15s,background .15s}
.pf__tocs i{font-style:normal;font-size:10px;min-width:24px;opacity:.7;font-variant-numeric:tabular-nums}
.pf__tocs:hover{color:var(--pf-tx);background:color-mix(in srgb,var(--pf-tx) 5%,transparent)}
.pf__tocs.on{color:var(--pf-tx);background:color-mix(in srgb,var(--pf-acc) 13%,transparent);font-weight:600}
.pf__sec{scroll-margin-top:84px;margin-bottom:46px}
.pf__h{display:flex;align-items:center;gap:11px;margin-bottom:16px}
.pf__h i{font-style:normal;font-size:13px;font-weight:800;color:var(--pf-acc2);background:color-mix(in srgb,var(--pf-acc) 16%,transparent);width:29px;height:29px;border-radius:9px;display:grid;place-items:center;flex:none}
.pf__h h2{font-size:24px;font-weight:750;margin:0}
.pf p{margin:0 0 12px;opacity:.92;line-height:1.72}
/* Читаемая ширина строки для прозы (заголовки/сетки/карточки — на всю ширину). */
.pf__sec>p{max-width:68ch}
.pf__sec>p:first-of-type{font-size:1.05em;color:var(--pf-tx);opacity:1}
/* Подзаголовок внутри длинного текстового раздела (строки с «## »). */
.pf__sh{font-size:16.5px;font-weight:700;line-height:1.35;margin:26px 0 9px;color:var(--pf-tx);max-width:68ch;scroll-margin-top:84px}
.pf__sec>p+.pf__sh{margin-top:26px}
.pf__tl,.pf__acc,.pf__accb p{max-width:760px}
.pf__facts{background:var(--pf-card);border:1px solid var(--pf-line);border-radius:20px;padding:20px 22px;margin-bottom:18px}
.pf__facts u{display:block;text-decoration:none;font-size:13px;letter-spacing:.05em;text-transform:uppercase;color:var(--pf-mut);margin-bottom:14px;font-weight:700}
.pf__factsg{display:grid;grid-template-columns:repeat(2,1fr);gap:14px 24px}
.pf__fr b{display:block;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--pf-mut);font-weight:700;margin-bottom:3px}
.pf__fr i{font-style:normal;font-weight:600}
.pf__tl{margin-left:6px;padding-left:24px;border-left:2px solid var(--pf-line)}
.pf__ti{position:relative;padding-bottom:20px}
.pf__ti::before{content:"";position:absolute;left:-31px;top:5px;width:11px;height:11px;border-radius:50%;background:linear-gradient(120deg,var(--pf-acc),var(--pf-acc2));box-shadow:0 0 0 4px var(--pf-bg)}
.pf__ty{font-size:12.5px;font-weight:800;color:var(--pf-acc2)}
.pf__tt{font-weight:650;margin:2px 0 3px}
.pf__td{font-size:14px;color:var(--pf-mut)}
.pf__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px}
.pf__grid--f{grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}
.pf__rel{border-radius:14px;overflow:hidden;border:1px solid var(--pf-line);background:var(--pf-card);transition:.18s;text-decoration:none;color:inherit}
.pf__rel:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(0,0,0,.3)}
.pf__cov{aspect-ratio:1;display:grid;place-items:center;text-align:center;padding:12px;font-weight:800;font-size:14px;color:#fff;
  background:linear-gradient(150deg,color-mix(in srgb,var(--pf-acc) 85%,#000),color-mix(in srgb,var(--pf-acc) 40%,#000));position:relative}
.pf__cov img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pf__grid--f .pf__cov{aspect-ratio:16/10}
.pf__rb{padding:9px 11px}
.pf__rb .tt{font-size:13.5px;font-weight:650;line-height:1.25}
.pf__rb .mt{font-size:12px;color:var(--pf-mut);margin-top:3px;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.pf__chip{font-size:11px;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,var(--pf-tx) 8%,transparent);color:var(--pf-mut)}
.pf__badges{display:flex;flex-wrap:wrap;gap:9px}
.pf__badge{display:flex;align-items:center;gap:9px;padding:10px 14px;border-radius:12px;background:var(--pf-card);border:1px solid var(--pf-line)}
.pf__badge em{font-style:normal;width:26px;height:26px;border-radius:8px;background:linear-gradient(120deg,var(--pf-acc),var(--pf-acc2));display:grid;place-items:center;font-size:14px;flex:none}
.pf__badge b{font-size:14px}.pf__badge span{display:block;font-size:12px;color:var(--pf-mut)}
.pf__tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(252px,1fr));gap:14px}
.pf__tile{padding:17px 18px;border-radius:16px;background:var(--pf-card);border:1px solid var(--pf-line);display:flex;flex-direction:column}
.pf__tile em{font-style:normal;font-size:12px;font-weight:800;color:var(--pf-acc2);display:block;margin-bottom:9px;letter-spacing:.04em}
.pf__tile b{font-size:14.5px;font-weight:700;line-height:1.3;margin-bottom:5px}
.pf__tile span{font-size:13px;color:var(--pf-mut);line-height:1.55}
.pf__discog{margin-top:2px}
.pf__pcard{width:100%}
.pf__pph{font-size:clamp(14px,1.5vw,18px);font-weight:700;padding:14px;text-align:center;line-height:1.25;background:linear-gradient(135deg,var(--brand-primary,var(--pf-acc)),var(--brand-accent,var(--pf-acc2)))}
.pf__pcap{padding:9px 2px 0}
.pf__pcap b{display:block;font-size:13.5px;font-weight:650;line-height:1.25}
.pf__pcap span{display:flex;gap:7px;align-items:center;flex-wrap:wrap;font-size:12px;color:var(--pf-mut);margin-top:4px}
.pf__sec--src p{font-size:12px;line-height:1.42;color:var(--pf-mut);max-width:none;margin:0 0 4px}
.pf__sec--src>p:first-of-type{font-size:12px;color:var(--pf-mut);opacity:1}
.pf__sec--src .pf__h h2{font-size:16px}
.pf__sec--src .pf__h i{width:24px;height:24px;font-size:11px}
.pf__cols{display:grid;gap:26px}
.pf__col>p:first-of-type{margin-top:0}
.pf__col>p{max-width:none}
.pf__callout{border-radius:16px;padding:18px 22px;background:var(--pf-card);border:1px solid var(--pf-line)}
.pf__callout--quote{border-left:4px solid var(--pf-acc);background:color-mix(in srgb,var(--pf-acc) 8%,transparent)}
.pf__callout--note{border-left:4px solid var(--pf-acc2);background:color-mix(in srgb,var(--pf-acc2) 8%,transparent)}
.pf__callout-body p{margin:0 0 8px;font-size:16px;line-height:1.6;max-width:none}
.pf__callout-body p:last-child{margin-bottom:0}
.pf__callout--quote .pf__callout-body p{font-style:italic}
.pf__callout-author{margin-top:10px;font-size:13.5px;color:var(--pf-mut);font-weight:600}
.pf__crow{display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory}
.pf__crow .pf__pcard{flex:0 0 auto;width:150px;scroll-snap-align:start;text-decoration:none;color:inherit}
.pf__crow::-webkit-scrollbar{height:6px}
.pf__crow::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--pf-tx) 18%,transparent);border-radius:99px}
.pf__sec--full>p,.pf__sec--full>.pf__sh{max-width:none}
.pf__acc{border:1px solid var(--pf-line);border-radius:14px;overflow:hidden;margin-bottom:9px;background:var(--pf-card)}
.pf__acch{width:100%;text-align:left;background:none;border:none;color:var(--pf-tx);padding:14px 17px;font-size:15px;font-weight:650;cursor:pointer;display:flex;align-items:center;justify-content:space-between}
.pf__acch em{font-style:normal;color:var(--pf-acc2);transition:.2s}
.pf__acch-l{display:flex;align-items:center;gap:12px;min-width:0}
.pf__acc-av{width:34px;height:34px;border-radius:50%;overflow:hidden;position:relative;display:grid;place-items:center;font-size:13px;font-weight:800;color:#fff;flex:none;border:1px solid var(--pf-line);background:linear-gradient(150deg,color-mix(in srgb,var(--pf-acc) 80%,#000),color-mix(in srgb,var(--pf-acc) 35%,#000))}
.pf__acc-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.pf__acc-nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pf__acc-link{display:inline-block;margin-top:10px;font-size:13px;font-weight:600;color:var(--pf-acc2);text-decoration:none}
.pf__acc-link:hover{text-decoration:underline}
.pf__acc.on .pf__acch em{transform:rotate(45deg)}
.pf__accb{max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 17px}
.pf__acc.on .pf__accb{max-height:2400px;padding-bottom:15px}
.pf__gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.pf__gal figure{margin:0;aspect-ratio:1;border-radius:12px;overflow:hidden;border:1px solid var(--pf-line);background:var(--pf-card)}
.pf__gal img{width:100%;height:100%;object-fit:cover;display:block}
@media(max-width:900px){
  .pf__heroin{grid-template-columns:1fr;gap:20px;padding:28px 20px}
  .pf__port{max-width:200px}
  .pf__wrap{grid-template-columns:1fr;gap:20px}
  .pf__toc{position:static;display:flex;gap:6px;overflow-x:auto;overflow-y:visible;max-height:none;padding-bottom:6px}
  .pf__toc b{display:none}.pf__toca{white-space:nowrap}
  .pf__toca.on::before{display:none}
  .pf__tocsub{display:none}
  .pf__factsg{grid-template-columns:1fr}
  .pf__sec--full{margin-left:0}
  .pf__cols{grid-template-columns:1fr !important}
}
@media(min-width:901px){
  .pf__sec--full{margin-left:-260px}
}
`

type Member = { slug: string; title: string; portraitUrl?: string | null }

const initialsOf = (name: string): string => {
  const w = (name || '').trim().split(/\s+/).filter(Boolean)
  const s = w.length >= 2 ? w[0][0] + w[1][0] : (w[0] ? (w[0].length <= 3 ? w[0] : w[0].slice(0, 2)) : '')
  return s.toUpperCase() || '★'
}

export function ProfileView({
  data, title, portraitUrl, gallery, videos, members, categoryRows,
}: {
  data: ProfileData
  title: string
  portraitUrl?: string | null
  gallery?: GalleryItem[]
  videos?: VideoItem[]
  members?: Member[]
  categoryRows?: Record<string, CategoryRow>
}) {
  const qf = data.quickFacts ?? []
  const gal = gallery ?? []
  const vids = videos ?? []
  const blocks = toBlocks(data).filter((b) => {
    if (b.type === 'gallery') return gal.length > 0
    if (b.type === 'videos') return vids.length > 0
    if (b.type === 'text') return Boolean(b.body?.trim())
    if (b.type === 'columns') return b.cols?.some((c) => (c.body || '').trim() || (c.title || '').trim())
    if (b.type === 'callout') return Boolean(b.text?.trim())
    if (b.type === 'categoryRow') return Boolean(b.categoryId && categoryRows?.[String(b.categoryId)]?.items?.length)
    if ('items' in b) return Array.isArray(b.items) && b.items.length > 0
    return true
  })

  // Поиск участника по имени связи — для аватара и ссылки в «Отношениях».
  const memberByTitle = new Map<string, Member>()
  const memberBySlug = new Map<string, Member>()
  for (const m of members || []) { memberByTitle.set((m.title || '').trim().toLowerCase(), m); memberBySlug.set((m.slug || '').toLowerCase(), m) }
  const ALIAS: Record<string, string> = { 'намджун': 'rm', 'рм': 'rm', 'сокджин': 'jin', 'джин': 'jin', 'юнги': 'suga', 'шуга': 'suga', 'хосок': 'j-hope', 'джей-хоуп': 'j-hope', 'чимин': 'jimin', 'тэхён': 'v', 'ви': 'v', 'чонгук': 'jungkook', 'чон чонгук': 'jungkook' }
  const findMember = (name: string): Member | undefined => {
    const n = (name || '').trim().toLowerCase()
    return memberByTitle.get(n) || (ALIAS[n] ? memberBySlug.get(ALIAS[n]) : undefined)
  }

  // Оценка времени чтения (рус. ~170 слов/мин, ~6 символов на слово).
  const readChars = (data.lead || '').length + blocks.reduce((acc, b) => {
    if (b.type === 'text') return acc + (b.body || '').length
    if (b.type === 'columns') return acc + b.cols.reduce((a, c) => a + (c.body || '').length, 0)
    if (b.type === 'callout') return acc + (b.text || '').length
    if (b.type === 'relations') return acc + b.items.reduce((a, r) => a + (r.text || '').length, 0)
    if (b.type === 'factsList') return acc + b.items.reduce((a, x) => a + String(x).length, 0)
    if ('items' in b) return acc + JSON.stringify(b.items).length
    return acc
  }, 0)
  const readMin = Math.max(1, Math.round(readChars / 6 / 170))

  const hasBio = Boolean(data.lead) || qf.length > 0
  const extractSubs = (body: string, id: string) => {
    const subs: { id: string; label: string }[] = []
    let n = 0
    body.split(/\n{2,}/).forEach((t) => { const x = t.trim(); if (x.startsWith('## ')) { subs.push({ id: `${id}--sh-${n}`, label: x.slice(3).trim() }); n++ } })
    return subs
  }
  type TocItem = { id: string; label: string; subs: { id: string; label: string }[] }
  const toc: TocItem[] = []
  if (hasBio) toc.push({ id: 'bio', label: 'Биография', subs: [] })
  blocks.forEach((b) => { if (b.title === '') return; const subs = b.type === 'text' && b.body ? extractSubs(b.body, b.id) : []; toc.push({ id: b.id, label: b.title || BLOCK_LABEL[b.type], subs }) })
  const parentOf = new Map<string, string>()
  toc.forEach((t) => t.subs.forEach((sub) => parentOf.set(sub.id, t.id)))

  const [active, setActive] = useState(toc[0]?.id || '')
  const [prog, setProg] = useState(0)
  const [openAcc, setOpenAcc] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const tocRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current; if (!root) return
    const LINE = 140 // px от верха вьюпорта — «текущий» раздел тот, чей заголовок выше этой линии
    let raf = 0
    const compute = () => {
      raf = 0
      const h = document.documentElement
      setProg((h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100)
      const hs = Array.from(root.querySelectorAll('[data-pf-sec],[data-pf-sub]')) as HTMLElement[]
      if (!hs.length) return
      let cur = hs[0].id
      for (const el of hs) {
        if (el.getBoundingClientRect().top - LINE <= 0) cur = el.id
        else break
      }
      if (h.scrollTop + h.clientHeight >= h.scrollHeight - 4) cur = hs[hs.length - 1].id
      setActive(cur)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute) }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [toc.length])
  useEffect(() => {
    const nav = tocRef.current; if (!nav) return
    const el = nav.querySelector('.on') as HTMLElement | null; if (!el) return
    const top = el.offsetTop, bot = top + el.offsetHeight
    if (top < nav.scrollTop) nav.scrollTop = top - 8
    else if (bot > nav.scrollTop + nav.clientHeight) nav.scrollTop = bot - nav.clientHeight + 8
  }, [active])

  const paras = (body: string, secId?: string) => {
    let sh = 0
    return body.split(/\n{2,}/).map((t, i) => {
      const x = t.trim()
      if (x.startsWith('## ')) {
        const label = x.slice(3).trim()
        const id = secId ? `${secId}--sh-${sh}` : undefined
        sh++
        return <h3 className="pf__sh" key={i} id={id} {...(id ? { 'data-pf-sub': '' } : {})}>{label}</h3>
      }
      return <p key={i}>{x}</p>
    })
  }
  let num = 0
  const Head = ({ id, label }: { id: string; label: string }) => { num += 1; return <div className="pf__h" id={id} data-pf-sec><i>{num}</i><h2>{label}</h2></div> }

  const renderBlock = (b: PBlock) => {
    const label = b.title || BLOCK_LABEL[b.type]
    const noHead = b.title === ''
    const head = noHead ? null : <Head id={b.id} label={label} />
    const fullCls = (b as { full?: boolean }).full ? ' pf__sec--full' : ''
    if (b.type === 'text') { const isSrc = /^\s*Источник/i.test(b.title || ''); return (<section className={`pf__sec${fullCls}${isSrc ? ' pf__sec--src' : ''}`} key={b.id}>{head}{paras(b.body || '', b.title === '' ? undefined : b.id)}</section>) }
    if (b.type === 'timeline') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__tl">{b.items.map((t, i) => (<div className="pf__ti" key={i}><div className="pf__ty">{t.year}</div><div className="pf__tt">{t.title}</div>{t.text && <div className="pf__td">{t.text}</div>}</div>))}</div>
      </section>)
    if (b.type === 'relations') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        {b.items.map((r, i) => { const key = `${b.id}:${i}`; const on = openAcc === key; const mem = findMember(r.name); return (
          <div className={`pf__acc${on ? ' on' : ''}`} key={i}>
            <button type="button" className="pf__acch" onClick={() => setOpenAcc(on ? '' : key)}>
              <span className="pf__acch-l">
                <span className="pf__acc-av">{mem?.portraitUrl ? <img src={mem.portraitUrl} alt={r.name} loading="lazy" /> : initialsOf(r.name)}</span>
                <span className="pf__acc-nm">{r.name}</span>
              </span>
              <em>+</em>
            </button>
            <div className="pf__accb">
              {paras(r.text || '')}
              {mem && <Link href={`/publication/${mem.slug}`} className="pf__acc-link">Открыть профиль {r.name} →</Link>}
            </div>
          </div>) })}
      </section>)
    if (b.type === 'releases') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="poster-grid pf__discog">
          {b.items.map((r, i) => (
            <div className="poster-card pf__pcard" key={i}>
              <div className="poster-card__frame"><div className="poster-card__placeholder pf__pph">{r.title}</div></div>
              <div className="pf__pcap"><b>{r.title}</b><span>{r.meta && <span className="pf__chip">{r.meta}</span>}{r.year}</span></div>
            </div>
          ))}
        </div>
      </section>)
    if (b.type === 'films') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__grid pf__grid--f">
          {b.items.map((r, i) => (<div className="pf__rel" key={i}><div className="pf__cov">{r.title}</div><div className="pf__rb"><div className="tt">{r.title}</div><div className="mt">{r.meta && <span className="pf__chip">{r.meta}</span>}{r.year}</div></div></div>))}
        </div>
      </section>)
    if (b.type === 'awards') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__badges">{b.items.map((a, i) => (<div className="pf__badge" key={i}><em>{a.icon || '🏆'}</em><div><b>{a.title}</b>{a.subtitle && <span>{a.subtitle}</span>}</div></div>))}</div>
      </section>)
    if (b.type === 'factsList') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__tiles">{b.items.map((f, i) => { const str = String(f); const di = str.indexOf(' — '); const hasT = di > 0 && di <= 42; const t = hasT ? str.slice(0, di) : ''; const body = hasT ? str.slice(di + 3) : str; return (
          <div className="pf__tile" key={i}><em>{String(i + 1).padStart(2, '0')}</em>{t && <b>{t}</b>}<span>{body}</span></div>
        ) })}</div>
      </section>)
    if (b.type === 'gallery') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__gal">{gal.map((g, i) => (<figure key={i}>{g.url ? <img src={g.url} alt={g.caption || ''} loading="lazy" /> : null}</figure>))}</div>
      </section>)
    if (b.type === 'videos') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__grid pf__grid--f">{vids.map((v, i) => (<Link href={`/video/${v.slug}`} className="pf__rel" key={i}><div className="pf__cov">{v.coverUrl ? <img src={v.coverUrl} alt={v.title} loading="lazy" /> : v.title}</div><div className="pf__rb"><div className="tt">{v.title}</div></div></Link>))}</div>
      </section>)
    if (b.type === 'columns') { const n = Math.min(3, Math.max(1, b.cols?.length || 1)); return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__cols" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {b.cols.map((c, i) => (<div className="pf__col" key={i}>{c.title && <h3 className="pf__sh" style={{ marginTop: 0 }}>{c.title}</h3>}{paras(c.body || '')}</div>))}
        </div>
      </section>) }
    if (b.type === 'callout') return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className={`pf__callout${b.variant === 'note' ? ' pf__callout--note' : ' pf__callout--quote'}`}>
          <div className="pf__callout-body">{paras(b.text || '')}</div>
          {b.author && <div className="pf__callout-author">— {b.author}</div>}
        </div>
      </section>)
    if (b.type === 'categoryRow') { const row = categoryRows?.[String(b.categoryId)]; if (!row) return null; return (
      <section className={`pf__sec${fullCls}`} key={b.id}>{head}
        <div className="pf__crow">
          {row.items.map((it, i) => (
            <a className="poster-card pf__pcard" href={it.href} key={i} title={it.title}>
              <div className="poster-card__frame">{it.posterUrl ? <img src={it.posterUrl} alt={it.title} loading="lazy" className="poster-card__img" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} /> : <div className="poster-card__placeholder pf__pph">{it.title}</div>}</div>
              <div className="pf__pcap"><b>{it.title}</b></div>
            </a>
          ))}
        </div>
      </section>) }
    return null
  }

  const activeParent = parentOf.get(active) || active

  return (
    <div className="pf" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="pf__prog" style={{ width: `${prog}%` }} />

      <div className="pf__hero">
        <div className="pf__herobg" />
        <div className="pf__heroin">
          <div className="pf__port">{portraitUrl ? <img src={portraitUrl} alt={title} /> : <span className="pf__mono">{initialsOf(title)}</span>}</div>
          <div>
            {data.eyebrow && <div className="pf__eye">{data.eyebrow}</div>}
            <h1 className="pf__name">{title}</h1>
            {data.subtitle && <div className="pf__sub">{data.subtitle}</div>}
            <div className="pf__read">≈ {readMin} мин чтения</div>
            {data.lead && <p className="pf__lead">{data.lead}</p>}
            {qf.length > 0 && <div className="pf__qrow">{qf.slice(0, 5).map((f, i) => (<div className="pf__qf" key={i}><b>{f.label}</b><i>{f.value}</i></div>))}</div>}
          </div>
        </div>
      </div>

      <div className="pf__wrap">
        <nav className="pf__toc" ref={tocRef}>
          <b>Содержание</b>
          {toc.map((t, ti) => {
            const cur = activeParent === t.id
            return (
              <div className="pf__tocg" key={t.id}>
                <a href={`#${t.id}`} className={`pf__toca${active === t.id ? ' on' : ''}${cur && active !== t.id ? ' cur' : ''}`}>
                  <i>{ti + 1}</i><span>{t.label}</span>
                </a>
                {t.subs.length > 0 && (
                  <div className={`pf__tocsub${cur ? ' show' : ''}`}>
                    {t.subs.map((sub, si) => (
                      <a key={sub.id} href={`#${sub.id}`} className={`pf__tocs${active === sub.id ? ' on' : ''}`}>
                        <i>{ti + 1}.{si + 1}</i><span>{sub.label}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>
        <main>
          {hasBio && (
            <section className="pf__sec">
              <Head id="bio" label="Биография" />
              {qf.length > 0 && (
                <div className="pf__facts"><u>Быстрые факты</u>
                  <div className="pf__factsg">{qf.map((f, i) => (<div className="pf__fr" key={i}><b>{f.label}</b><i>{f.value}</i></div>))}</div>
                </div>
              )}
              {data.lead && <p>{data.lead}</p>}
            </section>
          )}
          {blocks.map((b) => renderBlock(b))}
        </main>
      </div>

      {members && members.length > 0 && (
        <div className="pf__members">
          <div className="pf__members-h">Другие участники</div>
          <div className="pf__members-row">
            {members.map((m) => (
              <Link key={m.slug} href={`/publication/${m.slug}`} className="pf__mem">
                <span className="pf__mem-av">{m.portraitUrl ? <img src={m.portraitUrl} alt={m.title} loading="lazy" /> : initialsOf(m.title)}</span>
                <span className="pf__mem-nm">{m.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
