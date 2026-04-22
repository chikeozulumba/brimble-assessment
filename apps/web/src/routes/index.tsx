import { useNavigate, useSearch } from '@tanstack/react-router';
import { DeployForm } from '../components/DeployForm';
import { DeploymentList } from '../components/DeploymentList';
import { LogStream } from '../components/LogStream';

export function IndexPage() {
  const { deployment } = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });

  const selectDeployment = (id: string) => {
    navigate({ search: { deployment: id } });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Brimble</h1>
        <p className="text-sm text-gray-500">Deploy from Git with Railpack</p>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">New Deployment</h2>
          <DeployForm onDeployed={selectDeployment} />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Deployments</h2>
          <DeploymentList selectedId={deployment} onSelect={selectDeployment} />
        </section>

        {deployment && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Logs</h2>
              <button
                onClick={() => navigate({ search: {} })}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Close ✕
              </button>
            </div>
            <div className="bg-white rounded border p-4">
              <LogStream deploymentId={deployment} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
