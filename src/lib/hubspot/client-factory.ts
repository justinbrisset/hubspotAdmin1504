import { Client } from '@hubspot/api-client';
import {
  requireSupabaseData,
  requireSupabaseOk,
  supabaseAdmin,
} from '@/lib/supabase-admin';
import { encrypt, decrypt } from '@/lib/crypto';
import { refreshAccessToken } from './oauth';

export async function getHubSpotClient(tenantId: string): Promise<Client> {
  const tenant = requireSupabaseData(
    await supabaseAdmin
    .from('tenants')
    .select('auth_type, hubspot_access_token, hubspot_refresh_token, hubspot_token_expires_at')
    .eq('id', tenantId)
    .maybeSingle(),
    `Failed to load tenant "${tenantId}"`
  );

  if (!tenant) {
    throw new Error(`Tenant "${tenantId}" not found`);
  }

  if (!tenant.hubspot_access_token) {
    throw new Error(`Tenant "${tenantId}" has no HubSpot token. Connect via OAuth or add a Service Key first.`);
  }

  // Service Key: long-lived bearer token, no refresh flow
  if (tenant.auth_type === 'service_key') {
    return new Client({ accessToken: decrypt(tenant.hubspot_access_token) });
  }

  // OAuth: refresh if expired (with 60s buffer)
  if (!tenant.hubspot_refresh_token) {
    throw new Error(`OAuth tenant "${tenantId}" is missing a refresh token.`);
  }

  const refreshToken = decrypt(tenant.hubspot_refresh_token);
  const expiresAt = tenant.hubspot_token_expires_at
    ? new Date(tenant.hubspot_token_expires_at)
    : new Date(0);

  if (expiresAt.getTime() - 60_000 <= Date.now()) {
    const newTokens = await refreshAccessToken(refreshToken);

    const updateResult = await supabaseAdmin
      .from('tenants')
      .update({
        hubspot_access_token: encrypt(newTokens.access_token),
        hubspot_refresh_token: encrypt(newTokens.refresh_token),
        hubspot_token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    requireSupabaseOk(updateResult, `Failed to refresh HubSpot token for tenant "${tenantId}"`);

    return new Client({ accessToken: newTokens.access_token });
  }

  return new Client({ accessToken: decrypt(tenant.hubspot_access_token) });
}
