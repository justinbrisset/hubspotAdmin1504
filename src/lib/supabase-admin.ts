import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseAdminClient = SupabaseClient;

let cachedClient: SupabaseAdminClient | null = null;

function requireEnv(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

export function getSupabaseAdmin(): SupabaseAdminClient {
  if (!cachedClient) {
    cachedClient = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: { persistSession: false },
      }
    );
  }

  return cachedClient;
}

export const supabaseAdmin: SupabaseAdminClient = new Proxy({} as SupabaseAdminClient, {
  get(_target, property, receiver) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

type SupabaseResult<T> = {
  data: T;
  error: PostgrestError | null;
};

type SupabaseMutationResult = {
  error: PostgrestError | null;
};

export function requireSupabaseData<T>(
  result: SupabaseResult<T>,
  context: string
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }

  return result.data;
}

export function requireSupabaseOk(
  result: SupabaseMutationResult,
  context: string
): void {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
}
