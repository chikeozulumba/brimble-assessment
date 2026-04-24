import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLogs, useDeployment, LogEntry } from '../api/client';
import { IconCopy, IconTerminal } from './icons';

interface Props {
  deploymentId: string;
  onClose: () => void;
}

const STREAM_COLOR: Record<string, string> = {
  stdout: '#16a34a',
  stderr: '#dc2626',
  system: '#0284c7',
};

const STREAM_LABEL: Record<string, string> = {
  stdout: 'out',
  stderr: 'err',
  system: 'sys',
};

export function LogModal({ deploymentId, onClose }: Props) {
  const { data: dep }             = useDeployment(deploymentId);
  const { data: logs, isLoading } = useLogs(deploymentId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    if (logs?.length) bottomRef.current?.scrollIntoView();
  }, [logs]);

  const handleCopy = () => {
    if (!logs) return;
    const text = logs.map((l: LogEntry) => `[${l.ts}] [${l.stream}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-5xl h-[88vh] rounded-xl overflow-hidden animate-slide-down shadow-lg"
        style={{
          background: "linear-gradient(180deg, var(--surface) 0%, var(--raised) 100%)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3.5 border-b shrink-0"
          style={{
            borderColor: "var(--border)",
            background: "linear-gradient(180deg, var(--surface) 0%, var(--raised) 100%)",
          }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg border shrink-0"
            style={{ background: "var(--raised-2)", borderColor: "var(--border)", color: "var(--text-3)" }}
            aria-hidden
          >
            <IconTerminal className="w-4 h-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
              {dep?.slug ?? "Logs"}
            </span>
            <span className="text-[11px] font-medium" style={{ color: "var(--text-3)" }}>
              Full log history
            </span>
          </div>
          {dep && (
            <span
              className="text-xs px-2 py-0.5 rounded-md font-mono font-medium shrink-0"
              style={{ background: "var(--raised-2)", color: "var(--text-2)", border: "1px solid var(--border)" }}
            >
              {dep.status}
            </span>
          )}

          <span className="ml-auto text-xs tabular-nums font-medium shrink-0" style={{ color: "var(--text-3)" }}>
            {logs?.length ?? 0} lines
          </span>

          <button
            type="button"
            onClick={handleCopy}
            className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors inline-flex items-center gap-1.5 hover:bg-[var(--raised-2)]"
            style={{ borderColor: "var(--border-2)", color: "var(--text-2)", background: "var(--surface)" }}
          >
            <IconCopy className="w-3.5 h-3.5" />
            Copy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:bg-[var(--raised-2)]"
            style={{ borderColor: "var(--border-2)", color: "var(--text-2)", background: "var(--surface)" }}
          >
            Close
          </button>
        </div>

        {/* Log body */}
        <div
          className="flex-1 overflow-y-auto font-mono text-[11px] leading-5 p-5 space-y-0.5 shadow-inner"
          style={{
            background: "linear-gradient(180deg, #141414 0%, #0d0d0d 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {isLoading && (
            <div className="flex items-center gap-2" style={{ color: "#555555" }}>
              <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Loading logs…
            </div>
          )}
          {!isLoading && !logs?.length && (
            <span style={{ color: "#555555" }}>No logs recorded.</span>
          )}
          {logs?.map((log: LogEntry) => (
            <div key={log.id} className="flex gap-2">
              <span className="shrink-0 tabular-nums select-none" style={{ color: "#444444" }}>
                {new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span
                className="shrink-0 w-7 text-right select-none"
                style={{ color: STREAM_COLOR[log.stream] ?? "#555555", opacity: 0.7 }}
              >
                {STREAM_LABEL[log.stream] ?? log.stream}
              </span>
              <span className="break-all whitespace-pre-wrap" style={{ color: "#d4d4d4" }}>{log.line}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
