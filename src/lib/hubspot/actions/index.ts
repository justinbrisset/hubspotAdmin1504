import type { ProposedChange } from '@/types';
import { updatePropertyDescription } from './properties';

function getObjectType(change: ProposedChange): string {
  const objectType = change.context?.objectType;
  if (typeof objectType !== 'string' || !objectType) {
    throw new Error(`Missing object type context for change "${change.resourceName}"`);
  }

  return objectType;
}

export async function applyHubSpotChange(tenantId: string, change: ProposedChange) {
  if (change.requiresUI) {
    throw new Error(`Change "${change.resourceName}" requires a manual HubSpot review and cannot be auto-applied.`);
  }

  if (
    change.action === 'update' &&
    change.resourceType === 'property' &&
    change.field === 'description' &&
    typeof change.resourceId === 'string' &&
    typeof change.proposedValue === 'string'
  ) {
    const objectType = getObjectType(change);
    const { before, after } = await updatePropertyDescription({
      tenantId,
      objectType,
      propertyName: change.resourceId,
      description: change.proposedValue,
    });

    return {
      resourceType: 'property',
      resourceId: change.resourceId,
      beforeState: before,
      afterState: after,
    };
  }

  throw new Error(`Unsupported auto-apply change type: ${change.resourceType}.${change.field ?? 'unknown'}`);
}

export async function rollbackHubSpotChange(tenantId: string, change: ProposedChange) {
  if (
    change.action === 'update' &&
    change.resourceType === 'property' &&
    change.field === 'description' &&
    typeof change.resourceId === 'string' &&
    typeof change.currentValue === 'string'
  ) {
    const objectType = getObjectType(change);
    const { before, after } = await updatePropertyDescription({
      tenantId,
      objectType,
      propertyName: change.resourceId,
      description: change.currentValue,
    });

    return {
      resourceType: 'property',
      resourceId: change.resourceId,
      beforeState: before,
      afterState: after,
    };
  }

  throw new Error(`Unsupported rollback change type: ${change.resourceType}.${change.field ?? 'unknown'}`);
}
