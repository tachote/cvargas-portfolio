import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: z.object({
    title: z.string(), date: z.string(), summary: z.string().optional(),
    lang: z.string().default('en'), medium_url: z.string().optional(),
    related_cve: z.string().optional(), draft: z.boolean().default(false),
  }),
});
export const collections = { blog };
