# Research Tools

A read-only research agent for Claude Code. It finds information in the current project or on the
public web, and fact-checks it. It returns a strict, cited Markdown report. It never changes
anything.

## Install

```
/plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit
/plugin install research-tools@dev-digest-agentic-sdd-kit
```

The plugin has no dependencies. [`sdd-engineering`](../sdd-engineering) depends on it:
`spec-creator` and `implementation-planner` send broad discovery work to the researcher.

## Components

| Component | Type | Model | Tools |
| --- | --- | --- | --- |
| `research-tools:researcher` | agent | sonnet | Read, Glob, Grep, Bash, WebSearch, WebFetch (no Edit or Write) |

## Usage

Ask a question and name the agent, or let Claude delegate on its own:

```
Use the researcher agent: where is rate limiting configured in this repo, and what are the limits?
Use research-tools:researcher to check whether Fastify 5 still supports the `onRoute` hook.
```

To keep raw exploration out of your main context, split a broad question into independent strands.
Then launch several researchers in parallel, one per strand.

## How it works

1. **Interview first.** If the request has no actual question, is ambiguous, or is unbounded, the
   agent returns a *Clarification needed* block: 1–4 questions, each with a default answer. It
   doesn't guess.
2. **Pick a mode:**
   - **Project mode:** Glob, Grep and Read.
   - **Internet mode:** at most about 5 WebSearch queries, then WebFetch to verify.
   - **Mixed mode:** both, with project results first.
3. **Report.** It uses a fixed template:
   - Summary and confidence.
   - Atomic findings. Each project finding has a `path:line` and a verbatim excerpt. Each web
     finding has a source URL and a quote.
   - Conflicts and caveats.
   - An explicit **Not found / gaps** section.

## Guarantees

- **Read-only.** It never creates, edits or deletes files.
- **Cited.** Every claim has a locator, and it never invents paths, lines, quotes or URLs.
- **Honest.** "Not found" is a valid result. Empty results are reported, not padded.
- **Bounded.** It makes a small number of web queries and never runs a deep-research harness.
- **Language.** It answers in the language of the request and keeps template headings in English.

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Releases are tagged `research-tools--v<version>`.
