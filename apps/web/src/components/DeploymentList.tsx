import { useDeployments, useDeleteDeployment, useRedeployDeployment, Deployment } from '../api/client';

const statusColors: Record<string, string> = {
  pending: 'bg-gray-400',
  building: 'bg-yellow-400',
  deploying: 'bg-blue-400',
  running: 'bg-green-500',
  failed: 'bg-red-500',
  stopped: 'bg-gray-500',
};

interface Props {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function DeploymentList({ selectedId, onSelect }: Props) {
  const { data: deployments, isLoading } = useDeployments();
  const deleteDep = useDeleteDeployment();
  const redeploy = useRedeployDeployment();

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!deployments?.length) return <p className="text-sm text-gray-500">No deployments yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b text-left text-gray-600">
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Slug</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2 pr-4">Image</th>
            <th className="py-2 pr-4">URL</th>
            <th className="py-2 pr-4">Created</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {deployments.map((dep: Deployment) => (
            <tr
              key={dep.id}
              className={`border-b hover:bg-gray-50 cursor-pointer ${selectedId === dep.id ? 'bg-blue-50' : ''}`}
              onClick={() => onSelect(dep.id)}
            >
              <td className="py-2 pr-4">
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${statusColors[dep.status] ?? 'bg-gray-400'}`} />
                  {dep.status}
                </span>
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{dep.slug}</td>
              <td className="py-2 pr-4 max-w-xs truncate font-mono text-xs" title={dep.source}>{dep.source}</td>
              <td className="py-2 pr-4 font-mono text-xs">{dep.imageTag ?? '—'}</td>
              <td className="py-2 pr-4">
                {dep.publicUrl
                  ? <a href={dep.publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs" onClick={(e) => e.stopPropagation()}>{dep.publicUrl}</a>
                  : '—'}
              </td>
              <td className="py-2 pr-4 text-xs text-gray-500">{new Date(dep.createdAt).toLocaleString()}</td>
              <td className="py-2">
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onSelect(dep.id)}
                    className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Logs
                  </button>
                  <button
                    onClick={() => redeploy.mutate(dep.id)}
                    className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                    disabled={redeploy.isPending}
                  >
                    Redeploy
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this deployment?')) deleteDep.mutate(dep.id); }}
                    className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                    disabled={deleteDep.isPending}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
