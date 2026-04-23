import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Deployment,
  useDeleteDeployment,
  useDeployments,
  useRedeployDeployment,
  useStopDeployment,
} from "../api/client";
import { ConfirmModal } from "./ConfirmModal";
import { LogStream } from "./LogStream";

type PendingAction = { type: "stop" | "delete"; deploymentId: string };

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
  initialExpandId?: string;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 mb-0.5">{label}</dt>
      <dd className="text-xs text-gray-800 break-all">{children}</dd>
    </div>
  );
}

export function DeploymentList({ initialExpandId }: Props) {
  const { data: deployments, isLoading } = useDeployments();
  const stopDep = useStopDeployment();
  const deleteDep = useDeleteDeployment();
  const redeploy = useRedeployDeployment();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialExpandId ?? null,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (initialExpandId) setExpandedId(initialExpandId);
  }, [initialExpandId]);

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (!deployments?.length)
    return <p className="text-sm text-gray-500">No deployments yet.</p>;

  const filtered = statusFilter
    ? deployments.filter((d: Deployment) => d.status === statusFilter)
    : deployments;

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
        Deployments ({filtered.length})
      </h2>
      {/* Status filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1 text-xs rounded-full border transition-colors ${
            statusFilter === null
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
          }`}
        >
          All
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors ${
              statusFilter === s
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
            }`}
          >
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full ${statusColors[s]}`}
            />
            {s}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">
          No deployments match this filter.
        </p>
      )}

      {/* Accordion list */}
      <div className="space-y-2">
        {filtered.map((dep: Deployment) => {
          const isExpanded = expandedId === dep.id;
          const isRunning = dep.status === "running";
          const isStopped = dep.status === "stopped";

          return (
            <div
              key={dep.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Summary row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => toggle(dep.id)}
              >
                <span className="text-gray-400 text-xs w-3 shrink-0">
                  {isExpanded ? "▼" : "▶"}
                </span>

                <span className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      statusColors[dep.status] ?? "bg-gray-400"
                    } ${isRunning ? "animate-pulse" : ""}`}
                  />
                  <span className="text-xs font-medium text-gray-700 w-16">
                    {dep.status}
                  </span>
                </span>

                <span className="font-mono text-xs font-semibold text-gray-900 shrink-0">
                  {dep.slug}
                </span>

                <span
                  className="text-xs text-gray-400 truncate min-w-0 flex-1"
                  title={dep.source}
                >
                  {dep.source}
                </span>

                <span className="text-xs text-gray-400 whitespace-nowrap shrink-0 hidden sm:block">
                  {new Date(dep.createdAt).toLocaleString()}
                </span>

                {/* Row actions — clicks don't propagate to the toggle */}
                <div
                  className="flex gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() =>
                      redeploy.mutate(dep.id, {
                        onSuccess: (newDep) =>
                          toast.success("Redeployment started", {
                            description: newDep.slug,
                          }),
                      })
                    }
                    disabled={redeploy.isPending}
                    className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                  >
                    Redeploy
                  </button>
                  <button
                    onClick={() =>
                      setPendingAction({ type: "stop", deploymentId: dep.id })
                    }
                    disabled={stopDep.isPending || isStopped}
                    className="px-2 py-1 text-xs bg-orange-50 text-orange-600 rounded hover:bg-orange-100 disabled:opacity-40"
                  >
                    Stop
                  </button>
                  <button
                    onClick={() =>
                      setPendingAction({ type: "delete", deploymentId: dep.id })
                    }
                    disabled={deleteDep.isPending}
                    className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-200">
                  {/* Deployment info */}
                  <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Deployment Info
                    </p>
                    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
                      <InfoRow label="Slug">
                        <span className="font-mono">{dep.slug}</span>
                      </InfoRow>
                      <InfoRow label="Status">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              statusColors[dep.status] ?? "bg-gray-400"
                            }`}
                          />
                          {dep.status}
                        </span>
                      </InfoRow>
                      <InfoRow label="Created">
                        {new Date(dep.createdAt).toLocaleString()}
                      </InfoRow>
                      <InfoRow label="Source">
                        <span className="font-mono">{dep.source}</span>
                      </InfoRow>
                      <InfoRow label="Image">
                        <span className="font-mono">{dep.imageTag ?? "—"}</span>
                      </InfoRow>
                      <InfoRow label="Updated">
                        {new Date(dep.updatedAt).toLocaleString()}
                      </InfoRow>
                      <InfoRow label="URL">
                        {dep.publicUrl ? (
                          <a
                            href={dep.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {dep.publicUrl}
                          </a>
                        ) : (
                          "—"
                        )}
                      </InfoRow>
                      {dep.errorMessage && (
                        <InfoRow label="Error">
                          <span className="text-red-600">
                            {dep.errorMessage}
                          </span>
                        </InfoRow>
                      )}
                      {dep.envVars && Object.keys(dep.envVars).length > 0 && (
                        <div className="col-span-2 sm:col-span-3">
                          <dt className="text-xs font-medium text-gray-500 mb-1">
                            Environment Variables
                          </dt>
                          <dd className="space-y-0.5">
                            {Object.entries(dep.envVars).map(([k, v]) => (
                              <div key={k} className="font-mono text-xs">
                                <span className="text-gray-800">{k}</span>
                                <span className="text-gray-400">=</span>
                                <span className="text-gray-600">{v}</span>
                              </div>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Logs */}
                  <div className="px-5 py-4">
                    <LogStream deploymentId={dep.id} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pendingAction && (
        <ConfirmModal
          title={
            pendingAction.type === "stop"
              ? "Stop deployment?"
              : "Delete deployment?"
          }
          message={
            pendingAction.type === "stop"
              ? "This will stop the running container and remove its Caddy route. The record will remain."
              : "This will permanently delete the deployment and all its logs. This cannot be undone."
          }
          confirmLabel={pendingAction.type === "stop" ? "Stop" : "Delete"}
          confirmClassName={
            pendingAction.type === "stop"
              ? "bg-orange-500 hover:bg-orange-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }
          onConfirm={() => {
            const { type, deploymentId } = pendingAction;
            setPendingAction(null);
            if (type === "stop") {
              stopDep.mutate(deploymentId, {
                onSuccess: () => toast.success("Deployment stopped"),
              });
            } else {
              deleteDep.mutate(deploymentId, {
                onSuccess: () => toast.success("Deployment deleted"),
              });
            }
          }}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
