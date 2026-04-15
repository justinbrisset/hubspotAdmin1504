import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSession } from '@/lib/auth/request-session';
import { getHubSpotClient } from '@/lib/hubspot/client-factory';
import {
  markSyncCompleted,
  markSyncFailed,
  syncAllResources,
} from '@/lib/snapshot/extract';
import { transformAndEmbed } from '@/lib/snapshot/pipeline';
import type { ResourceType } from '@/types';
import { sendOpsNotification } from '@/lib/notifications/webhook';

export const maxDuration = 300;

const syncRequestSchema = z.object({
  resourceTypes: z
    .array(
      z.enum([
        'workflows',
        'properties',
        'pipelines',
        'forms',
        'lists',
        'marketing_emails',
        'owners',
      ])
    )
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const denied = await requireSession(req);
  if (denied) return denied;

  const { tenantId } = await params;
  const body = syncRequestSchema.safeParse(await req.json().catch(() => ({})));

  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  try {
    const hubspotClient = await getHubSpotClient(tenantId);
    const syncResults = await syncAllResources(
      tenantId,
      hubspotClient,
      body.data.resourceTypes as ResourceType[] | undefined
    );
    const finalizedResults = [];

    for (const result of syncResults) {
      if (result.success && result.data) {
        try {
          await transformAndEmbed(tenantId, result.resourceType, result.data);
          await markSyncCompleted(tenantId, result.resourceType, result.itemsCount);
          finalizedResults.push(result);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          await markSyncFailed(tenantId, result.resourceType, errorMessage);
          finalizedResults.push({ ...result, success: false, error: errorMessage });
        }
      } else {
        finalizedResults.push(result);
      }
    }

    const summary = {
      total: finalizedResults.length,
      succeeded: finalizedResults.filter((r) => r.success).length,
      failed: finalizedResults.filter((r) => !r.success).length,
      results: finalizedResults.map(({ resourceType, itemsCount, success, error }) => ({
        resourceType,
        itemsCount,
        success,
        error,
      })),
    };

    if (summary.failed > 0) {
      await sendOpsNotification({
        title: `Manual sync reported failures for ${tenantId}`,
        body: `${summary.failed} resource lane(s) failed during a manual portal sync.`,
        severity: 'warning',
        details: summary,
      });
    }

    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
