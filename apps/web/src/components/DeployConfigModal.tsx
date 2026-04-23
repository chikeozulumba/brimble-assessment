import { useEffect, useState } from 'react';

interface EnvRow {
  key: string;
  value: string;
}

interface Props {
  source: string;
  onConfirm: (envVars: Record<string, string>) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function DeployConfigModal({ source, onConfirm, onCancel, isPending }: Props) {
  const [rows, setRows] = useState<EnvRow[]>([{ key: '', value: '' }]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isPending) onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, isPending]);

  const updateRow = (i: number, field: 'key' | 'value', val: string) => {
    setRows((prev) => {
      const next = prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
      // auto-append a blank row when the last row gets content
      if (i === prev.length - 1 && val.trim()) next.push({ key: '', value: '' });
      return next;
    });
  };

  const removeRow = (i: number) => {
    setRows((prev) => prev.length === 1 ? [{ key: '', value: '' }] : prev.filter((_, idx) => idx !== i));
  };

  const handleConfirm = () => {
    const envVars: Record<string, string> = {};
    for (const { key, value } of rows) {
      if (key.trim()) envVars[key.trim()] = value;
    }
    onConfirm(envVars);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={() => { if (!isPending) onCancel(); }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Configure Deployment</h2>
          <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{source}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Environment Variables
            </p>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={row.key}
                    onChange={(e) => updateRow(i, 'key', e.target.value)}
                    placeholder="KEY"
                    className="w-2/5 border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
                    disabled={isPending}
                  />
                  <span className="text-gray-400 text-xs">=</span>
                  <input
                    type="text"
                    value={row.value}
                    onChange={(e) => updateRow(i, 'value', e.target.value)}
                    placeholder="value"
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs font-mono"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-gray-400 hover:text-red-500 text-sm leading-none px-1"
                    disabled={isPending}
                    aria-label="Remove row"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Leave blank to deploy without extra variables.</p>
          </div>
        </div>

        <div className="px-5 py-3 border-t bg-gray-50 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-xs text-gray-600 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="px-4 py-2 text-xs bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Deploying…' : 'Deploy'}
          </button>
        </div>
      </div>
    </div>
  );
}
