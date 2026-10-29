# Deploy (nginx + cloudflared)

1. Build production output (never with `DRAFTS=1`, that would publish drafts):

   ```sh
   npm ci
   npx astro build
   ```

2. Copy `dist/` to the nginx root:

   ```sh
   rsync -a --delete dist/ /usr/share/nginx/html/
   ```

3. Install the config:
   - `deploy/security-headers.conf` → `/etc/nginx/snippets/security-headers.conf`
   - `deploy/nginx.conf` → `/etc/nginx/conf.d/cvargas.conf`
   - `nginx -t && nginx -s reload`

4. Point the cloudflared tunnel ingress for `cvargas.com` at `http://localhost:80`.

Headers in `security-headers.conf` mirror `public/_headers` (used by Cloudflare Pages); change both together.
The page-level CSP (script/style hashes) is emitted by Astro as a `<meta>` tag in each HTML file; the header CSP only adds directives a meta tag cannot express.
