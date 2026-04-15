'use client';

import { useState } from 'react';

interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  results: {
    resourceType: string;
    itemsCount: number;
    success: boolean;
    error?: string;
  }[];
}

export function SyncButton({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function triggerSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/sync/${tenantId}`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Sync failed');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={triggerSync}
        disabled={loading}
        className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-900"
      >
        {loading ? 'Syncing...' : 'Sync portal'}
      </button>

      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

      {result && (
        <div className="mt-4 text-sm">
          <p className="font-medium">
            {result.succeeded}/{result.total} resources synced
            {result.failed > 0 && ` · ${result.failed} failed`}
          </p>
          <ul className="mt-2 space-y-1">
            {result.results.map((r) => (
              <li key={r.resourceType} className={r.success ? 'text-gray-700' : 'text-red-600'}>
                {r.success ? '✓' : '✗'} {r.resourceType} ({r.itemsCount} items)
                {r.error && ` — ${r.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
