import { useEffect, useRef } from 'react';
import { useLogs, useDeployment, LogEntry } from '../api/client';

interface Props {
  deploymentId: string;
  onClose: () => void;
}

const streamColors: Record<string, string> = {
  stdout: 'text-green-300',
  stderr: 'text-red-400',
  system: 'text-blue-300',
};

export function LogModal({ deploymentId, onClose }: Props) {
  const { data: dep } = useDeployment(deploymentId);
  const { data: logs, isLoading } = useLogs(deploymentId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (logs?.length) bottomRef.current?.scrollIntoView();
  }, [logs]);

  const handleCopy = () => {
    if (!logs) return;
    const text = logs.map((l: LogEntry) => `[${l.ts}] [${l.stream}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full max-w-5xl h-[85vh] bg-gray-950 rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
          <span className="text-white font-semibold text-sm">Full Logs</span>
          {dep && (
            <>
              <span className="font-mono text-xs text-gray-400">{dep.slug}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">{dep.status}</span>
            </>
          )}
          <span className="ml-auto text-xs text-gray-500">{logs?.length ?? 0} lines</span>
          <button
            onClick={handleCopy}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto font-mono text-xs leading-5 p-4">
          {isLoading && <span className="text-gray-500">Loading logs…</span>}
          {!isLoading && !logs?.length && <span className="text-gray-500">No logs recorded.</span>}
          {logs?.map((log: LogEntry) => (
            <div key={log.id} className="flex gap-2">
              <span className="text-gray-600 shrink-0">{new Date(log.ts).toLocaleTimeString()}</span>
              <span className={`shrink-0 ${streamColors[log.stream] ?? 'text-gray-400'}`}>[{log.stream}]</span>
              <span className="text-gray-200 break-all">{log.line}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
