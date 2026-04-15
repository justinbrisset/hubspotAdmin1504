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
        className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white"
      >
        Add via Service Key
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl rounded-3xl border border-white/10 bg-slate-950/30 p-5"
    >
      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-white">Client name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Altares"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2.5 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/40"
          required
        />
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-sm font-medium text-white">Service Key</label>
        <input
          type="password"
          value={serviceKey}
          onChange={(e) => setServiceKey(e.target.value)}
          placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2.5 font-mono text-xs text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/40"
          required
        />
        <p className="mt-1 text-xs text-white/45">
          Created in HubSpot: Development → Keys → Service keys
        </p>
      </div>

      {error && <p className="mb-3 text-sm text-rose-300">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12 disabled:opacity-50"
        >
          {loading ? 'Validating...' : 'Add tenant'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
