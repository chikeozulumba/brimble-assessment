import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconAlertCircle, IconStop } from "./icons";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  /** When set, shown in the header circle instead of the default alert/stop icon. */
  decorativeIcon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger = true,
  decorativeIcon,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl overflow-hidden animate-slide-down shadow-lg"
        style={{
          background: "linear-gradient(180deg, var(--surface) 0%, var(--raised) 100%)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-5">
          <div className="flex gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
              style={{
                background: danger ? "rgba(220,38,38,0.08)" : "var(--raised-2)",
                borderColor: danger ? "rgba(220,38,38,0.2)" : "var(--border)",
                color: danger ? "#dc2626" : "var(--text-2)",
              }}
              aria-hidden
            >
              {decorativeIcon ?? (
                danger ? (
                  <IconAlertCircle className="w-5 h-5" strokeWidth={2} />
                ) : (
                  <IconStop className="w-5 h-5" strokeWidth={2} />
                )
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                {title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                {message}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-[var(--raised-2)]"
            style={{ background: "transparent", color: "var(--text-2)", borderColor: "var(--border-2)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-95"
            style={{
              background: danger ? "linear-gradient(180deg, #ef4444 0%, #dc2626 100%)" : "var(--accent)",
              color: "#ffffff",
              border: "none",
              boxShadow: danger ? "0 2px 8px rgba(220,38,38,0.35)" : "var(--shadow-xs)",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
