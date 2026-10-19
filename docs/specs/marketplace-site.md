# Специфікація: сайт маркетплейсу на GitHub Pages

| | |
| --- | --- |
| Статус | Draft |
| Дата | 2026-10-18 |
| Автор | Andrii Syniagin |
| URL сайту | `https://sinyagin.github.io/dev-digest-agentic-sdd-kit/` |

## 1. Мета

Користувачі маркетплейсу `dev-digest-agentic-sdd-kit` мають знаходити потрібні артефакти (skills, agents, commands, hooks, MCP-сервери) запитом звичайною мовою, бачити результати картками і встановлювати плагіни без ручного складання команд.

Сайт статичний і розгортається на GitHub Pages. Бекенду немає: дані збираються під час збірки в GitHub Actions, пошук працює в браузері.

### Цілі MVP

- G1. Пошук по всьому вмісту репозиторію з обробкою запитів звичайною англійською мовою («I need a skill for…»).
- G2. Результати пошуку як картки з фільтрами, стан пошуку в URL.
- G3. Окрема сторінка для кожного артефакту і кожного плагіна.
- G4. Конструктор встановлення: користувач обирає плагіни і отримує команди або фрагмент `.claude/settings.json`.
- G5. Автоматичні збірка й деплой при push у `main`, без ручних кроків при додаванні нових артефактів.

### Поза обсягом MVP

- Семантичний пошук (етап 2, розділ 11).
- Панель довіри, Issue-кнопки, `llms.txt` і скіл `find`, changelog/RSS, обране, Giscus, локалізація UI (розділ 12).
- Будь-які дані від користувачів на сервері, авторизація, аналітика.

## 2. Користувачі та сценарії

| ID | Як… | я хочу… | щоб… |
| --- | --- | --- | --- |
| US1 | розробник з Claude Code | написати «I need a skill for writing a spec» | побачити відповідні артефакти без знання їхніх назв |
| US2 | розробник | відфільтрувати результати за типом і плагіном | швидко звузити список |
| US3 | розробник | відкрити сторінку артефакту | прочитати, що він робить, які інструменти використовує і як його викликати |
| US4 | розробник | скопіювати команду встановлення одним кліком | не набирати її вручну |
| US5 | тімлід | вибрати кілька плагінів і отримати фрагмент `.claude/settings.json` | підключити маркетплейс для всієї команди одним комітом |
| US6 | розробник | поділитися посиланням на результати пошуку | колега побачив той самий список |
| US7 | автор плагіна | додати новий скіл і запушити в `main` | він з'явився на сайті без додаткових кроків |

## 3. Архітектура

```
push у main / PR
      │
      ▼
GitHub Actions: .github/workflows/pages.yml
  1. npm ci + unit tests (site/)
  2. node site/scripts/build-index.mjs → site/src/data/index.json + site/public/index.json
       читає marketplace.json + plugins/*/ ; валідує ; падає при помилках
  3. astro build (site/)            → site/dist/
  4. E2E (Playwright), далі actions/upload-pages-artifact + actions/deploy-pages (лише main)
      │
      ▼
GitHub Pages (статика)
  /                       головна: пошук + картки + фільтри
  /a/<plugin>/<type>/<slug>/   сторінка артефакту (SSG)
  /p/<plugin>/            сторінка плагіна (SSG)
  /install/               конструктор встановлення
  /index.json             публічний індекс (копія даних для клієнта)
```

**Стек:** Astro (SSG) + TypeScript. Інтерактивні частини (пошук, фільтри, конструктор) — клієнтські скрипти на vanilla TS без фреймворку; розмітку картки генерує одна функція `renderCard`, яку використовують і SSG, і клієнт. Пошук — [MiniSearch](https://github.com/lucaong/minisearch). Рендер Markdown — unified (remark-gfm → rehype-sanitize) під час збірки.

### Структура в репозиторії

Увесь сайт — один npm-пакет у `site/`, щоб індексатор і сайт мали спільні залежності.

```
site/
  astro.config.mjs         # site + base: '/dev-digest-agentic-sdd-kit/'
  package.json             # predev/prebuild запускають індексатор
  playwright.config.ts
  scripts/
    build-index.mjs        # індексатор
    build-index.test.mjs
    __fixtures__/ok/       # фікстура маркетплейсу з усіма 5 типами
  e2e/site.spec.ts
  src/
    data/index.json        # генерується, у .gitignore
    lib/                   # типи, base-шляхи, HTML-екранування, Markdown
    search/
      query.ts             # розбір запиту (розд. 6)
      engine.ts            # MiniSearch, ранжування, фасети, fallback
      stopwords.ts         # англійські стоп-слова
    install/               # генератор команд/settings і сховище вибору
    components/card.ts     # renderCard (SSG + клієнт)
    scripts/               # global.ts (копіювання, лічильник), home.ts (пошук)
    pages/
      index.astro
      a/[plugin]/[type]/[name].astro
      p/[plugin].astro
      install.astro
.github/workflows/pages.yml
```

`site/src/data/index.json`, `site/public/index.json`, `site/dist/` і `site/.astro/` додаються в `.gitignore`.

## 4. Модель даних: `index.json`

```ts
interface SiteIndex {
  schemaVersion: 1;
  generatedAt: string;            // ISO 8601
  commit: string;                 // git SHA
  marketplace: {
    name: string;                 // "dev-digest-agentic-sdd-kit"
    description: string;
    repo: string;                 // "sinyagin/dev-digest-agentic-sdd-kit"
    owner: { name: string; url?: string };
  };
  plugins: Plugin[];
  artifacts: Artifact[];
}

interface Plugin {
  name: string;                   // "sdd-kit"
  displayName?: string;
  version: string;
  description: string;
  category?: string;              // з marketplace.json
  tags: string[];                 // tags (marketplace.json) ∪ keywords (plugin.json)
  license?: string;
  path: string;                   // "plugins/sdd-kit"
  counts: Record<ArtifactType, number>;
}

type ArtifactType = "skill" | "agent" | "command" | "hook" | "mcp";

interface Artifact {
  id: string;                     // "<plugin>:<type>:<name>", унікальний
  type: ArtifactType;
  name: string;
  slug: string;                   // безпечна для URL форма name ("PreToolUse:Edit|Write" → "pretooluse-edit-write")
  plugin: string;
  description: string;
  invocation?: string;            // "/sdd-kit:hello" для skill/command; "sdd-kit:<name>" для agent
  tags: string[];                 // успадковані від плагіна + власні з frontmatter (якщо є)
  frontmatter: Record<string, unknown>;  // як є, для сторінки артефакту
  body: string;                   // Markdown без frontmatter; для hook/mcp — JSON-конфіг у блоці коду
  files: string[];                // шляхи відносно кореня плагіна
  sourceUrl: string;              // https://github.com/<repo>/blob/main/<path>
  url: string;                    // "a/<plugin>/<type>/<slug>/", відносно base
}
```

Клієнтський `/index.json` має ту саму схему, але `body` у ньому — чистий текст, обрізаний до 4000 символів. HTML тіла рендериться лише під час збірки сторінок.

## 5. Індексатор (`site/scripts/build-index.mjs`)

### Джерела

| Тип | Де шукати (за замовчуванням) | Назва | Опис |
| --- | --- | --- | --- |
| plugin | `marketplace.json` → `plugins[].source` → `.claude-plugin/plugin.json` | `name` | `description` |
| skill | `skills/*/SKILL.md` | frontmatter `name`, інакше ім'я теки | frontmatter `description` |
| command | `commands/**/*.md` | ім'я файлу без `.md` | frontmatter `description`, інакше перший абзац |
| agent | `agents/*.md` | frontmatter `name`, інакше ім'я файлу | frontmatter `description` |
| hook | `hooks/hooks.json` або `hooks` у `plugin.json` | `<Event>[:<matcher>]` | автоматично з команди/типу хука |
| mcp | `.mcp.json` або `mcpServers` у `plugin.json` | ключ сервера | `command`/`url` сервера |

Якщо `plugin.json` задає власні шляхи (`commands`, `agents`, `skills`, `hooks`, `mcpServers`), індексатор використовує їх замість шляхів за замовчуванням.

Плагіни з `source`, що вказує не на локальну теку (github/url), індексуються лише за даними з `marketplace.json`, без артефактів.

### Вимоги

- IX1. Індексатор **має** завершитися з ненульовим кодом, якщо в skill, agent або command немає `description`, або якщо два артефакти мають однаковий `id`.
- IX2. Індексатор **має** завершитися з помилкою, якщо `name` у `marketplace.json` не збігається з `name` у `plugin.json` (дублює правило з README).
- IX3. Індексатор **має** бути детермінованим: однаковий вміст дає однаковий `index.json`, крім `generatedAt` і `commit`.
- IX4. Індексатор не мережевий: читає лише файлову систему і `git rev-parse HEAD`.
- IX5. Залежності: `gray-matter` (frontmatter), стандартна бібліотека Node 22.

Індексатор запускається і в PR (job у `pages.yml` без деплою), щоб помилки IX1–IX2 ловилися до мержу.

## 6. Пошук

### Конвеєр запиту

```
сирий запит
  → 1. нормалізація: NFKC, нижній регістр, апостроф ' ʼ ’ → ', прибрати пунктуацію
  → 2. токенізація за пробілами та дефісами
  → 3. витягти намір типу (таблиця нижче) → фільтр type; токен прибрати
  → 4. прибрати стоп-слова
  → 5. MiniSearch.search(terms, options)
  → 6. ранжування + фільтри з UI → картки
```

**Намір типу** (крок 3):

| Токени | Фільтр |
| --- | --- |
| skill, skills | `skill` |
| agent, agents, subagent, subagents | `agent` |
| command, commands, slash | `command` |
| hook, hooks | `hook` |
| mcp, server, servers | `mcp` |

Якщо з наміром типу немає результатів, пошук повторюється без цього фільтра, а над результатами з'являється напис «No skills matched — showing all types».

**Стоп-слова** — фіксований англійський список у `stopwords.ts` (i, need, want, a, an, the, for, to, that, which, something, help, me, can, …).

Запити приймаються лише англійською; окремої обробки інших мов немає.

### Конфігурація MiniSearch

```ts
new MiniSearch({
  idField: "id",
  fields: ["name", "description", "tags", "plugin", "body"],
  storeFields: ["id"],
  searchOptions: {
    boost: { name: 4, tags: 3, description: 2, plugin: 1.5, body: 1 },
    prefix: true,
    fuzzy: (term) => (term.length > 4 ? 0.2 : 0),
    combineWith: "OR",
  },
});
```

Індекс будується в браузері з `/index.json` при першому фокусі на полі пошуку (або одразу, якщо в URL є `q`).

### Ранжування

- Базовий score від MiniSearch.
- ×1.2, якщо артефакт збігся з більшістю (> 50 %) значущих термів запиту.
- Порожній запит: усі артефакти, сортування за типом (skill → command → agent → hook → mcp), потім за назвою.

### Вимоги

- S1. Коли користувач вводить запит, сайт **має** оновити результати не пізніше ніж за 100 мс після останнього натискання (debounce 120 мс не враховується).
- S2. Запит «I need a skill to check the plugin works» **має** повернути `sdd-kit:skill:hello` першим результатом на поточному вмісті репо.
- S3. Опечатка в слові довше 4 символів (наприклад, «plugn») **має** знаходити збіг.
- S4. Якщо результатів немає, сайт **має** показати порожній стан з пропозиціями: скинути фільтри, переглянути всі артефакти, приклади запитів.
- S5. Збіги в назві та описі на картці **мають** підсвічуватися (`<mark>`).

## 7. UI

Мова інтерфейсу і пошукових запитів — англійська.

### Головна (`/`)

```
┌─────────────────────────────────────────────────────────────┐
│ dev-digest-agentic-sdd-kit            [Install builder (2)] │
│ Agentic spec-driven development kit for Claude Code         │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🔍 Describe what you need… e.g. "skill for writing specs"│ │
│ └─────────────────────────────────────────────────────────┘ │
│ Type: [All] [Skills 1] [Agents 0] [Commands 0] [Hooks] [MCP] │
│ Plugin: [sdd-kit ▾]   Tags: [sdd] [workflow]       12 results│
│                                                             │
│ ┌────────────────────┐ ┌────────────────────┐               │
│ │ SKILL      sdd-kit │ │ AGENT      sdd-kit │               │
│ │ hello              │ │ …                  │               │
│ │ Placeholder skill… │ │                    │               │
│ │ #sdd #workflow     │ │                    │               │
│ │ /sdd-kit:hello  ⧉  │ │                    │               │
│ │ [+ Add plugin] Details · Source           │               │
│ └────────────────────┘ └────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

Фільтри показують кількість артефактів для поточного запиту; варіант з нулем неактивний.

### Анатомія картки

| Елемент | Джерело | Поведінка |
| --- | --- | --- |
| Бейдж типу | `type` | колір на тип |
| Плагін + версія | `plugin`, `Plugin.version` | посилання на `/p/<plugin>/` |
| Назва | `name` | посилання на сторінку артефакту; підсвічування |
| Опис | `description`, до 3 рядків | підсвічування; повний текст у `title` |
| Теги | `tags` | клік додає тег у фільтр |
| Виклик | `invocation` | кнопка копіювання |
| + Add plugin | `plugin` | додає плагін у конструктор; стан «✓ Added» |
| Details / Source | `url`, `sourceUrl` | Source відкривається в новій вкладці |

### Стан у URL

`?q=<запит>&type=skill,agent&plugin=sdd-kit&tag=sdd`. Зміна фільтрів робить `history.replaceState`; відкриття посилання відновлює стан. Гаряча клавіша `/` фокусує поле пошуку, `Esc` очищає його.

### Сторінка артефакту (`/a/<plugin>/<type>/<name>/`)

- Заголовок, бейдж типу, плагін і версія, опис.
- Блок «How to use»: виклик з кнопкою копіювання; команди встановлення плагіна (розділ 8).
- Таблиця frontmatter (`allowed-tools`/`tools`, `model`, `argument-hint` тощо — усе, що є).
- Відрендерений Markdown тіла.
- Список файлів артефакту з посиланнями на GitHub.
- «Other artifacts in this plugin» — до 6 карток.

### Сторінка плагіна (`/p/<plugin>/`)

Опис, версія, ліцензія, категорія, теги, лічильники за типами, команди встановлення, кнопка «Add to install builder», сітка карток усіх артефактів плагіна.

### Загальне

- Адаптивна верстка: 1 колонка < 640 px, 2 колонки до 1024 px, 3 — ширше.
- Світла й темна тема за `prefers-color-scheme`.
- Сторінки артефактів і плагінів працюють без JavaScript (крім кнопок копіювання).

## 8. Конструктор встановлення (`/install/`)

Одиниця встановлення — плагін. Додати можна з картки будь-якого артефакту (додається його плагін), зі сторінки плагіна або на самій сторінці конструктора (список усіх плагінів з чекбоксами). Вибір зберігається в `localStorage` (`sddkit.install.v1`, масив імен плагінів); якщо сховище недоступне, вибір живе до перезавантаження сторінки. Лічильник вибраних плагінів показується в шапці.

Конструктор має дві вкладки з кнопкою «Copy».

**Commands** (особисте встановлення):

```
/plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit
/plugin install sdd-kit@dev-digest-agentic-sdd-kit
/plugin install <other>@dev-digest-agentic-sdd-kit
```

**Project settings** (для команди, фрагмент `.claude/settings.json`):

```json
{
  "extraKnownMarketplaces": {
    "dev-digest-agentic-sdd-kit": {
      "source": { "source": "github", "repo": "sinyagin/dev-digest-agentic-sdd-kit" }
    }
  },
  "enabledPlugins": {
    "sdd-kit@dev-digest-agentic-sdd-kit": true
  }
}
```

Під фрагментом — підказка: «Merge into `.claude/settings.json` in your project and commit it».

Значення `marketplace.name` і `repo` беруться з `index.json`, у коді їх не прописуємо.

### Вимоги

- IB1. Коли користувач натискає «+ Add plugin», плагін **має** з'явитися в конструкторі, а лічильник у шапці — збільшитися, без перезавантаження сторінки.
- IB2. Якщо не вибрано жодного плагіна, конструктор **має** показати список плагінів і неактивні кнопки копіювання.
- IB3. Згенерований JSON **має** бути валідним і містити лише вибрані плагіни.

## 9. CI/CD

Новий workflow `.github/workflows/pages.yml`; існуючий `validate.yml` не змінюється.

```yaml
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:
permissions: { contents: read }   # pages: write + id-token: write лише в job deploy
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:     # index + astro build + upload-pages-artifact; у PR — без upload
  deploy:    # needs: build; if: github.ref == 'refs/heads/main'; actions/deploy-pages
```

Шляхи-тригери не обмежуємо: зміни в `plugins/` і в `site/` однаково мають перебудовувати сайт.

Разове налаштування: Settings → Pages → Source: **GitHub Actions**. Репозиторій має бути публічним (або на плані з підтримкою Pages для приватних репо).

## 10. Нефункціональні вимоги

- NF1. Клієнтський `index.json` ≤ 300 КБ gzip при 500 артефактах; JS головної сторінки ≤ 60 КБ gzip.
- NF2. Lighthouse (mobile) для головної: Performance ≥ 90, Accessibility ≥ 95.
- NF3. Під час роботи сайт не звертається до сторонніх доменів (без CDN, шрифтів і аналітики).
- NF4. Доступність: усі інтерактивні елементи доступні з клавіатури, видимий фокус, `aria-live` для кількості результатів, контраст AA.
- NF5. Підтримка: останні дві версії Chrome, Firefox, Safari, Edge.
- NF6. Увесь вміст Markdown рендериться під час збірки з санітизацією HTML (rehype-sanitize), без виконання скриптів з артефактів.

## 11. Етап 2: семантичний пошук

- Під час збірки для кожного артефакту рахується ембеддинг (`name + description + tags + перші 512 токенів body`) моделлю `Xenova/multilingual-e5-small` (quantized), результат — `embeddings.bin` (float16) поруч з `index.json`.
- У браузері кнопка «Smart search» ліниво завантажує модель через transformers.js (кешується в Cache Storage) і рахує ембеддинг запиту.
- Гібридний score: `0.5 × нормалізований MiniSearch + 0.5 × косинусна близькість`.
- Пошук за ключовими словами з MVP лишається основним і працює без моделі.

Деталі (розмір моделі, поріг близькості, UX завантаження) уточнюються в окремій специфікації перед етапом 2.

## 12. Беклог після MVP

1. Панель довіри: хуки й події, shell-команди, MCP-сервери, `allowed-tools` — на сторінках плагіна й артефакту.
2. Issue-кнопки: «Request an artifact» (з порожнього стану пошуку, з текстом запиту) і «Report a problem» на сторінці артефакту, через шаблони в `.github/ISSUE_TEMPLATE/`.
3. Публічний API для агентів: стабільний `/index.json`, `/llms.txt`, скіл `sdd-kit:find`.
4. Карта SDD-процесу (spec → plan → tasks → implement → review) з артефактами на кожному етапі.
5. Changelog і RSS/Atom зі змін версій `plugin.json`.
6. Обране в `localStorage`.
7. Giscus для коментарів; статистика, зібрана в CI; локалізація UI uk/en.

## 13. Тестування

- Unit (Vitest): індексатор на фікстурі `site/scripts/__fixtures__/` (усі 5 типів, помилки IX1–IX2); `query.ts` — стоп-слова, намір типу; генератор фрагментів конструктора (IB3).
- E2E (Playwright, проти `astro preview --ignore-lock` на окремому порту 4322, бо в Astro 7 preview за замовчуванням тримає lock-файл): S2, S4, фільтри + відновлення стану з URL, IB1, копіювання в буфер.
- Lighthouse CI для NF2 — після MVP; поки що перевіряється вручну.

## 14. Критерії приймання MVP

- [ ] Push у `main` автоматично публікує сайт на `https://sinyagin.github.io/dev-digest-agentic-sdd-kit/`.
- [ ] PR з артефактом без `description` не проходить CI.
- [ ] Новий скіл, доданий у `plugins/sdd-kit/skills/<name>/SKILL.md`, з'являється в пошуку і має свою сторінку після мержу.
- [ ] S2–S5, IB1–IB3 виконуються.
- [ ] Посилання з `?q=…&type=…` відкриває той самий набір результатів.
- [ ] Фрагмент Project settings, вставлений у `.claude/settings.json` чистого проєкту, після запуску Claude Code пропонує встановити маркетплейс і вибрані плагіни.
- [ ] `claude plugin validate . --strict` проходить (сайт не ламає валідацію маркетплейсу).

## 15. Ризики та відкриті питання

| Питання | Пропозиція |
| --- | --- |
| Чи вплине тека `site/` на `claude plugin validate`? | Перевірити на першому PR; маркетплейс посилається лише на `plugins/*`, тож очікуємо, що ні |
| Репозиторій публічний? | Потрібно для Pages на безкоштовному плані; підтвердити перед налаштуванням |
| Власний домен | Не в MVP; за потреби — файл `CNAME` і зміна `site` в `astro.config.mjs` |
