# GeoGive — Location-Based Giveaway PWA

Give away items to people near you. Free, local, no hassle.

## What is GeoGive?

GeoGive is a progressive web app that lets you browse and post free items on a map. See what's available nearby, request items from neighbors, and declutter your life — all without fees, ads, or catches.

## Features

- **Map-based browsing** — See free items plotted on an interactive map (Leaflet + OpenStreetMap)
- **Post items** — List items with photos, descriptions, categories, and conditions
- **Request system** — Request items and coordinate pickups via built-in chat
- **Real-time updates** — New items and messages appear instantly (Supabase Realtime)
- **Push notifications** — Get notified when someone requests your item or replies to your chat
- **User profiles** — Customize your avatar, bio, and reputation
- **Offline-first** — Queue actions when offline, sync when back online
- **Image compression** — Automatic client-side image optimization before upload
- **Safe interactions** — Block users, report content, safety tips
- **Android app** — TWA wrapper for Google Play Store distribution
- **Privacy-respecting** — No tracking, no ads, no data selling

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES modules), CSS3, HTML5 |
| Map | Leaflet 1.9 + OpenStreetMap tiles |
| Backend | Supabase (PostgreSQL + PostGIS) |
| Auth | Supabase Auth (Email, Google OAuth) |
| Storage | Supabase Storage (item photos) |
| Realtime | Supabase Realtime subscriptions |
| Push | Firebase Cloud Messaging (FCM) |
| Mobile | Trusted Web Activity (TWA) for Android |
| CI/CD | GitHub Actions |
| Deploy | GitHub Pages |

## Quick Start

### Prerequisites

- Node.js 18+ (for dev server only — the app itself is vanilla JS)
- A Supabase project (free tier works)
- A Firebase project (for push notifications)

### 1. Clone & install

```bash
git clone https://github.com/gandzekas/geogive.git
cd geogive
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Edit .env.local with your Supabase and Firebase credentials
```

### 3. Set up the database

Run the SQL migration in your Supabase SQL Editor:

```bash
cat supabase-migration.sql
# Copy the output and paste it into Supabase SQL Editor
```

### 4. Run locally

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: Node.js
npx serve .

# Option 3: VS Code Live Server extension
```

Open `http://localhost:8080` in your browser.

### 5. Deploy

Push to GitHub → GitHub Pages serves it automatically. No build step needed.

## Project Structure

```
geogive/
├── index.html              # Main HTML entry point
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline cache)
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
├── README.md               # This file
├── CONTRIBUTING.md         # Contribution guidelines
├── CODE_OF_CONDUCT.md      # Community conduct rules
├── supabase-migration.sql  # Full database schema
├── css/
│   ├── variables.css       # CSS custom properties
│   ├── base.css            # Reset, body, typography
│   ├── layout.css          # Header, nav, pages
│   ├── components.css      # Cards, buttons, modals, forms
│   └── map.css             # Map container, popups
├── js/
│   ├── app.js              # Entry point, init, global state
│   ├── config.js           # App configuration (Supabase URL, constants)
│   ├── utils.js            # Utility functions (escHtml, truncate, etc.)
│   ├── geo.js              # Geolocation, distance calculations
│   ├── map.js              # Leaflet map, markers, filtering
│   ├── auth.js             # Supabase auth, login/logout, Google OAuth
│   ├── items.js            # Item CRUD, offline support
│   ├── requests.js         # Item request system
│   ├── chats.js            # Real-time chat between users
│   ├── images.js            # Image compression, preview, upload
│   ├── ui.js               # UI components (cards, modals, toasts)
│   ├── profile.js          # User profiles, reports, blocking
│   ├── notifications.js    # Push notifications, FCM
│   ├── offline.js          # Offline action queue
│   └── router.js           # Page navigation
├── android/                # Android TWA wrapper
│   ├── README.md           # TWA build instructions
│   ├── PLAY_STORE_LISTING.md # Play Store listing template
│   ├── build-release.sh    # Build script
│   ├── generate-signing-key.sh # Key generation
│   ├── twa-manifest.json   # TWA configuration
│   ├── app/                # Android project source
│   └── ...
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md
    │   └── feature_request.md
    └── workflows/
        └── ci.yml          # CI/CD pipeline
```

## Database Schema

The app uses Supabase with the following tables:

| Table | Purpose |
|-------|---------|
| `profiles` | User display names, avatars, bios |
| `items` | Giveaway listings with geo coordinates |
| `photos` | Item photo URLs (linked to items) |
| `requests` | Item request messages |
| `chats` | Private messages between users |
| `notifications` | Push notification history |
| `reports` | User-submitted content reports |
| `ratings` | User reputation ratings |
| `blocked_users` | User block list |

See `supabase-migration.sql` for the complete schema.

## Configuration

The app reads configuration from environment variables at build time. For GitHub Pages deployment, it falls back to prompts.

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous key |
| `VAPID_KEY` | No | FCM VAPID key for push notifications |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to contribute:

- 🐛 **Report bugs** — Open an issue with the bug report template
- 💡 **Suggest features** — Open an issue with the feature request template
- 📝 **Improve docs** — Fix typos, add examples, clarify instructions
- 🎨 **Fix UI issues** — Responsive bugs, accessibility improvements
- ⚡ **Add features** — Pick an open issue and submit a PR
- 🧹 **Refactor** — Clean up code, improve performance

### Development workflow:

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make changes, test locally
4. Commit: `git commit -m "Add my feature"`
5. Push: `git push origin feature/my-feature`
6. Open a PR

## Roadmap

- [ ] iOS Safari push notifications
- [ ] Image carousel on item cards
- [ ] Email notifications (Supabase Edge Functions)
- [ ] Admin moderation panel
- [ ] Item favorites/watchlist
- [ ] Expiration date reminders
- [ ] Multi-language support
- [ ] Accessibility audit (WCAG 2.1 AA)

## License

MIT — See [LICENSE](LICENSE) for details.

## Credits

Built with ❤️ using [Supabase](https://supabase.com), [Leaflet](https://leafletjs.com), and [OpenStreetMap](https://openstreetmap.org).
