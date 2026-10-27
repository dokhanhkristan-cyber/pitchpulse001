# PITCH PULSE — Cloudflare Workers Free Edition

This edition replaces the Node.js HTTP server with a Cloudflare Worker and a SQLite-backed Durable Object. It preserves the UI, rooms, PINs, $0–10M investments, Host reveal, countdown and results. The frontend polls every 1.2 seconds for room updates instead of maintaining an SSE connection.

## Deploy from GitHub (no Render)

1. Create a NEW GitHub repository, e.g. `pitchpulse-cloudflare`. Upload **all contents** of this folder, including `src/worker.js`, `public/`, `wrangler.jsonc` and `package.json` (preserve folder structure).
2. Sign in at https://dash.cloudflare.com/ and go to **Workers & Pages** > **Create application** > **Import a repository** (Workers Git integration; labels may change).
3. Connect GitHub, choose the repository, use build command `npm install` (or leave build blank if Cloudflare installs dependencies), deploy command `npx wrangler deploy`. Root directory `/`.
4. Deploy. Open the generated `https://<worker-name>.<subdomain>.workers.dev` URL on iPad. Both Host and teams use the same URL.
5. If the dashboard does not offer Git import, from a computer with Node.js run `npm install`, `npx wrangler login`, `npx wrangler deploy` in this folder. The deployment is hosted on Cloudflare; the computer need not remain running.

## Notes
- Cloudflare's free Workers plan has usage limits. Durable Objects with SQLite-backed storage are supported on the free plan subject to limits; check Cloudflare's current pricing and eligibility before an event.
- Rooms are persistent in Durable Object storage. Session tokens are stored as well. This is a classroom/demo application, not a hardened financial product.
- Test with two browser devices before presenting. The countdown lasts 7.5 seconds. Polling can add ~1.2 seconds to the visible reveal update.
- No domain purchase is required. Do not upload your old `server.js` as the Worker entrypoint.
