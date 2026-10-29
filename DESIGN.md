# DESIGN.md — cvargas.com

Owner: Diseño. Read this before changing UI. If a task conflicts with a rule here, stop and ask.

## Non-negotiables
- **Gothic is the only theme.** No light/vanilla theme, no theme toggle. `data-theme="gothic"` is fixed.
- **Hero stays clean:** name, role, tagline, links, PRESS START, avatar. No numbers (no CVE count, no stats) and no certs in the hero.
- **The game is opt-in only.** It never auto-starts. It loads via dynamic `import()` only on PRESS START or `#play`. Any other hash skips it. Skip/Esc always exit. `prefers-reduced-motion` disables it.
- **Recruiter scan in 20–30 s.** CVEs must be in the static HTML from first paint (ATS/SEO), not injected by JS.
- **Strict CSP:** no inline `<script>` or `style=""` attributes, and no inline styles from libraries (Prism uses classes).
- **`prefers-reduced-motion`** disables parallax, sprites, animations and the game.
- **Original art only.** No Konami/Castlevania or poncle/Vampire Survivors assets, names or logos.
- **Data vs code:** content lives in `src/data/*.json` and `src/content/blog/*.md` (edited by Flip). Code never hardcodes numbers that come from data (counts, skill levels).
- **Avatar** (`public/fx/avatar-hunter*`) must sit on `--bg` (#0E0A12); the whip loop keeps that color. Never on a light background.

## Tokens (src/styles.css)
| token | value | use |
|---|---|---|
| `--bg` | #0E0A12 | page |
| `--surface` | #1A1220 | cards, tables |
| `--surface-2` | #22182A | code blocks, hover |
| `--border` | #3A2A44 | 1px borders, empty skill pips |
| `--text` | #EDE6D6 | body |
| `--muted` | #9A8FA3 | meta, captions |
| `--accent` | #C9A227 | gold: links, H2 subtitles, filled pips |
| `--blood` | #B0213A | crit, payloads |
| `--sev-crit/high/med/low` | #B0213A / #D9542B / #C9A227 / #6E8F5A | CVSS |

## Type
- **Inter**: body and headings. **JetBrains Mono** (`JBMono`): IDs, tables, meta, stats. **Pixelify Sans** (`Pixel`): H2 subtitles, game, small labels only.
- H2 pattern: plain term first, then a gothic subtitle in Pixel + `--accent`: `CVEs & Advisories · Bestiary`.

## Layout
- Single column, max ~720px (blog articles 680px, Inter 18/1.7). Hero has a 220px right column for the framed avatar; on ≤600px it shrinks to 96px next to the name.
- Section order: Hero → CVEs & Advisories · Bestiary → Awards · Trophies → Writing · Grimoire → Talks · Transmissions → Skills · Attributes → Certifications · Relics → Contact · Save Room.
- Skills: 10 pixel pips per row (filled `--accent`, empty `--border`), number, `--muted` evidence; "Self-assessed, 1–10" caption.
- Mobile: CVE table becomes stacked cards. No horizontal scroll (`body{overflow-x:clip}`).

## Code highlighting (Prism, classes only)
bg `--surface-2` · keyword `--accent` · string #6E8F5A · number/payload `--blood` · comment `--muted` italic · function #D9542B · rest `--text`.

## QA before merging UI changes
Screenshot 1280×800 and 390×844 for `/`, `/#skills`, `/#play` and one `/blog/*` post; console must have zero errors; no horizontal scroll.
