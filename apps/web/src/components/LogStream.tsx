import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeployment, LogEntry } from '../api/client';
import { LogModal } from './LogModal';

interface Props {
  deploymentId: string;
}

const streamColors: Record<string, string> = {
  stdout: 'text-green-300',
  stderr: 'text-red-400',
  system: 'text-blue-300',
};

export function LogStream({ deploymentId }: Props) {
  const { data: dep, refetch: refetchDep } = useDeployment(deploymentId);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    esRef.current?.close();

    setLogs([]);
    setLiveStatus(null);
    setDone(false);
    setConnected(false);

    const es = new EventSource(`/api/deployments/${deploymentId}/logs/stream`);
    esRef.current = es;

    es.addEventListener('log', (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLogs((prev) => [...prev, entry]);
      setConnected(true);
    });

    es.addEventListener('status', (e) => {
      const { status } = JSON.parse(e.data);
      setLiveStatus(status);
      refetchDep();
    });

    es.addEventListener('done', () => {
      setDone(true);
      setConnected(false);
      es.close();
      refetchDep();
    });

    es.onopen = () => setConnected(true);

    es.onerror = () => {
      setConnected(false);
      es.close();
    };
  }, [deploymentId, refetchDep]);

  useEffect(() => {
    connect();
    return () => esRef.current?.close();
  }, [connect]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const status = liveStatus ?? dep?.status ?? '…';
  const isRunning = status === 'running';
  const streamClosed = done && isRunning;

  return (
    <div className="flex flex-col h-full">
      {showModal && <LogModal deploymentId={deploymentId} onClose={() => setShowModal(false)} />}

      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Logs</p>

        {connected && isRunning && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        )}

        {done && !isRunning && (
          <span className="text-xs text-gray-400">(stream closed)</span>
        )}

        <div className="ml-auto flex gap-2">
          {streamClosed && (
            <button
              onClick={connect}
              className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              Reconnect
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="text-xs px-2 py-0.5 rounded bg-gray-800 text-white hover:bg-gray-700"
          >
            View Full Logs
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-900 rounded p-3 font-mono text-xs leading-5 min-h-[300px] max-h-[500px]">
        {logs.length === 0 && !done && (
          <span className="text-gray-500">Waiting for logs…</span>
        )}
        {logs.length === 0 && done && (
          <span className="text-gray-500">No logs recorded.</span>
        )}
        {logs.map((log) => (
          <div key={log.id} className={streamColors[log.stream] ?? 'text-gray-300'}>
            <span className="text-gray-600 mr-2">[{log.stream}]</span>
            {log.line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
