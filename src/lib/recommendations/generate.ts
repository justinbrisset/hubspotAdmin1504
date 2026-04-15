import { generateAuditReport } from '@/lib/audit/report';
import { getLatestSnapshotsByResource } from '@/lib/snapshots/queries';
import type { ChangeProposal } from '@/types';

type HubSpotRecord = Record<string, unknown>;

function asRecordArray(value: unknown): HubSpotRecord[] {
  return Array.isArray(value)
    ? value.filter((item): item is HubSpotRecord => !!item && typeof item === 'object')
    : [];
}

function buildPropertyDescription(property: HubSpotRecord, objectType: string): string {
  const label = String(property.label ?? property.name ?? 'this field');
  const singularObjectType = objectType.replace(/s$/, '');
  const groupName = String(property.groupName ?? 'the active schema');

  return `Stores ${label.toLowerCase()} for ${singularObjectType} records in HubSpot. This field belongs to the ${groupName} group and should be used consistently anywhere the ${label.toLowerCase()} value is captured or referenced.`;
}

export async function generateRecommendations(
  tenantId: string
): Promise<ChangeProposal[]> {
  const [auditReport, latestSnapshots] = await Promise.all([
    generateAuditReport(tenantId),
    getLatestSnapshotsByResource(tenantId),
  ]);

  const proposals: ChangeProposal[] = [];

  const propertySnapshot = latestSnapshots.properties?.snapshotData;
  if (propertySnapshot && typeof propertySnapshot === 'object') {
    const undocumentedProperties = Object.entries(propertySnapshot as Record<string, unknown>).flatMap(
      ([objectType, values]) =>
        asRecordArray(values)
          .filter(
            (property) =>
              !Boolean(property.hubspotDefined) &&
              (typeof property.description !== 'string' || property.description.trim().length === 0)
          )
          .slice(0, 6)
          .map((property) => ({
            objectType,
            property,
          }))
    );

    for (const { objectType, property } of undocumentedProperties) {
      const propertyName = String(property.name ?? 'unknown');
      const label = String(property.label ?? propertyName);

      proposals.push({
        id: crypto.randomUUID(),
        tenantId,
        title: `Document property: ${label}`,
        summary: `Add a clear description for ${label} so future audits and operators understand the field intent.`,
        reasoning:
          'This field is custom and currently lacks documentation. Filling the description improves schema hygiene without changing the underlying business logic.',
        confidenceScore: 0.86,
        riskLevel: 'low',
        changes: [
          {
            action: 'update',
            resourceType: 'property',
            resourceId: propertyName,
            resourceName: `${objectType}: ${label}`,
            field: 'description',
            currentValue: property.description ?? '',
            proposedValue: buildPropertyDescription(property, objectType),
            reversible: true,
            requiresUI: false,
            context: {
              objectType,
              label,
            },
          },
        ],
      });
    }
  }

  const workflowSnapshot = asRecordArray(latestSnapshots.workflows?.snapshotData);
  for (const workflow of workflowSnapshot.filter((item) => !Boolean(item.isEnabled ?? item.enabled)).slice(0, 4)) {
    const workflowName = String(workflow.name ?? workflow.id ?? 'Unnamed workflow');
    proposals.push({
      id: crypto.randomUUID(),
      tenantId,
      title: `Review inactive workflow: ${workflowName}`,
      summary: 'Confirm whether this inactive workflow should be archived, documented, or brought back into use.',
      reasoning:
        'Inactive workflows increase operational noise and can make automation audits harder to reason about.',
      confidenceScore: 0.64,
      riskLevel: 'medium',
      changes: [
        {
          action: 'update',
          resourceType: 'workflow',
          resourceId: String(workflow.id ?? workflowName),
          resourceName: workflowName,
          currentValue: workflow.isEnabled ?? workflow.enabled ?? false,
          proposedValue: 'Review for archive or reactivation',
          reversible: true,
          requiresUI: true,
          uiInstructions:
            'Open the workflow in HubSpot, confirm it is still intentionally paused, then archive it or document the owner and intended use.',
        },
      ],
    });
  }

  const pipelineSnapshot = latestSnapshots.pipelines?.snapshotData;
  if (pipelineSnapshot && typeof pipelineSnapshot === 'object') {
    const emptyPipelines = Object.entries(pipelineSnapshot as Record<string, unknown>).flatMap(
      ([objectType, values]) =>
        asRecordArray(values)
          .filter((pipeline) => asRecordArray(pipeline.stages).length === 0)
          .slice(0, 3)
          .map((pipeline) => ({
            objectType,
            pipeline,
          }))
    );

    for (const { objectType, pipeline } of emptyPipelines) {
      const pipelineName = String(pipeline.label ?? pipeline.id ?? 'Unnamed pipeline');

      proposals.push({
        id: crypto.randomUUID(),
        tenantId,
        title: `Repair empty pipeline: ${pipelineName}`,
        summary: 'Add the missing stage structure or retire the pipeline before it is used in production.',
        reasoning:
          'Pipelines without stages cannot support lifecycle tracking or accurate funnel reporting.',
        confidenceScore: 0.73,
        riskLevel: 'high',
        changes: [
          {
            action: 'update',
            resourceType: 'pipeline',
            resourceId: String(pipeline.id ?? pipelineName),
            resourceName: `${objectType}: ${pipelineName}`,
            proposedValue: 'Add the intended stages',
            reversible: true,
            requiresUI: true,
            uiInstructions:
              'Open the pipeline in HubSpot and define the minimum viable stage structure, or archive the pipeline if it was created by mistake.',
          },
        ],
      });
    }
  }

  const weakForms = asRecordArray(latestSnapshots.forms?.snapshotData)
    .filter((form) => {
      const fields = asRecordArray(form.fieldGroups).flatMap((group) => asRecordArray(group.fields));
      return fields.length === 0 || fields.every((field) => !Boolean(field.required));
    })
    .slice(0, 3);

  for (const form of weakForms) {
    const formName = String(form.name ?? form.id ?? 'Unnamed form');
    proposals.push({
      id: crypto.randomUUID(),
      tenantId,
      title: `Strengthen form requirements: ${formName}`,
      summary: 'Add the minimum required fields needed for clean lead capture and routing.',
      reasoning:
        'Forms without required fields tend to create low-signal submissions and downstream enrichment work.',
      confidenceScore: 0.67,
      riskLevel: 'medium',
      changes: [
        {
          action: 'update',
          resourceType: 'form',
          resourceId: String(form.id ?? formName),
          resourceName: formName,
          proposedValue: 'Define required fields',
          reversible: true,
          requiresUI: true,
          uiInstructions:
            'Open the form in HubSpot and mark the minimum qualification and routing fields as required.',
        },
      ],
    });
  }

  if (proposals.length === 0 && auditReport.findings.length > 0) {
    const finding = auditReport.findings[0];
    proposals.push({
      id: crypto.randomUUID(),
      tenantId,
      title: `Review audit finding: ${finding.title}`,
      summary: finding.recommendation,
      reasoning:
        'A manual proposal was created because no low-risk automated action was available for this finding.',
      confidenceScore: 0.5,
      riskLevel: finding.severity === 'critical' ? 'high' : 'medium',
      changes: [
        {
          action: 'update',
          resourceType: finding.affectedResources[0]?.type ?? 'portal',
          resourceId: finding.affectedResources[0]?.id,
          resourceName: finding.affectedResources[0]?.name ?? finding.title,
          proposedValue: finding.recommendation,
          reversible: true,
          requiresUI: true,
          uiInstructions: finding.recommendation,
        },
      ],
    });
  }

  return proposals.slice(0, 12);
}
