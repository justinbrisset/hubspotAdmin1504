import type {
  AuditFinding,
  AuditSeverity,
  PortalSnapshot,
  ResourceType,
  SyncStatus,
  Tenant,
} from '@/types';

interface AuditRuleContext {
  tenant: Tenant;
  syncStatuses: SyncStatus[];
  latestSnapshots: Partial<Record<ResourceType, PortalSnapshot>>;
}

type HubSpotRecord = Record<string, unknown>;

function asRecordArray(value: unknown): HubSpotRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is HubSpotRecord => !!item && typeof item === 'object')
    : [];
}

function buildFinding({
  id,
  category,
  severity,
  title,
  description,
  recommendation,
  affectedResources,
}: AuditFinding): AuditFinding {
  return {
    id,
    category,
    severity,
    title,
    description,
    recommendation,
    affectedResources,
  };
}

function getWorkflowSnapshot(ctx: AuditRuleContext): HubSpotRecord[] {
  return asRecordArray(ctx.latestSnapshots.workflows?.snapshotData);
}

function getFormSnapshot(ctx: AuditRuleContext): HubSpotRecord[] {
  return asRecordArray(ctx.latestSnapshots.forms?.snapshotData);
}

function getEmailSnapshot(ctx: AuditRuleContext): HubSpotRecord[] {
  return asRecordArray(ctx.latestSnapshots.marketing_emails?.snapshotData);
}

function getPropertySnapshot(ctx: AuditRuleContext): Array<HubSpotRecord & { objectType: string }> {
  const snapshot = ctx.latestSnapshots.properties?.snapshotData;
  if (!snapshot || typeof snapshot !== 'object') return [];

  return Object.entries(snapshot as Record<string, unknown>).flatMap(([objectType, values]) =>
    asRecordArray(values).map((property) => ({ ...property, objectType }))
  );
}

function getPipelineSnapshot(ctx: AuditRuleContext): Array<HubSpotRecord & { objectType: string }> {
  const snapshot = ctx.latestSnapshots.pipelines?.snapshotData;
  if (!snapshot || typeof snapshot !== 'object') return [];

  return Object.entries(snapshot as Record<string, unknown>).flatMap(([objectType, values]) =>
    asRecordArray(values).map((pipeline) => ({ ...pipeline, objectType }))
  );
}

function getAffectedResources(
  items: Array<{
    id: string;
    name: string;
    type: string;
  }>
): AuditFinding['affectedResources'] {
  return items.slice(0, 8);
}

function pickSeverity(count: number, warningThreshold = 1): AuditSeverity {
  return count >= warningThreshold ? 'warning' : 'info';
}

function ruleInactiveWorkflows(ctx: AuditRuleContext): AuditFinding[] {
  const inactive = getWorkflowSnapshot(ctx)
    .filter((workflow) => !Boolean(workflow.isEnabled ?? workflow.enabled))
    .map((workflow) => ({
      id: String(workflow.id ?? workflow.name ?? 'unknown'),
      name: String(workflow.name ?? workflow.id ?? 'Unnamed workflow'),
      type: 'workflow',
    }));

  if (inactive.length === 0) return [];

  return [
    buildFinding({
      id: 'inactive-workflows',
      category: 'inactive_workflows',
      severity: pickSeverity(inactive.length, 2),
      title: `${inactive.length} inactive workflow${inactive.length === 1 ? '' : 's'} detected`,
      description:
        'Inactive workflows remain in the configuration surface but are not producing automation value. They often indicate stale experiments, paused launches, or automation drift.',
      recommendation:
        'Review whether these workflows should be archived, re-enabled, or documented as intentionally paused.',
      affectedResources: getAffectedResources(inactive),
    }),
  ];
}

function ruleUndocumentedProperties(ctx: AuditRuleContext): AuditFinding[] {
  const undocumented = getPropertySnapshot(ctx)
    .filter(
      (property) =>
        !Boolean(property.hubspotDefined) &&
        (typeof property.description !== 'string' || property.description.trim().length === 0)
    )
    .map((property) => ({
      id: String(property.name ?? 'unknown'),
      name: `${property.objectType}: ${String(property.label ?? property.name ?? 'Unnamed property')}`,
      type: 'property',
    }));

  if (undocumented.length === 0) return [];

  return [
    buildFinding({
      id: 'undocumented-properties',
      category: 'undocumented_properties',
      severity: pickSeverity(undocumented.length, 3),
      title: `${undocumented.length} custom propert${undocumented.length === 1 ? 'y is' : 'ies are'} undocumented`,
      description:
        'Custom properties without descriptions are difficult to govern, harder for teams to trust, and make audit or migration work slower.',
      recommendation:
        'Add plain-language descriptions that explain the business meaning and intended usage of each field.',
      affectedResources: getAffectedResources(undocumented),
    }),
  ];
}

function ruleUnusedProperties(ctx: AuditRuleContext): AuditFinding[] {
  const hidden = getPropertySnapshot(ctx)
    .filter((property) => !Boolean(property.hubspotDefined) && Boolean(property.hidden))
    .map((property) => ({
      id: String(property.name ?? 'unknown'),
      name: `${property.objectType}: ${String(property.label ?? property.name ?? 'Unnamed property')}`,
      type: 'property',
    }));

  if (hidden.length === 0) return [];

  return [
    buildFinding({
      id: 'unused-properties',
      category: 'unused_properties',
      severity: 'info',
      title: `${hidden.length} hidden custom propert${hidden.length === 1 ? 'y looks' : 'ies look'} like cleanup candidates`,
      description:
        'Hidden custom properties often represent legacy experiments or fields that are no longer part of active operational workflows.',
      recommendation:
        'Confirm whether these hidden custom properties can be archived or consolidated into the active schema.',
      affectedResources: getAffectedResources(hidden),
    }),
  ];
}

function ruleEmptyPipelines(ctx: AuditRuleContext): AuditFinding[] {
  const empty = getPipelineSnapshot(ctx)
    .filter((pipeline) => asRecordArray(pipeline.stages).length === 0)
    .map((pipeline) => ({
      id: String(pipeline.id ?? pipeline.label ?? 'unknown'),
      name: `${pipeline.objectType}: ${String(pipeline.label ?? pipeline.id ?? 'Unnamed pipeline')}`,
      type: 'pipeline',
    }));

  if (empty.length === 0) return [];

  return [
    buildFinding({
      id: 'empty-pipelines',
      category: 'empty_pipelines',
      severity: 'critical',
      title: `${empty.length} pipeline${empty.length === 1 ? '' : 's'} ha${empty.length === 1 ? 's' : 've'} no stages`,
      description:
        'A pipeline without stages cannot support meaningful lifecycle movement or reporting and usually reflects broken setup.',
      recommendation:
        'Define the intended stage structure or archive the unused pipeline before users begin storing records against it.',
      affectedResources: getAffectedResources(empty),
    }),
  ];
}

function ruleDuplicateProperties(ctx: AuditRuleContext): AuditFinding[] {
  const duplicates: Array<{ id: string; name: string; type: string }> = [];
  const byLabel = new Map<string, Array<HubSpotRecord & { objectType: string }>>();

  for (const property of getPropertySnapshot(ctx)) {
    const label = String(property.label ?? property.name ?? '').trim().toLowerCase();
    if (!label) continue;

    const key = `${property.objectType}:${label}`;
    const list = byLabel.get(key) ?? [];
    list.push(property);
    byLabel.set(key, list);
  }

  for (const [key, list] of byLabel.entries()) {
    if (list.length < 2) continue;

    const objectType = key.split(':')[0];
    duplicates.push({
      id: key,
      name: `${objectType}: ${String(list[0].label ?? list[0].name ?? 'Duplicate property')}`,
      type: 'property',
    });
  }

  if (duplicates.length === 0) return [];

  return [
    buildFinding({
      id: 'duplicate-properties',
      category: 'duplicate_properties',
      severity: pickSeverity(duplicates.length, 2),
      title: `${duplicates.length} duplicate property label group${duplicates.length === 1 ? '' : 's'} detected`,
      description:
        'Repeated field labels within the same object type create schema ambiguity and make downstream reporting harder to trust.',
      recommendation:
        'Review whether duplicate labels should be merged, renamed, or documented with clearer ownership.',
      affectedResources: getAffectedResources(duplicates),
    }),
  ];
}

function ruleMissingRequiredFields(ctx: AuditRuleContext): AuditFinding[] {
  const affected = getFormSnapshot(ctx)
    .filter((form) => {
      const fields = asRecordArray(form.fieldGroups).flatMap((group) => asRecordArray(group.fields));
      const requiredCount = fields.filter((field) => Boolean(field.required)).length;
      return fields.length === 0 || requiredCount === 0;
    })
    .map((form) => ({
      id: String(form.id ?? form.name ?? 'unknown'),
      name: String(form.name ?? form.id ?? 'Unnamed form'),
      type: 'form',
    }));

  if (affected.length === 0) return [];

  return [
    buildFinding({
      id: 'missing-required-fields',
      category: 'missing_required_fields',
      severity: pickSeverity(affected.length, 2),
      title: `${affected.length} form${affected.length === 1 ? '' : 's'} missing strong required-field discipline`,
      description:
        'Forms with no required fields often collect low-quality data and create downstream enrichment or handoff gaps.',
      recommendation:
        'Add the minimum required fields for qualification, routing, and lifecycle attribution.',
      affectedResources: getAffectedResources(affected),
    }),
  ];
}

function ruleNamingConventions(ctx: AuditRuleContext): AuditFinding[] {
  const suspiciousName = /(copy|test|temp|untitled|new workflow|draft)/i;

  const affected = [
    ...getWorkflowSnapshot(ctx).map((workflow) => ({
      id: String(workflow.id ?? workflow.name ?? 'unknown'),
      name: String(workflow.name ?? workflow.id ?? 'Unnamed workflow'),
      type: 'workflow',
    })),
    ...getFormSnapshot(ctx).map((form) => ({
      id: String(form.id ?? form.name ?? 'unknown'),
      name: String(form.name ?? form.id ?? 'Unnamed form'),
      type: 'form',
    })),
    ...getPipelineSnapshot(ctx).map((pipeline) => ({
      id: String(pipeline.id ?? pipeline.label ?? 'unknown'),
      name: String(pipeline.label ?? pipeline.id ?? 'Unnamed pipeline'),
      type: 'pipeline',
    })),
    ...getEmailSnapshot(ctx).map((email) => ({
      id: String(email.id ?? email.name ?? 'unknown'),
      name: String(email.name ?? email.id ?? 'Unnamed email'),
      type: 'marketing_email',
    })),
  ].filter((item) => suspiciousName.test(item.name));

  if (affected.length === 0) return [];

  return [
    buildFinding({
      id: 'naming-conventions',
      category: 'naming_conventions',
      severity: 'info',
      title: `${affected.length} asset${affected.length === 1 ? '' : 's'} use placeholder naming`,
      description:
        'Placeholder asset names are a signal that configuration hygiene is drifting and make operational review more time-consuming.',
      recommendation:
        'Rename draft, copy, or temporary assets to match the team naming convention before they spread through reporting and automation.',
      affectedResources: getAffectedResources(affected),
    }),
  ];
}

function ruleMissingLifecycleMapping(ctx: AuditRuleContext): AuditFinding[] {
  const contactProperties = getPropertySnapshot(ctx).filter(
    (property) => property.objectType === 'contacts'
  );
  const hasLifecycle = contactProperties.some(
    (property) => String(property.name ?? '').toLowerCase() === 'lifecyclestage'
  );

  if (hasLifecycle) return [];

  return [
    buildFinding({
      id: 'missing-lifecycle-mapping',
      category: 'missing_lifecycle_mapping',
      severity: 'warning',
      title: 'No lifecycle stage property was found in the synced contact schema',
      description:
        'Lifecycle stage is one of the clearest indicators for funnel reporting, lead routing, and cross-team alignment.',
      recommendation:
        'Verify that lifecycle stage data is available and mapped correctly for contacts before using the portal for audit or qualification decisions.',
      affectedResources: [],
    }),
  ];
}

function ruleIntegrationHealth(ctx: AuditRuleContext): AuditFinding[] {
  const failed = ctx.syncStatuses
    .filter((status) => status.status === 'error')
    .map((status) => ({
      id: status.resourceType,
      name: `${status.resourceType} sync`,
      type: 'sync_status',
    }));

  if (failed.length > 0) {
    return [
      buildFinding({
        id: 'integration-health-errors',
        category: 'integration_health',
        severity: 'critical',
        title: `${failed.length} sync lane${failed.length === 1 ? ' is' : 's are'} failing`,
        description:
          'Broken sync lanes reduce trust in the audit surface and leave the AI layer reasoning over incomplete portal data.',
        recommendation:
          'Resolve failed syncs first, then rerun the audit to make sure later findings reflect a complete snapshot.',
        affectedResources: getAffectedResources(failed),
      }),
    ];
  }

  const stale = ctx.syncStatuses
    .filter((status) => {
      if (!status.lastSynced) return true;
      return Date.now() - status.lastSynced.getTime() > 1000 * 60 * 60 * 24 * 7;
    })
    .map((status) => ({
      id: status.resourceType,
      name: `${status.resourceType} sync`,
      type: 'sync_status',
    }));

  if (stale.length === 0) return [];

  return [
    buildFinding({
      id: 'integration-health-stale',
      category: 'integration_health',
      severity: 'warning',
      title: `${stale.length} sync lane${stale.length === 1 ? ' is' : 's are'} stale`,
      description:
        'If the sync baseline is too old, recommendations and change summaries will drift away from the current portal reality.',
      recommendation:
        'Run a fresh sync before relying on the audit as the source of truth.',
      affectedResources: getAffectedResources(stale),
    }),
  ];
}

function ruleStaleAssets(ctx: AuditRuleContext): AuditFinding[] {
  const staleCutoff = Date.now() - 1000 * 60 * 60 * 24 * 365;

  const stale = [
    ...getWorkflowSnapshot(ctx).map((workflow) => ({
      id: String(workflow.id ?? workflow.name ?? 'unknown'),
      name: String(workflow.name ?? workflow.id ?? 'Unnamed workflow'),
      type: 'workflow',
      updatedAt: workflow.updatedAt,
    })),
    ...getFormSnapshot(ctx).map((form) => ({
      id: String(form.id ?? form.name ?? 'unknown'),
      name: String(form.name ?? form.id ?? 'Unnamed form'),
      type: 'form',
      updatedAt: form.updatedAt,
    })),
    ...getEmailSnapshot(ctx).map((email) => ({
      id: String(email.id ?? email.name ?? 'unknown'),
      name: String(email.name ?? email.id ?? 'Unnamed email'),
      type: 'marketing_email',
      updatedAt: email.updatedAt,
    })),
  ]
    .filter((item) => typeof item.updatedAt === 'string')
    .filter((item) => {
      const updatedAt = Date.parse(String(item.updatedAt));
      return Number.isFinite(updatedAt) && updatedAt < staleCutoff;
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
    }));

  if (stale.length === 0) return [];

  return [
    buildFinding({
      id: 'stale-assets',
      category: 'stale_assets',
      severity: 'info',
      title: `${stale.length} asset${stale.length === 1 ? '' : 's'} appear untouched for over a year`,
      description:
        'Long-stale assets are not automatically bad, but they are prime candidates for rationalization, documentation, or retirement.',
      recommendation:
        'Review whether these assets are still business-critical or should move into a deprecated archive track.',
      affectedResources: getAffectedResources(stale),
    }),
  ];
}

export function runAuditRules(ctx: AuditRuleContext): AuditFinding[] {
  return [
    ...ruleIntegrationHealth(ctx),
    ...ruleEmptyPipelines(ctx),
    ...ruleInactiveWorkflows(ctx),
    ...ruleUndocumentedProperties(ctx),
    ...ruleUnusedProperties(ctx),
    ...ruleDuplicateProperties(ctx),
    ...ruleMissingRequiredFields(ctx),
    ...ruleNamingConventions(ctx),
    ...ruleMissingLifecycleMapping(ctx),
    ...ruleStaleAssets(ctx),
  ];
}
