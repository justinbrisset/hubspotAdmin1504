import { getHubSpotClient } from '@/lib/hubspot/client-factory';

export async function updatePropertyDescription({
  tenantId,
  objectType,
  propertyName,
  description,
}: {
  tenantId: string;
  objectType: string;
  propertyName: string;
  description: string;
}) {
  const hubspotClient = await getHubSpotClient(tenantId);
  const before = await hubspotClient.crm.properties.coreApi.getByName(objectType, propertyName);
  const after = await hubspotClient.crm.properties.coreApi.update(objectType, propertyName, {
    description,
  });

  return { before, after };
}
