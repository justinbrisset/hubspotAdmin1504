export const AUTH_COOKIE_NAME = 'auth_token';
export const AUTH_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  exp: number;
  iat: number;
  nonce: string;
}

function getAuthSecret(): string {
  const secret = process.env.APP_AUTH_SECRET ?? process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('Missing APP_AUTH_SECRET (or ENCRYPTION_KEY fallback)');
  }
  return secret;
}

function encodeText(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function decodeText(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function sign(payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(encodeText(getAuthSecret())),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(encodeText(payload)));
  return new Uint8Array(signature);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left[i] ^ right[i];
  }

  return mismatch === 0;
}

export async function createSessionToken(): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    exp: issuedAt + AUTH_SESSION_TTL_SECONDS,
    iat: issuedAt,
    nonce: encodeBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };

  const encodedPayload = encodeBase64Url(encodeText(JSON.stringify(payload)));
  const encodedSignature = encodeBase64Url(await sign(encodedPayload));

  return `${encodedPayload}.${encodedSignature}`;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  const [payloadPart, signaturePart, extraPart] = token.split('.');
  if (!payloadPart || !signaturePart || extraPart) {
    return false;
  }

  const expectedSignature = await sign(payloadPart);
  const actualSignature = decodeBase64Url(signaturePart);

  if (!constantTimeEqual(actualSignature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      decodeText(decodeBase64Url(payloadPart))
    ) as Partial<SessionPayload>;

    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
