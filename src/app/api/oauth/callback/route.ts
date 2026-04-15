import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens, getPortalInfo } from '@/lib/hubspot/oauth';
import { encrypt } from '@/lib/crypto';
import { requireSupabaseOk, supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const cookieStore = await cookies();
  const savedState = cookieStore.get('oauth_state')?.value;
  cookieStore.delete('oauth_state');

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL('/settings?error=invalid_state', req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const portalInfo = await getPortalInfo(tokens.access_token);

    // Generate a slug-friendly tenant ID from the portal ID
    const tenantId = `portal-${portalInfo.portalId}`;

    const upsertResult = await supabaseAdmin
      .from('tenants')
      .upsert({
        id: tenantId,
        name: `HubSpot ${portalInfo.portalId}`,
        hubspot_portal_id: portalInfo.portalId,
        hubspot_access_token: encrypt(tokens.access_token),
        hubspot_refresh_token: encrypt(tokens.refresh_token),
        hubspot_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'hubspot_portal_id' });

    requireSupabaseOk(upsertResult, 'Failed to store tenant connection');

    return NextResponse.redirect(new URL(`/settings?connected=${tenantId}`, req.url));
  } catch (err) {
    console.error('OAuth callback error:', err);
    return NextResponse.redirect(new URL('/settings?error=oauth_failed', req.url));
  }
}
