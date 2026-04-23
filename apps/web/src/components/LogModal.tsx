import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLogs, useDeployment, LogEntry } from '../api/client';

interface Props {
  deploymentId: string;
  onClose: () => void;
}

const STREAM_COLOR: Record<string, string> = {
  stdout: 'var(--s-running)',
  stderr: 'var(--s-failed)',
  system: 'var(--s-deploying)',
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
      style={{ background: "rgba(7,7,14,0.90)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-5xl h-[88vh] rounded-lg overflow-hidden animate-slide-down"
        style={{ background: "var(--surface)", border: "1px solid var(--border-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--raised)" }}
        >
          {/* macOS traffic lights */}
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: "rgba(251,113,133,0.6)" }} />
            <span className="w-3 h-3 rounded-full" style={{ background: "rgba(251,191,36,0.6)" }} />
            <span className="w-3 h-3 rounded-full" style={{ background: "rgba(61,220,132,0.6)" }} />
          </div>

          <span className="text-xs font-mono font-semibold ml-2" style={{ color: "var(--text)" }}>
            {dep?.slug ?? 'logs'}
          </span>
          {dep && (
            <span
              className="text-[11px] px-2 py-0.5 rounded font-mono"
              style={{ background: "var(--raised-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
            >
              {dep.status}
            </span>
          )}

          <span className="ml-auto text-[11px] font-mono tabular-nums" style={{ color: "var(--text-3)" }}>
            {logs?.length ?? 0} lines
          </span>

          <button
            onClick={handleCopy}
            className="text-[11px] px-2.5 py-1 rounded font-mono transition-colors flex items-center gap-1.5"
            style={{ background: "var(--raised-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            copy
          </button>
          <button
            onClick={onClose}
            className="text-[11px] px-2.5 py-1 rounded font-mono transition-colors"
            style={{ background: "var(--raised-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--s-failed)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
          >
            ✕ close
          </button>
        </div>

        {/* Log body */}
        <div
          className="terminal-scan relative flex-1 overflow-y-auto font-mono text-[11px] leading-5 p-5 space-y-0.5"
          style={{ background: "var(--base)" }}
        >
          {isLoading && (
            <div className="flex items-center gap-2" style={{ color: "var(--text-3)" }}>
              <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              loading logs…
            </div>
          )}
          {!isLoading && !logs?.length && (
            <span style={{ color: "var(--text-3)" }}>no logs recorded.</span>
          )}
          {logs?.map((log: LogEntry) => (
            <div key={log.id} className="flex gap-2 group">
              <span className="shrink-0 tabular-nums select-none" style={{ color: "var(--text-3)" }}>
                {new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span
                className="shrink-0 w-7 text-right select-none"
                style={{ color: STREAM_COLOR[log.stream] ?? "var(--text-2)", opacity: 0.6 }}
              >
                {STREAM_LABEL[log.stream] ?? log.stream}
              </span>
              <span className="break-all whitespace-pre-wrap" style={{ color: "var(--text)" }}>{log.line}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
