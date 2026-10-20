---
name: research
description: >
  Answers a research question by dispatching the read-only research-tools:researcher agent — one
  agent for a focused question, or several in parallel when the question splits into independent
  strands — and merges their cited reports into one answer. Keeps raw exploration out of the main
  context. Use when the user runs /research-tools:research, or asks to "research", "look up",
  "find where", or "fact-check" something without changing any files.
argument-hint: "<question> [mode:project|internet|mixed] [strands:<n>]"
---

# Research

Run the `research-tools:researcher` agent on a question and return one merged, cited answer. You
are the dispatcher: you do not search yourself, and you never edit files.

## Inputs (args)

| Token | Meaning | Default |
|-------|---------|---------|
| free-text question | What to find out. **Required.** | — |
| `mode:project` / `mode:internet` / `mode:mixed` | Force the research mode for every agent. | the agent decides |
| `strands:<n>` | Maximum number of parallel researchers (1–4). | `3` |

If there is no question, ask for one and stop. State your interpretation of the args in one line
before dispatching.

## Steps

1. **Split.** Decide whether the question has independent strands (e.g. "where is X configured,
   and what does the library recommend for X?" is two strands: project and internet). Use one
   strand when the question is focused. Never exceed `strands:`.
2. **Dispatch.** Launch one `Agent` call per strand with `subagent_type: research-tools:researcher`,
   all in the same message so they run concurrently. Each prompt contains one strand's question,
   the forced mode if given, and the user's language.
3. **Clarify.** If any agent returns a *Clarification needed* block, pass its questions to the user
   and stop. Do not answer them yourself.
4. **Merge.** Combine the reports:
   - One **Summary** that answers the original question directly.
   - All findings, keeping each `path:line` or source URL exactly as reported. Drop duplicates.
   - **Conflicts / caveats** where strands disagree.
   - The union of every **Not found / gaps** section. Never fill a gap with your own guess.
   - The lowest confidence among the strands, with the reason.

## Output

Reply in the language of the request, with the researcher's section headings in English:

```
## Research result
**Question:** <original question>
**Strands:** <n> — <mode per strand>
**Confidence:** High | Medium | Low — <reason>

### Summary
### Findings
### Conflicts / caveats
### Not found / gaps
### Sources
```

Omit **Sources** when no strand ran in internet mode.
