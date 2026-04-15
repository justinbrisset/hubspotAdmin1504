import Link from 'next/link';
import type { ReactNode } from 'react';

export function AppShell({
  title,
  description,
  actions,
  children,
  eyebrow = 'Operations',
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(180deg,_#0b1120_0%,_#0f172a_45%,_#111827_100%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="mb-10 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-3 text-sm text-white/70 transition hover:text-white"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                HS
              </span>
              <span>
                <span className="block text-[10px] uppercase tracking-[0.3em] text-white/45">
                  HubSpot Copilot
                </span>
                <span className="block text-sm font-medium text-white/90">
                  Portal intelligence workspace
                </span>
              </span>
            </Link>

            <nav className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 text-sm text-white/70">
              <Link
                href="/"
                className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="rounded-full px-4 py-2 transition hover:bg-white/10 hover:text-white"
              >
                Settings
              </Link>
            </nav>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/70">
                {eyebrow}
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
                  {description}
                </p>
              ) : null}
            </div>

            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
