import { useState } from "react";
import { DeployForm } from "../components/DeployForm";
import { DeploymentList } from "../components/DeploymentList";

export function IndexPage() {
  const [newDepId, setNewDepId] = useState<string | undefined>();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Brimble</h1>
        <p className="text-sm text-gray-500">
          Self hosted app deployment platform with Git
        </p>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            New Deployment
          </h2>
          <DeployForm onDeployed={setNewDepId} />
        </section>

        <section>
          <DeploymentList initialExpandId={newDepId} />
        </section>
      </main>
    </div>
  );
}
