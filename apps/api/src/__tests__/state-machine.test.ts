import { describe, it, expect } from 'vitest';

type Status = 'pending' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';

const validTransitions: Record<Status, Status[]> = {
  pending:   ['building', 'failed'],
  building:  ['deploying', 'failed'],
  deploying: ['running', 'failed'],
  running:   ['stopped', 'failed'],
  failed:    [],
  stopped:   [],
};

function canTransition(from: Status, to: Status): boolean {
  return validTransitions[from].includes(to);
}

describe('deployment status state machine', () => {
  it('allows the happy path: pending → building → deploying → running', () => {
    const path: Status[] = ['pending', 'building', 'deploying', 'running'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
    }
  });

  it('allows any step to transition to failed', () => {
    const inProgress: Status[] = ['pending', 'building', 'deploying'];
    for (const s of inProgress) {
      expect(canTransition(s, 'failed')).toBe(true);
    }
  });

  it('allows running → stopped', () => {
    expect(canTransition('running', 'stopped')).toBe(true);
  });

  it('disallows skipping steps', () => {
    expect(canTransition('pending', 'running')).toBe(false);
    expect(canTransition('building', 'running')).toBe(false);
  });

  it('disallows transition from terminal states', () => {
    expect(canTransition('failed', 'building')).toBe(false);
    expect(canTransition('stopped', 'running')).toBe(false);
  });
});
