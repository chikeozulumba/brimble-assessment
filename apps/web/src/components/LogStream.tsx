import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeployment, LogEntry } from '../api/client';
import { LogModal } from './LogModal';

interface Props {
  deploymentId: string;
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

export function LogStream({ deploymentId }: Props) {
  const { data: dep, refetch: refetchDep } = useDeployment(deploymentId);
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [connected, setConnected]   = useState(false);
  const [done, setDone]             = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const status    = liveStatus ?? dep?.status ?? '…';
  const isRunning = status === 'running';
  const streamClosed = done && isRunning;

  return (
    <div className="flex flex-col h-full">
      {showModal && <LogModal deploymentId={deploymentId} onClose={() => setShowModal(false)} />}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: "var(--text-3)" }}>
          logs
        </p>

        {connected && isRunning && (
          <span className="flex items-center gap-1.5 text-[11px] font-mono font-medium" style={{ color: "var(--s-running)" }}>
            <span
              className="w-1.5 h-1.5 rounded-full animate-led-pulse"
              style={{ background: "var(--s-running)", boxShadow: "0 0 4px var(--s-running)" }}
            />
            live
          </span>
        )}
        {done && !isRunning && (
          <span className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>ended</span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {streamClosed && (
            <button
              onClick={connect}
              className="text-[11px] px-2.5 py-1 rounded font-mono transition-colors"
              style={{ background: "var(--raised-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
            >
              reconnect
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="text-[11px] px-2.5 py-1 rounded font-mono transition-colors"
            style={{ background: "var(--raised-2)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
          >
            full logs
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div
        className="terminal-scan relative flex-1 overflow-y-auto rounded-lg p-4 font-mono text-[11px] leading-5 min-h-[260px] max-h-[420px]"
        style={{ background: "var(--base)", border: "1px solid var(--border-2)" }}
      >
        {logs.length === 0 && !done && (
          <div className="flex items-center gap-2" style={{ color: "var(--text-3)" }}>
            <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            waiting for logs…
          </div>
        )}
        {logs.length === 0 && done && (
          <span style={{ color: "var(--text-3)" }}>no logs recorded.</span>
        )}
        {logs.map((log) => (
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
  );
}
