import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { deploymentsRoute } from './routes/deployments.js';
import { logsRoute } from './routes/logs.js';
import { config } from './config.js';
import { reconcileCaddyRoutesFromDb } from './pipeline/reconcileCaddy.js';

const app = new Hono();

app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true }));
app.route('/api/deployments', deploymentsRoute);
app.route('/api/deployments', logsRoute);

(async () => {
  try {
    await reconcileCaddyRoutesFromDb();
  } catch (e) {
    console.error('[startup] Caddy route reconcile failed:', e);
  }

  serve({ fetch: app.fetch, port: config.port, hostname: '0.0.0.0' }, (info) => {
    console.log(`API listening on http://0.0.0.0:${info.port}`);
  });
})();
