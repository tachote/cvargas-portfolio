import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { readdirSync, readFileSync } from "node:fs";

// Draft slugs never go in the sitemap, even in DRAFTS=1 preview builds.
const blogDir = new URL("./src/content/blog/", import.meta.url);
const draftSlugs = new Set(
  readdirSync(blogDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => /^draft:\s*true\s*$/m.test(readFileSync(new URL(f, blogDir), "utf8").split(/^---\s*$/m)[1] ?? ""))
    .map((f) => f.replace(/\.md$/, "")),
);
const excluded = (page) => {
  const path = new URL(page).pathname;
  if (path.startsWith("/play")) return false; // game-only redirect route (noindex)
  if (path.startsWith("/404")) return false;
  const m = path.match(/^\/blog\/([^/]+)\/?$/);
  return !(m && draftSlugs.has(m[1]));
};

// Prism emits class names (no inline style attrs) so CSP can stay without 'unsafe-inline'.
export default defineConfig({
  site: "https://cvargas.com",
  integrations: [sitemap({ filter: excluded })],
  build: { inlineStylesheets: "never" },
  experimental: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "img-src 'self'",
        "font-src 'self'",
        "connect-src 'self'",
        "form-action 'none'",
      ],
    },
  },
  markdown: { syntaxHighlight: "prism" },
});
