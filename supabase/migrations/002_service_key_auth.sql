-- ============================================================
-- Add service_key auth support to tenants
-- Service Keys are HubSpot's modern replacement for private apps:
-- long-lived bearer tokens with no refresh flow.
-- ============================================================

ALTER TABLE tenants
  ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'oauth'
  CHECK (auth_type IN ('oauth', 'service_key'));

-- Allow service_key tenants to omit refresh token + expiry
-- (the columns are already nullable; this is explicit documentation)
COMMENT ON COLUMN tenants.hubspot_refresh_token IS
  'OAuth refresh token (encrypted). NULL for auth_type=service_key.';

COMMENT ON COLUMN tenants.hubspot_token_expires_at IS
  'OAuth access token expiry. NULL for auth_type=service_key (long-lived).';

COMMENT ON COLUMN tenants.hubspot_access_token IS
  'Encrypted bearer token. OAuth access token for auth_type=oauth, service key for auth_type=service_key.';
