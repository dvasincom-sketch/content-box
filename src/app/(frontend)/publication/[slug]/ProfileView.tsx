'use client'
import React, { useEffect, useRef, useState } from 'react'
import Link from '@/components/AppLink'
import { toBlocks, BLOCK_LABEL, type ProfileData, type PBlock } from '@/lib/profileBlocks'

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
.pf__lead{max-width:640px;margin:14px 0 20px;color:var(--pf-tx);opacity:.9}
.pf__qrow{display:flex;flex-wrap:wrap;gap:9px}
.pf__qf{background:var(--pf-card);border:1px solid var(--pf-line);border-radius:12px;padding:8px 13px}
.pf__qf b{display:block;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--pf-mut);font-weight:700;margin-bottom:2px}
.pf__qf i{font-style:normal;font-size:14px;font-weight:600}
.pf__wrap{display:grid;grid-template-columns:220px 1fr;gap:40px;align-items:start}
.pf__toc{position:sticky;top:80px}
.pf__toc b{display:block;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--pf-mut);font-weight:700;margin-bottom:10px}
.pf__toc a{display:block;padding:7px 12px;border-radius:9px;color:var(--pf-mut);font-size:14px;border-left:2px solid transparent;cursor:pointer;transition:.15s;text-decoration:none}
.pf__toc a:hover{color:var(--pf-tx);background:color-mix(in srgb,var(--pf-tx) 5%,transparent)}
.pf__toc a.on{color:var(--pf-tx);background:color-mix(in srgb,var(--pf-acc) 14%,transparent);border-left-color:var(--pf-acc2);font-weight:600}
.pf__sec{scroll-margin-top:84px;margin-bottom:46px}
.pf__h{display:flex;align-items:center;gap:11px;margin-bottom:16px}
.pf__h i{font-style:normal;font-size:13px;font-weight:800;color:var(--pf-acc2);background:color-mix(in srgb,var(--pf-acc) 16%,transparent);width:29px;height:29px;border-radius:9px;display:grid;place-items:center;flex:none}
.pf__h h2{font-size:24px;font-weight:750;margin:0}
.pf p{margin:0 0 12px;opacity:.92;line-height:1.72}
/* Читаемая ширина строки для прозы (заголовки/сетки/карточки — на всю ширину). */
.pf__sec>p{max-width:68ch}
.pf__sec>p:first-of-type{font-size:1.05em;color:var(--pf-tx);opacity:1}
/* Подзаголовок внутри длинного текстового раздела (строки с «## »). */
.pf__sh{font-size:16.5px;font-weight:700;line-height:1.35;margin:26px 0 9px;color:var(--pf-tx);max-width:68ch}
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
.pf__tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:11px}
.pf__tile{padding:15px;border-radius:14px;background:var(--pf-card);border:1px solid var(--pf-line);font-size:14px;font-weight:550}
.pf__tile em{font-style:normal;font-size:12px;font-weight:800;color:var(--pf-acc2);display:block;margin-bottom:6px}
.pf__acc{border:1px solid var(--pf-line);border-radius:14px;overflow:hidden;margin-bottom:9px;background:var(--pf-card)}
.pf__acch{width:100%;text-align:left;background:none;border:none;color:var(--pf-tx);padding:14px 17px;font-size:15px;font-weight:650;cursor:pointer;display:flex;align-items:center;justify-content:space-between}
.pf__acch em{font-style:normal;color:var(--pf-acc2);transition:.2s}
.pf__acc.on .pf__acch em{transform:rotate(45deg)}
.pf__accb{max-height:0;overflow:hidden;transition:max-height .3s ease;padding:0 17px}
.pf__acc.on .pf__accb{max-height:600px;padding-bottom:15px}
.pf__gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.pf__gal figure{margin:0;aspect-ratio:1;border-radius:12px;overflow:hidden;border:1px solid var(--pf-line);background:var(--pf-card)}
.pf__gal img{width:100%;height:100%;object-fit:cover;display:block}
@media(max-width:900px){
  .pf__heroin{grid-template-columns:1fr;gap:20px;padding:28px 20px}
  .pf__port{max-width:200px}
  .pf__wrap{grid-template-columns:1fr;gap:20px}
  .pf__toc{position:static;display:flex;gap:6px;overflow-x:auto;padding-bottom:6px}
  .pf__toc b{display:none}.pf__toc a{white-space:nowrap;border-left:none}
  .pf__factsg{grid-template-columns:1fr}
}
`

type Member = { slug: string; title: string; portraitUrl?: string | null }

const initialsOf = (name: string): string => {
  const w = (name || '').trim().split(/\s+/).filter(Boolean)
  const s = w.length >= 2 ? w[0][0] + w[1][0] : (w[0] ? (w[0].length <= 3 ? w[0] : w[0].slice(0, 2)) : '')
  return s.toUpperCase() || '★'
}

export function ProfileView({
  data, title, portraitUrl, gallery, videos, members,
}: {
  data: ProfileData
  title: string
  portraitUrl?: string | null
  gallery?: GalleryItem[]
  videos?: VideoItem[]
  members?: Member[]
}) {
  const qf = data.quickFacts ?? []
  const gal = gallery ?? []
  const vids = videos ?? []
  const blocks = toBlocks(data).filter((b) => {
    if (b.type === 'gallery') return gal.length > 0
    if (b.type === 'videos') return vids.length > 0
    if (b.type === 'text') return Boolean(b.body?.trim())
    if ('items' in b) return Array.isArray(b.items) && b.items.length > 0
    return true
  })

  const hasBio = Boolean(data.lead) || qf.length > 0
  const toc: { id: string; label: string }[] = []
  if (hasBio) toc.push({ id: 'bio', label: 'Биография' })
  blocks.forEach((b) => { if (b.title === '') return; toc.push({ id: b.id, label: b.title || BLOCK_LABEL[b.type] }) })

  const [active, setActive] = useState(toc[0]?.id || '')
  const [prog, setProg] = useState(0)
  const [openAcc, setOpenAcc] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => { const h = document.documentElement; setProg((h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100) }
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    const root = rootRef.current; if (!root) return
    const secs = Array.from(root.querySelectorAll('[data-pf-sec]')) as HTMLElement[]
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive((e.target as HTMLElement).id) }), { rootMargin: '-45% 0px -50% 0px' })
    secs.forEach((s) => io.observe(s)); return () => io.disconnect()
  }, [toc.length])

  const paras = (body: string) => body.split(/\n{2,}/).map((t, i) => {
    const x = t.trim()
    if (x.startsWith('## ')) return <h3 className="pf__sh" key={i}>{x.slice(3).trim()}</h3>
    return <p key={i}>{x}</p>
  })
  let num = 0
  const Head = ({ id, label }: { id: string; label: string }) => { num += 1; return <div className="pf__h" id={id} data-pf-sec><i>{num}</i><h2>{label}</h2></div> }

  const renderBlock = (b: PBlock) => {
    const label = b.title || BLOCK_LABEL[b.type]
    const noHead = b.title === ''
    const head = noHead ? null : <Head id={b.id} label={label} />
    if (b.type === 'text') return (<section className="pf__sec" key={b.id}>{head}{paras(b.body || '')}</section>)
    if (b.type === 'timeline') return (
      <section className="pf__sec" key={b.id}>{head}
        <div className="pf__tl">{b.items.map((t, i) => (<div className="pf__ti" key={i}><div className="pf__ty">{t.year}</div><div className="pf__tt">{t.title}</div>{t.text && <div className="pf__td">{t.text}</div>}</div>))}</div>
      </section>)
    if (b.type === 'relations') return (
      <section className="pf__sec" key={b.id}>{head}
        {b.items.map((r, i) => { const key = `${b.id}:${i}`; const on = openAcc === key; return (
          <div className={`pf__acc${on ? ' on' : ''}`} key={i}>
            <button type="button" className="pf__acch" onClick={() => setOpenAcc(on ? '' : key)}>{r.name}<em>+</em></button>
            <div className="pf__accb"><p style={{ margin: 0, fontSize: 14 }}>{r.text}</p></div>
          </div>) })}
      </section>)
    if (b.type === 'releases' || b.type === 'films') return (
      <section className="pf__sec" key={b.id}>{head}
        <div className={`pf__grid${b.type === 'films' ? ' pf__grid--f' : ''}`}>
          {b.items.map((r, i) => (<div className="pf__rel" key={i}><div className="pf__cov">{r.title}</div><div className="pf__rb"><div className="tt">{r.title}</div><div className="mt">{r.meta && <span className="pf__chip">{r.meta}</span>}{r.year}</div></div></div>))}
        </div>
      </section>)
    if (b.type === 'awards') return (
      <section className="pf__sec" key={b.id}>{head}
        <div className="pf__badges">{b.items.map((a, i) => (<div className="pf__badge" key={i}><em>{a.icon || '🏆'}</em><div><b>{a.title}</b>{a.subtitle && <span>{a.subtitle}</span>}</div></div>))}</div>
      </section>)
    if (b.type === 'factsList') return (
      <section className="pf__sec" key={b.id}>{head}
        <div className="pf__tiles">{b.items.map((f, i) => (<div className="pf__tile" key={i}><em>{String(i + 1).padStart(2, '0')}</em>{f}</div>))}</div>
      </section>)
    if (b.type === 'gallery') return (
      <section className="pf__sec" key={b.id}>{head}
        <div className="pf__gal">{gal.map((g, i) => (<figure key={i}>{g.url ? <img src={g.url} alt={g.caption || ''} loading="lazy" /> : null}</figure>))}</div>
      </section>)
    if (b.type === 'videos') return (
      <section className="pf__sec" key={b.id}>{head}
        <div className="pf__grid pf__grid--f">{vids.map((v, i) => (<Link href={`/video/${v.slug}`} className="pf__rel" key={i}><div className="pf__cov">{v.coverUrl ? <img src={v.coverUrl} alt={v.title} loading="lazy" /> : v.title}</div><div className="pf__rb"><div className="tt">{v.title}</div></div></Link>))}</div>
      </section>)
    return null
  }

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
            {data.lead && <p className="pf__lead">{data.lead}</p>}
            {qf.length > 0 && <div className="pf__qrow">{qf.slice(0, 5).map((f, i) => (<div className="pf__qf" key={i}><b>{f.label}</b><i>{f.value}</i></div>))}</div>}
          </div>
        </div>
      </div>

      <div className="pf__wrap">
        <nav className="pf__toc">
          <b>На этой странице</b>
          {toc.map((t) => (<a key={t.id} href={`#${t.id}`} className={active === t.id ? 'on' : ''}>{t.label}</a>))}
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
