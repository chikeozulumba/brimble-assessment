import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eq, gt, and, asc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deploymentLogs, deployments } from '../db/schema.js';
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
    // 1. Replay full history
    const history = await db.select().from(deploymentLogs)
      .where(eq(deploymentLogs.deploymentId, id))
      .orderBy(asc(deploymentLogs.id));

    for (const row of history) {
      await stream.writeSSE({ event: 'log', data: JSON.stringify(row) });
    }

    // 2a. Pipeline is still running — subscribe to the broker as before
    if (broker.isActive(id)) {
      const emitter = broker.subscribe(id);

      const onLog = (row: unknown) => stream.writeSSE({ event: 'log', data: JSON.stringify(row) });
      const onStatus = (payload: unknown) => stream.writeSSE({ event: 'status', data: JSON.stringify(payload) });

      emitter.on('log', onLog);
      emitter.on('status', onStatus);

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
      return;
    }

    // 2b. Pipeline is done — check whether the container is still running
    const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));

    if (dep?.status !== 'running') {
      // Terminal state (failed / stopped / etc.) — nothing more to stream
      await stream.writeSSE({ event: 'done', data: '{}' });
      return;
    }

    // 2c. Container is running: poll DB for new lines written by the background tailLogs
    let lastId = history.at(-1)?.id ?? 0;
    let aborted = false;
    stream.onAbort(() => { aborted = true; });

    while (!aborted) {
      await new Promise((r) => setTimeout(r, 1000));
      if (aborted) break;

      // Fetch any new log lines since we last checked
      const newLogs = await db.select().from(deploymentLogs)
        .where(and(eq(deploymentLogs.deploymentId, id), gt(deploymentLogs.id, lastId)))
        .orderBy(asc(deploymentLogs.id));

      for (const log of newLogs) {
        await stream.writeSSE({ event: 'log', data: JSON.stringify(log) });
        lastId = log.id;
      }

      // Re-read status so we notice when the container stops
      const [current] = await db.select().from(deployments).where(eq(deployments.id, id));
      if (current?.status !== 'running') {
        await stream.writeSSE({ event: 'status', data: JSON.stringify({ status: current?.status }) });
        await stream.writeSSE({ event: 'done', data: '{}' });
        break;
      }
    }
  });
});
