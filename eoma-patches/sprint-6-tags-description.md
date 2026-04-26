# Sprint 6 — Tags `description` column

**EOMA Sprint:** 6 (Phase 7 of `EOMA/.claude/plans/we-will-rebuilt-the-flickering-backus.md`)
**EOMA spec ref:** `docs/superpowers/specs/2026-04-26-social-management-redesign-design.md` §11 (Settings hub) + §13 (per-editor field verification)
**Why this exists:** EOMA's Sprint 6 Tags settings sub-page surfaces a description Textarea so users can remember why a tag exists (e.g. "Used on weekly product round-ups"). Postiz upstream's `Tags` model only carries `name + color`; the EOMA frontend persisted a `description` field at the API layer but it was silently dropped when forwarded to Postiz' `CreateTagDto`. This patch adds a single nullable string column so the field round-trips end-to-end.

## Surface

```
POST /tags          { name, color, description? }   → Tags row created with description
PUT  /tags/:id      { name, color, description? }   → row updated
GET  /tags                                           → response now includes description
```

`description` is **optional** at every layer (DTO `@IsOptional()`, Prisma `String?`), so existing Postiz consumers + the legacy EOMA frontend that didn't ship the field are unaffected.

## Files modified

1. `libraries/nestjs-libraries/src/database/prisma/schema.prisma`
   - Adds `description String?` to the `Tags` model. No index — descriptions aren't query-filtered.
2. `libraries/nestjs-libraries/src/dtos/posts/create.tag.dto.ts`
   - Adds `@IsOptional() @IsString() @MaxLength(200) description?: string`. The 200-char cap matches the EOMA `<Textarea>` `maxLength` so client + server agree on the boundary.
3. `libraries/nestjs-libraries/src/database/prisma/posts/posts.repository.ts`
   - `createTag` + `editTag` now pass `description: body.description` to Prisma. When the DTO field is undefined, Prisma writes `NULL` on create / leaves the column unchanged on update (Prisma `update` semantics).

## DB migration

Postiz uses `prisma db push` (no `migrations/` directory in the repo). Running `pnpm prisma-db-push` after this patch lands will add the nullable column to the live database. On Railway redeploy, this should be triggered as part of the standard deploy script.

**Important:** the column is `String?` (nullable) so existing rows resolve to `NULL` automatically — no backfill, no destructive operation, no rollout sequencing concern.

## Rollback

Revert this single commit. Existing rows with `description` set will retain the column data (Postgres won't drop the column until the schema is re-pushed without it). To drop the column entirely: revert + run `pnpm prisma-db-push` — Postgres will execute `ALTER TABLE postiz."Tags" DROP COLUMN "description"`.

## Verification

- `pnpm run prisma-generate` — green (Prisma client regenerated).
- `pnpm run build` — green (backend + orchestrator + frontend Nest builds all succeed; TypeScript validates the new field through repository → service → controller chain).
- DTO + repository diffs match: `description?` flows from request body → repository write → Prisma column.
