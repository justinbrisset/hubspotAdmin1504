'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function GenerateRecommendationsButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateRecommendations() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/portals/${tenantId}/proposals`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to generate recommendations');
      }

      router.refresh();
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : String(generationError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={generateRecommendations}
        disabled={loading}
        className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12 disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate recommendations'}
      </button>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </div>
  );
}
