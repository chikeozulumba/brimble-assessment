import { useState, type ReactNode } from "react";
import { useDeployments } from "../api/client";
import { DeployForm } from "../components/DeployForm";
import { DeploymentList } from "../components/DeploymentList";
import {
  IconActivity,
  IconAlertCircle,
  IconLayers,
  IconRocket,
  IconServer,
  IconWrench,
} from "../components/icons";

const S_COLOR: Record<string, string> = {
  running: "#16a34a",
  building: "#d97706",
  failed: "#dc2626",
};

function StatChip({
  label,
  count,
  color,
  pulse,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  pulse?: boolean;
  icon: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full pl-2 pr-2.5 py-1 text-xs border transition-colors"
      style={{
        color,
        borderColor: `${color}35`,
        background: `${color}0c`,
        boxShadow: `0 0 20px -8px ${color}50`,
      }}
    >
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full ${pulse ? "animate-led-pulse" : ""}`}
        style={{ background: `${color}18`, color }}
      >
        {icon}
      </span>
      <span className="font-semibold tabular-nums">{count}</span>
      <span className="font-medium opacity-80" style={{ color: "var(--text-2)" }}>
        {label}
      </span>
    </span>
  );
}

export function IndexPage() {
  const [newDepId, setNewDepId] = useState<string | undefined>();
  const { data: deployments = [] } = useDeployments();

  const counts = {
    total: deployments.length,
    running: deployments.filter((d) => d.status === "running").length,
    building: deployments.filter((d) =>
      ["building", "deploying", "pending"].includes(d.status),
    ).length,
    failed: deployments.filter((d) => d.status === "failed").length,
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--base)" }}>
      <header
        className="sticky top-0 z-30 border-b app-header-sheen"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="max-w-5xl mx-auto px-6 flex items-center gap-4"
          style={{ height: "56px" }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg border shrink-0"
            style={{
              background: "linear-gradient(145deg, var(--raised-2) 0%, var(--surface) 100%)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-xs)",
              color: "var(--text)",
            }}
            aria-hidden
          >
            <IconLayers className="w-4 h-4" strokeWidth={1.75} />
          </span>

          <div className="min-w-0 flex flex-col gap-0.5">
            <span
              className="text-sm font-semibold tracking-tight leading-none"
              style={{ color: "var(--text)" }}
            >
              brimble
            </span>
            <span className="text-[11px] leading-none" style={{ color: "var(--text-3)" }}>
              lightweight deploy control
            </span>
          </div>

          <div className="w-px h-6 shrink-0 hidden sm:block" style={{ background: "var(--border)" }} />

          <span
            className="hidden sm:inline text-sm font-medium"
            style={{ color: "var(--text-2)" }}
          >
            Deployments
          </span>

          {counts.total > 0 && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              {counts.running > 0 && (
                <StatChip
                  label="running"
                  count={counts.running}
                  color={S_COLOR.running}
                  pulse
                  icon={<IconActivity className="w-3.5 h-3.5" strokeWidth={2} />}
                />
              )}
              {counts.building > 0 && (
                <StatChip
                  label="in progress"
                  count={counts.building}
                  color={S_COLOR.building}
                  pulse
                  icon={<IconWrench className="w-3.5 h-3.5" strokeWidth={2} />}
                />
              )}
              {counts.failed > 0 && (
                <StatChip
                  label="failed"
                  count={counts.failed}
                  color={S_COLOR.failed}
                  icon={<IconAlertCircle className="w-3.5 h-3.5" strokeWidth={2} />}
                />
              )}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
                style={{
                  color: "var(--text-3)",
                  borderColor: "var(--border)",
                  background: "var(--raised-2)",
                }}
              >
                <IconServer className="w-3.5 h-3.5 opacity-70" />
                {counts.total} total
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          <section
            className="rounded-xl overflow-hidden surface-panel-elevated"
            style={{ borderColor: "var(--border)" }}
          >
            <div
              className="px-5 py-3.5 border-b flex items-start gap-3"
              style={{
                borderColor: "var(--border)",
                background: "linear-gradient(90deg, var(--raised) 0%, var(--surface) 100%)",
              }}
            >
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: "linear-gradient(135deg, #111 0%, #333 100%)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(17,17,17,0.2)",
                }}
                aria-hidden
              >
                <IconRocket className="w-4 h-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                  New deployment
                </p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-2)" }}>
                  Paste a Git repository URL. GitHub repos can add environment variables before deploy.
                </p>
              </div>
            </div>
            <div className="px-5 py-5" style={{ background: "var(--surface)" }}>
              <DeployForm onDeployed={setNewDepId} />
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 px-0.5">
              <IconServer className="w-4 h-4" style={{ color: "var(--text-3)" }} />
              <h2 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text)" }}>
                Your deployments
              </h2>
            </div>
            <DeploymentList initialExpandId={newDepId} />
          </section>
        </div>
      </main>
    </div>
  );
}
