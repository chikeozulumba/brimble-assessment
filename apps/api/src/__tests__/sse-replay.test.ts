import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';

interface LogEntry {
  id: number;
  deploymentId: string;
  ts: string;
  stream: string;
  line: string;
}

async function simulateSSEStream(
  history: LogEntry[],
  liveEvents: LogEntry[],
  delayMs = 0,
): Promise<string[]> {
  const received: string[] = [];
  const emitter = new EventEmitter();

  // Simulate the SSE handler
  async function handler() {
    // 1. Replay history
    for (const row of history) {
      received.push(`log:${row.id}`);
    }

    // 2. Subscribe to live
    const onLog = (row: LogEntry) => received.push(`log:${row.id}`);
    emitter.on('log', onLog);

    await new Promise<void>((resolve) => {
      emitter.once('done', () => {
        emitter.off('log', onLog);
        resolve();
      });
    });
  }

  const handlerPromise = handler();

  // Fire live events after a tick
  await new Promise((r) => setTimeout(r, delayMs));
  for (const e of liveEvents) emitter.emit('log', e);
  emitter.emit('done');

  await handlerPromise;
  return received;
}

describe('SSE replay ordering', () => {
  const makeLog = (id: number): LogEntry => ({
    id,
    deploymentId: 'dep1',
    ts: new Date().toISOString(),
    stream: 'stdout',
    line: `line ${id}`,
  });

  it('replays history before live events', async () => {
    const history = [makeLog(1), makeLog(2), makeLog(3)];
    const live = [makeLog(4), makeLog(5)];

    const received = await simulateSSEStream(history, live);

    expect(received).toEqual(['log:1', 'log:2', 'log:3', 'log:4', 'log:5']);
  });

  it('works when there is no history (mid-stream connect)', async () => {
    const received = await simulateSSEStream([], [makeLog(10), makeLog(11)]);
    expect(received).toEqual(['log:10', 'log:11']);
  });

  it('works when there are no live events (post-build connect)', async () => {
    const history = [makeLog(1), makeLog(2)];
    const received = await simulateSSEStream(history, []);
    expect(received).toEqual(['log:1', 'log:2']);
  });

  it('emits history in id order', async () => {
    // History is already sorted by the DB query — verify the contract
    const history = [makeLog(5), makeLog(10), makeLog(15)];
    const received = await simulateSSEStream(history, []);
    const ids = received.map((r) => parseInt(r.split(':')[1], 10));
    expect(ids).toEqual([5, 10, 15]);
  });
});
