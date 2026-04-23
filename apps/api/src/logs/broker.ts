import { EventEmitter } from 'events';
import { logWriter } from './writer.js';

export interface LogEntry {
  id: number;
  deploymentId: string;
  ts: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
}

class LogBroker {
  private emitters = new Map<string, EventEmitter>();
  private counters = new Map<string, number>();

  subscribe(deploymentId: string): EventEmitter {
    let e = this.emitters.get(deploymentId);
    if (!e) {
      e = new EventEmitter();
      e.setMaxListeners(50);
      this.emitters.set(deploymentId, e);
    }
    return e;
  }

  publish(deploymentId: string, stream: 'stdout' | 'stderr' | 'system', line: string): void {
    const ts = new Date().toISOString();
    const id = (this.counters.get(deploymentId) ?? 0) + 1;
    this.counters.set(deploymentId, id);

    logWriter.writeLine(deploymentId, stream, line, ts);
    this.emitters.get(deploymentId)?.emit('log', { id, deploymentId, ts, stream, line } satisfies LogEntry);
  }

  publishStatus(deploymentId: string, status: string): void {
    this.emitters.get(deploymentId)?.emit('status', { status });
  }

  isActive(deploymentId: string): boolean {
    return this.emitters.has(deploymentId);
  }

  close(deploymentId: string): void {
    this.emitters.get(deploymentId)?.emit('done');
    this.emitters.delete(deploymentId);
    this.counters.delete(deploymentId);
    // Do not close the log writer here — tailLogs may still be appending app output.
  }
}

export const broker = new LogBroker();
