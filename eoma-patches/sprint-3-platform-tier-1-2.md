# Sprint 3 — Platform Tier 1+2 Patches

**Branch:** `eoma-main`
**Date:** 2026-04-26
**EOMA companion PR:** `feature/social-mgmt-sprint-3-platforms`
**Patch budget:** ~11 hours (Phase B from Sprint 3 architect blueprint)

## Overview

Adds the missing per-platform settings fields that EOMA's composer needs to ship Tier 1+2 polish. All new fields are OPTIONAL on the DTO so they're forward-compatible with existing Postiz consumers. No Prisma migrations — every field lives inside the existing `Post.settings` JSON blob.

EOMA will inject the `__type` discriminator (e.g., `__type: 'instagram'`) inside its `posts.proxy.js` chokepoint so class-validator routes payloads to the correct DTO; that side of the work is owned by the EOMA-side coder.

## Per-platform changes

### X (twitter) — `libraries/nestjs-libraries/src/dtos/posts/providers-settings/x.dto.ts`

- **ADDED** `thread_finisher?: string` — `@IsOptional() @IsString() @MaxLength(280)`. Text appended to the last tweet in a thread. The X provider already reads `postDetails.thread_finisher` directly via an internal type; promoting the field to the public DTO so EOMA can ship it without class-validator stripping it.

### Instagram — `libraries/nestjs-libraries/src/dtos/posts/providers-settings/instagram.dto.ts`

- **ADDED** `alt_texts?: string[]` — `@IsOptional() @IsArray() @IsString({ each: true })`. One alt-text per media slide; provider iterates per upload.
- **ADDED** `location_id?: string` — `@IsOptional() @IsString()`. Instagram Graph API location id.
- **ADDED** `first_comment?: string` — `@IsOptional() @IsString() @MaxLength(2200)`. Auto-posted comment after the publish call resolves.
- **ADDED** `cover_frame_seconds?: number` — `@IsOptional() @IsNumber() @Min(0) @Max(60)`. Reel video timestamp (in seconds) used to derive the cover thumbnail.
- **ADDED** `is_reel?: boolean` — `@IsOptional() @IsBoolean()`. Explicit Reel signal (paired with `post_type: 'post'`). Architect Decision Q4: a server-side flag eliminates the fragile media-count / aspect-ratio inference path.

### Facebook — `libraries/nestjs-libraries/src/dtos/posts/providers-settings/facebook.dto.ts`

- **ADDED** `page_id?: string` — `@IsOptional() @IsString()`. When the Facebook account has multiple Pages, identifies which Page to post to. Required-when-multiple-pages on the EOMA side; optional on the DTO so single-page accounts remain valid.

### LinkedIn — `libraries/nestjs-libraries/src/dtos/posts/providers-settings/linkedin.dto.ts`

- **ADDED** `media_type?: 'text' | 'image' | 'document' | 'article'` — `@IsOptional() @IsIn([...])`.
- **ADDED** `document_url?: string` — `@IsOptional() @IsString()`. URL of the document asset after R2 upload, used when `media_type === 'document'`.

### YouTube — `libraries/nestjs-libraries/src/dtos/posts/providers-settings/youtube.settings.dto.ts`

- **ADDED** `category_id?: string` — `@IsOptional() @IsString()`. YouTube category id (e.g., `"22"` = People & Blogs).
- **ADDED** `is_short?: boolean` — `@IsOptional() @IsBoolean()`. Explicit Shorts flag (overrides aspect-ratio inference).

### WordPress — `libraries/nestjs-libraries/src/dtos/posts/providers-settings/wordpress.dto.ts`

- **ADDED** `status?: 'publish' | 'draft' | 'pending'` — `@IsOptional() @IsIn([...])`. Pairs with the WP provider patch below.
- **ADDED** `category_id?: number` — `@IsOptional() @IsNumber()`. WordPress category id.
- **ADDED** `tags?: string[]` — `@IsOptional() @IsArray() @IsString({ each: true })`.
- **ADDED** `slug?: string` — `@IsOptional() @IsString()`. Custom URL slug (provider currently always derives slug from title — leaving derivation in place for now; honoring this field is a future provider-side task).

### Reddit — `libraries/nestjs-libraries/src/dtos/posts/providers-settings/reddit.dto.ts`

- **ADDED** `nsfw?: boolean` on `RedditSettingsDtoInner` (per-subreddit `value` block) — `@IsOptional() @IsBoolean()`. Marks the submission NSFW.

### TikTok — UNCHANGED

TikTok's "commercial content disclosure" (organic / branded / paid) is handled in EOMA's proxy by mapping a single UI Select to the existing `brand_organic_toggle` + `brand_content_toggle` boolean pair. No DTO change. All other Tier 1 TikTok fields (`privacy_level`, `duet`, `stitch`, `comment`, `autoAddMusic`, `content_posting_method`) already exist on `TikTokDto`.

### WordPress provider — `libraries/nestjs-libraries/src/integrations/social/wordpress.provider.ts`

- **CHANGED** the WP-REST POST body's hardcoded `status: 'publish'` to `status: postDetails?.[0]?.settings?.status ?? 'publish'`. The default fallback preserves existing behavior; explicit `'draft'` or `'pending'` from the DTO now flow through to the `wp-json/wp/v2/<type>` endpoint.

## Upstream rebase notes

- All DTO additions are pure-additive `@IsOptional()` fields. If upstream Postiz lands a field with the same name and a different type, prefer the upstream type and remove the EOMA addition (defer to upstream); update the EOMA composer accordingly.
- The WordPress provider `status` line is the only behavior change. If upstream introduces a draft/pending feature themselves, drop our patch and adopt theirs.
- The Reddit `nsfw` field lives on `RedditSettingsDtoInner` (per-subreddit value), not on the top-level `RedditSettingsDto`. Preserve that placement on rebase — the provider iterates `subreddit[].value` for each sub.

## Companion EOMA changes

Tracked in EOMA PR `feature/social-mgmt-sprint-3-platforms`:
- `src/modules/social/components/composer/platform-settings/*` — 4 new components, 4 extended.
- `src/modules/social/api/posts.proxy.js` — `__type` discriminator injection + TikTok `content_disclosure` → `brand_*_toggle` Transform.
- `src/modules/social/utils/platform-config.js` — Tier 1+2 field map.
- `src/modules/social/hooks/useComposerValidation.js` — `required_when_matrix` enforcement.

## Verification

```bash
cd /Users/suleymanozdas/Projects/eoma-projects/postiz-fork
pnpm install --frozen-lockfile --prefer-offline
pnpm exec tsc --noEmit -p libraries/nestjs-libraries
```

Type-check is the canonical gate — class-validator decorators are runtime metadata only and have no compile-time tests.
