import Link from 'next/link';
import type { ReactNode } from 'react';
import { PortalTabs } from '@/components/portals/portal-tabs';
import { AppShell } from '@/components/ui/app-shell';
import { StatusPill } from '@/components/ui/status-pill';
import { SyncButton } from '@/app/settings/sync-button';
import { getTenantOrThrow } from '@/lib/portals/queries';

function formatDate(value: Date | null | undefined): string {
  if (!value) return 'No expiry';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value);
}

export default async function PortalLayout({
  children,
  params,
}: Readonly<{
  children: ReactNode;
  params: Promise<{ tenantId: string }>;
}>) {
  const { tenantId } = await params;
  const tenant = await getTenantOrThrow(tenantId);

  return (
    <AppShell
      eyebrow="Portal workspace"
      title={tenant.name}
      description={`Portal ${tenant.hubspotPortalId} · ${tenant.authType === 'service_key' ? 'Service key access' : 'OAuth connection'} · Token refresh ${formatDate(tenant.hubspotTokenExpiresAt)}`}
      actions={
        <>
          <StatusPill tone={tenant.authType === 'service_key' ? 'lavender' : 'accent'}>
            {tenant.authType === 'service_key' ? 'Service Key' : 'OAuth'}
          </StatusPill>
          <Link
            href="/settings"
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white"
          >
            Manage connection
          </Link>
          <SyncButton tenantId={tenantId} />
        </>
      }
    >
      <PortalTabs tenantId={tenantId} />
      {children}
    </AppShell>
  );
}
