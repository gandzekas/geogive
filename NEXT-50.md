# GeoGive — Next 50 Tasks (v2.1 work plan)

Generated 2026-08-21. Grounded in: repo state (main @ 939db6b), June 2026 honest-status audit,
and the fact that all 50 original milestones are code-complete but the app is still a
localStorage single-player demo. The #1 gap: **no real backend**.

## Phase 0 — Ship hygiene (do first)
1. Commit + push dirty working tree (assetlinks consolidation, privacy.html is untracked)
2. Verify live GitHub Pages serves latest commit (last-modified check; stale-cache fix if not)
3. Full static suite green: `node -c` all JS, html-validate, `node test_app.js`
4. Lighthouse CI run — fix any category below threshold
5. Playwright E2E suite green — fix failing specs
6. Bump SW cache version + all `?v=` cache-bust params on next deploy
7. Repo cleanup: tmp/, logs/, committed APK binaries — gitignore or remove

## Phase 1 — Real backend: become multi-user (THE mission)
8. Diff `supabase-migration.sql` schema vs every `sb.from()` call in JS; fix column mismatches
9. Apply migration to Supabase project (verified apply script or dashboard SQL)
10. Wire items.js CRUD → Supabase (localStorage stays as offline fallback)
11. Wire requests.js → Supabase
12. Wire chats.js → Supabase + Realtime channel subscription
13. Follow system → Supabase (real cross-device follows)
14. Feed.js → query followed users' items from DB
15. Ratings → Supabase upsert + server-side trust score recompute
16. Reports → Supabase inserts (real moderation queue)
17. Collections → Supabase
18. Notifications → Supabase rows + realtime badge updates
19. Photo uploads → Supabase Storage bucket + storage policies
20. RLS policy audit: owner-only writes, public reads where intended, all 9 tables
21. Profile auto-create via DB trigger on signup (not client-side)
22. Offline queue replay → actually syncs to Supabase when back online

## Phase 2 — Push & real-time
23. Generate VAPID keypair; public key into app config
24. Push subscription endpoint (Edge Function storing push tokens)
25. Edge Function: send web-push on new message/request/rating
26. Typing indicators via Supabase Realtime broadcast (replace local fake)
27. Per-user online/offline presence

## Phase 3 — Money for real
28. Stripe checkout session via Edge Function (promoted listings)
29. Stripe webhook → auto-promote item for 24h on payment
30. GeoGive Pro: real Stripe Billing subscription + DB-backed entitlement check
31. Referral attribution captured in DB at signup (`?ref=` handling)

## Phase 4 — Growth & launch prep
32. Working OG/social preview tags (GitHub Pages caveat — prerender or workaround)
33. Play Store listing copy: title, short + full description
34. Auto-generate Play Store screenshots via Playwright with phone frames
35. Feature graphic + full icon set generated from existing brand icons
36. Play Data Safety form answers drafted (privacy-first mapping)
37. Privacy policy at stable public URL (commit privacy.html, verify served)
38. Press kit page: logo, screenshots, boilerplate, founder blurb
39. Product Hunt launch draft: tagline, description, maker comment
40. Launch posts drafted: r/lithuania, relevant giveaway/sharing subreddits
41. In-app invite sheet: deep link carrying referral code

## Phase 5 — Quality & hardening round 2
42. Accessibility pass: ARIA labels on all interactive elements, modal focus traps
43. i18n coverage beyond Settings: browse, item cards, chat strings
44. Global error boundary: window.onerror → friendly toast + detailed console log
45. Client-side rate limits on posting/reporting (spam prevention)
46. Strip GPS EXIF from photos before upload (privacy)
47. Skeleton loaders + empty states for browse/feed/chat
48. First-run onboarding tour (3-step overlay)
49. Privacy-first usage stats: anonymous local counters, exportable on demand
50. Consolidate all above into ROADMAP-V2 tracking doc with checkboxes

## Blockers needing user action (flagged when reached)
- Supabase project credentials (if none exist yet) — Phases 1–3
- Stripe account + keys — Phase 3
- Play Console developer account ($25) — store publishing
- Real human testers — M10/M30 validation
