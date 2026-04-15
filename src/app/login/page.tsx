'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

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
    <form onSubmit={handleSubmit} className="w-full max-w-sm p-8 border rounded-lg">
      <h1 className="text-2xl font-bold mb-6">HubSpot Copilot</h1>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full px-3 py-2 border rounded mb-4"
        autoFocus
      />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}

function LoginFallback() {
  return (
    <form className="w-full max-w-sm p-8 border rounded-lg">
      <h1 className="text-2xl font-bold mb-6">HubSpot Copilot</h1>
      <input
        type="password"
        placeholder="Password"
        className="w-full px-3 py-2 border rounded mb-4"
        disabled
      />
      <button
        type="button"
        disabled
        className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
      >
        Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
