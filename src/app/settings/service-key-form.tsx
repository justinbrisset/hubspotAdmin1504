'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ServiceKeyForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [serviceKey, setServiceKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tenants/service-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, serviceKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Failed to add tenant');
      } else {
        setName('');
        setServiceKey('');
        setOpen(false);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-block px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-900"
      >
        Add via Service Key
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border rounded-lg p-4 max-w-md">
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Client name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Altares"
          className="w-full px-3 py-2 border rounded"
          required
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Service Key</label>
        <input
          type="password"
          value={serviceKey}
          onChange={(e) => setServiceKey(e.target.value)}
          placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full px-3 py-2 border rounded font-mono text-xs"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Created in HubSpot: Development → Keys → Service keys
        </p>
      </div>

      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded disabled:opacity-50"
        >
          {loading ? 'Validating...' : 'Add tenant'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="px-4 py-2 border rounded"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
