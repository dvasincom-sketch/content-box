import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { notFound } from 'next/navigation'
import { getTenantFromHeaders } from '@/lib/tenant'
import { brandVars } from '@/lib/brand'
import { buildMetadata } from '@/lib/seo'
import type { Metadata } from 'next'
import { RichText } from '@/components/RichText'
import '../../styles.css'

/** Заглушки юр-страниц: показываются, пока в CMS нет страницы с таким slug.
 *  Как только в Pages создаётся страница offer/privacy/terms — она имеет приоритет. */
const LEGAL_STUBS: Record<string, { title: string; sections: { h: string; p: string }[] }> = {
  offer: {
    title: 'Публичная оферта',
    sections: [
      { h: '1. Общие положения', p: 'Настоящий документ является публичной офертой и определяет условия предоставления доступа к материалам проекта, а также условия добровольной поддержки проекта.' },
      { h: '2. Предмет оферты', p: 'Проект предоставляет пользователям доступ к озвученным и переведённым материалам, а также принимает добровольные взносы в поддержку развития.' },
      { h: '3. Оплата', p: 'Оплата производится банковскими картами Visa, Mastercard и МИР. После оплаты на указанный e-mail направляется электронный чек в соответствии с 54-ФЗ «О применении контрольно-кассовой техники».' },
      { h: '4. Возврат средств', p: 'Порядок возврата добровольных взносов будет описан в окончательной редакции документа.' },
      { h: '5. Реквизиты', p: 'Реквизиты владельца проекта будут указаны в окончательной редакции документа.' },
    ],
  },
  privacy: {
    title: 'Политика конфиденциальности',
    sections: [
      { h: '1. Общие положения', p: 'Настоящая Политика описывает порядок обработки и защиты персональных данных пользователей в соответствии с 152-ФЗ «О персональных данных».' },
      { h: '2. Какие данные мы обрабатываем', p: 'При регистрации и оформлении поддержки мы можем обрабатывать имя, адрес электронной почты и технические данные, необходимые для работы сервиса.' },
      { h: '3. Цели обработки', p: 'Данные используются для предоставления доступа к материалам, направления уведомлений и электронных чеков, а также для улучшения работы сайта.' },
      { h: '4. Права пользователя', p: 'Пользователь вправе запросить сведения об обработке своих данных, их уточнение или удаление, направив обращение на контактный e-mail проекта.' },
    ],
  },
  terms: {
    title: 'Пользовательское соглашение',
    sections: [
      { h: '1. Общие условия', p: 'Используя сайт, пользователь соглашается с условиями настоящего соглашения.' },
      { h: '2. Использование материалов', p: 'Материалы предназначены для личного некоммерческого просмотра. Копирование и распространение без разрешения не допускается.' },
      { h: '3. Ответственность', p: 'Проект стремится обеспечить доступность и качество материалов, однако не гарантирует бесперебойную работу сервиса.' },
      { h: '4. Изменение условий', p: 'Условия соглашения могут обновляться. Актуальная редакция всегда доступна на этой странице.' },
    ],
  },
}

type Params = { slug: string }

/** SEO-каскад (ТЗ §6): дефолт тенанта → страница. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return {}
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const page = res.docs[0] as any
  if (!page) {
    const stub = LEGAL_STUBS[slug]
    return stub ? { title: stub.title } : {}
  }

  return buildMetadata({
    defaults: settings?.seoDefaults,
    levels: [page.seo],
    fallbackTitle: page.title,
    brandName: tenant.name,
  })
}

export default async function ContentPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const ctx = await getTenantFromHeaders()
  if (!ctx) return <div className="p-8">Тенант не определён.</div>
  const { tenant, settings } = ctx

  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })

  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenant.id } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  const page = res.docs[0] as any
  if (!page) {
    const stub = LEGAL_STUBS[slug]
    if (!stub) notFound()
    return (
      <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
        <div className="max-w-6xl mx-auto px-4 py-10">
          <Link href="/" className="text-sm inline-block mb-6 c-navlink">← На главную</Link>
          <h1
            className="text-3xl lg:text-5xl font-extrabold mb-6"
            style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' }}
          >
            {stub!.title}
          </h1>
          <div className="max-w-3xl mx-auto">
            <div
              className="mb-8 rounded-2xl px-4 py-3 text-sm"
              style={{
                color: 'var(--brand-text)',
                background: 'color-mix(in srgb, var(--brand-primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--brand-primary) 25%, transparent)',
              }}
            >
              Документ находится в подготовке. Это предварительная версия — окончательная редакция будет опубликована в ближайшее время.
            </div>
            {stub!.sections.map((sec, i) => (
              <section key={i} className="mb-6">
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)' }}>
                  {sec.h}
                </h2>
                <p className="leading-relaxed" style={{ color: 'var(--brand-muted)' }}>{sec.p}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="page-canvas" style={{ ...brandVars(settings), minHeight: '100vh' }}>
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Крошки и заголовок — во всю ширину, как на странице категории. */}
        <Link href="/" className="text-sm inline-block mb-6 c-navlink">← На главную</Link>
        <h1
          className="text-3xl lg:text-5xl font-extrabold mb-8"
          style={{ color: 'var(--brand-text)', fontFamily: 'var(--font-heading)', fontWeight: 'var(--heading-weight)' }}
        >
          {page.title}
        </h1>
        {/* Текст — узкая колонка по центру: читаемая длина строки. */}
        <div className="max-w-3xl mx-auto">
          <RichText data={page.content} />
        </div>
      </div>
    </main>
  )
}
