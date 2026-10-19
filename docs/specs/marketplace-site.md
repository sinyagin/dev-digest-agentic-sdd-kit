# Spec: marketplace website on GitHub Pages

| | |
| --- | --- |
| Status | Draft |
| Date | 2026-10-18 |
| Author | Andrii Syniagin |
| Site URL | `https://sinyagin.github.io/dev-digest-agentic-sdd-kit/` |

## 1. Purpose

Users of the `dev-digest-agentic-sdd-kit` marketplace should be able to find the artifacts they need (skills, agents, commands, hooks, MCP servers) with a plain-language query, see the results as cards, and install plugins without assembling commands by hand.

The site is static and deployed to GitHub Pages. There is no backend: data is collected at build time in GitHub Actions, and search runs in the browser.

### MVP goals

- G1. Search across the whole repository with plain English queries ("I need a skill for…").
- G2. Search results as cards with filters; search state kept in the URL.
- G3. A dedicated page for every artifact and every plugin.
- G4. Install builder: the user picks plugins and gets commands or a `.claude/settings.json` snippet.
- G5. Automatic build and deploy on push to `main`, with no manual steps when new artifacts are added.

### Out of scope for the MVP

- Semantic search (phase 2, section 11).
- Trust panel, issue buttons, `llms.txt` and a `find` skill, changelog/RSS, favorites, Giscus, UI localization (section 12).
- Any server-side user data, authentication, analytics.

## 2. Users and scenarios

| ID | As a… | I want to… | so that… |
| --- | --- | --- | --- |
| US1 | developer using Claude Code | type "I need a skill for writing a spec" | I see matching artifacts without knowing their names |
| US2 | developer | filter results by type and plugin | I can narrow the list quickly |
| US3 | developer | open an artifact page | I can read what it does, which tools it uses and how to invoke it |
| US4 | developer | copy an install command with one click | I don't have to type it |
| US5 | team lead | pick several plugins and get a `.claude/settings.json` snippet | I can enable the marketplace for the whole team in one commit |
| US6 | developer | share a link to search results | a colleague sees the same list |
| US7 | plugin author | add a new skill and push to `main` | it appears on the site with no extra steps |

## 3. Architecture

```
push to main / PR
      │
      ▼
GitHub Actions: .github/workflows/pages.yml
  1. npm ci + unit tests (site/)
  2. node site/scripts/build-index.mjs → site/src/data/index.json + site/public/index.json
       reads marketplace.json + plugins/*/ ; validates ; fails on errors
  3. astro build (site/)            → site/dist/
  4. E2E (Playwright), then actions/upload-pages-artifact + actions/deploy-pages (main only)
      │
      ▼
GitHub Pages (static)
  /                            home: search + cards + filters
  /a/<plugin>/<type>/<slug>/   artifact page (SSG)
  /p/<plugin>/                 plugin page (SSG)
  /install/                    install builder
  /index.json                  public index (client copy of the data)
```

**Stack:** Astro (SSG) + TypeScript. Interactive parts (search, filters, install builder) are client scripts in vanilla TS with no framework; card markup comes from a single `renderCard` function used by both SSG and the client. Search: [MiniSearch](https://github.com/lucaong/minisearch). Markdown is rendered at build time with unified (remark-gfm → rehype-sanitize).

### Repository layout

The whole site is one npm package in `site/`, so the indexer and the site share dependencies.

```
site/
  astro.config.mjs         # site + base: '/dev-digest-agentic-sdd-kit/'
  package.json             # predev/prebuild run the indexer
  playwright.config.ts
  scripts/
    build-index.mjs        # indexer
    build-index.test.mjs
    __fixtures__/ok/       # fixture marketplace covering all 5 types
  e2e/site.spec.ts
  src/
    data/index.json        # generated, in .gitignore
    lib/                   # types, base paths, HTML escaping, Markdown
    search/
      query.ts             # query parsing (section 6)
      engine.ts            # MiniSearch, ranking, facets, fallback
      stopwords.ts         # English stopwords
    install/               # command/settings generator and selection store
    components/card.ts     # renderCard (SSG + client)
    scripts/               # global.ts (copy, counter), home.ts (search)
    pages/
      index.astro
      a/[plugin]/[type]/[name].astro
      p/[plugin].astro
      install.astro
.github/workflows/pages.yml
```

`site/src/data/index.json`, `site/public/index.json`, `site/dist/` and `site/.astro/` are in `.gitignore`.

## 4. Data model: `index.json`

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
  category?: string;              // from marketplace.json
  tags: string[];                 // tags (marketplace.json) ∪ keywords (plugin.json)
  license?: string;
  path: string;                   // "plugins/sdd-kit"
  counts: Record<ArtifactType, number>;
}

type ArtifactType = "skill" | "agent" | "command" | "hook" | "mcp";

interface Artifact {
  id: string;                     // "<plugin>:<type>:<name>", unique
  type: ArtifactType;
  name: string;
  slug: string;                   // URL-safe form of name ("PreToolUse:Edit|Write" → "pretooluse-edit-write")
  plugin: string;
  description: string;
  invocation?: string;            // "/sdd-kit:hello" for skill/command; "sdd-kit:<name>" for agent
  tags: string[];                 // inherited from the plugin + the artifact's own frontmatter tags (if any)
  frontmatter: Record<string, unknown>;  // as is, for the artifact page
  body: string;                   // Markdown without frontmatter; for hook/mcp, the JSON config in a code block
  files: string[];                // paths relative to the plugin root
  sourceUrl: string;              // https://github.com/<repo>/blob/main/<path>
  url: string;                    // "a/<plugin>/<type>/<slug>/", relative to base
}
```

The client `/index.json` has the same schema, but its `body` is plain text capped at 4000 characters. Body HTML is rendered only when pages are built.

## 5. Indexer (`site/scripts/build-index.mjs`)

### Sources

| Type | Where to look (default) | Name | Description |
| --- | --- | --- | --- |
| plugin | `marketplace.json` → `plugins[].source` → `.claude-plugin/plugin.json` | `name` | `description` |
| skill | `skills/*/SKILL.md` | frontmatter `name`, else the directory name | frontmatter `description` |
| command | `commands/**/*.md` | file name without `.md` | frontmatter `description`, else the first paragraph |
| agent | `agents/*.md` | frontmatter `name`, else the file name | frontmatter `description` |
| hook | `hooks/hooks.json` or `hooks` in `plugin.json` | `<Event>[:<matcher>]` | generated from the hook's command/type |
| mcp | `.mcp.json` or `mcpServers` in `plugin.json` | server key | server `command`/`url` |

If `plugin.json` sets custom paths (`commands`, `agents`, `skills`, `hooks`, `mcpServers`), the indexer reads them in addition to the default paths.

Plugins whose `source` is not a local directory (github/url) are indexed from `marketplace.json` data only, without artifacts.

### Requirements

- IX1. The indexer **shall** exit with a non-zero code if a skill, agent or command has no `description`, or if two artifacts share an `id`.
- IX2. The indexer **shall** fail if `name` in `marketplace.json` does not match `name` in `plugin.json` (mirrors the README rule).
- IX3. The indexer **shall** be deterministic: the same content produces the same `index.json`, except `generatedAt` and `commit`.
- IX4. The indexer makes no network calls: it reads only the file system, `git rev-parse HEAD` and `git remote get-url origin` (or `GITHUB_REPOSITORY` in CI).
- IX5. Dependencies: `gray-matter` (frontmatter) and the Node 22 standard library.

The indexer also runs on PRs (the `pages.yml` build job without deploy), so IX1–IX2 errors are caught before merge.

## 6. Search

### Query pipeline

```
raw query
  → 1. normalize: NFKC, lowercase, apostrophes ' ʼ ’ → ', strip punctuation
  → 2. tokenize on whitespace and hyphens
  → 3. extract type intent (table below) → type filter; drop the token
  → 4. drop stopwords
  → 5. MiniSearch.search(terms, options)
  → 6. ranking + UI filters → cards
```

**Type intent** (step 3):

| Tokens | Filter |
| --- | --- |
| skill, skills | `skill` |
| agent, agents, subagent, subagents | `agent` |
| command, commands, slash | `command` |
| hook, hooks | `hook` |
| mcp, server, servers | `mcp` |

If the type intent yields no results, the search is repeated without that filter and a notice "No skills matched — showing all types" appears above the results.

**Stopwords**: a fixed English list in `stopwords.ts` (i, need, want, a, an, the, for, to, that, which, something, help, me, can, …).

Queries are English only; other languages get no special handling.

### MiniSearch configuration

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

The browser builds the index from `/index.json` on first focus of the search field (or immediately if the URL has search parameters).

### Ranking

- Base score from MiniSearch.
- ×1.2 if the artifact matched most (> 50 %) of the meaningful query terms.
- Empty query: all artifacts, sorted by type (skill → command → agent → hook → mcp), then by name.

### Requirements

- S1. When the user types a query, the site **shall** update the results within 100 ms of the last keystroke (not counting the 120 ms debounce).
- S2. The query "I need a skill to check the plugin works" **shall** return `sdd-kit:skill:hello` as the first result on the current repository content.
- S3. A typo in a word longer than 4 characters (e.g. "plugn") **shall** still match.
- S4. When there are no results, the site **shall** show an empty state offering to clear filters, browse all artifacts, or try example queries.
- S5. Matches in a card's name and description **shall** be highlighted (`<mark>`).

## 7. UI

The interface and search queries are in English.

### Home (`/`)

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

Filters show artifact counts for the current query; options with zero results are disabled.

### Card anatomy

| Element | Source | Behavior |
| --- | --- | --- |
| Type badge | `type` | one color per type |
| Plugin + version | `plugin`, `Plugin.version` | links to `/p/<plugin>/` |
| Name | `name` | links to the artifact page; highlighted |
| Description | `description`, up to 3 lines | highlighted; full text in `title` |
| Tags | `tags` | click adds the tag to the filter |
| Invocation | `invocation` | copy button |
| + Add plugin | `plugin` | adds the plugin to the install builder; "✓ Added" state |
| Details / Source | `url`, `sourceUrl` | Source opens in a new tab |

### URL state

`?q=<query>&type=skill,agent&plugin=sdd-kit&tag=sdd`. Changing filters calls `history.replaceState`; opening a link restores the state. The `/` key focuses the search field, `Esc` clears it.

### Artifact page (`/a/<plugin>/<type>/<slug>/`)

- Title, type badge, plugin and version, description.
- "How to use" block: invocation with a copy button; plugin install commands (section 8).
- Frontmatter table (`allowed-tools`/`tools`, `model`, `argument-hint`, etc. — whatever is present).
- Rendered Markdown body.
- The artifact's files with links to GitHub.
- "Other artifacts in this plugin": up to 6 cards.

### Plugin page (`/p/<plugin>/`)

Description, version, license, category, tags, per-type counts, install commands, an "Add to install builder" button, and a card grid of all the plugin's artifacts.

### General

- Responsive layout: 1 column below 640 px, 2 columns up to 1024 px, 3 above.
- Light and dark themes via `prefers-color-scheme`.
- Artifact and plugin pages work without JavaScript (except the copy buttons).

## 8. Install builder (`/install/`)

The unit of installation is a plugin. Plugins can be added from any artifact card (its plugin is added), from a plugin page, or on the builder page itself (a checkbox list of all plugins). The selection is stored in `localStorage` (`sddkit.install.v1`, an array of plugin names); if storage is unavailable, the selection lasts until the page reloads. The header shows the number of selected plugins.

The builder has two tabs and a "Copy" button.

**Commands** (personal install):

```
/plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit
/plugin install sdd-kit@dev-digest-agentic-sdd-kit
/plugin install <other>@dev-digest-agentic-sdd-kit
```

**Project settings** (for a team, a `.claude/settings.json` snippet):

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

Below the snippet is a hint: "Merge into `.claude/settings.json` in your project and commit it".

`marketplace.name` and `repo` come from `index.json`; they are not hard-coded.

### Requirements

- IB1. When the user clicks "+ Add plugin", the plugin **shall** appear in the builder and the header counter **shall** increase, without a page reload.
- IB2. When no plugin is selected, the builder **shall** show the plugin list and disabled copy buttons.
- IB3. The generated JSON **shall** be valid and contain only the selected plugins.

## 9. CI/CD

A new workflow `.github/workflows/pages.yml`; the existing `validate.yml` is unchanged.

```yaml
on:
  push: { branches: [main] }
  pull_request:
  workflow_dispatch:
permissions: { contents: read }   # pages: write + id-token: write only in the deploy job
concurrency: { group: pages-${{ github.ref }}, cancel-in-progress: true }
jobs:
  build:     # tests + index + astro build + E2E + upload-pages-artifact; no upload on PRs
  deploy:    # needs: build; if: github.ref == 'refs/heads/main'; actions/deploy-pages
```

No path filters: changes in both `plugins/` and `site/` must rebuild the site.

One-time setup: Settings → Pages → Source: **GitHub Actions**. The repository must be public (or on a plan that supports Pages for private repositories).

## 10. Non-functional requirements

- NF1. Client `index.json` ≤ 300 KB gzip at 500 artifacts; home page JS ≤ 60 KB gzip.
- NF2. Lighthouse (mobile) for the home page: Performance ≥ 90, Accessibility ≥ 95.
- NF3. At runtime the site makes no requests to third-party domains (no CDNs, fonts or analytics).
- NF4. Accessibility: all interactive elements are keyboard-reachable, focus is visible, the result count uses `aria-live`, contrast meets AA.
- NF5. Support: the last two versions of Chrome, Firefox, Safari and Edge.
- NF6. All Markdown is rendered at build time with HTML sanitization (rehype-sanitize); no scripts from artifacts are executed.

## 11. Phase 2: semantic search

- At build time, compute an embedding for each artifact (`name + description + tags + first 512 tokens of body`) with a small quantized embedding model (e.g. `Xenova/all-MiniLM-L6-v2`), stored as `embeddings.bin` (float16) next to `index.json`.
- In the browser, a "Smart search" button lazily loads the model via transformers.js (cached in Cache Storage) and embeds the query.
- Hybrid score: `0.5 × normalized MiniSearch score + 0.5 × cosine similarity`.
- The MVP keyword search stays the default and works without the model.

Details (model size, similarity threshold, loading UX) go into a separate spec before phase 2.

## 12. Post-MVP backlog

1. Trust panel: hooks and their events, shell commands, MCP servers, `allowed-tools` — on plugin and artifact pages.
2. Issue buttons: "Request an artifact" (from the empty search state, prefilled with the query) and "Report a problem" on the artifact page, via templates in `.github/ISSUE_TEMPLATE/`.
3. Public API for agents: a stable `/index.json`, `/llms.txt`, and a `sdd-kit:find` skill.
4. SDD process map (spec → plan → tasks → implement → review) with the artifacts for each stage.
5. Changelog and RSS/Atom from `plugin.json` version changes.
6. Favorites in `localStorage`.
7. Giscus comments; stats collected in CI; UI localization.

## 13. Testing

- Unit (Vitest): the indexer against the fixture in `site/scripts/__fixtures__/` (all 5 types, IX1–IX2 errors); `query.ts` — stopwords, type intent; install builder output (IB3).
- E2E (Playwright, against `astro preview --ignore-lock` on a separate port 4322, because Astro 7's preview holds a lock file by default): S2, S4, filters and URL state restore, IB1, clipboard copy.
- Lighthouse CI for NF2 comes after the MVP; checked manually for now.

## 14. MVP acceptance criteria

- [ ] A push to `main` automatically publishes the site at `https://sinyagin.github.io/dev-digest-agentic-sdd-kit/`.
- [ ] A PR with an artifact missing `description` fails CI.
- [ ] A new skill added at `plugins/sdd-kit/skills/<name>/SKILL.md` shows up in search and gets its own page after merge.
- [ ] S2–S5 and IB1–IB3 hold.
- [ ] A link with `?q=…&type=…` opens the same set of results.
- [ ] The Project settings snippet, pasted into `.claude/settings.json` of a clean project, makes Claude Code offer to install the marketplace and the selected plugins.
- [ ] `claude plugin validate . --strict` passes (the site does not break marketplace validation).

## 15. Risks and open questions

| Question | Proposal |
| --- | --- |
| Does the `site/` directory affect `claude plugin validate`? | Checked locally: validation passes, since the marketplace only references `plugins/*` |
| Is the repository public? | Required for Pages on the free plan; confirm before setup |
| Custom domain | Not in the MVP; if needed, add a `CNAME` file and change `site` in `astro.config.mjs` |
