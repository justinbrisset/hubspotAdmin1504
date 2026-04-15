import { createClient, type PostgrestError } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

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
