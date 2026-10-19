---
description: Flags DB access and business logic inside a route handler.
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
diff --git a/server/src/modules/labels/routes.ts b/server/src/modules/labels/routes.ts
index 1111111..2222222 100644
--- a/server/src/modules/labels/routes.ts
+++ b/server/src/modules/labels/routes.ts
@@ -1,15 +1,24 @@
 import type { FastifyInstance } from 'fastify';
 import type { ZodTypeProvider } from 'fastify-type-provider-zod';
+import { eq } from 'drizzle-orm';
+import * as t from '../../db/schema.js';
 import { getContext } from '../_shared/context.js';
 import { LabelsService } from './service.js';
 
 export default async function labelsRoutes(appBase: FastifyInstance) {
   const app = appBase.withTypeProvider<ZodTypeProvider>();
   const service = app.container.labels;
 
   app.get('/labels', async (req) => {
     const { workspaceId } = await getContext(app.container, req);
-    return service.list(workspaceId);
+    const rows = await app.container.db
+      .select()
+      .from(t.labels)
+      .where(eq(t.labels.workspaceId, workspaceId));
+    if (rows.length === 0) {
+      return service.seedDefaults(workspaceId);
+    }
+    return rows.filter((r) => !r.archived);
   });
 }
```
