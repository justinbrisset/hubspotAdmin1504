import { NextRequest, NextResponse } from 'next/server';
import { getHubSpotClient } from '@/lib/hubspot/client-factory';
import {
  markSyncCompleted,
  markSyncFailed,
  syncAllResources,
} from '@/lib/snapshot/extract';
import { transformAndEmbed } from '@/lib/snapshot/pipeline';

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  try {
    const hubspotClient = await getHubSpotClient(tenantId);
    const syncResults = await syncAllResources(tenantId, hubspotClient);
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

    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
