import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/**
 * Плоский конфиг ESLint.
 *
 * Раньше здесь стоял мост `FlatCompat` из @eslint/eslintrc, который загружал
 * `next/core-web-vitals` и `next/typescript` как СТАРЫЕ (eslintrc) конфиги. На
 * eslint 9.39 это перестало работать вовсе: валидатор eslintrc падает с
 * «Converting circular structure to JSON» ещё до чтения файлов проекта, то
 * есть линт не запускался в принципе — и заметить это было негде, потому что
 * автоматического прогона в проекте не было.
 *
 * eslint-config-next 16 экспортирует уже плоские конфиги, поэтому мост не
 * нужен: подключаем напрямую.
 */
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // ── Правила React Compiler (новые в eslint-config-next 16) ──────────
      //
      // По умолчанию это ошибки, и на текущем коде их около сорока в ~25
      // компонентах: `set-state-in-effect` — синхронный setState внутри
      // useEffect (типовой паттерн «синхронизировать состояние с пропсами»,
      // им написаны почти все панели настроек и модалки студии).
      //
      // Держим их как ПРЕДУПРЕЖДЕНИЯ осознанно. Правила справедливые и код
      // действительно стоит переписать, но это переделка двух десятков рабочих
      // экранов — отдельная задача с отдельным тестированием. Сделать их
      // ошибками прямо сейчас значит завести CI, который красный с первого дня;
      // такой CI выключают, и тогда он не ловит уже ничего, включая регрессии
      // в контроле доступа, ради которых он и заводился.
      //
      // Долг зафиксирован здесь, чтобы о нём не забыли. Правильный порядок:
      // расшить по одному экрану, затем поднять до 'error'.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',

      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    ignores: [
      '.next/',
      // ── Авто-генерируемое: править бессмысленно, при регенерации вернётся ──
      'src/payload-types.ts',
      'src/payload-generated-schema.ts',
      // Карта импортов админки Payload.
      'src/app/(payload)/admin/importMap.js',
      // Миграции пишет `payload migrate:create` по диффу со схемой. Сигнатура
      // `({ db, payload, req })` фиксирована фреймворком, а `payload` и `req`
      // в SQL-миграциях не нужны — это давало 76 предупреждений об
      // «неиспользуемых аргументах», то есть примерно каждое десятое, и все
      // неустранимые. В шуме такого объёма настоящие находки не видны.
      'src/migrations/**',
    ],
  },
]

export default eslintConfig
