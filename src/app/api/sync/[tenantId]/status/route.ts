import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/request-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const { tenantId } = await params;

  const { data, error } = await supabaseAdmin
    .from('sync_status')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('resource_type');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ syncStatus: data });
}
