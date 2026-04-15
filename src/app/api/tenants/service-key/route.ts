import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { encrypt } from '@/lib/crypto';
import { getPortalInfo } from '@/lib/hubspot/oauth';

const bodySchema = z.object({
  name: z.string().min(1),
  serviceKey: z.string().min(10),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, serviceKey } = parsed.data;

  // Validate the key by fetching portal info
  let portalInfo: { portalId: string; accountType: string };
  try {
    portalInfo = await getPortalInfo(serviceKey);
  } catch {
    return NextResponse.json(
      { error: 'Invalid service key — could not fetch portal info from HubSpot' },
      { status: 400 }
    );
  }

  const tenantId = `portal-${portalInfo.portalId}`;

  const { error } = await supabaseAdmin
    .from('tenants')
    .upsert(
      {
        id: tenantId,
        name,
        hubspot_portal_id: portalInfo.portalId,
        auth_type: 'service_key',
        hubspot_access_token: encrypt(serviceKey),
        hubspot_refresh_token: null,
        hubspot_token_expires_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'hubspot_portal_id' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: tenantId,
    name,
    hubspotPortalId: portalInfo.portalId,
    authType: 'service_key',
  }, { status: 201 });
}
