import { createApp } from '../src/app';

// This is the single serverless function for the whole app - backend/vercel.json
// rewrites every incoming path to here (the [...path].ts bracket catch-all
// convention didn't reliably match multi-segment paths for a plain Node.js
// project, so we route explicitly instead). Express still sees the original
// request path/URL, so its own routing (/api/auth, /api/uploads, etc.) is
// unaffected. Unlike src/index.ts, this must NOT call app.listen(): Vercel
// invokes the exported handler per-request instead of running a server.
export default createApp();
