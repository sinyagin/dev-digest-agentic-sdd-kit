---
description: Flags the I/O import in the pure core package and the skipped mandatory gate, citing the rule ids.
tags: [recall]
max_turns: 15
allowed_tools: [Agent, Read, Glob, Grep]
---

Run an architecture review of the diff below against our documented structural contracts and give me the reviewer's report.

The project documents these structural contracts in `docs/architecture.md` (rule id — rule):

- `inward-only-dependencies` — layers are Presentation (`routes.ts`) → Application (`service.ts`) → Infrastructure (`repository.ts`) → Domain (`domain/`, `@app/shared`). An inner layer never imports an outer one; domain code imports no HTTP framework, ORM, or adapter.
- `business-logic-in-routes` — a route handler only validates input, calls one service method, and sends the reply.
- `di-discipline` — concrete adapters, repositories and services are constructed only in the composition root `server/src/platform/container.ts`; everything else receives them from the container.
- `config-access-through-provider` — only `server/src/platform/localSecretsProvider.ts` reads `process.env`.
- `pure-package-isolation` — the `core/` package does no I/O except through the injected `LLMProvider`.
- `mandatory-pipeline-gate` — every `core/` pipeline result passes through `groundFindings()` before it is returned.
- `shared-contract-not-duplicated` — `@app/shared` is the single source of truth for cross-package Zod contracts.

```diff
diff --git a/core/src/pipeline/run.ts b/core/src/pipeline/run.ts
index ccccccc..ddddddd 100644
--- a/core/src/pipeline/run.ts
+++ b/core/src/pipeline/run.ts
@@ -1,4 +1,5 @@
 import type { PipelineInput, Finding } from "./types.js";
+import { readFileSync } from "node:fs";
 import { draftFindings } from "./draft.js";
 import { dedupe } from "./dedupe.js";
 import { groundFindings } from "./ground.js";
@@ -6,9 +7,10 @@ import { groundFindings } from "./ground.js";
 export async function runPipeline(input: PipelineInput): Promise<Finding[]> {
   const llm = input.llm;
+  const prompt = readFileSync(input.promptPath, "utf8");
   const drafted = await draftFindings(input, llm);
   const deduped = dedupe(drafted);
-  const grounded = await groundFindings(deduped, input.diff);
-  return grounded;
+  return deduped;
 }
```
