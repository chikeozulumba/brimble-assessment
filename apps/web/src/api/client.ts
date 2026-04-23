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
  createdAt: string;
  updatedAt: string;
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}

export function useDeleteDeployment() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, string>({
    mutationFn: (id) => apiFetch(`/deployments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}

export function useRedeployDeployment() {
  const qc = useQueryClient();
  return useMutation<Deployment, Error, string>({
    mutationFn: (id) => apiFetch(`/deployments/${id}/redeploy`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deployments'] }),
  });
}
