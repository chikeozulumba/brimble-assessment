import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { useCreateDeployment, useDeployments } from '../api/client';
import { DeployConfigModal } from './DeployConfigModal';
import { IconGitBranch, IconRocket } from './icons';

interface Props { onDeployed: (id: string) => void }

function isGitHubUrl(s: string) {
  return /github\.com\/.+\/.+/.test(s.trim());
}

function dedupeGithubSources(sources: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of sources) {
    const s = raw?.trim();
    if (!s || !isGitHubUrl(s)) continue;
    const key = s.replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function DeployForm({ onDeployed }: Props) {
  const [source, setSource] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const create = useCreateDeployment();
  const { data: deployments = [] } = useDeployments();

  const recentGithubUrls = useMemo(
    () => dedupeGithubSources(deployments.map((d) => d.source)),
    [deployments],
  );

  const filteredRecent = useMemo(() => {
    const q = source.trim().toLowerCase();
    if (!q) return recentGithubUrls;
    return recentGithubUrls.filter((u) => u.toLowerCase().includes(q));
  }, [recentGithubUrls, source]);

  const syncMenuPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el || !dropdownOpen) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, [dropdownOpen]);

  useLayoutEffect(() => {
    if (!dropdownOpen) {
      setMenuPos(null);
      return;
    }
    syncMenuPosition();
    window.addEventListener('resize', syncMenuPosition);
    window.addEventListener('scroll', syncMenuPosition, true);
    return () => {
      window.removeEventListener('resize', syncMenuPosition);
      window.removeEventListener('scroll', syncMenuPosition, true);
    };
  }, [dropdownOpen, syncMenuPosition, filteredRecent.length]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [dropdownOpen]);

  const startDeployWithSource = (trimmed: string) => {
    if (!trimmed) return;
    setSource(trimmed);
    setDropdownOpen(false);
    if (isGitHubUrl(trimmed)) {
      setShowModal(true);
    } else {
      create.mutate(
        { source: trimmed },
        {
          onSuccess: (dep) => {
            setSource('');
            onDeployed(dep.id);
            toast.success('Deployment started', { description: dep.slug });
          },
        },
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return;
    startDeployWithSource(source.trim());
  };

  const handleConfirm = (envVars: Record<string, string>) => {
    create.mutate({ source: source.trim(), envVars }, {
      onSuccess: (dep) => {
        setSource(''); setShowModal(false); onDeployed(dep.id);
        toast.success('Deployment started', { description: dep.slug });
      },
    });
  };

  const pickRecent = (url: string) => {
    startDeployWithSource(url.trim());
  };

  return (
    <>
      {showModal && (
        <DeployConfigModal source={source.trim()} onConfirm={handleConfirm} onCancel={() => setShowModal(false)} isPending={create.isPending} />
      )}

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
        <div ref={wrapRef} className="relative flex-1 min-w-0">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex text-[var(--text-3)] z-[1]"
            aria-hidden
          >
            <IconGitBranch className="w-4 h-4" strokeWidth={1.75} />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="relative z-[1] w-full h-10 pl-10 pr-3 rounded-lg border text-sm transition-all focus:outline-none placeholder-[var(--text-3)] shadow-sm"
            style={{
              background: "var(--raised)",
              borderColor: "var(--border-2)",
              color: "var(--text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow = "var(--ring-focus)";
              if (recentGithubUrls.length > 0) setDropdownOpen(true);
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-2)";
              e.currentTarget.style.boxShadow = "none";
            }}
            onClick={() => {
              if (recentGithubUrls.length > 0) setDropdownOpen(true);
            }}
            autoComplete="off"
            disabled={create.isPending}
            role="combobox"
            aria-expanded={dropdownOpen}
            aria-controls="deploy-recent-github"
            aria-autocomplete="list"
          />

        </div>

        {dropdownOpen &&
          filteredRecent.length > 0 &&
          menuPos &&
          createPortal(
            <ul
              ref={listRef}
              id="deploy-recent-github"
              className="max-h-56 overflow-auto rounded-lg border py-1 shadow-md animate-slide-down"
              style={{
                position: 'fixed',
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
                zIndex: 9999,
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: 'var(--shadow-md)',
              }}
              role="listbox"
              aria-label="Recently used GitHub repositories"
            >
              {filteredRecent.map((url) => (
                <li key={url} role="presentation">
                  <button
                    type="button"
                    role="option"
                    className="w-full px-3 py-2 text-left text-xs font-mono transition-colors hover:bg-[var(--raised-2)]"
                    style={{ color: 'var(--text)' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickRecent(url);
                    }}
                  >
                    {url.replace(/^https?:\/\/(www\.)?/, '')}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )}

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
