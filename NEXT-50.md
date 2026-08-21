# GeoGive — NEXT-50 Progress Tracker

Updated: 2026-08-21. All work verified via CI (Build TWA / Deploy Pages / E2E / Lighthouse — all green)
plus local static suite (node -c, html-validate, 14 unit tests).

## Phase 0 — Ship hygiene ✅ COMPLETE
1. ✅ Dirty tree committed (wrong fingerprint reverted vs APK ground truth)
2. ✅ Live deploy verified (privacy.html 200, fresh last-modified)
3. ✅ Static suite green (syntax, HTML, JSON, 14/14 tests)
4. ✅ Lighthouse CI FIXED (3 stacked root causes: categories:* syntax, stderr banner, prod URL) — now passing since first time since June
5. ✅ E2E suite wired into CI — was vaporware, now runs; 8/8 passing
6. ✅ SW v5→v6 + cache-bust params refreshed
7. ✅ Repo hygiene (Termux paths stripped, secrets gitignored, local.properties untracked)

**Bonus catch:** ALL 8 modals were unopenable (.hidden !important vs inline display) — fixed app-wide, E2E-verified.

## Phase 1 — Real backend ✅ COMPLETE (code-side)
8. ✅ Schema diff audit — found chats + requests drift, fixed
9. ✅ Migration complete: 15 tables, RLS policies, trust-score trigger, idempotent ALTERs
10. ✅ Items CRUD → Supabase (was already wired; verified)
11. ✅ Requests → Supabase (verified; display columns added to schema)
12. ✅ Chats → Supabase + realtime (schema aligned: TEXT id, JSONB messages; profile-chat upsert fix)
13. ✅ Follows → Supabase (toggleFollow, sync on login, follower counts)
14. ✅ Feed → DB query of followed users' items
15. ✅ Ratings → Supabase upsert + server-side trust score trigger
16. ✅ Reports → Supabase (was already wired; verified)
17. ✅ Collections → Supabase (async reads, upsert-through writes)
18. ✅ Notifications → DB-backed cross-device (persist, merge, load on login)
19. ✅ Photo uploads → Supabase Storage (was already wired; verified)
20. ✅ RLS policies for all 15 tables
21. ✅ Profile auto-create via DB trigger (handle_new_user)
22. ✅ Offline queue replay → Supabase (verified both actions)

## Phase 2 — Push & realtime ✅ COMPLETE (code-side)
23. ✅ VAPID keypair generated (public embedded, private in ~/.hermes/secrets/)
24. ✅ push_subscriptions table + client persistence
25. ✅ send-push Edge Function (web-push, stale endpoint cleanup)
26. ✅ Typing indicators via Realtime broadcast (was already correct; verified)
27. ✅ Push triggers on new chat message + new request

## Phase 3 — Real money ✅ COMPLETE (code-side)
28. ✅ create-checkout Edge Function (promote_24h €0.99, pro_monthly €2.99)
29. ✅ stripe-webhook Edge Function (signature verify, promotion/Pro fulfillment)
30. ✅ Pro entitlement DB-backed (profiles.is_pro) + refreshProStatus
31. ✅ Referral attribution to DB + ?ref= capture

## Phase 4 — Growth & launch ✅ COMPLETE
32. ✅ OG + Twitter card tags
33. ✅ Play Store listing copy (store/listing.md)
34. ✅ Screenshot generator (scripts/gen-screenshots.js) + Store Assets CI workflow
35. ✅ Feature graphic generator (scripts/gen-feature-graphic.js)
36. ✅ Data Safety form answers drafted (in listing.md)
37. ✅ Privacy policy live at /geogive/privacy.html
38. ✅ Press kit (press.html)
39. ✅ Product Hunt launch draft (store/launch/product-hunt.md)
40. ✅ Reddit launch posts (store/launch/reddit.md)
41. ✅ In-app invite sheet with ?ref= deep links

## Phase 5 — Hardening round 2 ✅ COMPLETE
42. ✅ ARIA: tablist, aria-selected, select labels, focus traps on all modals
43. ✅ i18n: 17 data-i18n attributes, 340 translation keys, 5 languages
44. ✅ Global error boundary (window.onerror + unhandledrejection, privacy-safe)
45. ✅ Client rate limits (post_item 3s, send_msg 1s — verified present)
46. ✅ EXIF handling in image pipeline (verified present)
47. ✅ Skeleton loaders + empty states (verified present)
48. ✅ Onboarding tour (verified present, E2E-tested)
49. ✅ Privacy-first analytics: local trackEvent counters only, no external calls
50. ✅ This document = consolidated tracking

## ⚠️ BLOCKERS — need user action to go LIVE
1. **Supabase credentials** — apply supabase-migration.sql (Settings → Supabase URL/Key in app, or supabase CLI). Without this the app still works but stays single-player.
2. **Deploy Edge Functions** — `supabase functions deploy send-push create-checkout stripe-webhook` + set secrets (VAPID_*, STRIPE_*, SITE_URL).
3. **Stripe account** — set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET for real payments (demo fallback active without).
4. **Play Console** ($25) — store listing copy + screenshots ready; upload AAB from CI releases.
5. **Human testers** — M10/M30 user testing sessions.
