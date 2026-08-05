import { createApp } from '../src/app';

// Vercel's zero-config Node runtime maps this catch-all file to every request
// under /api/*, passing the request straight through unmodified - our Express
// app's own routes are already mounted at /api/auth, /api/uploads, etc., so no
// path rewriting is needed. Unlike src/index.ts, this must NOT call app.listen():
// Vercel invokes the exported handler per-request instead of running a server.
export default createApp();
