import { defineConfig } from 'astro/config';
// Prism emits class names (no inline style attrs) so CSP can stay without 'unsafe-inline'.
export default defineConfig({ site: 'https://cvargas.com', build: { inlineStylesheets: 'auto' }, markdown: { syntaxHighlight: 'prism' } });
