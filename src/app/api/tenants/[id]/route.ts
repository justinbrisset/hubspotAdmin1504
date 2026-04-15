import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth/request-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { z } from 'zod';

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const parsed = updateTenantSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('tenants')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const { id } = await params;

  if (id === 'shared') {
    return NextResponse.json({ error: 'Cannot delete the shared tenant' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('tenants')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
