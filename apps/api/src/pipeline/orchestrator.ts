import { join } from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { broker } from '../logs/broker.js';
import { logWriter } from '../logs/writer.js';
import { cloneRepo } from './git.js';
import { buildWithRailpack } from './railpack.js';
import { runContainer, stopAndRemoveContainer } from './docker.js';
import { addRoute, removeRoute } from './caddy.js';
import { config } from '../config.js';
import { acquireBuildSlot, releaseBuildSlot } from './buildConcurrency.js';

async function setStatus(id: string, status: string, extra: Record<string, unknown> = {}) {
  await db.update(deployments)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(deployments.id, id));
  broker.publishStatus(id, status);
}

export async function runPipeline(deploymentId: string, slug: string, source: string, envVars: Record<string, string> = {}) {
  const srcPath = join('/tmp/brimble', deploymentId, 'src');
  const logPath = logWriter.getPath(deploymentId);

  await db.update(deployments)
    .set({ logPath, updatedAt: new Date() })
    .where(eq(deployments.id, deploymentId));

  let buildSlotHeld = false;
  try {
    await acquireBuildSlot();
    buildSlotHeld = true;

    // 1. Clone
    await setStatus(deploymentId, 'building');
    await cloneRepo(deploymentId, source, srcPath);

    // 2. Railpack + BuildKit
    const imageTag = `brimble-${slug}:latest`;
    const runImage = await buildWithRailpack(deploymentId, srcPath, imageTag);
    await db.update(deployments).set({ imageTag: runImage, updatedAt: new Date() }).where(eq(deployments.id, deploymentId));

    // 3. Docker run — release build slot once `building` work is done
    await setStatus(deploymentId, 'deploying');
    releaseBuildSlot();
    buildSlotHeld = false;

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

    await setStatus(deploymentId, 'running', { containerId, internalPort: port, publicUrl });
    broker.publish(deploymentId, 'system', `Deployment running at ${publicUrl}`);
  } catch (err: any) {
    const message = err?.message ?? String(err);
    broker.publish(deploymentId, 'system', `Pipeline failed: ${message}`);
    await setStatus(deploymentId, 'failed', { errorMessage: message });
    broker.close(deploymentId);
  } finally {
    if (buildSlotHeld) {
      releaseBuildSlot();
      buildSlotHeld = false;
    }
  }
}

export async function teardownDeployment(deploymentId: string) {
  const [dep] = await db.select().from(deployments).where(eq(deployments.id, deploymentId));
  if (!dep) return;

  broker.close(deploymentId);

  if (dep.containerId) {
    await stopAndRemoveContainer(dep.containerId);
  }
  if (dep.slug) {
    await removeRoute(dep.slug).catch(() => {});
  }

  await logWriter.close(deploymentId);

  await db.update(deployments)
    .set({ status: 'stopped', updatedAt: new Date() })
    .where(eq(deployments.id, deploymentId));
}
