# GeoGive Roadmap

**Current State:** MVP → Production-ready PWA + Android TWA with Supabase backend. All 5 phases implemented. 25/25 roadmap tasks complete. 14 unit tests passing.

---

## Phase 1: Stability & Polish (Week 1-2)

The foundation needs to be rock-solid before adding features.

### 1.1 Input Sanitization Audit
- **Issue:** `escHtml()` is used in some places but `innerHTML` is still used heavily in profile.js, chats.js, items.js
- **Why:** XSS vulnerability
- **Action:** Audit all `innerHTML` assignments, ensure all user-generated content is escaped. Consider using `textContent` where possible.

### 1.2 Error Boundary Wrapper
- **Issue:** Most async calls have try/catch but errors silently fall to localStorage with no user feedback
- **Why:** Bad UX — users don't know when something fails
- **Action:** Create a global error handler that shows a toast + logs to console. Wrap all Supabase calls in a unified error handler.

### 1.3 Photo Compression Before Upload
- **Issue:** Currently uploads full base64 or blob, no resizing. 5 photos × multi-MB = slow/broken on mobile
- **Why:** Performance — mobile connections can't handle 5MB+ uploads
- **Action:** Add canvas-based image compression (max 1280px wide, JPEG 0.7 quality) before upload.

### 1.4 Pull-to-Refresh on Browse
- **Issue:** No way to refresh items without reloading the page
- **Why:** Mobile UX expectation
- **Action:** Add touch-based pull-to-refresh on the browse page.

### 1.5 Loading Skeletons
- **Issue:** Generic spinner for all loading states
- **Why:** Perceived performance — skeletons feel faster
- **Action:** Add skeleton placeholders for item list, chat messages, profile.

### 1.6 Offline Indicator States
- **Issue:** connIndicator exists but only shows online/offline, no "syncing..." state
- **Why:** UX clarity
- **Action:** Add three states: online, offline, syncing (with animation).

---

## Phase 2: Core Feature Gaps (Week 3-4)

Features that are half-built or missing that users expect.

### 2.1 Real-time Chat
- **Issue:** Messages are stored in localStorage, not synced via Supabase Realtime. Two users chatting see nothing unless they refresh
- **Why:** Broken core feature
- **Action:** Integrate Supabase Realtime subscriptions for the chats table. Replace localStorage chat sync with realtime channel.

### 2.2 Push Notifications
- **Issue:** notifications.js is a stub (13 lines). No Supabase Realtime subscription for new messages/requests
- **Why:** Missing core feature
- **Action:** Subscribe to Realtime events, show browser Notification API alerts for new messages and requests.

### 2.3 Item Expiration Automation
- **Issue:** Items expire after 30 days but no cron/job marks them expired
- **Why:** Data quality — expired items still show as available
- **Action:** Create a Supabase Edge Function that runs daily to mark expired items, OR add client-side filtering on load.

### 2.4 Server-side Search
- **Issue:** Search is client-side only — loads all items then filters. Fine for 50 items, breaks at 500+
- **Why:** Scalability
- **Action:** Move search to Supabase query with `ilike` or full-text search on title/description.

### 2.5 Category Icons in Map Markers
- **Issue:** All markers look the same regardless of category
- **Why:** UX — users can't scan map for what they want
- **Action:** Use custom Leaflet divIcons with category emoji/color per marker.

### 2.6 "My Listings" Empty State
- **Issue:** No CTA to post first item when list is empty
- **Why:** Onboarding — new users see blank page
- **Action:** Add empty state with illustration + "Post your first item" button.

---

## Phase 3: Trust & Safety (Week 5-6)

Needed before any public launch.

### 3.1 Verified User Badge
- **Issue:** No way to distinguish trusted users
- **Why:** Trust — users want to know who they're dealing with
- **Action:** Add email verification check via Supabase, show verified badge on profile and items.

### 3.2 Report Review Queue
- **Issue:** Reports are stored but no admin UI to review/take action
- **Why:** Safety gap — reports go nowhere
- **Action:** Create an admin page (protected by role) to review, dismiss, or act on reports.

### 3.3 Block List Server-side Enforcement
- **Issue:** Blocked users are stored in localStorage but not enforced server-side
- **Why:** Bug — a blocked user can still see your items and message you
- **Action:** Add Supabase RLS policies to filter out blocked users' content.

### 3.4 Auto-flag Items with Multiple Reports
- **Issue:** No automated response to reported items
- **Why:** Abuse prevention
- **Action:** Auto-hide items with 3+ reports, add to review queue.

### 3.5 Meetup Safety Tips Modal
- **Issue:** Exists as a toast, should be a proper checklist
- **Why:** User safety — this is important information
- **Action:** Create a proper modal with safety tips shown before first transaction and accessible from settings.

---

## Phase 4: Growth & Retention (Week 7-8)

Turn users into repeat users.

### 4.1 Favorites / Watchlist
- **Issue:** No way to save items for later
- **Why:** Retention — users come back to check on saved items
- **Action:** Add favorites table in Supabase, heart icon on items, favorites page.

### 4.2 Share Item
- **Issue:** No way to share an item with others
- **Why:** Growth — viral loop
- **Action:** Use Web Share API for native mobile sharing with item title + link.

### 4.3 Onboarding Flow
- **Issue:** First-time user sees the app with no guidance
- **Why:** Activation — users need to understand the flow
- **Action:** 3-step walkthrough overlay: browse → post → chat. Dismissable, shown once.

### 4.4 Recently Viewed
- **Issue:** No history of viewed items
- **Why:** Engagement — users can re-find items they looked at
- **Action:** Store last 20 viewed items in localStorage, show on browse page.

### 4.5 Notification Preferences
- **Issue:** No user control over notifications
- **Why:** Control — some users don't want notifications
- **Action:** Add settings toggle for: new messages, nearby items, none.

---

## Phase 5: Monetization & Scale (Month 3+)

Only after product-market fit is proven.

### 5.1 "Bump" Feature
- **Issue:** No revenue model
- **Why:** Sustainability
- **Action:** Pay to re-surface listing to top of browse for 24h.

### 5.2 Analytics Dashboard
- **Issue:** No visibility into app usage
- **Why:** Data-driven decisions
- **Action:** Track active items, requests, completion rate, DAU/MAU.

### 5.3 Multi-language Support
- **Issue:** English only
- **Why:** Scale — non-English markets
- **Action:** Add i18n with at least Spanish, French, German.

### 5.4 Build Pipeline Migration
- **Issue:** Shipping unminified vanilla JS
- **Why:** Performance at scale
- **Action:** Migrate to Vite + minification + tree-shaking + lazy loading.

---

## Tech Debt (Track Separately)

| Issue | Priority | Action |
|-------|----------|--------|
| No test suite | High | Add Vitest for core logic (normalizeItem, buildChatId, filter logic) |
| No TypeScript | Medium | Gradual migration to prevent regressions |
| localStorage bloat | Medium | Add LRU eviction for items, chats, profiles caches |
| Supabase credentials in localStorage | Low | Consider edge functions for sensitive operations |
| No CI/CD | Low | GitHub Actions for lint + test + build on push |

---

## Priority Order

1. Phase 1 (Stability & Polish)
2. Phase 2 items 2.1, 2.2 (Real-time chat, Push notifications)
3. Phase 3 (Trust & Safety)
4. Phase 2 remaining items
5. Phase 4 (Growth & Retention)
6. Phase 5 (Monetization & Scale)
