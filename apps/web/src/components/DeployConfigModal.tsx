import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface EnvRow { key: string; value: string }

interface Props {
  source: string;
  onConfirm: (envVars: Record<string, string>) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function DeployConfigModal({ source, onConfirm, onCancel, isPending }: Props) {
  const [rows, setRows] = useState<EnvRow[]>([{ key: '', value: '' }]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isPending) onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel, isPending]);

  const updateRow = (i: number, field: 'key' | 'value', val: string) => {
    setRows((prev) => {
      const next = prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
      if (i === prev.length - 1 && val.trim()) next.push({ key: '', value: '' });
      return next;
    });
  };

  const removeRow = (i: number) =>
    setRows((prev) => prev.length === 1 ? [{ key: '', value: '' }] : prev.filter((_, idx) => idx !== i));

  const handleConfirm = () => {
    const envVars: Record<string, string> = {};
    for (const { key, value } of rows) {
      if (key.trim()) envVars[key.trim()] = value;
    }
    onConfirm(envVars);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(7,7,14,0.85)" }}
      onClick={() => { if (!isPending) onCancel(); }}
    >
      <div
        className="w-full max-w-lg rounded-lg overflow-hidden animate-slide-down"
        style={{ background: "var(--surface)", border: "1px solid var(--border-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div
            className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-dim)" }}
          >
            <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-mono font-semibold" style={{ color: "var(--text)" }}>configure deployment</h2>
            <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
              {source.replace(/^https?:\/\/(www\.)?/, '')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-3)" }}>
            environment variables
          </p>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => updateRow(i, 'key', e.target.value)}
                  placeholder="KEY"
                  className="w-2/5 h-8 px-3 rounded text-[11px] font-mono transition-all focus:outline-none disabled:opacity-40 placeholder-[var(--text-3)]"
                  style={{ background: "var(--raised)", borderColor: "var(--border-2)", border: "1px solid var(--border-2)", color: "var(--text)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-glow)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; e.currentTarget.style.boxShadow = "none"; }}
                  disabled={isPending}
                />
                <span className="text-[11px] font-mono shrink-0" style={{ color: "var(--text-3)" }}>=</span>
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => updateRow(i, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 h-8 px-3 rounded text-[11px] font-mono transition-all focus:outline-none disabled:opacity-40 placeholder-[var(--text-3)]"
                  style={{ background: "var(--raised)", border: "1px solid var(--border-2)", color: "var(--text)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-glow)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; e.currentTarget.style.boxShadow = "none"; }}
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={isPending}
                  className="p-1 transition-colors disabled:opacity-40"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--s-failed)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
                  aria-label="Remove"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-mono mt-3" style={{ color: "var(--text-3)" }}>
            leave blank to deploy without extra variables.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded text-xs font-mono font-medium transition-colors disabled:opacity-40"
            style={{ background: "var(--raised)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
          >
            cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="px-5 py-2 rounded text-xs font-mono font-semibold transition-colors disabled:opacity-40 flex items-center gap-2"
            style={{ background: "var(--accent)", color: "var(--base)", border: "1px solid var(--accent)" }}
            onMouseEnter={(e) => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            {isPending ? (
              <>
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                deploying…
              </>
            ) : 'deploy'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
