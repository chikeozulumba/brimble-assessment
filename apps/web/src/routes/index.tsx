import { useState } from "react";
import { useDeployments } from "../api/client";
import { DeployForm } from "../components/DeployForm";
import { DeploymentList } from "../components/DeploymentList";

function Led({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${pulse ? "animate-led-pulse" : ""}`}
      style={{ backgroundColor: color, boxShadow: pulse ? `0 0 5px ${color}` : undefined }}
    />
  );
}

function StatChip({
  label, count, color, pulse,
}: { label: string; count: number; color: string; pulse?: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-1 rounded text-xs font-mono font-medium"
      style={{ background: `${color}14`, border: `1px solid ${color}28`, color }}
    >
      <Led color={color} pulse={pulse} />
      <span className="tabular-nums">{count}</span>
      <span className="opacity-70">{label}</span>
    </div>
  );
}

export function IndexPage() {
  const [newDepId, setNewDepId] = useState<string | undefined>();
  const { data: deployments = [] } = useDeployments();

  const counts = {
    total:     deployments.length,
    running:   deployments.filter((d) => d.status === "running").length,
    building:  deployments.filter((d) => ["building", "deploying", "pending"].includes(d.status)).length,
    failed:    deployments.filter((d) => d.status === "failed").length,
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--base)" }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-13 flex items-center gap-5" style={{ height: "52px" }}>
          {/* Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-xs font-display font-bold"
              style={{ background: "var(--accent)", color: "var(--base)" }}
            >
              B
            </div>
            <span
              className="text-sm font-display font-bold tracking-tight"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              brimble
            </span>
          </div>

          <div className="w-px h-4 shrink-0" style={{ background: "var(--border-2)" }} />

          <nav className="flex items-center gap-1">
            <span
              className="px-2.5 py-1 rounded text-xs font-medium"
              style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
            >
              deployments
            </span>
          </nav>

          {/* Live stats */}
          <div className="ml-auto flex items-center gap-2">
            {counts.running > 0 && (
              <StatChip label="running" count={counts.running} color="#3ddc84" pulse />
            )}
            {counts.building > 0 && (
              <StatChip label="building" count={counts.building} color="#fbbf24" pulse />
            )}
            {counts.failed > 0 && (
              <StatChip label="failed" count={counts.failed} color="#fb7185" />
            )}
            {counts.total > 0 && (
              <span className="text-xs font-mono ml-1" style={{ color: "var(--text-2)" }}>
                {counts.total} total
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main canvas ─────────────────────────────────────────────── */}
      <main className="flex-1 dot-grid">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Deploy panel */}
          <section
            className="rounded-lg border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div
              className="px-5 py-3.5 border-b flex items-center gap-3"
              style={{ borderColor: "var(--border)" }}
            >
              <span className="text-xs font-mono font-semibold" style={{ color: "var(--accent)" }}>
                $ deploy
              </span>
              <span className="text-xs" style={{ color: "var(--text-2)" }}>
                paste a GitHub repository URL to start a new deployment
              </span>
            </div>
            <div className="px-5 py-4">
              <DeployForm onDeployed={setNewDepId} />
            </div>
          </section>

          {/* Deployment list */}
          <section>
            <DeploymentList initialExpandId={newDepId} />
          </section>

        </div>
      </main>
    </div>
  );
}
