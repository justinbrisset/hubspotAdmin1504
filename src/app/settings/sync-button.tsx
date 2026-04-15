'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ResourceType } from '@/types';

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

export function SyncButton({
  tenantId,
  resourceTypes,
  label = 'Sync portal',
}: {
  tenantId: string;
  resourceTypes?: ResourceType[];
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function triggerSync() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/sync/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceTypes }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Sync failed');
      } else {
        setResult(data);
        router.refresh();
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
        className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12 disabled:opacity-50"
      >
        {loading ? 'Syncing...' : label}
      </button>

      {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}

      {result && (
        <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/30 p-4 text-sm text-white/70">
          <p className="font-medium text-white">
            {result.succeeded}/{result.total} resources synced
            {result.failed > 0 && ` · ${result.failed} failed`}
          </p>
          <ul className="mt-2 space-y-1">
            {result.results.map((r) => (
              <li key={r.resourceType} className={r.success ? 'text-white/65' : 'text-rose-300'}>
                {r.success ? 'OK' : 'ERR'} {r.resourceType} ({r.itemsCount} items)
                {r.error && ` - ${r.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
