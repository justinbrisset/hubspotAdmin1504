'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/audit', label: 'Audit' },
  { href: '/chat', label: 'Chat' },
  { href: '/changes', label: 'Changes' },
] as const;

export function PortalTabs({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2 rounded-3xl border border-white/10 bg-white/[0.04] p-2">
      {TABS.map((tab) => {
        const href = `/portals/${tenantId}${tab.href}`;
        const active = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
              active
                ? 'bg-cyan-400/12 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.24)]'
                : 'text-white/60 hover:bg-white/8 hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
