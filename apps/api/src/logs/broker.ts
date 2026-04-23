import { EventEmitter } from 'events';
import { db } from '../db/client.js';
import { deploymentLogs } from '../db/schema.js';

class LogBroker {
  private emitters = new Map<string, EventEmitter>();

  subscribe(deploymentId: string): EventEmitter {
    let e = this.emitters.get(deploymentId);
    if (!e) {
      e = new EventEmitter();
      e.setMaxListeners(50);
      this.emitters.set(deploymentId, e);
    }
    return e;
  }

  async publish(deploymentId: string, stream: 'stdout' | 'stderr' | 'system', line: string) {
    const rows = await db.insert(deploymentLogs).values({ deploymentId, stream, line }).returning();
    this.emitters.get(deploymentId)?.emit('log', rows[0]);
  }

  publishStatus(deploymentId: string, status: string) {
    this.emitters.get(deploymentId)?.emit('status', { status });
  }

  isActive(deploymentId: string): boolean {
    return this.emitters.has(deploymentId);
  }

  close(deploymentId: string) {
    this.emitters.get(deploymentId)?.emit('done');
    this.emitters.delete(deploymentId);
  }
}

export const broker = new LogBroker();
