# Continuum Academy

An executive online-learning platform delivered as a **100% static, installable PWA** (plain HTML/CSS/JS — no build step). Members browse disciplines, watch video masterclasses, and keep a personal library.

## How it runs

The application is **100% client-side**. Sessions, likes, saved titles, and watch position live client-side in `localStorage` and `IndexedDB`. Any valid email + an 8-character password signs in.

## Project structure

Pages are **one folder deep, one folder per route** so each URL is clean (`/login/`, `/home/`, …). This layout is what the service worker and PWA install depend on — page folders are intentionally flat, not grouped by type.

```
.
├── index.html              # Root entry: redirects to /home/ or /login/
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker (offline shell + caching rules)
├── _headers                # Netlify / Cloudflare Pages security headers
│
├── login/                  # Sign in
├── signup/                 # Create account
├── forgot-password/        # Request a password reset
├── reset-password/         # Choose a new password
├── home/                   # Member landing (hero, continue watching, player)
├── explore/                # Free discipline preview
├── disciplines/            # All disciplines (listing)
├── discipline/             # Single discipline (detail)
├── library/                # My Library (saved titles)
├── search/                 # Search
├── clips/                  # Vertical trailer clips
├── profile/                # My Account
├── admin/                  # Admin (Beta) content authoring
│
├── assets/
│   ├── css/                # Stylesheets (one per page + shared theme/user-menu)
│   ├── js/                 # App scripts
│   │   └── data/           # catalogue.js, disciplines.js, library.js
│   ├── images/             # Icons, logos, thumbnails
│   └── videos/             # Sample / uploaded video files
│
└── .vscode/                # Local dev server (serve.py) + debug configs
```

### Path convention

Because every page sits one folder deep, all references are written relative to that level: `../assets/...` for static files and `../login/`, `../home/`, etc. for navigation. The same route list is mirrored in three places that must stay in sync when a page is added or moved:

- [`sw.js`](sw.js) — the `SHELL` precache array
- [`assets/js/config.js`](assets/js/config.js) — `loginPath` / `homePath` / `profilePath`
- [`_headers`](#headers) — caching rules for `sw.js` and the manifest

## Running locally

No install required. Serve the project root so `/login/` style URLs resolve and video Range requests work:

```bash
python3 .vscode/serve.py 8080
```

Then open http://localhost:8080/. In VS Code you can also use **Run and Debug** (`.vscode/launch.json`) for the Login, Home, or Clips pages.

## Deploying

Static hosting of the repo root. Use **Netlify** or **Cloudflare Pages** so the security headers in `_headers` are applied; GitHub Pages cannot set headers and is not recommended for member content.

## Conventions

- Folder and file names: lowercase kebab-case.
- The root folder is named `continuum-academy`.
- `.DS_Store`, dated files under `_backup/`, local env files, and dependency folders are ignored (see `.gitignore`).
