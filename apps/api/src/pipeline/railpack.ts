import { spawn } from 'child_process';
import { broker } from '../logs/broker.js';

export async function buildWithRailpack(deploymentId: string, srcPath: string, imageTag: string): Promise<void> {
  await broker.publish(deploymentId, 'system', `Building image ${imageTag} with Railpack`);

  return new Promise((resolve, reject) => {
    const proc = spawn('railpack', ['build', srcPath, '--name', imageTag], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        broker.publish(deploymentId, 'stdout', line);
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        broker.publish(deploymentId, 'stderr', line);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        broker.publish(deploymentId, 'system', `Railpack build succeeded: ${imageTag}`);
        resolve();
      } else {
        reject(new Error(`Railpack exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn railpack: ${err.message}`));
    });
  });
}
