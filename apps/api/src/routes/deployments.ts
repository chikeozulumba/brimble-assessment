import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { runPipeline, teardownDeployment } from '../pipeline/orchestrator.js';

export const deploymentsRoute = new Hono();

function slug() {
  return nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x');
}

deploymentsRoute.post('/', async (c) => {
  const body = await c.req.json<{ source: string; envVars?: Record<string, string> }>();
  if (!body.source) return c.json({ error: 'source is required' }, 400);

  const id = crypto.randomUUID();
  const s = slug();
  const envVars = body.envVars && Object.keys(body.envVars).length > 0 ? body.envVars : null;

  const [dep] = await db.insert(deployments).values({
    id,
    slug: s,
    source: body.source,
    status: 'pending',
    envVars,
  }).returning();

  runPipeline(id, s, body.source, envVars ?? {}).catch(console.error);

  return c.json(dep, 201);
});

deploymentsRoute.get('/', async (c) => {
  const all = await db.select().from(deployments).orderBy(desc(deployments.createdAt));
  return c.json(all);
});

deploymentsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!dep) return c.json({ error: 'not found' }, 404);
  return c.json(dep);
});

deploymentsRoute.post('/:id/redeploy', async (c) => {
  const id = c.req.param('id');
  const [original] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!original) return c.json({ error: 'not found' }, 404);

  const newId = crypto.randomUUID();
  const s = slug();

  const [dep] = await db.insert(deployments).values({
    id: newId,
    slug: s,
    source: original.source,
    status: 'pending',
    envVars: original.envVars,
  }).returning();

  runPipeline(newId, s, original.source, original.envVars ?? {}).catch(console.error);

  return c.json(dep, 201);
});

deploymentsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!dep) return c.json({ error: 'not found' }, 404);

  await teardownDeployment(id);
  return c.json({ ok: true });
});
