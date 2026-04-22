import { useEffect, useRef, useState } from 'react';
import { useDeployment, LogEntry } from '../api/client';

interface Props {
  deploymentId: string;
}

const streamColors: Record<string, string> = {
  stdout: 'text-green-300',
  stderr: 'text-red-400',
  system: 'text-blue-300',
};

export function LogStream({ deploymentId }: Props) {
  const { data: dep } = useDeployment(deploymentId);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogs([]);
    setLiveStatus(null);
    setDone(false);

    const es = new EventSource(`/api/deployments/${deploymentId}/logs/stream`);

    es.addEventListener('log', (e) => {
      const entry: LogEntry = JSON.parse(e.data);
      setLogs((prev) => [...prev, entry]);
    });

    es.addEventListener('status', (e) => {
      const { status } = JSON.parse(e.data);
      setLiveStatus(status);
    });

    es.addEventListener('done', () => {
      setDone(true);
      es.close();
    });

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [deploymentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const status = liveStatus ?? dep?.status ?? '…';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-gray-700">Deployment:</span>
        <span className="font-mono text-xs text-gray-500">{deploymentId}</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{status}</span>
        {done && <span className="text-xs text-gray-400">(stream closed)</span>}
      </div>
      {dep?.publicUrl && dep.status === 'running' && (
        <div className="mb-2">
          <a href={dep.publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm underline">
            Open {dep.publicUrl}
          </a>
        </div>
      )}
      <div className="flex-1 overflow-y-auto bg-gray-900 rounded p-3 font-mono text-xs leading-5 min-h-[300px] max-h-[500px]">
        {logs.length === 0 && (
          <span className="text-gray-500">Waiting for logs…</span>
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
