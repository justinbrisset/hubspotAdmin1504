'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Panel } from '@/components/ui/panel';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      const nextPath = searchParams.get('next');
      const redirectPath = nextPath?.startsWith('/') ? nextPath : '/';

      router.push(redirectPath);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Login failed');
      setLoading(false);
    }
  }

  return (
    <Panel className="w-full max-w-md p-8">
      <form onSubmit={handleSubmit}>
        <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">Secure entry</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">HubSpot Copilot</h1>
        <p className="mt-3 text-sm text-white/60">
          Sign in to access synced portals, audit findings, and the operator workspace.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/40"
          autoFocus
        />
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 py-3 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-300/12 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </Panel>
  );
}

function LoginFallback() {
  return (
    <Panel className="w-full max-w-md p-8">
      <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">Secure entry</p>
      <h1 className="mt-3 text-3xl font-semibold text-white">HubSpot Copilot</h1>
      <input
        type="password"
        placeholder="Password"
        className="mt-6 w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-white/70"
        disabled
      />
      <button
        type="button"
        disabled
        className="mt-5 w-full rounded-2xl border border-cyan-400/30 bg-cyan-400/10 py-3 text-sm font-medium text-cyan-100 disabled:opacity-50"
      >
        Sign in
      </button>
    </Panel>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_30%),linear-gradient(180deg,_#0b1120_0%,_#0f172a_45%,_#111827_100%)] px-6 py-12">
      <div className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
        <div className="hidden lg:block">
          <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/70">Portal intelligence</p>
          <h2 className="mt-4 max-w-xl text-5xl font-semibold leading-tight text-white">
            Audit, search, and operate every client portal from one secure cockpit.
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/60">
            The workspace keeps synced configuration snapshots, deterministic audit findings, and a grounded copilot ready for operator review.
          </p>
        </div>
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
      </div>
    </div>
  );
}
