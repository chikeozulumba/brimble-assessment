import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eq, gt, and, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deploymentLogs } from '../db/schema.js';
import { broker } from '../logs/broker.js';

export const logsRoute = new Hono();

logsRoute.get('/:id/logs', async (c) => {
  const id = c.req.param('id');
  const after = c.req.query('after');

  const condition = after
    ? and(eq(deploymentLogs.deploymentId, id), gt(deploymentLogs.id, parseInt(after, 10)))
    : eq(deploymentLogs.deploymentId, id);

  const logs = await db.select().from(deploymentLogs)
    .where(condition)
    .orderBy(asc(deploymentLogs.id));

  return c.json(logs);
});

logsRoute.get('/:id/logs/stream', (c) => {
  const id = c.req.param('id');

  return streamSSE(c, async (stream) => {
    // 1. Replay history
    const history = await db.select().from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, id))
      .orderBy(asc(deploymentLogs.id));

    for (const row of history) {
      await stream.writeSSE({ event: 'log', data: JSON.stringify(row) });
    }

    // 2. Subscribe to live events
    const emitter = broker.subscribe(id);

    const onLog = (row: unknown) =>
      stream.writeSSE({ event: 'log', data: JSON.stringify(row) });
    const onStatus = (payload: unknown) =>
      stream.writeSSE({ event: 'status', data: JSON.stringify(payload) });

    emitter.on('log', onLog);
    emitter.on('status', onStatus);

    // 3. Keep open until done
    await new Promise<void>((resolve) => {
      emitter.once('done', () => {
        stream.writeSSE({ event: 'done', data: '{}' });
        emitter.off('log', onLog);
        emitter.off('status', onStatus);
        resolve();
      });
      stream.onAbort(() => {
        emitter.off('log', onLog);
        emitter.off('status', onStatus);
        resolve();
      });
    });
  });
});
