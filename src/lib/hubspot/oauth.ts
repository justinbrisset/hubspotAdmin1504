const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize';
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token';

const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.companies.read',
  'crm.objects.deals.read',
  'crm.objects.tickets.read',
  'crm.objects.owners.read',
  'crm.schemas.contacts.read',
  'crm.schemas.companies.read',
  'crm.schemas.deals.read',
  'crm.schemas.tickets.read',
  'crm.lists.read',
  'automation',
  'forms',
  'content',
];

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
    scope: SCOPES.join(' '),
    state,
  });
  return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.HUBSPOT_REDIRECT_URI!,
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HubSpot token exchange failed: ${error}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.HUBSPOT_CLIENT_ID!,
    client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
  });

  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HubSpot token refresh failed: ${error}`);
  }

  return res.json();
}

export async function getPortalInfo(accessToken: string): Promise<{ portalId: string; accountType: string }> {
  const res = await fetch('https://api.hubapi.com/account-info/v3/details', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error('Failed to fetch HubSpot account info');

  const data = await res.json();
  return {
    portalId: String(data.portalId),
    accountType: data.accountType,
  };
}
