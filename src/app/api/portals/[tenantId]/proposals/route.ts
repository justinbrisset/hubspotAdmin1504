import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/request-session';
import { listChangeProposals, insertGeneratedProposals } from '@/lib/proposals/store';
import { generateRecommendations } from '@/lib/recommendations/generate';

const generateSchema = z.object({
  conversationId: z.string().uuid().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const { tenantId } = await params;

  try {
    const proposals = await listChangeProposals(tenantId);
    return NextResponse.json({ proposals });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const parsed = generateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { tenantId } = await params;

  try {
    const generated = await generateRecommendations(tenantId);
    const proposals = await insertGeneratedProposals({
      tenantId,
      proposals: generated,
      source: parsed.data.conversationId ? 'chat' : 'audit',
      conversationId: parsed.data.conversationId ?? null,
    });

    return NextResponse.json({ proposals }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
