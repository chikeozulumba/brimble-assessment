import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateDeployment } from '../api/client';
import { DeployConfigModal } from './DeployConfigModal';

interface Props { onDeployed: (id: string) => void }

function isGitHubUrl(s: string) {
  return /github\.com\/.+\/.+/.test(s.trim());
}

export function DeployForm({ onDeployed }: Props) {
  const [source, setSource] = useState('');
  const [showModal, setShowModal] = useState(false);
  const create = useCreateDeployment();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return;
    if (isGitHubUrl(source)) {
      setShowModal(true);
    } else {
      create.mutate({ source: source.trim() }, {
        onSuccess: (dep) => { setSource(''); onDeployed(dep.id); toast.success('Deployment started', { description: dep.slug }); },
      });
    }
  };

  const handleConfirm = (envVars: Record<string, string>) => {
    create.mutate({ source: source.trim(), envVars }, {
      onSuccess: (dep) => {
        setSource(''); setShowModal(false); onDeployed(dep.id);
        toast.success('Deployment started', { description: dep.slug });
      },
    });
  };

  return (
    <>
      {showModal && (
        <DeployConfigModal source={source.trim()} onConfirm={handleConfirm} onCancel={() => setShowModal(false)} isPending={create.isPending} />
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        {/* Prompt */}
        <div
          className="flex items-center gap-2.5 px-3 rounded-md border shrink-0"
          style={{ background: "var(--raised)", borderColor: "var(--border-2)" }}
        >
          <span className="text-xs font-mono font-semibold select-none" style={{ color: "var(--accent)" }}>~/</span>
        </div>

        {/* URL input */}
        <div className="relative flex-1">
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full h-9 pl-3 pr-4 rounded-md border text-xs font-mono transition-all placeholder-[var(--text-3)] focus:outline-none"
            style={{
              background: "var(--raised)",
              borderColor: source ? "var(--border-2)" : "var(--border)",
              color: "var(--text)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-glow)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = source ? "var(--border-2)" : "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
            disabled={create.isPending}
          />
        </div>

        {/* Deploy button */}
        <button
          type="submit"
          disabled={create.isPending || !source.trim()}
          className="h-9 px-4 rounded-md text-xs font-semibold font-mono flex items-center gap-2 transition-all disabled:opacity-40"
          style={{
            background: create.isPending || !source.trim() ? "var(--raised-2)" : "var(--accent)",
            color: create.isPending || !source.trim() ? "var(--text-2)" : "var(--base)",
            border: `1px solid ${create.isPending || !source.trim() ? "var(--border-2)" : "var(--accent)"}`,
          }}
        >
          {create.isPending ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              running…
            </>
          ) : (
            <>
              <span>deploy</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {create.isError && (
          <span className="self-center text-xs font-mono" style={{ color: "var(--s-failed)" }}>
            {create.error.message}
          </span>
        )}
      </form>
    </>
  );
}
