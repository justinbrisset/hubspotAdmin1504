import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { z } from 'zod';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, hubspot_portal_id, created_at, updated_at')
    .neq('id', 'shared')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tenants: data });
}

const createTenantSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, 'ID must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1),
  hubspotPortalId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createTenantSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, name, hubspotPortalId } = parsed.data;

  const { error } = await supabaseAdmin
    .from('tenants')
    .insert({
      id,
      name,
      hubspot_portal_id: hubspotPortalId,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json({ id, name, hubspotPortalId }, { status: 201 });
}
