import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BatchResult,
  Deployment,
  useBatchDeleteDeployments,
  useBatchStopDeployments,
  useDeleteDeployment,
  useDeployments,
  useRedeployDeployment,
  useStopDeployment,
} from "../api/client";
import { ConfirmModal } from "./ConfirmModal";
import { LogStream } from "./LogStream";

type PendingAction =
  | { type: "stop" | "delete"; deploymentId: string }
  | { type: "batch-stop" | "batch-delete"; ids: string[] };

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

function batchToast(action: "stopped" | "deleted", result: BatchResult) {
  if (result.failed === 0) {
    toast.success(`${result.succeeded} deployment${result.succeeded !== 1 ? "s" : ""} ${action}`);
  } else {
    toast.warning(
      `${result.succeeded} ${action}, ${result.failed} failed`,
      { description: "Some deployments could not be processed." },
    );
  }
}

export function DeploymentList({ initialExpandId }: Props) {
  const { data: deployments, isLoading } = useDeployments();
  const stopDep = useStopDeployment();
  const deleteDep = useDeleteDeployment();
  const redeploy = useRedeployDeployment();
  const batchStop = useBatchStopDeployments();
  const batchDelete = useBatchDeleteDeployments();

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandId ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const filteredIds = filtered.map((d: Deployment) => d.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id: string) => selectedIds.has(id));
  const someSelected = filteredIds.some((id: string) => selectedIds.has(id));
  const selectedInView = filteredIds.filter((id: string) => selectedIds.has(id));

  const toggle = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(filteredIds));

  const clearSelection = () => setSelectedIds(new Set());

  // Confirm modal helpers
  const modalConfig = pendingAction
    ? pendingAction.type === "stop"
      ? {
          title: "Stop deployment?",
          message: "This will stop the running container and remove its Caddy route. The record will remain.",
          confirmLabel: "Stop",
          confirmClassName: "bg-orange-500 hover:bg-orange-600 text-white",
        }
      : pendingAction.type === "delete"
      ? {
          title: "Delete deployment?",
          message: "This will permanently delete the deployment and all its logs. This cannot be undone.",
          confirmLabel: "Delete",
          confirmClassName: "bg-red-600 hover:bg-red-700 text-white",
        }
      : pendingAction.type === "batch-stop"
      ? {
          title: `Stop ${(pendingAction as { ids: string[] }).ids.length} deployment${(pendingAction as { ids: string[] }).ids.length !== 1 ? "s" : ""}?`,
          message: "All selected deployments will be stopped. Their records will remain.",
          confirmLabel: "Stop All",
          confirmClassName: "bg-orange-500 hover:bg-orange-600 text-white",
        }
      : {
          title: `Delete ${(pendingAction as { ids: string[] }).ids.length} deployment${(pendingAction as { ids: string[] }).ids.length !== 1 ? "s" : ""}?`,
          message: "All selected deployments and their logs will be permanently deleted. This cannot be undone.",
          confirmLabel: "Delete All",
          confirmClassName: "bg-red-600 hover:bg-red-700 text-white",
        }
    : null;

  const handleConfirm = () => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);

    if (action.type === "stop") {
      stopDep.mutate(action.deploymentId, {
        onSuccess: () => toast.success("Deployment stopped"),
      });
    } else if (action.type === "delete") {
      deleteDep.mutate(action.deploymentId, {
        onSuccess: () => toast.success("Deployment deleted"),
      });
    } else if (action.type === "batch-stop") {
      batchStop.mutate(action.ids, {
        onSuccess: (result) => { batchToast("stopped", result); clearSelection(); },
        onError: (err) => toast.error(err.message),
      });
    } else {
      batchDelete.mutate(action.ids, {
        onSuccess: (result) => { batchToast("deleted", result); clearSelection(); },
        onError: (err) => toast.error(err.message),
      });
    }
  };

  const isBatchBusy = batchStop.isPending || batchDelete.isPending;

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
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusColors[s]}`} />
            {s}
          </button>
        ))}
      </div>

      {/* Batch action bar */}
      {someSelected && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gray-900 text-white rounded-lg text-xs">
          <span className="font-medium mr-1">
            {selectedInView.length} selected
          </span>
          <button
            onClick={() => setPendingAction({ type: "batch-stop", ids: selectedInView })}
            disabled={isBatchBusy}
            className="px-3 py-1 rounded bg-orange-500 hover:bg-orange-400 disabled:opacity-50 font-medium"
          >
            Stop Selected
          </button>
          <button
            onClick={() => setPendingAction({ type: "batch-delete", ids: selectedInView })}
            disabled={isBatchBusy}
            className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 font-medium"
          >
            Delete Selected
          </button>
          <button
            onClick={clearSelection}
            className="ml-auto px-2 py-1 rounded text-gray-400 hover:text-white"
          >
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">
          No deployments match this filter.
        </p>
      )}

      {/* Accordion list */}
      <div className="space-y-2">
        {/* Select-all row */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-1.5">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
              onChange={toggleSelectAll}
              className="w-3.5 h-3.5 rounded accent-gray-800 cursor-pointer"
            />
            <span className="text-xs text-gray-400">Select all</span>
          </div>
        )}

        {filtered.map((dep: Deployment) => {
          const isExpanded = expandedId === dep.id;
          const isRunning = dep.status === "running";
          const isStopped = dep.status === "stopped";
          const isSelected = selectedIds.has(dep.id);

          return (
            <div
              key={dep.id}
              className={`rounded-lg border overflow-hidden transition-colors ${
                isSelected
                  ? "bg-blue-50 border-blue-200"
                  : "bg-white border-gray-200"
              }`}
            >
              {/* Summary row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => toggle(dep.id)}
              >
                {/* Checkbox — does not toggle accordion */}
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(dep.id)}
                    className="w-3.5 h-3.5 rounded accent-gray-800 cursor-pointer"
                  />
                </div>

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
                          <span className="text-red-600">{dep.errorMessage}</span>
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

                  <div className="px-5 py-4">
                    <LogStream deploymentId={dep.id} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pendingAction && modalConfig && (
        <ConfirmModal
          {...modalConfig}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
