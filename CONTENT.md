# Content rules (cvargas.com)

Audience: recruiters (fast scan) first, AppSec peers second. Every claim must be verifiable.

## Source of truth
- All facts come from `src/data/*.json` and `src/content/blog/*.md`. No numbers, names, dates or titles hard-coded in components.
- Do not add, remove or edit CVEs, certifications, awards, talks or skill levels without Cristian's explicit confirmation.
- CVEs: every entry needs a working advisory URL. Keep short `vuln_class` labels (SQLi, XSS, SSRF, Auth bypass, IDOR) and put specifics in `detail`.
- Certs: `tier` (top/other/lang) and `confirmed` control rendering. Never show `credential_id`.
- Skills (`skills.json`) are self-assessed and must stay labeled that way. Each has an `evidence` taken from existing data, or `null`. Never invent evidence.
- Blog `related_cve` only when the post is about that exact bug. Otherwise `null`.

## Do not change
- Hero: name, role and one-line focus plus the avatar. No counts (CVEs, certs, CTFs) and no OSWE/CWEE in the hero.
- Plain-first H2s (e.g. "CVEs & Advisories · Bestiary"). The themed name is the subtitle, never the only label.
- All content stays in the HTML (SEO/ATS). The game is opt-in via PRESS START and never blocks the CV.
- Drafts (`draft: true`) are noindex and only build with `DRAFTS=1`. Publishing a post requires Cristian's OK.

## Tone
- English on the site, short and factual. No "passionate", "ninja" or other personal-brand filler.
- Awards and certifications are separate sections.
