import { asc, eq, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { deployments } from '../db/schema.js';
import { runPipeline } from './orchestrator.js';

/** Max concurrent `runPipeline` executions (clone → build → deploy). */
export const MAX_CONCURRENT_PIPELINES = 2;

const processing = new Set<string>();
const fifo: string[] = [];

function pump(): void {
  while (processing.size < MAX_CONCURRENT_PIPELINES && fifo.length > 0) {
    const id = fifo.shift()!;
    void runSlot(id);
  }
}

async function runSlot(deploymentId: string): Promise<void> {
  processing.add(deploymentId);
  try {
    const [dep] = await db.select().from(deployments).where(eq(deployments.id, deploymentId));
    if (!dep) return;
    if (!['queued', 'pending'].includes(dep.status)) return;

    const env = (dep.envVars as Record<string, string> | null) ?? {};
    await runPipeline(deploymentId, dep.slug, dep.source, env);
  } catch (e) {
    console.error('[deployment-queue] pipeline error', deploymentId, e);
  } finally {
    processing.delete(deploymentId);
    pump();
  }
}

/** Schedule a deployment pipeline when a slot is free; otherwise FIFO-wait. */
export function enqueueDeploymentPipeline(deploymentId: string): void {
  if (processing.has(deploymentId)) return;
  if (fifo.includes(deploymentId)) return;

  if (processing.size < MAX_CONCURRENT_PIPELINES) {
    void runSlot(deploymentId);
  } else {
    fifo.push(deploymentId);
  }
}

/** Remove a deployment from the wait list (e.g. user deleted or stopped before start). */
export function cancelQueuedDeployment(deploymentId: string): void {
  const i = fifo.indexOf(deploymentId);
  if (i !== -1) fifo.splice(i, 1);
}

export function isDeploymentPipelineRunning(deploymentId: string): boolean {
  return processing.has(deploymentId);
}

/** 1-based position among waiting deployments only; `null` if not waiting in the FIFO. */
export function getWaitingQueuePosition(deploymentId: string): number | null {
  const i = fifo.indexOf(deploymentId);
  if (i === -1) return null;
  return i + 1;
}

export function getDeploymentQueueSummary() {
  return {
    maxConcurrent: MAX_CONCURRENT_PIPELINES,
    activeCount: processing.size,
    activeIds: [...processing],
    waitingIds: [...fifo],
    waitingCount: fifo.length,
  };
}

/** After API restart: resume pipelines for rows still marked queued/pending (FIFO). */
export async function resumeStaleQueuedDeployments(): Promise<void> {
  const rows = await db
    .select()
    .from(deployments)
    .where(or(eq(deployments.status, 'queued'), eq(deployments.status, 'pending')))
    .orderBy(asc(deployments.createdAt));

  for (const r of rows) {
    enqueueDeploymentPipeline(r.id);
  }
}
