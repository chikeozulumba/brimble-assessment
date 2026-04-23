import { join } from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { broker } from '../logs/broker.js';
import { cloneRepo } from './git.js';
import { buildWithRailpack } from './railpack.js';
import { runContainer, stopAndRemoveContainer } from './docker.js';
import { addRoute, removeRoute } from './caddy.js';
import { config } from '../config.js';

async function setStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  await db.update(deployments)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(deployments.id, id));
  broker.publishStatus(id, status);
}

export async function runPipeline(deploymentId: string, slug: string, source: string, envVars: Record<string, string> = {}) {
  const srcPath = join('/tmp/brimble', deploymentId, 'src');

  try {
    // 1. Clone
    await setStatus(deploymentId, 'building');
    await cloneRepo(deploymentId, source, srcPath);

    // 2. Railpack + BuildKit (returns host-runnable ref, e.g. localhost:5000/brimble-…:latest when using registry push)
    const imageTag = `brimble-${slug}:latest`;
    const runImage = await buildWithRailpack(deploymentId, srcPath, imageTag);
    await db.update(deployments).set({ imageTag: runImage, updatedAt: new Date() }).where(eq(deployments.id, deploymentId));

    // 3. Docker run
    await setStatus(deploymentId, 'deploying');
    const { containerId, internalIp, port } = await runContainer(
      deploymentId,
      runImage,
      slug,
      config.appsNetwork,
      envVars,
    );

    // 4. Caddy route
    await addRoute(slug, internalIp, port);
    const publicUrl = `${config.publicBaseUrl}/apps/${slug}/`;

    await setStatus(deploymentId, 'running', {
      containerId,
      internalPort: port,
      publicUrl,
    });

    await broker.publish(deploymentId, 'system', `Deployment running at ${publicUrl}`);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    await broker.publish(deploymentId, 'system', `Pipeline failed: ${message}`);
    await setStatus(deploymentId, 'failed', { errorMessage: message });
  } finally {
    broker.close(deploymentId);
  }
}

export async function teardownDeployment(deploymentId: string) {
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, deploymentId));
  if (!dep) return;

  if (dep.containerId) {
    await stopAndRemoveContainer(dep.containerId);
  }
  if (dep.slug) {
    await removeRoute(dep.slug).catch(() => {});
  }

  await db.update(deployments)
    .set({ status: 'stopped', updatedAt: new Date() })
    .where(eq(deployments.id, deploymentId));
}
