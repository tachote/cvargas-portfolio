# AGENTS.md — rules for coding agents (Codex, etc.)

Read `DESIGN.md` (visual rules) and `CONTENT.md` (content rules) before changing anything.

## Stack
- Astro 5, fully static. Deployed to Cloudflare Pages (`npm run build` → `dist/`).
- Node 20+. `npm ci && npm run build`. Preview drafts: `DRAFTS=1 npx astro build`.

## Hard rules
- Data lives in `src/data/*.json` / `src/data/cves.ts`. Never hardcode counts or numbers in templates.
- Do not add/remove/edit CVEs, certs, awards or skill levels without Cristian's confirmation.
- Gothic skin is the only theme. Hero: avatar only, no counts, no certs.
- The game (`src/scripts/vgate.*`) is opt-in via PRESS START only, lazy-loaded via dynamic `import()`. Never auto-start it (except `#play` hash) and never block first paint.
- Respect `prefers-reduced-motion`.
- CSP: no `unsafe-inline`. No inline `style=""` attributes, no inline event handlers, no third-party scripts, embeds or thumbnails. Code highlighting stays on Prism (class-based).
- Blog posts in `src/content/blog/` with `draft: true` must never be linked or built in production.
- Copy is in English. Assets must be original or freely licensed.

## Before you open a PR
- `npm run build` passes with no warnings you introduced.
- Check desktop and ≤600px mobile; no horizontal scroll.
