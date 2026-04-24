import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconRocket, IconTrash } from './icons';

interface EnvRow { key: string; value: string }

function envToRows(initial: Record<string, string> | null | undefined): EnvRow[] {
  if (!initial || Object.keys(initial).length === 0) {
    return [{ key: '', value: '' }];
  }
  return [
    ...Object.entries(initial).map(([key, value]) => ({ key, value })),
    { key: '', value: '' },
  ];
}

interface Props {
  source: string;
  onConfirm: (envVars: Record<string, string>) => void;
  onCancel: () => void;
  isPending: boolean;
  initialEnvVars?: Record<string, string> | null;
  title?: string;
  confirmLabel?: string;
  envHint?: string;
}

export function DeployConfigModal({
  source,
  onConfirm,
  onCancel,
  isPending,
  initialEnvVars,
  title = 'Configure deployment',
  confirmLabel = 'Deploy',
  envHint = 'Leave blank to deploy without extra variables.',
}: Props) {
  const [rows, setRows] = useState<EnvRow[]>(() => envToRows(initialEnvVars));

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
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={() => { if (!isPending) onCancel(); }}
    >
      <div
        className="w-full max-w-lg rounded-xl overflow-hidden animate-slide-down shadow-lg"
        style={{
          background: "linear-gradient(180deg, var(--surface) 0%, var(--raised) 100%)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 border-b flex gap-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={{
              background: "linear-gradient(135deg, #111 0%, #333 100%)",
              borderColor: "#000",
              color: "#fff",
              boxShadow: "0 2px 8px rgba(17,17,17,0.15)",
            }}
            aria-hidden
          >
            <IconRocket className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
            <p className="text-xs mt-0.5 font-mono truncate" style={{ color: "var(--text-3)" }}>
              {source.replace(/^https?:\/\/(www\.)?/, '')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium mb-3" style={{ color: "var(--text-3)" }}>
            Environment Variables
          </p>
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.key}
                  onChange={(e) => updateRow(i, 'key', e.target.value)}
                  placeholder="KEY"
                  className="w-2/5 h-8 px-3 rounded border text-xs font-mono focus:outline-none transition-colors disabled:opacity-40 placeholder-[var(--text-3)]"
                  style={{ background: "var(--raised)", borderColor: "var(--border-2)", color: "var(--text)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
                  disabled={isPending}
                />
                <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-3)" }}>=</span>
                <input
                  type="text"
                  value={row.value}
                  onChange={(e) => updateRow(i, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 h-8 px-3 rounded border text-xs font-mono focus:outline-none transition-colors disabled:opacity-40 placeholder-[var(--text-3)]"
                  style={{ background: "var(--raised)", borderColor: "var(--border-2)", color: "var(--text)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-2)"; }}
                  disabled={isPending}
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  disabled={isPending}
                  className="p-1 transition-colors disabled:opacity-40"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
                  aria-label="Remove"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--text-3)" }}>
            {envHint}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t flex justify-end gap-2" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-40 hover:bg-[var(--raised-2)]"
            style={{ background: "transparent", color: "var(--text-2)", borderColor: "var(--border-2)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40 inline-flex items-center gap-2 hover:opacity-95"
            style={{
              background: "linear-gradient(180deg, #1a1a1a 0%, #111 100%)",
              color: "#ffffff",
              border: "1px solid #000",
              boxShadow: "0 2px 8px rgba(17,17,17,0.2)",
            }}
          >
            {isPending ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Deploying…
              </>
            ) : (
              <>
                <IconRocket className="w-4 h-4" strokeWidth={1.75} />
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
