/**
 * Limits how many deployments may sit in the `building` phase at once (Railpack / image build).
 * Pipelines in `deploying` or later do not consume a slot, so more than two runs can be in flight
 * overall, but at most {@link MAX_CONCURRENT_BUILDING} are in `building` concurrently.
 */

export const MAX_CONCURRENT_BUILDING = 2;

let buildingSlots = 0;
const waiters: Array<() => void> = [];
const slotFreedListeners: Array<() => void> = [];

export function onBuildSlotFreed(fn: () => void): void {
  slotFreedListeners.push(fn);
}

export function getBuildingSlotsInUse(): number {
  return buildingSlots;
}

/** Block until a build slot is available, then reserve it (call before `building` status work). */
export async function acquireBuildSlot(): Promise<void> {
  while (buildingSlots >= MAX_CONCURRENT_BUILDING) {
    await new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
  }
  buildingSlots++;
}

/** Release one build slot after leaving the `building` phase (typically when entering `deploying`). */
export function releaseBuildSlot(): void {
  buildingSlots = Math.max(0, buildingSlots - 1);
  const wake = waiters.shift();
  if (wake) wake();
  for (const fn of slotFreedListeners) {
    try {
      fn();
    } catch (e) {
      console.error('[build-concurrency] slotFreed listener:', e);
    }
  }
}

export function canStartBuildWithoutWaiting(): boolean {
  return buildingSlots < MAX_CONCURRENT_BUILDING;
}
