# Sprint 5 — Analytics date-range params

**EOMA Sprint:** 5 (Phase 6 of `EOMA/.claude/plans/we-will-rebuilt-the-flickering-backus.md`)
**EOMA spec ref:** `docs/superpowers/specs/2026-04-26-social-management-redesign-design.md` §15.B
**Why this exists:** EOMA's Analytics surface ships a 7d/30d/90d toggle. Postiz' upstream `/analytics/:integration` and `/analytics/post/:postId` only accept a single `?date=<days>` numeric param. EOMA needs to forward an explicit ISO date range so the cache key, provider call, and resulting series are all aligned with what the user picked.

## Surface

```
GET /analytics/:integration?date=<n>&startDate=<ISO YYYY-MM-DD>&endDate=<ISO YYYY-MM-DD>
GET /analytics/post/:postId?date=<n>&startDate=<ISO YYYY-MM-DD>&endDate=<ISO YYYY-MM-DD>
```

Both range params are **optional** — when absent the upstream `?date=<n>` continues to work unchanged. When supplied, they take precedence: the controller derives a day-window from `(endDate - startDate)` and forwards that integer to the provider's `analytics()` method (existing interface contract preserved).

## Files modified

1. `apps/backend/src/api/routes/analytics.controller.ts`
   - Both `getIntegration` and `getPostAnalytics` learn optional `@Query('startDate')` + `@Query('endDate')`.
   - Service signatures `IntegrationService.checkAnalytics` and `PostsService.checkPostAnalytics` accept `range?: { startDate?: string; endDate?: string }` as a trailing additive arg — defaults remain backward-compatible with existing callers.
2. `libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts`
   - Adds private `_resolveAnalyticsDayWindow` + `_analyticsCacheSegment` helpers. When `range` is supplied, `dayWindow = ceil((endDate - startDate) / day_ms)`; cache key embeds both boundaries so distinct ranges don't collide (e.g. `integration:org:int:7d-2026-04-19_2026-04-26`).
3. `libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts`
   - Same helper pair, named `_resolvePostAnalyticsDayWindow` + `_postAnalyticsCacheSegment`. Kept as private locals (not extracted to a shared util) so the patch surface stays small and reversible.

## Provider interface

Untouched. Providers' `analytics(internalId, token, dayCount)` still receives a single integer. The day-count is now derived from the ISO range when supplied, falling back to the bare `+date` param otherwise. No provider implementations needed updates — the contract didn't change.

## Cache key

Old: `integration:<orgId>:<integrationId>:<rawDateParam>` (e.g. `:30`).
New: `integration:<orgId>:<integrationId>:<segment>` where `segment` is either:
- `<n>` when only `?date=` is supplied (backward-compatible), OR
- `<n>d-<startDate>_<endDate>` when an explicit range is supplied.

Different ranges resolve to distinct keys; identical ranges hit cache.

## Verification

- `pnpm run build` (workspace → backend + orchestrator + frontend) — green.
- Existing `?date=30` behavior unchanged for callers that don't supply the range params.
- The EOMA proxy at `backend/src/routes/social-management-proxy/posts.ts` was updated in the same Sprint 5 cycle to pass `defaultMissingDates: false` to its `normalizePostizDateQuery` helper, so the bare-param path is preserved end-to-end.

## Rollback

Revert this single commit + the matching service-layer commit. EOMA's proxy will continue to work because the range params are optional on its side too — the Analytics dashboard just falls back to the implicit ±1y window of `?date=<n>`.
