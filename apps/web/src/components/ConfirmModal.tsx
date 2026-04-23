import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, confirmLabel, danger = true, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const confirmBg     = danger ? "rgba(251,113,133,0.12)" : "var(--accent-dim)";
  const confirmColor  = danger ? "#fb7185" : "var(--accent)";
  const confirmBorder = danger ? "rgba(251,113,133,0.30)" : "var(--accent-glow)";
  const confirmHover  = danger ? "rgba(251,113,133,0.22)" : "rgba(61,220,132,0.18)";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(7,7,14,0.82)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg overflow-hidden animate-slide-down"
        style={{ background: "var(--surface)", border: "1px solid var(--border-2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon strip */}
        <div className="px-5 pt-5 pb-4 flex gap-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div
            className="w-9 h-9 rounded flex items-center justify-center shrink-0"
            style={{ background: danger ? "rgba(251,113,133,0.10)" : "var(--accent-dim)" }}
          >
            {danger ? (
              <svg className="w-4 h-4" style={{ color: "#fb7185" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" />
              </svg>
            )}
          </div>
          <div>
            <h2 className="text-xs font-mono font-semibold" style={{ color: "var(--text)" }}>{title}</h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-2)" }}>{message}</p>
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 rounded text-xs font-mono font-medium transition-colors"
            style={{ background: "var(--raised)", color: "var(--text-2)", border: "1px solid var(--border-2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
          >
            cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-2 rounded text-xs font-mono font-semibold transition-colors"
            style={{ background: confirmBg, color: confirmColor, border: `1px solid ${confirmBorder}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = confirmHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = confirmBg; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
