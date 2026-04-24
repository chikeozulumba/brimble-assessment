import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { teardownDeployment } from '../pipeline/orchestrator.js';
import { canStartBuildWithoutWaiting } from '../pipeline/buildConcurrency.js';
import {
  cancelQueuedDeployment,
  enqueueDeploymentPipeline,
  getDeploymentQueueSummary,
  getWaitingQueuePosition,
  isDeploymentPipelineRunning,
} from '../pipeline/deploymentQueue.js';

export const deploymentsRoute = new Hono();

function slug() {
  return nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x');
}

type DepRow = typeof deployments.$inferSelect;

function enrich(dep: DepRow) {
  return {
    ...dep,
    queuePosition: getWaitingQueuePosition(dep.id),
    pipelineSlotHeld: isDeploymentPipelineRunning(dep.id),
  };
}

deploymentsRoute.get('/queue/summary', async (c) => {
  return c.json(getDeploymentQueueSummary());
});

deploymentsRoute.post('/', async (c) => {
  const body = await c.req.json<{ source: string; envVars?: Record<string, string> }>();
  if (!body.source) return c.json({ error: 'source is required' }, 400);

  const id = crypto.randomUUID();
  const s = slug();
  const envVars = body.envVars && Object.keys(body.envVars).length > 0 ? body.envVars : null;

  const initialStatus = canStartBuildWithoutWaiting() ? 'pending' : 'queued';

  const [dep] = await db.insert(deployments).values({
    id,
    slug: s,
    source: body.source,
    status: initialStatus,
    envVars,
  }).returning();

  enqueueDeploymentPipeline(id);

  return c.json(enrich(dep), 201);
});

deploymentsRoute.get('/', async (c) => {
  const all = await db.select().from(deployments).orderBy(desc(deployments.createdAt));
  return c.json(all.map(enrich));
});

deploymentsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!dep) return c.json({ error: 'not found' }, 404);
  return c.json(enrich(dep));
});

deploymentsRoute.post('/:id/redeploy', async (c) => {
  const id = c.req.param('id');
  const [original] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!original) return c.json({ error: 'not found' }, 404);

  let envVars = original.envVars;
  const ct = c.req.header('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      const body = await c.req.json<{ envVars?: Record<string, string> }>();
      if (body && typeof body === 'object' && 'envVars' in body) {
        const ev = body.envVars;
        envVars =
          ev != null && typeof ev === 'object' && !Array.isArray(ev) && Object.keys(ev).length > 0
            ? (ev as Record<string, string>)
            : null;
      }
    } catch {
      /* keep original.envVars */
    }
  }

  const newId = crypto.randomUUID();
  const s = slug();

  const initialStatus = canStartBuildWithoutWaiting() ? 'pending' : 'queued';

  const [dep] = await db.insert(deployments).values({
    id: newId,
    slug: s,
    source: original.source,
    status: initialStatus,
    envVars,
  }).returning();

  enqueueDeploymentPipeline(newId);

  return c.json(enrich(dep), 201);
});

/** Tear down runtime resources, clear operational columns, and enqueue the pipeline again on the same row (same id, slug, source, envVars). */
deploymentsRoute.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!dep) return c.json({ error: 'not found' }, 404);

  if (!['stopped', 'failed'].includes(dep.status)) {
    return c.json(
      { error: 'Can only start deployments that are stopped or failed. Stop a running deployment first if you need to restart it.' },
      400,
    );
  }

  if (isDeploymentPipelineRunning(id)) {
    return c.json({ error: 'A pipeline is already running for this deployment' }, 409);
  }

  cancelQueuedDeployment(id);
  await teardownDeployment(id);

  const initialStatus = canStartBuildWithoutWaiting() ? 'pending' : 'queued';

  await db
    .update(deployments)
    .set({
      status: initialStatus,
      imageTag: null,
      containerId: null,
      internalPort: null,
      publicUrl: null,
      errorMessage: null,
      logPath: null,
      updatedAt: new Date(),
    })
    .where(eq(deployments.id, id));

  enqueueDeploymentPipeline(id);

  const [updated] = await db.select().from(deployments).where(eq(deployments.id, id));
  return c.json(enrich(updated!));
});

deploymentsRoute.post('/:id/stop', async (c) => {
  const id = c.req.param('id');
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!dep) return c.json({ error: 'not found' }, 404);

  cancelQueuedDeployment(id);
  await teardownDeployment(id);
  return c.json({ ok: true });
});

deploymentsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!dep) return c.json({ error: 'not found' }, 404);

  cancelQueuedDeployment(id);
  await teardownDeployment(id);
  await db.delete(deployments).where(eq(deployments.id, id));
  return c.json({ ok: true });
});
