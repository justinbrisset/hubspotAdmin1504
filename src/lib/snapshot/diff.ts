import type {
  PortalChangeBucket,
  PortalChangeSummary,
  ResourceType,
} from '@/types';

interface NormalizedSnapshotItem {
  key: string;
  id: string;
  name: string;
  objectType?: string;
  fingerprint: string;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, inner]) => `${JSON.stringify(key)}:${stableSerialize(inner)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    : [];
}

function toId(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number') return String(candidate);
  }

  return 'unknown';
}

function toName(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number') return String(candidate);
  }

  return 'Unnamed resource';
}

function buildBucket(items: NormalizedSnapshotItem[]): PortalChangeBucket {
  const samples = items.slice(0, 4).map((item) => ({
    id: item.id,
    name: item.name,
    ...(item.objectType ? { objectType: item.objectType } : {}),
  }));

  return {
    count: items.length,
    sampleIds: samples.map((sample) => sample.id),
    samples,
  };
}

function normalizeWorkflows(data: unknown): NormalizedSnapshotItem[] {
  return asRecordArray(data).map((workflow) => {
    const id = toId(workflow.id, workflow.flowId, workflow.name);
    const name = toName(workflow.name, workflow.label, id);
    const actions = asRecordArray(workflow.actions).map((action) => ({
      id: action.id,
      type: action.actionTypeId ?? action.type,
      fields: action.fields,
    }));

    return {
      key: id,
      id,
      name,
      fingerprint: stableSerialize({
        name,
        enabled: workflow.isEnabled ?? workflow.enabled,
        type: workflow.type ?? workflow.flowType,
        objectTypeId: workflow.objectTypeId,
        reenrollmentEnabled: workflow.reenrollmentEnabled,
        actionCount: actions.length,
        actions,
        updatedAt: workflow.updatedAt,
      }),
    };
  });
}

function normalizeProperties(data: unknown): NormalizedSnapshotItem[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data as Record<string, unknown>).flatMap(([objectType, values]) =>
    asRecordArray(values).map((property) => {
      const id = toId(property.name, property.label);
      const name = toName(property.label, property.name, id);

      return {
        key: `${objectType}:${id}`,
        id,
        name,
        objectType,
        fingerprint: stableSerialize({
          name,
          description: property.description,
          type: property.type,
          fieldType: property.fieldType,
          groupName: property.groupName,
          hasOptions: Array.isArray(property.options),
          optionLabels: asRecordArray(property.options).map((option) => option.label),
          hidden: property.hidden,
        }),
      };
    })
  );
}

function normalizePipelines(data: unknown): NormalizedSnapshotItem[] {
  if (!data || typeof data !== 'object') return [];

  return Object.entries(data as Record<string, unknown>).flatMap(([objectType, values]) =>
    asRecordArray(values).map((pipeline) => {
      const id = toId(pipeline.id, pipeline.pipelineId, pipeline.label);
      const name = toName(pipeline.label, pipeline.name, id);
      const stages = asRecordArray(pipeline.stages).map((stage) => ({
        id: stage.id,
        label: stage.label,
        probability: (stage.metadata as Record<string, unknown> | undefined)?.probability,
      }));

      return {
        key: `${objectType}:${id}`,
        id,
        name,
        objectType,
        fingerprint: stableSerialize({
          name,
          displayOrder: pipeline.displayOrder,
          stageCount: stages.length,
          stages,
        }),
      };
    })
  );
}

function normalizeForms(data: unknown): NormalizedSnapshotItem[] {
  return asRecordArray(data).map((form) => {
    const id = toId(form.id, form.guid, form.name);
    const name = toName(form.name, form.label, id);
    const fieldGroups = asRecordArray(form.fieldGroups);
    const fields = fieldGroups.flatMap((group) => asRecordArray(group.fields));

    return {
      key: id,
      id,
      name,
      fingerprint: stableSerialize({
        name,
        formType: form.formType,
        fieldCount: fields.length,
        requiredCount: fields.filter((field) => Boolean(field.required)).length,
        updatedAt: form.updatedAt,
      }),
    };
  });
}

function normalizeLists(data: unknown): NormalizedSnapshotItem[] {
  return asRecordArray(data).map((list) => {
    const id = toId(list.listId, list.id, list.name);
    const name = toName(list.name, id);

    return {
      key: id,
      id,
      name,
      fingerprint: stableSerialize({
        name,
        processingType: list.processingType ?? list.listType,
        size: list.size ?? list.listSize,
        updatedAt: list.updatedAt,
      }),
    };
  });
}

function normalizeMarketingEmails(data: unknown): NormalizedSnapshotItem[] {
  return asRecordArray(data).map((email) => {
    const id = toId(email.id, email.name);
    const name = toName(email.name, id);

    return {
      key: id,
      id,
      name,
      fingerprint: stableSerialize({
        name,
        subject: email.subject,
        status: email.state ?? email.status,
        type: email.type,
        updatedAt: email.updatedAt,
      }),
    };
  });
}

function normalizeOwners(data: unknown): NormalizedSnapshotItem[] {
  return asRecordArray(data).map((owner) => {
    const id = toId(owner.id, owner.email, owner.userId);
    const name = toName(
      [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim(),
      owner.email,
      id
    );

    return {
      key: id,
      id,
      name,
      fingerprint: stableSerialize({
        name,
        email: owner.email,
        active: owner.activeUserId ?? owner.active,
        teams: asRecordArray(owner.teams).map((team) => team.name),
      }),
    };
  });
}

export function normalizeSnapshotItems(
  resourceType: ResourceType,
  snapshotData: unknown
): NormalizedSnapshotItem[] {
  switch (resourceType) {
    case 'workflows':
      return normalizeWorkflows(snapshotData);
    case 'properties':
      return normalizeProperties(snapshotData);
    case 'pipelines':
      return normalizePipelines(snapshotData);
    case 'forms':
      return normalizeForms(snapshotData);
    case 'lists':
      return normalizeLists(snapshotData);
    case 'marketing_emails':
      return normalizeMarketingEmails(snapshotData);
    case 'owners':
      return normalizeOwners(snapshotData);
    default:
      return [];
  }
}

export function summarizeSnapshotChange(
  resourceType: ResourceType,
  currentSnapshotData: unknown,
  previousSnapshotData: unknown
): PortalChangeSummary {
  const currentItems = normalizeSnapshotItems(resourceType, currentSnapshotData);
  const previousItems = normalizeSnapshotItems(resourceType, previousSnapshotData);

  const currentByKey = new Map(currentItems.map((item) => [item.key, item]));
  const previousByKey = new Map(previousItems.map((item) => [item.key, item]));

  const added: NormalizedSnapshotItem[] = [];
  const updated: NormalizedSnapshotItem[] = [];
  const removed: NormalizedSnapshotItem[] = [];
  const renamed: NormalizedSnapshotItem[] = [];

  for (const currentItem of currentItems) {
    const previousItem = previousByKey.get(currentItem.key);

    if (!previousItem) {
      added.push(currentItem);
      continue;
    }

    if (previousItem.name !== currentItem.name) {
      renamed.push(currentItem);
    }

    if (previousItem.fingerprint !== currentItem.fingerprint) {
      updated.push(currentItem);
    }
  }

  for (const previousItem of previousItems) {
    if (!currentByKey.has(previousItem.key)) {
      removed.push(previousItem);
    }
  }

  return {
    resourceType,
    itemCount: currentItems.length,
    previousItemCount: previousItems.length,
    added: buildBucket(added),
    updated: buildBucket(updated),
    removed: buildBucket(removed),
    renamed: buildBucket(renamed),
  };
}
