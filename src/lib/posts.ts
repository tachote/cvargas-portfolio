import { getCollection } from 'astro:content';
// Drafts only render when DRAFTS=1 (preview). Production builds skip them.
export const SHOW_DRAFTS = process.env.DRAFTS === '1';
export const posts = async () =>
  (await getCollection('blog', (p) => SHOW_DRAFTS || !p.data.draft)).sort((a, b) => b.data.date.localeCompare(a.data.date));
