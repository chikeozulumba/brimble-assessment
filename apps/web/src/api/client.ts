import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Deployment {
  id: string;
  slug: string;
  source: string;
  status: string;
  imageTag: string | null;
  containerId: string | null;
  internalPort: number | null;
  publicUrl: string | null;
  errorMessage: string | null;
  envVars: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  /** 1-based wait position when status is `queued` and waiting for a build slot. */
  queuePosition?: number | null;
  /** True while this deployment holds one of the concurrent pipeline workers (clone→deploy). */
  pipelineSlotHeld?: boolean;
}

export interface DeploymentQueueSummary {
  maxConcurrent: number;
  activeCount: number;
  activeIds: string[];
  waitingIds: string[];
  waitingCount: number;
}

export interface LogEntry {
  id: number;
  deploymentId: string;
  ts: string;
  stream: 'stdout' | 'stderr' | 'system';
  line: string;
}

const BASE = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export function useDeployments() {
  return useQuery<Deployment[]>({
    queryKey: ['deployments'],
    queryFn: () => apiFetch('/deployments'),
  });
}

export function useDeploymentQueueSummary() {
  return useQuery<DeploymentQueueSummary>({
    queryKey: ['deployments', 'queue-summary'],
    queryFn: () => apiFetch('/deployments/queue/summary'),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 2500;
      return d.waitingCount > 0 || d.activeCount > 0 ? 2000 : false;
    },
  });
}

export function useDeployment(id: string) {
  return useQuery<Deployment>({
    queryKey: ['deployments', id],
    queryFn: () => apiFetch(`/deployments/${id}`),
    enabled: Boolean(id),
  });
}

export function useLogs(deploymentId: string) {
  return useQuery<LogEntry[]>({
    queryKey: ['logs', deploymentId],
    queryFn: () => apiFetch(`/deployments/${deploymentId}/logs`),
    enabled: Boolean(deploymentId),
    refetchInterval: false,
  });
}

export function useCreateDeployment() {
  const qc = useQueryClient();
  return useMutation<Deployment, Error, { source: string; envVars?: Record<string, string> }>({
    mutationFn: (body) =>
      apiFetch('/deployments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deployments'] });
      qc.invalidateQueries({ queryKey: ['deployments', 'queue-summary'] });
    },
  });
}

export function useStopDeployment() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/deployments/${id}/stop`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deployments'] });
      qc.invalidateQueries({ queryKey: ['deployments', 'queue-summary'] });
    },
  });
}

export function useDeleteDeployment() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/deployments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deployments'] });
      qc.invalidateQueries({ queryKey: ['deployments', 'queue-summary'] });
    },
  });
}

export interface RedeployPayload {
  id: string;
  /** When set (including `{}`), replaces env vars for the new deployment; omit to copy the original row. */
  envVars?: Record<string, string>;
}

export function useRedeployDeployment() {
  const qc = useQueryClient();
  return useMutation<Deployment, Error, RedeployPayload>({
    mutationFn: ({ id, envVars }) =>
      apiFetch(`/deployments/${id}/redeploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envVars !== undefined ? { envVars } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deployments'] });
      qc.invalidateQueries({ queryKey: ['deployments', 'queue-summary'] });
    },
  });
}

export interface BatchResult { succeeded: number; failed: number }

export function useBatchStopDeployments() {
  const qc = useQueryClient();
  return useMutation<BatchResult, Error, string[]>({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiFetch(`/deployments/${id}/stop`, { method: 'POST' })),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (succeeded === 0) throw new Error(`All ${ids.length} stop operations failed`);
      return { succeeded, failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deployments'] });
      qc.invalidateQueries({ queryKey: ['deployments', 'queue-summary'] });
    },
  });
}

export function useBatchDeleteDeployments() {
  const qc = useQueryClient();
  return useMutation<BatchResult, Error, string[]>({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(
        ids.map((id) => apiFetch(`/deployments/${id}`, { method: 'DELETE' })),
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (succeeded === 0) throw new Error(`All ${ids.length} delete operations failed`);
      return { succeeded, failed };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deployments'] });
      qc.invalidateQueries({ queryKey: ['deployments', 'queue-summary'] });
    },
  });
}
