# Sprint 5 — Media alt-text inline edit

**EOMA Sprint:** 5 (Phase 6 of `EOMA/.claude/plans/we-will-rebuilt-the-flickering-backus.md`)
**EOMA spec ref:** `docs/superpowers/specs/2026-04-26-social-management-redesign-design.md` §15.D
**Why this exists:** EOMA's Media library now supports alt-text edit-in-place per tile (click pencil → inline `<input>` → Enter to save). Postiz upstream has `POST /media/information` for the post-upload metadata write (id + thumbnail + thumbnailTimestamp), but no endpoint to mutate just the `alt` column for an already-saved item.

## Surface

```
PUT /media/:id
Body: { alt: string }   // class-validator: IsString + MaxLength(1000)
→ { id, name, originalName, alt, thumbnail, path, thumbnailTimestamp } on 200
→ Prisma error if (id, organizationId) doesn't match a row → 5xx
```

Auth: `@GetOrgFromRequest`. Ownership: composite `(id, organizationId)` `where` clause inside `MediaRepository.updateAlt` — Prisma rejects the update silently (returns `null`/throws) when the row doesn't belong to the caller's org.

## Files modified / added

1. `apps/backend/src/api/routes/media.controller.ts`
   - New `@Put('/:id')` handler. Uses the new `UpdateMediaAltDto` for body validation. Forwards to `MediaService.updateAlt(org.id, id, alt)`.
2. `libraries/nestjs-libraries/src/dtos/media/update.media.alt.dto.ts` (new)
   - `class-validator` DTO with `IsString` + `MaxLength(1000)` on `alt`. Kept narrow: the existing `SaveMediaInformationDto` is reused by `POST /media/information` for the upload-time triple write — we deliberately don't widen it.
3. `libraries/nestjs-libraries/src/database/prisma/media/media.service.ts`
   - Thin pass-through `updateAlt(org, id, alt)` → repository.
4. `libraries/nestjs-libraries/src/database/prisma/media/media.repository.ts`
   - `updateAlt(org, id, alt)` performs `prisma.media.update({ where: { id, organizationId: org }, data: { alt } })`. Returns the updated row trimmed to the same select shape `getMedia` uses, so the EOMA frontend can replace its optimistic copy with the canonical version.

## DB

No migration. The `media.alt` column has existed in `prisma/schema.prisma` since the Postiz upstream alt-text feature shipped — Postiz' upload flow writes it via `saveMediaInformation`, but no editing endpoint existed until this patch.

## EOMA proxy contract

EOMA proxy (`backend/src/routes/social-management-proxy/media.ts`) surfaces this as `PUT /api/social-management/media/:id` with the same body. authMiddleware + business → org resolution + `x-org-id` header (the standard EOMA → Postiz auth pattern).

## Verification

- `pnpm run build` (workspace) — green.
- Composite-key ownership: a foreign-org's media id won't match the `(id, organizationId)` pair → Prisma throws `RecordNotFound` → 5xx (caller never mutates the foreign row).
- `MaxLength(1000)` matches Twitter alt-text max (the strictest provider); other platforms accept longer but truncating at 1k is pragmatic.

## Rollback

Revert this single commit + the new DTO file. EOMA's MediaCard alt-edit will revert visually but server state is unaffected.
