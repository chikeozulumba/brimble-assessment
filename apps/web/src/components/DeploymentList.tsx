import { useState } from "react";
import {
  Deployment,
  useDeleteDeployment,
  useDeployments,
  useRedeployDeployment,
} from "../api/client";
import { LogModal } from "./LogModal";

const statusColors: Record<string, string> = {
  pending: "bg-gray-400",
  building: "bg-yellow-400",
  deploying: "bg-blue-400",
  running: "bg-green-500",
  failed: "bg-red-500",
  stopped: "bg-gray-500",
};

const ALL_STATUSES = [
  "pending",
  "building",
  "deploying",
  "running",
  "failed",
  "stopped",
] as const;

interface Props {
  selectedId: string | undefined;
  onSelect: (id: string) => void;
}

export function DeploymentList({ selectedId, onSelect }: Props) {
  const { data: deployments, isLoading } = useDeployments();
  const deleteDep = useDeleteDeployment();
  const redeploy = useRedeployDeployment();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [logModalId, setLogModalId] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!deployments?.length)
    return <p className="text-sm text-gray-500">No deployments yet.</p>;

  const filtered = statusFilter
    ? deployments.filter((d: Deployment) => d.status === statusFilter)
    : deployments;

  return (
    <div>
      {logModalId && (
        <LogModal
          deploymentId={logModalId}
          onClose={() => setLogModalId(null)}
        />
      )}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === null ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}
        >
          All
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${statusFilter === s ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${statusColors[s]}`}
            />
            {s}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Source</th>
              <th className="py-2 pr-4">Image</th>
              <th className="py-2 pr-4">URL</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dep: Deployment) => (
              <tr
                key={dep.id}
                className={`border-b hover:bg-gray-50 cursor-pointer ${selectedId === dep.id ? "bg-blue-50" : ""}`}
                onClick={() => onSelect(dep.id)}
              >
                <td className="py-2 pr-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${statusColors[dep.status] ?? "bg-gray-400"}`}
                    />
                    {dep.status}
                  </span>
                </td>
                <td className="py-2 pr-4 font-mono text-xs uppercase">
                  {dep.slug}
                </td>
                <td
                  className="py-2 pr-4 max-w-xs truncate font-mono text-xs"
                  title={dep.source}
                >
                  {dep.source}
                </td>
                <td className="py-2 pr-4 font-mono text-xs">
                  {dep.imageTag ?? "—"}
                </td>
                <td className="py-2 pr-4">
                  {dep.publicUrl ? (
                    <a
                      href={dep.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {dep.publicUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(dep.createdAt).toLocaleString()}
                </td>
                <td className="py-2 whitespace-nowrap">
                  <div
                    className="flex gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onSelect(dep.id)}
                      className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                    >
                      Logs
                    </button>
                    {/* <button
                      onClick={() => setLogModalId(dep.id)}
                      className="px-2 py-1 text-xs bg-gray-800 text-white rounded hover:bg-gray-700 whitespace-nowrap"
                    >
                      Full Logs
                    </button> */}
                    <button
                      onClick={() => redeploy.mutate(dep.id)}
                      className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
                      disabled={redeploy.isPending}
                    >
                      Redeploy
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this deployment?"))
                          deleteDep.mutate(dep.id);
                      }}
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
        {filtered.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">
            No deployments match this filter.
          </p>
        )}
      </div>
    </div>
  );
}
