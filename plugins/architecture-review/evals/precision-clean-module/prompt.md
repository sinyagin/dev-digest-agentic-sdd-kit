---
description: Reports no violations for a correctly layered new module.
tags: [precision]
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
diff --git a/server/src/modules/tags/routes.ts b/server/src/modules/tags/routes.ts
new file mode 100644
index 0000000..5555555
--- /dev/null
+++ b/server/src/modules/tags/routes.ts
@@ -0,0 +1,17 @@
+import type { FastifyInstance } from 'fastify';
+import type { ZodTypeProvider } from 'fastify-type-provider-zod';
+import type { Tag } from '@app/shared';
+import { getContext } from '../_shared/context.js';
+
+export default async function tagsRoutes(appBase: FastifyInstance) {
+  const app = appBase.withTypeProvider<ZodTypeProvider>();
+
+  app.get('/tags', async (req): Promise<Tag[]> => {
+    const { workspaceId } = await getContext(app.container, req);
+    return app.container.tags.list(workspaceId);
+  });
+}
diff --git a/server/src/modules/tags/service.ts b/server/src/modules/tags/service.ts
new file mode 100644
index 0000000..6666666
--- /dev/null
+++ b/server/src/modules/tags/service.ts
@@ -0,0 +1,14 @@
+import type { Tag } from '@app/shared';
+import type { Container } from '../../platform/container.js';
+import { toTagDto } from './helpers.js';
+
+export class TagsService {
+  constructor(private container: Container) {}
+
+  async list(workspaceId: string): Promise<Tag[]> {
+    const rows = await this.container.tagsRepo.list(workspaceId);
+    return rows.map(toTagDto);
+  }
+}
diff --git a/server/src/modules/tags/repository.ts b/server/src/modules/tags/repository.ts
new file mode 100644
index 0000000..7777777
--- /dev/null
+++ b/server/src/modules/tags/repository.ts
@@ -0,0 +1,15 @@
+import { asc, eq } from 'drizzle-orm';
+import type { Db } from '../../db/client.js';
+import * as t from '../../db/schema.js';
+import type { TagRow } from '../../db/rows.js';
+
+export class TagsRepository {
+  constructor(private db: Db) {}
+
+  async list(workspaceId: string): Promise<TagRow[]> {
+    return this.db
+      .select()
+      .from(t.tags)
+      .where(eq(t.tags.workspaceId, workspaceId))
+      .orderBy(asc(t.tags.name));
+  }
+}
diff --git a/server/src/modules/tags/helpers.ts b/server/src/modules/tags/helpers.ts
new file mode 100644
index 0000000..8888888
--- /dev/null
+++ b/server/src/modules/tags/helpers.ts
@@ -0,0 +1,6 @@
+import type { Tag } from '@app/shared';
+import type { TagRow } from '../../db/rows.js';
+
+export function toTagDto(row: TagRow): Tag {
+  return { id: row.id, name: row.name, color: row.color, created_at: row.createdAt.toISOString() };
+}
```
