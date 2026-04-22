import { useState } from 'react';
import { useCreateDeployment } from '../api/client';

interface Props {
  onDeployed: (id: string) => void;
}

export function DeployForm({ onDeployed }: Props) {
  const [source, setSource] = useState('');
  const create = useCreateDeployment();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim()) return;
    create.mutate({ source: source.trim() }, {
      onSuccess: (dep) => {
        setSource('');
        onDeployed(dep.id);
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="https://github.com/owner/repo"
        className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm font-mono"
        disabled={create.isPending}
      />
      <button
        type="submit"
        disabled={create.isPending || !source.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
      >
        {create.isPending ? 'Deploying…' : 'Deploy'}
      </button>
      {create.isError && (
        <p className="text-red-500 text-sm self-center">{create.error.message}</p>
      )}
    </form>
  );
}
