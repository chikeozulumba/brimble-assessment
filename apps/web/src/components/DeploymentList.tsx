import { useEffect, useState, type ReactNode } from "react";
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
import {
  IconCalendar,
  IconChevronDown,
  IconExternalLink,
  IconFilter,
  IconGitBranch,
  IconInbox,
  IconLayoutGrid,
  IconRefresh,
  IconStop,
  IconTrash,
} from "./icons";
import { LogStream } from "./LogStream";

/* ── Status ─────────────────────────────────────────────────────────── */

const S_COLOR: Record<string, string> = {
  pending: "#7c3aed",
  building: "#d97706",
  deploying: "#0284c7",
  running: "#16a34a",
  failed: "#dc2626",
  stopped: "#a3a3a3",
};

const S_ACTIVE = new Set(["pending", "building", "deploying", "running"]);
const ALL_STATUSES = [
  "pending",
  "building",
  "deploying",
  "running",
  "failed",
  "stopped",
] as const;

function FilterChipIcon({ status }: { status: (typeof ALL_STATUSES)[number] | null }) {
  const c = "w-3.5 h-3.5 shrink-0";
  if (status === null) return <IconFilter className={c} style={{ color: "var(--text-3)" }} />;
  const color = S_COLOR[status] ?? "#a3a3a3";
  switch (status) {
    case "pending":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="2" fill={color} stroke="none" />
        </svg>
      );
    case "building":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"
          />
        </svg>
      );
    case "deploying":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.52 2.52 14.98 14.98 0 002.4 8.64 14.98 14.98 0 008.64 21.76m0-4.8v4.8"
          />
        </svg>
      );
    case "running":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    case "failed":
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "stopped":
      return <IconStop className={c} style={{ color }} />;
    default:
      return null;
  }
}

/* ── Types ──────────────────────────────────────────────────────────── */

type PendingAction =
  | { type: "stop" | "delete"; deploymentId: string }
  | { type: "batch-stop" | "batch-delete"; ids: string[] };

/* ── Small components ───────────────────────────────────────────────── */

function Dot({ status }: { status: string }) {
  const color = S_COLOR[status] ?? "#a3a3a3";
  const pulse = S_ACTIVE.has(status);
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${pulse ? "animate-led-pulse" : ""}`}
      style={{ backgroundColor: color }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = S_COLOR[status] ?? "#a3a3a3";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium"
      style={{
        background: `${color}12`,
        color,
        border: `1px solid ${color}28`,
      }}
    >
      <Dot status={status} />
      {status}
    </span>
  );
}

function Btn({
  onClick,
  disabled,
  variant = "default",
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "warn" | "danger";
  icon?: ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    default: {
      color: "var(--text-2)",
      bg: "transparent",
      border: "var(--border-2)",
      hoverBg: "var(--raised-2)",
      hoverColor: "var(--text)",
    },
    warn: {
      color: "#d97706",
      bg: "transparent",
      border: "transparent",
      hoverBg: "rgba(217,119,6,0.06)",
      hoverColor: "#d97706",
    },
    danger: {
      color: "var(--text-2)",
      bg: "transparent",
      border: "transparent",
      hoverBg: "rgba(220,38,38,0.06)",
      hoverColor: "#dc2626",
    },
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-30"
      style={{
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = styles.hoverBg;
        el.style.color = styles.hoverColor;
        if (variant === "default") el.style.borderColor = "var(--border-2)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = styles.bg;
        el.style.color = styles.color;
        if (variant === "default") el.style.borderColor = styles.border;
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function PropRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex gap-4 py-2 border-b"
      style={{ borderColor: "var(--border)" }}
    >
      <dt className="w-16 text-xs shrink-0" style={{ color: "var(--text-3)" }}>
        {label}
      </dt>
      <dd
        className="text-xs break-all font-mono"
        style={{ color: "var(--text-2)" }}
      >
        {children}
      </dd>
    </div>
  );
}

function batchToast(action: "stopped" | "deleted", r: BatchResult) {
  const n = r.succeeded;
  r.failed === 0
    ? toast.success(`${n} deployment${n !== 1 ? "s" : ""} ${action}`)
    : toast.warning(`${n} ${action}, ${r.failed} failed`);
}

/* ── Main ───────────────────────────────────────────────────────────── */

export function DeploymentList({
  initialExpandId,
}: {
  initialExpandId?: string;
}) {
  const { data: deployments, isLoading } = useDeployments();
  const stopDep = useStopDeployment();
  const deleteDep = useDeleteDeployment();
  const redeploy = useRedeployDeployment();
  const batchStop = useBatchStopDeployments();
  const batchDelete = useBatchDeleteDeployments();

  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialExpandId ?? null,
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

  useEffect(() => {
    if (initialExpandId) setExpandedId(initialExpandId);
  }, [initialExpandId]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 rounded-xl border animate-pulse surface-panel-elevated"
            style={{
              background: "var(--raised)",
              borderColor: "var(--border)",
            }}
          />
        ))}
      </div>
    );
  }

  if (!deployments?.length) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 px-6 rounded-xl border border-dashed text-center surface-panel-elevated"
        style={{
          borderColor: "var(--border-2)",
          background: "linear-gradient(180deg, var(--surface) 0%, var(--raised) 100%)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <span
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border"
          style={{
            background: "var(--raised-2)",
            borderColor: "var(--border)",
            color: "var(--text-3)",
          }}
          aria-hidden
        >
          <IconInbox className="w-7 h-7" strokeWidth={1.5} />
        </span>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          No deployments yet
        </p>
        <p className="text-xs mt-1.5 max-w-xs leading-relaxed" style={{ color: "var(--text-2)" }}>
          Deploy a Git repository from the panel above. Live status and logs appear here as soon as the
          pipeline starts.
        </p>
      </div>
    );
  }

  const filtered = statusFilter
    ? deployments.filter((d: Deployment) => d.status === statusFilter)
    : deployments;
  const filteredIds = filtered.map((d: Deployment) => d.id);
  const allSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id: string) => selectedIds.has(id));
  const someSelected = filteredIds.some((id: string) => selectedIds.has(id));
  const selectedInView = filteredIds.filter((id: string) =>
    selectedIds.has(id),
  );

  const toggle = (id: string) => setExpandedId((p) => (p === id ? null : id));
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(filteredIds));
  const clearSel = () => setSelectedIds(new Set());

  type ModalCfg = {
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
  };
  const modalCfg: ModalCfg | null = pendingAction
    ? pendingAction.type === "stop"
      ? {
          title: "Stop deployment",
          message:
            "The container will be stopped and its route removed. The record is kept.",
          confirmLabel: "Stop",
          danger: false,
        }
      : pendingAction.type === "delete"
        ? {
            title: "Delete deployment",
            message:
              "This deployment and all its logs will be permanently removed.",
            confirmLabel: "Delete",
            danger: true,
          }
        : pendingAction.type === "batch-stop"
          ? {
              title: `Stop ${(pendingAction as any).ids.length} deployments`,
              message: "All selected containers will be stopped.",
              confirmLabel: "Stop all",
              danger: false,
            }
          : {
              title: `Delete ${(pendingAction as any).ids.length} deployments`,
              message: "All selected deployments will be permanently deleted.",
              confirmLabel: "Delete all",
              danger: true,
            }
    : null;

  const handleConfirm = () => {
    if (!pendingAction) return;
    const a = pendingAction;
    setPendingAction(null);
    if (a.type === "stop")
      stopDep.mutate(a.deploymentId, {
        onSuccess: () => toast.success("Deployment stopped"),
      });
    else if (a.type === "delete")
      deleteDep.mutate(a.deploymentId, {
        onSuccess: () => toast.success("Deployment deleted"),
      });
    else if (a.type === "batch-stop")
      batchStop.mutate(a.ids, {
        onSuccess: (r) => {
          batchToast("stopped", r);
          clearSel();
        },
      });
    else
      batchDelete.mutate((a as any).ids, {
        onSuccess: (r) => {
          batchToast("deleted", r);
          clearSel();
        },
      });
  };

  const isBatchBusy = batchStop.isPending || batchDelete.isPending;

  return (
    <div className="space-y-3">
      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1.5 flex-wrap rounded-xl border px-2 py-2"
        style={{
          background: "linear-gradient(180deg, var(--surface) 0%, var(--raised) 100%)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        {([null, ...ALL_STATUSES] as const).map((s) => {
          const active = statusFilter === s;
          const color = s ? S_COLOR[s] : undefined;
          return (
            <button
              key={s ?? "all"}
              type="button"
              onClick={() => setStatusFilter(active ? null : s)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
              style={{
                background: active
                  ? s
                    ? `${color}14`
                    : "var(--raised-2)"
                  : "transparent",
                color: active ? (s ? color! : "var(--text)") : "var(--text-3)",
                border: `1px solid ${active ? (s ? `${color}38` : "var(--border-2)") : "transparent"}`,
                fontWeight: active ? 600 : 500,
                boxShadow: active && s ? `0 0 16px -6px ${color}55` : undefined,
              }}
            >
              <FilterChipIcon status={s} />
              <span className="capitalize">{s ?? "all"}</span>
            </button>
          );
        })}

        <span
          className="ml-auto text-xs font-medium tabular-nums px-1"
          style={{ color: "var(--text-2)" }}
        >
          {filtered.length}
          {deployments.length !== filtered.length ? ` / ${deployments.length}` : ""}{" "}
          <span style={{ color: "var(--text-3)", fontWeight: 500 }}>deployments</span>
        </span>
      </div>

      {/* ── Batch action bar ────────────────────────────────────────── */}
      {someSelected && (
        <div
          className="animate-slide-down flex items-center gap-2 px-4 py-3 rounded-xl border"
          style={{
            background: "linear-gradient(90deg, var(--raised) 0%, var(--surface) 55%)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-sm), 0 0 0 1px rgba(217,119,6,0.08)",
          }}
        >
          <span className="text-xs font-semibold" style={{ color: "var(--text)" }}>
            {selectedInView.length} selected
          </span>
          <div className="w-px h-4 mx-0.5" style={{ background: "var(--border-2)" }} />
          <Btn
            variant="warn"
            icon={<IconStop className="w-3.5 h-3.5" />}
            onClick={() =>
              setPendingAction({ type: "batch-stop", ids: selectedInView })
            }
            disabled={isBatchBusy}
          >
            Stop
          </Btn>
          <Btn
            variant="danger"
            icon={<IconTrash className="w-3.5 h-3.5" />}
            onClick={() =>
              setPendingAction({ type: "batch-delete", ids: selectedInView })
            }
            disabled={isBatchBusy}
          >
            Delete
          </Btn>
          <button
            type="button"
            onClick={clearSel}
            className="ml-auto text-xs font-medium rounded-md px-2 py-1 transition-colors hover:bg-[var(--raised-2)]"
            style={{ color: "var(--text-3)" }}
          >
            Clear
          </button>
        </div>
      )}

      {/* ── Select-all ──────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected && !allSelected;
            }}
            onChange={toggleAll}
            className="w-3.5 h-3.5 cursor-pointer rounded"
          />
          <span
            className="text-xs select-none"
            style={{ color: "var(--text-3)" }}
          >
            Select all
          </span>
        </div>
      )}

      {filtered.length === 0 && (
        <p
          className="text-xs text-center py-8"
          style={{ color: "var(--text-3)" }}
        >
          No deployments match this filter
        </p>
      )}

      {/* ── Deployment cards ────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {filtered.map((dep: Deployment, idx: number) => {
          const isExpanded = expandedId === dep.id;
          const isStopped = dep.status === "stopped";
          const isSelected = selectedIds.has(dep.id);
          const sColor = S_COLOR[dep.status] ?? "#a3a3a3";

          return (
            <div
              key={dep.id}
              className="card-enter rounded-xl border overflow-hidden surface-panel-elevated"
              style={{
                animationDelay: `${idx * 20}ms`,
                borderColor: isSelected ? "var(--text)" : "var(--border)",
                boxShadow: isSelected
                  ? "var(--shadow-card-hover), 0 0 0 2px var(--accent-glow)"
                  : undefined,
              }}
            >
              {/* ── Summary row ───────────────────────────────────────── */}
              <div
                className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors hover:bg-[var(--raised)]"
                onClick={() => toggle(dep.id)}
              >
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(dep.id)}
                    className="w-3.5 h-3.5 cursor-pointer rounded"
                  />
                </div>

                {/* Status dot */}
                <Dot status={dep.status} />

                {/* Status label */}
                <span
                  className="text-xs w-[68px] shrink-0 font-medium"
                  style={{ color: sColor }}
                >
                  {dep.status}
                </span>

                {/* Slug */}
                <span
                  className="text-sm font-medium shrink-0"
                  style={{ color: "var(--text)" }}
                >
                  {dep.slug}
                </span>

                {/* Source */}
                <span
                  className="text-xs min-w-0 flex-1 flex items-center gap-1.5"
                  style={{ color: "var(--text-2)" }}
                >
                  <IconGitBranch className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span className="truncate min-w-0">{dep.source.replace(/^https?:\/\/(www\.)?/, "")}</span>
                </span>

                {/* Date */}
                <span
                  className="text-xs whitespace-nowrap shrink-0 hidden md:inline-flex items-center gap-1"
                  style={{ color: "var(--text-3)" }}
                >
                  <IconCalendar className="w-3.5 h-3.5 opacity-70" />
                  {new Date(dep.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  {new Date(dep.createdAt).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                <IconChevronDown
                  className="w-3.5 h-3.5 shrink-0 transition-transform duration-200"
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    color: "var(--text-3)",
                  }}
                />

                {/* Actions */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Btn
                    disabled={redeploy.isPending}
                    icon={<IconRefresh className="w-3.5 h-3.5" />}
                    onClick={() =>
                      redeploy.mutate(dep.id, {
                        onSuccess: (d) =>
                          toast.success("Redeployment started", {
                            description: d.slug,
                          }),
                      })
                    }
                  >
                    Redeploy
                  </Btn>
                  <Btn
                    variant="warn"
                    icon={<IconStop className="w-3.5 h-3.5" />}
                    disabled={stopDep.isPending || isStopped}
                    onClick={() =>
                      setPendingAction({ type: "stop", deploymentId: dep.id })
                    }
                  >
                    Stop
                  </Btn>
                  <Btn
                    variant="danger"
                    icon={<IconTrash className="w-3.5 h-3.5" />}
                    disabled={deleteDep.isPending}
                    onClick={() =>
                      setPendingAction({ type: "delete", deploymentId: dep.id })
                    }
                  >
                    Delete
                  </Btn>
                </div>
              </div>

              {/* ── Accordion body ──────────────────────────────────────── */}
              <div className={`collapsible ${isExpanded ? "open" : ""}`}>
                <div>
                  <div
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr]">
                      {/* Left — properties */}
                      <div
                        className="px-5 py-4 border-b lg:border-b-0 lg:border-r"
                        style={{
                          borderColor: "var(--border)",
                          background: "linear-gradient(180deg, var(--raised) 0%, var(--surface) 100%)",
                        }}
                      >
                        <p
                          className="text-xs font-semibold mb-3 inline-flex items-center gap-2"
                          style={{ color: "var(--text-2)" }}
                        >
                          <IconLayoutGrid className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                          Properties
                        </p>
                        <dl>
                          <PropRow label="id">{dep.slug}</PropRow>
                          <PropRow label="status">
                            <StatusBadge status={dep.status} />
                          </PropRow>
                          <PropRow label="source">
                            <a
                              href={dep.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 hover:underline group"
                              style={{ color: "var(--text)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <IconGitBranch className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-80" />
                              <span>{dep.source.replace(/^https?:\/\/(www\.)?/, "")}</span>
                              <IconExternalLink className="w-3 h-3 shrink-0 opacity-40" />
                            </a>
                          </PropRow>
                          {dep.publicUrl && (
                            <PropRow label="url">
                              <a
                                href={dep.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 hover:underline group"
                                style={{ color: "var(--s-deploying)" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="break-all">{dep.publicUrl}</span>
                                <IconExternalLink className="w-3.5 h-3.5 shrink-0 opacity-60" />
                              </a>
                            </PropRow>
                          )}
                          <PropRow label="image">{dep.imageTag ?? "—"}</PropRow>
                          <PropRow label="created">
                            {new Date(dep.createdAt).toLocaleString()}
                          </PropRow>
                          <PropRow label="updated">
                            {new Date(dep.updatedAt).toLocaleString()}
                          </PropRow>
                          {dep.errorMessage && (
                            <PropRow label="error">
                              <span style={{ color: "var(--s-failed)" }}>
                                {dep.errorMessage}
                              </span>
                            </PropRow>
                          )}
                        </dl>

                        {dep.envVars && Object.keys(dep.envVars).length > 0 && (
                          <div className="mt-4">
                            <p
                              className="text-xs font-medium mb-2"
                              style={{ color: "var(--text-3)" }}
                            >
                              Environment
                            </p>
                            <div
                              className="rounded px-3 py-2 space-y-1 font-mono text-xs"
                              style={{
                                background: "var(--raised-2)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              {Object.entries(dep.envVars).map(([k, v]) => (
                                <div key={k} className="flex gap-2">
                                  <span style={{ color: "var(--text)" }}>
                                    {k}
                                  </span>
                                  <span style={{ color: "var(--text-3)" }}>
                                    =
                                  </span>
                                  <span style={{ color: "var(--text-2)" }}>
                                    {v}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right — logs */}
                      <div className="px-5 py-4">
                        <LogStream deploymentId={dep.id} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {pendingAction && modalCfg && (
        <ConfirmModal
          title={modalCfg.title}
          message={modalCfg.message}
          confirmLabel={modalCfg.confirmLabel}
          danger={modalCfg.danger}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
