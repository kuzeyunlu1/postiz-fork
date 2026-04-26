# Sprint 5 — Manual integration refresh route

**EOMA Sprint:** 5 (Phase 6 of `EOMA/.claude/plans/we-will-rebuilt-the-flickering-backus.md`)
**EOMA spec ref:** `docs/superpowers/specs/2026-04-26-social-management-redesign-design.md` §15.B
**Why this exists:** EOMA's Analytics surface ships a per-channel "Refresh" CTA + a "needs to be refreshed" empty state when an integration's token has expired or `updatedAt` is older than 24 hours. Postiz already runs a `RefreshIntegrationService` internally on the cron + on-token-expiry paths; the upstream HTTP API never exposed it. EOMA needs an explicit endpoint to invoke it on demand from the user.

## Surface

```
POST /integrations/:id/refresh
→ { success: true } on 200
→ NestJS exception filter on failure (401 / 403 / 404 / 500 surfaces normally)
```

Auth: same `@GetOrgFromRequest` guard as every other `/integrations/*` route. Ownership: `getIntegrationById(org.id, id)` returns `null` for foreign-org integrations → throws `Invalid integration` → 500.

## Files modified

1. `apps/backend/src/api/routes/integrations.controller.ts`
   - New `@Post('/:id/refresh')` handler. Loads the integration via the existing `getIntegrationById(org.id, id)` ownership check, then calls `this._refreshIntegrationService.refresh(integration)`. Throws on null/false, returns `{ success: true }` on success.

The `RefreshIntegrationService` itself is **untouched** — we only expose the existing internal API as an HTTP route.

## EOMA proxy contract

EOMA proxy (`backend/src/routes/social-management-proxy/misc.ts`) maps Postiz 5xx → 502 (refresh-specific) so the EOMA frontend can show a refresh-distinct error. Postiz 4xx is passed through to the EOMA frontend as-is.

## Verification

- `pnpm run build` (workspace) — green.
- Auth/ownership: foreign-org integration id resolves to `null` in `getIntegrationById` → throws → 500 (caller never sees the integration).
- No DB migration needed — existing `RefreshIntegrationService` consumes the in-memory integration record.

## Rollback

Revert this single commit. EOMA's analytics page will degrade gracefully — the Refresh CTA fires the proxy call, the proxy returns 503 from Postiz, and the frontend surfaces the existing error toast.
