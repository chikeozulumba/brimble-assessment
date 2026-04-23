import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { broker } from '../logs/broker.js';
import { readLogFile } from '../logs/reader.js';

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

    // 2b. Pipeline done — check deployment state
    const [current] = await db.select().from(deployments).where(eq(deployments.id, id));
    if (current?.status !== 'running') {
      await stream.writeSSE({ event: 'done', data: '{}' });
      return;
    }

    // 2c. Container is running — tail the log file for new lines written by tailLogs
    let lastId = history.at(-1)?.id ?? 0;
    let aborted = false;
    stream.onAbort(() => { aborted = true; });

    while (!aborted) {
      await new Promise((r) => setTimeout(r, 1000));
      if (aborted) break;

      const [live] = await db.select().from(deployments).where(eq(deployments.id, id));
      if (!live?.logPath) break;

      const newLines = await readLogFile(id, live.logPath, lastId);
      for (const log of newLines) {
        await stream.writeSSE({ event: 'log', data: JSON.stringify(log) });
        lastId = log.id;
      }

      if (live.status !== 'running') {
        await stream.writeSSE({ event: 'status', data: JSON.stringify({ status: live.status }) });
        await stream.writeSSE({ event: 'done', data: '{}' });
        break;
      }
    }
  });
});
