import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
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
