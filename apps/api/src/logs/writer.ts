import { createWriteStream, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { WriteStream } from 'fs';
import { config } from '../config.js';

class LogFileWriter {
  private streams = new Map<string, WriteStream>();

  getPath(deploymentId: string): string {
    return `${config.logsDir}/${deploymentId}.log`;
  }

  private getStream(deploymentId: string): WriteStream {
    let s = this.streams.get(deploymentId);
    if (!s) {
      const path = this.getPath(deploymentId);
      mkdirSync(dirname(path), { recursive: true });
      s = createWriteStream(path, { flags: 'a', encoding: 'utf8' });
      s.on('error', (err) => console.error(`[log-writer] ${deploymentId}:`, err));
      this.streams.set(deploymentId, s);
    }
    return s;
  }

  writeLine(deploymentId: string, stream: string, line: string, ts: string): void {
    this.getStream(deploymentId).write(`${ts}\t${stream}\t${line}\n`);
  }

  async close(deploymentId: string): Promise<void> {
    const s = this.streams.get(deploymentId);
    if (!s) return;
    this.streams.delete(deploymentId);
    await new Promise<void>((resolve) => s.end(resolve));
  }
}

export const logWriter = new LogFileWriter();
