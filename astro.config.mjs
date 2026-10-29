import { defineConfig } from "astro/config";
// Prism emits class names (no inline style attrs) so CSP can stay without 'unsafe-inline'.
export default defineConfig({
  site: "https://cvargas.com",
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
