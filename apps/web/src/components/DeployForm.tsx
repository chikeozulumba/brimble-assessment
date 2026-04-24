import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateDeployment } from '../api/client';
import { DeployConfigModal } from './DeployConfigModal';
import { IconGitBranch, IconRocket } from './icons';

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

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex text-[var(--text-3)]"
            aria-hidden
          >
            <IconGitBranch className="w-4 h-4" strokeWidth={1.75} />
          </span>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full h-10 pl-10 pr-3 rounded-lg border text-sm transition-all focus:outline-none placeholder-[var(--text-3)] shadow-sm"
            style={{
              background: "var(--raised)",
              borderColor: "var(--border-2)",
              color: "var(--text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow = "var(--ring-focus)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-2)";
              e.currentTarget.style.boxShadow = "none";
            }}
            disabled={create.isPending}
          />
        </div>

        <button
          type="submit"
          disabled={create.isPending || !source.trim()}
          className="h-10 px-5 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 shrink-0 transition-all disabled:opacity-40 hover:opacity-95 active:scale-[0.99]"
          style={{
            background: "linear-gradient(180deg, #1a1a1a 0%, #111 100%)",
            color: "#ffffff",
            border: "1px solid #000",
            boxShadow: "0 1px 2px rgba(0,0,0,0.12), 0 4px 12px rgba(17,17,17,0.15)",
          }}
        >
          {create.isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Deploying…
            </>
          ) : (
            <>
              <IconRocket className="w-4 h-4" strokeWidth={1.75} />
              Deploy
            </>
          )}
        </button>

        {create.isError && (
          <span className="self-center text-sm" style={{ color: "var(--s-failed)" }}>
            {create.error.message}
          </span>
        )}
      </form>
    </>
  );
}
