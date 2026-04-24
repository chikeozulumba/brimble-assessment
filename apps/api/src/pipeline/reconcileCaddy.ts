import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { config } from '../config.js';
import { addRoute } from './caddy.js';
import { getContainerInternalIp } from './docker.js';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * After Caddy or the API restarts, in-memory Caddy JSON routes are gone but Postgres still lists
 * running deployments. Re-apply reverse_proxy routes so `/apps/{slug}/` works again.
 */
export async function reconcileCaddyRoutesFromDb(): Promise<void> {
  const rows = await db.select().from(deployments).where(eq(deployments.status, 'running'));
  if (rows.length === 0) return;

  for (const dep of rows) {
    if (!dep.slug || !dep.containerId || dep.internalPort == null) continue;

    const ip = await getContainerInternalIp(dep.containerId, config.appsNetwork);
    if (!ip) {
      console.warn(
        `[caddy-reconcile] skip ${dep.slug}: no container IP (id ${dep.containerId.slice(0, 12)}…, network ${config.appsNetwork})`,
      );
      continue;
    }

    const maxAttempts = 6;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await addRoute(dep.slug, ip, dep.internalPort);
        console.log(`[caddy-reconcile] /apps/${dep.slug} -> ${ip}:${dep.internalPort}`);
        break;
      } catch (e) {
        if (attempt === maxAttempts) {
          console.error(`[caddy-reconcile] addRoute failed for ${dep.slug} after ${maxAttempts} tries:`, e);
          break;
        }
        await sleep(400 * attempt);
      }
    }
  }
}
