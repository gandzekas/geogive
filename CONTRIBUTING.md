# Contributing to GeoGive

Thank you for your interest in contributing! This document outlines how to get involved.

## Code of Conduct

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, inclusive, and constructive.

## How to Contribute

### Reporting Bugs

1. Check if the bug is already reported in [Issues](https://github.com/gandzekas/geogive/issues)
2. If not, open a new issue using the **Bug Report** template
3. Include:
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/device info
   - Screenshots if applicable

### Suggesting Features

1. Open an issue using the **Feature Request** template
2. Describe the feature and why it would be valuable
3. Include mockups or examples if possible

### Code Contributions

#### Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/geogive.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Set up your environment (see README.md)

#### Development Guidelines

- **No build step required** — This is a vanilla JS PWA. Just edit files and refresh.
- **Keep it vanilla** — No frameworks, no bundlers. The app uses ES modules natively.
- **Preserve offline-first** — All new features should work offline or degrade gracefully.
- **Mobile-first** — Design for small screens first, then enhance for desktop.
- **Accessibility** — Use semantic HTML, ARIA labels, keyboard navigation.
- **No tracking** — Do not add analytics, tracking pixels, or data collection.

#### Code Style

- Use `const` and `let`, never `var`
- Use arrow functions for callbacks
- Use template literals for string interpolation
- Use async/await over .then() chains
- Keep functions small and focused (one responsibility)
- Comment complex logic, not obvious code
- Use CSS custom properties for theming

#### File Organization

| File                 | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `js/config.js`       | Configuration constants only              |
| `js/utils.js`        | Pure utility functions                    |
| `js/app.js`          | Entry point, initialization, global state |
| `js/auth.js`         | Authentication-related code               |
| `js/items.js`        | Item CRUD operations                      |
| `js/ui.js`           | UI rendering and interaction              |
| `css/variables.css`  | Theme variables only                      |
| `css/components.css` | Reusable UI components                    |

#### Testing

- Test in Chrome, Firefox, and Safari
- Test on mobile (iOS Safari, Android Chrome)
- Test offline mode (DevTools → Network → Offline)
- Test with slow connections (DevTools → Network → Slow 3G)

#### Submitting a PR

1. Ensure your code follows the guidelines above
2. Update documentation if needed
3. Write a clear PR description explaining what and why
4. Reference any related issues
5. Wait for review and address feedback

## Project Structure Notes

### JavaScript Modules

The app uses vanilla JavaScript files loaded as normal scripts. Each module has a clear responsibility:

- **app.js** — Initializes everything, manages global state, handles DOM events
- **config.js** — Reads Supabase credentials from environment, defines app constants
- **auth.js** — All Supabase Auth operations
- **items.js** — Item CRUD with offline queue
- **ui.js** — All DOM manipulation and rendering
- **map.js** — Leaflet map operations
- **geo.js** — Geolocation API and distance math
- **chats.js** — Real-time messaging
- **requests.js** — Item request flow
- **images.js** — Client-side image compression
- **profile.js** — User profiles, blocking, reporting
- **notifications.js** — Local in-app notification state helper
- **offline.js** — Offline action queue
- **router.js** — Page navigation
- **utils.js** — Shared utility functions

### CSS Architecture

- **variables.css** — Design tokens (colors, spacing, shadows)
- **base.css** — Reset and base element styles
- **layout.css** — Header, navigation, page structure
- **components.css** — Buttons, cards, modals, forms, chat
- **map.css** — Map-specific styles

### Database

- All schema changes go in `supabase-migration.sql`
- Use idempotent SQL (IF NOT EXISTS, DO $$ blocks)
- Document any new tables or columns

## Questions?

Open an issue with the `question` label or reach out to the maintainers.

Thank you for making GeoGive better! 🎁
