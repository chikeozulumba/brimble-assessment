import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { broker } from '../logs/broker.js';
import { readLogFile } from '../logs/reader.js';

/** Deployment is finished; stop SSE after replay / tail. */
const TERMINAL_STATUSES = new Set(['failed', 'stopped']);

export const logsRoute = new Hono();

logsRoute.get('/:id/logs', async (c) => {
  const id = c.req.param('id');
  const afterStr = c.req.query('after');
  const afterId = afterStr ? parseInt(afterStr, 10) : 0;

  const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));
  if (!dep?.logPath) return c.json([]);

  const logs = await readLogFile(id, dep.logPath, afterId);
  return c.json(logs);
});

logsRoute.get('/:id/logs/stream', (c) => {
  const id = c.req.param('id');

  return streamSSE(c, async (stream) => {
    const [dep] = await db.select().from(deployments).where(eq(deployments.id, id));

    // 1. Replay full history from log file
    const history = dep?.logPath ? await readLogFile(id, dep.logPath) : [];
    for (const row of history) {
      await stream.writeSSE({ event: 'log', data: JSON.stringify(row) });
    }

    // 2a. Pipeline is still running — subscribe to the in-memory broker
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

    // 2b. Broker inactive — tail DB + log file through pending/build/deploy/running until failed/stopped
    let lastId = history.at(-1)?.id ?? 0;
    let lastStatusSent: string | null = null;
    let aborted = false;
    stream.onAbort(() => { aborted = true; });

    while (!aborted) {
      const [live] = await db.select().from(deployments).where(eq(deployments.id, id));
      if (!live) break;

      if (live.status !== lastStatusSent) {
        await stream.writeSSE({ event: 'status', data: JSON.stringify({ status: live.status }) });
        lastStatusSent = live.status;
      }

      if (live.logPath) {
        const newLines = await readLogFile(id, live.logPath, lastId);
        for (const log of newLines) {
          await stream.writeSSE({ event: 'log', data: JSON.stringify(log) });
          lastId = log.id;
        }
      }

      if (TERMINAL_STATUSES.has(live.status)) {
        await stream.writeSSE({ event: 'done', data: '{}' });
        break;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  });
});
