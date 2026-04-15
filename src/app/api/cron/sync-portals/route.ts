import { NextRequest, NextResponse } from 'next/server';
import { requireSupabaseData, supabaseAdmin } from '@/lib/supabase-admin';
import { getHubSpotClient } from '@/lib/hubspot/client-factory';
import {
  markSyncCompleted,
  markSyncFailed,
  syncAllResources,
} from '@/lib/snapshot/extract';
import { transformAndEmbed } from '@/lib/snapshot/pipeline';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenants = requireSupabaseData(
    await supabaseAdmin
      .from('tenants')
      .select('id')
      .neq('id', 'shared')
      .not('hubspot_access_token', 'is', null),
    'Failed to load tenants for cron sync'
  );

  if (!tenants?.length) {
    return NextResponse.json({ message: 'No tenants to sync' });
  }

  const results = [];

  for (const tenant of tenants) {
    try {
      const client = await getHubSpotClient(tenant.id);
      const syncResults = await syncAllResources(tenant.id, client);
      const finalizedResults = [];

      for (const result of syncResults) {
        if (result.success && result.data) {
          try {
            await transformAndEmbed(tenant.id, result.resourceType, result.data);
            await markSyncCompleted(tenant.id, result.resourceType, result.itemsCount);
            finalizedResults.push(result);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await markSyncFailed(tenant.id, result.resourceType, errorMessage);
            finalizedResults.push({ ...result, success: false, error: errorMessage });
          }
        } else {
          finalizedResults.push(result);
        }
      }

      results.push({
        tenantId: tenant.id,
        success: finalizedResults.every((r) => r.success),
        synced: finalizedResults.filter((r) => r.success).length,
        failed: finalizedResults.filter((r) => !r.success).length,
      });
    } catch (err) {
      results.push({
        tenantId: tenant.id,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
