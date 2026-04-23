import { useState } from 'react';
import { useCreateDeployment } from '../api/client';
import { DeployConfigModal } from './DeployConfigModal';

interface Props {
  onDeployed: (id: string) => void;
}

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
        onSuccess: (dep) => { setSource(''); onDeployed(dep.id); },
      });
    }
  };

  const handleConfirm = (envVars: Record<string, string>) => {
    create.mutate({ source: source.trim(), envVars }, {
      onSuccess: (dep) => {
        setSource('');
        setShowModal(false);
        onDeployed(dep.id);
      },
    });
  };

  return (
    <>
      {showModal && (
        <DeployConfigModal
          source={source.trim()}
          onConfirm={handleConfirm}
          onCancel={() => setShowModal(false)}
          isPending={create.isPending}
        />
      )}
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
    </>
  );
}
