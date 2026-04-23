import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BatchResult, Deployment,
  useBatchDeleteDeployments, useBatchStopDeployments,
  useDeleteDeployment, useDeployments,
  useRedeployDeployment, useStopDeployment,
} from "../api/client";
import { ConfirmModal } from "./ConfirmModal";
import { LogStream } from "./LogStream";

/* ── Status maps ───────────────────────────────────────────────────── */

const S_COLOR: Record<string, string> = {
  pending:   "#818cf8",
  building:  "#fbbf24",
  deploying: "#38bdf8",
  running:   "#3ddc84",
  failed:    "#fb7185",
  stopped:   "#2e2e48",
};

const S_ACTIVE = new Set(["pending", "building", "deploying", "running"]);

const ALL_STATUSES = ["pending", "building", "deploying", "running", "failed", "stopped"] as const;

/* ── Types ─────────────────────────────────────────────────────────── */

type PendingAction =
  | { type: "stop" | "delete"; deploymentId: string }
  | { type: "batch-stop" | "batch-delete"; ids: string[] };

/* ── Small components ──────────────────────────────────────────────── */

function Led({ status }: { status: string }) {
  const color = S_COLOR[status] ?? "#3d3d58";
  const pulse = S_ACTIVE.has(status) && status !== "stopped";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${pulse ? "animate-led-pulse" : ""}`}
      style={{ backgroundColor: color, boxShadow: pulse ? `0 0 6px ${color}` : undefined }}
    />
  );
}

function StatusBadge({ status }: { status: string }) {
  const color = S_COLOR[status] ?? "#3d3d58";
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      <Led status={status} />
      {status}
    </span>
  );
}

function Btn({
  onClick, disabled, tone = "ghost", children,
}: { onClick: () => void; disabled?: boolean; tone?: "ghost" | "warn" | "danger"; children: React.ReactNode }) {
  const styles = {
    ghost:  { bg: "var(--raised-2)", color: "var(--text-2)", border: "var(--border-2)", hover: "var(--raised)" },
    warn:   { bg: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "rgba(251,191,36,0.2)", hover: "rgba(251,191,36,0.14)" },
    danger: { bg: "rgba(251,113,133,0.08)", color: "#fb7185", border: "rgba(251,113,133,0.2)", hover: "rgba(251,113,133,0.14)" },
  }[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-colors disabled:opacity-30"
      style={{ background: styles.bg, color: styles.color, border: `1px solid ${styles.border}` }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = styles.hover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = styles.bg; }}
    >
      {children}
    </button>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
      <dt className="w-20 text-[11px] font-mono shrink-0 pt-px" style={{ color: "var(--text-2)" }}>{label}</dt>
      <dd className="text-[11px] font-mono break-all leading-4" style={{ color: "var(--text)" }}>{children}</dd>
    </div>
  );
}

function batchToast(action: "stopped" | "deleted", r: BatchResult) {
  const n = r.succeeded;
  r.failed === 0
    ? toast.success(`${n} deployment${n !== 1 ? "s" : ""} ${action}`)
    : toast.warning(`${n} ${action}, ${r.failed} failed`, { description: "Some operations did not complete." });
}

/* ── Main ──────────────────────────────────────────────────────────── */

export function DeploymentList({ initialExpandId }: { initialExpandId?: string }) {
  const { data: deployments, isLoading } = useDeployments();
  const stopDep     = useStopDeployment();
  const deleteDep   = useDeleteDeployment();
  const redeploy    = useRedeployDeployment();
  const batchStop   = useBatchStopDeployments();
  const batchDelete = useBatchDeleteDeployments();

  const [statusFilter,  setStatusFilter]  = useState<string | null>(null);
  const [expandedId,    setExpandedId]    = useState<string | null>(initialExpandId ?? null);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  useEffect(() => { if (initialExpandId) setExpandedId(initialExpandId); }, [initialExpandId]);

  /* Loading skeleton */
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg border animate-pulse" style={{ background: "var(--surface)", borderColor: "var(--border)" }} />
        ))}
      </div>
    );
  }

  /* Empty state */
  if (!deployments?.length) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed"
        style={{ borderColor: "var(--border-2)", background: "var(--surface)" }}
      >
        <span className="text-2xl mb-3 opacity-30">⬡</span>
        <p className="text-sm font-mono" style={{ color: "var(--text-2)" }}>no deployments yet</p>
        <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>deploy a repository to get started</p>
      </div>
    );
  }

  const filtered      = statusFilter ? deployments.filter((d: Deployment) => d.status === statusFilter) : deployments;
  const filteredIds   = filtered.map((d: Deployment) => d.id);
  const allSelected   = filteredIds.length > 0 && filteredIds.every((id: string) => selectedIds.has(id));
  const someSelected  = filteredIds.some((id: string) => selectedIds.has(id));
  const selectedInView = filteredIds.filter((id: string) => selectedIds.has(id));

  const toggle        = (id: string) => setExpandedId((p) => (p === id ? null : id));
  const toggleSelect  = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll     = () => setSelectedIds(allSelected ? new Set() : new Set(filteredIds));
  const clearSel      = () => setSelectedIds(new Set());

  /* Confirm modal config */
  type ModalCfg = { title: string; message: string; confirmLabel: string; danger?: boolean };
  const modalCfg: ModalCfg | null = pendingAction
    ? pendingAction.type === "stop"
      ? { title: "Stop deployment", message: "Container will be stopped and its route removed. Record stays.", confirmLabel: "Stop", danger: false }
      : pendingAction.type === "delete"
      ? { title: "Delete deployment", message: "The deployment and all logs will be permanently removed.", confirmLabel: "Delete", danger: true }
      : pendingAction.type === "batch-stop"
      ? { title: `Stop ${(pendingAction as any).ids.length} deployments`, message: "All selected containers will be stopped.", confirmLabel: "Stop all", danger: false }
      : { title: `Delete ${(pendingAction as any).ids.length} deployments`, message: "All selected deployments and logs will be permanently deleted.", confirmLabel: "Delete all", danger: true }
    : null;

  const handleConfirm = () => {
    if (!pendingAction) return;
    const a = pendingAction;
    setPendingAction(null);
    if (a.type === "stop")         stopDep.mutate(a.deploymentId,    { onSuccess: () => toast.success("Deployment stopped") });
    else if (a.type === "delete")  deleteDep.mutate(a.deploymentId,  { onSuccess: () => toast.success("Deployment deleted") });
    else if (a.type === "batch-stop")
      batchStop.mutate(a.ids, { onSuccess: (r) => { batchToast("stopped", r); clearSel(); }, onError: (e) => toast.error(e.message) });
    else
      batchDelete.mutate((a as any).ids, { onSuccess: (r) => { batchToast("deleted", r); clearSel(); }, onError: (e) => toast.error(e.message) });
  };

  const isBatchBusy = batchStop.isPending || batchDelete.isPending;

  return (
    <div className="space-y-3">

      {/* ── Toolbar row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono mr-1" style={{ color: "var(--text-2)" }}>filter</span>
        <button
          onClick={() => setStatusFilter(null)}
          className="px-2.5 py-0.5 rounded text-[11px] font-mono transition-colors"
          style={{
            background: statusFilter === null ? "var(--accent-dim)" : "var(--raised)",
            color: statusFilter === null ? "var(--accent)" : "var(--text-2)",
            border: `1px solid ${statusFilter === null ? "var(--accent-glow)" : "var(--border)"}`,
          }}
        >
          all
        </button>
        {ALL_STATUSES.map((s) => {
          const active = statusFilter === s;
          const c = S_COLOR[s];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? null : s)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono transition-colors"
              style={{
                background: active ? `${c}18` : "var(--raised)",
                color: active ? c : "var(--text-2)",
                border: `1px solid ${active ? `${c}40` : "var(--border)"}`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
              {s}
            </button>
          );
        })}

        <span className="ml-auto text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
          {filtered.length} / {deployments.length}
        </span>
      </div>

      {/* ── Batch action bar ────────────────────────────────────────── */}
      {someSelected && (
        <div
          className="animate-slide-down flex items-center gap-2 px-4 py-2.5 rounded-lg border"
          style={{ background: "var(--raised-2)", borderColor: "var(--accent-glow)" }}
        >
          <Led status="running" />
          <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>
            {selectedInView.length} selected
          </span>
          <div className="w-px h-3.5 mx-1" style={{ background: "var(--border-2)" }} />
          <Btn tone="warn" onClick={() => setPendingAction({ type: "batch-stop", ids: selectedInView })} disabled={isBatchBusy}>
            stop selected
          </Btn>
          <Btn tone="danger" onClick={() => setPendingAction({ type: "batch-delete", ids: selectedInView })} disabled={isBatchBusy}>
            delete selected
          </Btn>
          <button
            onClick={clearSel}
            className="ml-auto text-[11px] font-mono transition-colors"
            style={{ color: "var(--text-2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
          >
            ✕ clear
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-xs font-mono text-center py-8" style={{ color: "var(--text-3)" }}>
          no deployments match this filter
        </p>
      )}

      {/* ── Select-all ──────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
            onChange={toggleAll}
            className="w-3.5 h-3.5 cursor-pointer rounded accent-[#3ddc84]"
          />
          <span className="text-[11px] font-mono select-none" style={{ color: "var(--text-3)" }}>
            select all
          </span>
        </div>
      )}

      {/* ── Deployment cards ────────────────────────────────────────── */}
      <div className="space-y-1.5">
        {filtered.map((dep: Deployment, idx: number) => {
          const isExpanded = expandedId === dep.id;
          const isStopped  = dep.status === "stopped";
          const isSelected = selectedIds.has(dep.id);
          const sColor     = S_COLOR[dep.status] ?? "#3d3d58";

          return (
            <div
              key={dep.id}
              className="card-enter rounded-lg border overflow-hidden transition-shadow"
              style={{
                animationDelay: `${idx * 25}ms`,
                background: isSelected ? "var(--raised)" : "var(--surface)",
                borderColor: isSelected ? "var(--accent-glow)" : "var(--border)",
                borderLeftColor: sColor,
                borderLeftWidth: "3px",
              }}
            >
              {/* ── Summary row ─────────────────────────────────────── */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none group"
                onClick={() => toggle(dep.id)}
              >
                {/* Checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(dep.id)}
                    className="w-3.5 h-3.5 cursor-pointer rounded accent-[#3ddc84]"
                  />
                </div>

                {/* Chevron */}
                <svg
                  className="w-3 h-3 shrink-0 transition-transform duration-300"
                  style={{
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    color: isExpanded ? "var(--accent)" : "var(--text-3)",
                  }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>

                {/* Status + slug */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <Led status={dep.status} />
                  <span className="text-[11px] font-mono w-[72px]" style={{ color: sColor }}>{dep.status}</span>
                </div>

                <span
                  className="font-mono text-xs font-semibold shrink-0"
                  style={{ color: "var(--text)" }}
                >
                  {dep.slug}
                </span>

                <span
                  className="text-[11px] font-mono truncate min-w-0 flex-1"
                  style={{ color: "var(--text-2)" }}
                  title={dep.source}
                >
                  {dep.source.replace(/^https?:\/\/(www\.)?/, "")}
                </span>

                <span className="text-[11px] font-mono whitespace-nowrap shrink-0 hidden lg:block" style={{ color: "var(--text-3)" }}>
                  {new Date(dep.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  {" "}
                  {new Date(dep.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Btn tone="ghost" disabled={redeploy.isPending}
                    onClick={() => redeploy.mutate(dep.id, { onSuccess: (d) => toast.success("Redeployment started", { description: d.slug }) })}>
                    redeploy
                  </Btn>
                  <Btn tone="warn" disabled={stopDep.isPending || isStopped}
                    onClick={() => setPendingAction({ type: "stop", deploymentId: dep.id })}>
                    stop
                  </Btn>
                  <Btn tone="danger" disabled={deleteDep.isPending}
                    onClick={() => setPendingAction({ type: "delete", deploymentId: dep.id })}>
                    delete
                  </Btn>
                </div>
              </div>

              {/* ── Accordion body ───────────────────────────────────── */}
              <div className={`collapsible ${isExpanded ? "open" : ""}`}>
                <div>
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr]">

                      {/* Left — properties ──────────────────────────── */}
                      <div
                        className="px-5 py-4 border-b lg:border-b-0 lg:border-r"
                        style={{ borderColor: "var(--border)", background: "var(--raised)" }}
                      >
                        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-3)" }}>
                          properties
                        </p>
                        <dl className="divide-y" style={{ borderColor: "var(--border)" }}>
                          <PropRow label="id">
                            <span style={{ color: "var(--text-2)" }}>{dep.id}</span>
                          </PropRow>
                          <PropRow label="status">
                            <StatusBadge status={dep.status} />
                          </PropRow>
                          <PropRow label="source">
                            <a
                              href={dep.source} target="_blank" rel="noopener noreferrer"
                              className="hover:underline"
                              style={{ color: "var(--accent)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {dep.source.replace(/^https?:\/\/(www\.)?/, "")}
                            </a>
                          </PropRow>
                          {dep.publicUrl && (
                            <PropRow label="url">
                              <a href={dep.publicUrl} target="_blank" rel="noopener noreferrer"
                                className="hover:underline" style={{ color: "var(--s-deploying)" }}
                                onClick={(e) => e.stopPropagation()}>
                                {dep.publicUrl}
                              </a>
                            </PropRow>
                          )}
                          <PropRow label="image">
                            <span style={{ color: "var(--text-2)" }}>{dep.imageTag ?? "—"}</span>
                          </PropRow>
                          <PropRow label="created">
                            <span style={{ color: "var(--text-2)" }}>{new Date(dep.createdAt).toLocaleString()}</span>
                          </PropRow>
                          <PropRow label="updated">
                            <span style={{ color: "var(--text-2)" }}>{new Date(dep.updatedAt).toLocaleString()}</span>
                          </PropRow>
                          {dep.errorMessage && (
                            <PropRow label="error">
                              <span style={{ color: "var(--s-failed)" }}>{dep.errorMessage}</span>
                            </PropRow>
                          )}
                        </dl>

                        {/* Env vars */}
                        {dep.envVars && Object.keys(dep.envVars).length > 0 && (
                          <div className="mt-4">
                            <p className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-3)" }}>
                              env vars
                            </p>
                            <div
                              className="rounded px-3 py-2 space-y-1 font-mono text-[11px]"
                              style={{ background: "var(--base)", border: "1px solid var(--border)" }}
                            >
                              {Object.entries(dep.envVars).map(([k, v]) => (
                                <div key={k} className="flex gap-1.5">
                                  <span style={{ color: "var(--s-pending)" }}>{k}</span>
                                  <span style={{ color: "var(--text-3)" }}>=</span>
                                  <span style={{ color: "var(--s-running)" }}>{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right — logs ───────────────────────────────── */}
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

      {/* Confirm modal */}
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
