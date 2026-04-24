import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDeployment, LogEntry } from '../api/client';
import { IconActivity, IconMaximize2, IconTerminal } from './icons';
import { LogModal } from './LogModal';

interface Props {
  deploymentId: string;
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

export function LogStream({ deploymentId }: Props) {
  const { data: dep, refetch: refetchDep } = useDeployment(deploymentId);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [connected, setConnected]   = useState(false);
  const [done, setDone]             = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const esRef                = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    esRef.current?.close();
    setLogs([]);
    setLiveStatus(null);
    setDone(false);
    setConnected(false);

    const es = new EventSource(`/api/deployments/${deploymentId}/logs/stream`);
    esRef.current = es;

    es.addEventListener('log', (e) => {
      setLogs((prev) => [...prev, JSON.parse(e.data)]);
      setConnected(true);
    });
    es.addEventListener('status', (e) => {
      setLiveStatus(JSON.parse(e.data).status);
      refetchDep();
    });
    es.addEventListener('done', () => {
      setDone(true);
      setConnected(false);
      es.close();
      refetchDep();
    });
    es.onopen  = () => setConnected(true);
    es.onerror = () => { setConnected(false); es.close(); };
  }, [deploymentId, refetchDep]);

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, [connect]);

  /** Keep tail visible inside the terminal only — avoid `scrollIntoView`, which scrolls the page. */
  useLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs]);

  const status = liveStatus ?? dep?.status ?? '…';
  /** Pipeline or container still active (matches API terminal: failed, stopped). */
  const inProgress = ['pending', 'queued', 'building', 'deploying', 'running'].includes(String(status));
  const streamClosed = done && status === 'running';

  return (
    <div className="flex flex-col h-full">
      {showModal && <LogModal deploymentId={deploymentId} onClose={() => setShowModal(false)} />}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-2)" }}>
          <IconTerminal className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
          Logs
        </span>

        {connected && !done && inProgress && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full pl-2 pr-2 py-0.5 border"
            style={{ color: "#15803d", borderColor: "rgba(22,163,74,0.25)", background: "rgba(22,163,74,0.08)" }}
          >
            <IconActivity className="w-3 h-3 animate-led-pulse" style={{ color: "#16a34a" }} />
            Live
          </span>
        )}
        {done && !inProgress && (
          <span className="text-xs font-medium rounded-full px-2 py-0.5 border" style={{ color: "var(--text-3)", borderColor: "var(--border)", background: "var(--raised-2)" }}>
            ended
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {streamClosed && (
            <button
              type="button"
              onClick={connect}
              className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors hover:bg-[var(--raised-2)]"
              style={{ borderColor: "var(--border-2)", color: "var(--text-2)", background: "var(--surface)" }}
            >
              Reconnect
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-xs inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors hover:bg-[var(--raised-2)]"
            style={{ borderColor: "var(--border-2)", color: "var(--text-2)", background: "var(--surface)" }}
          >
            <IconMaximize2 className="w-3.5 h-3.5 opacity-80" />
            Full logs
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto rounded-xl p-4 font-mono text-[11px] leading-5 min-h-[260px] max-h-[420px] shadow-inner overscroll-y-contain"
        style={{
          background: "linear-gradient(180deg, #141414 0%, #0d0d0d 100%)",
          border: "1px solid #262626",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {logs.length === 0 && !done && (
          <div className="flex items-center gap-2" style={{ color: "#555555" }}>
            <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Waiting for logs…
          </div>
        )}
        {logs.length === 0 && done && (
          <span style={{ color: "#555555" }}>No logs recorded.</span>
        )}
        {logs.map((log) => (
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
      </div>
    </div>
  );
}
