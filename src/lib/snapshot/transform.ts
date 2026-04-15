import type { ChunkInput, ResourceType } from '@/types';

// ============================================================
// Workflow transforms
// ============================================================

function describeTrigger(enrollmentCriteria: Record<string, unknown> | undefined): string {
  if (!enrollmentCriteria) return 'No enrollment criteria defined';

  const type = enrollmentCriteria.type as string ?? 'unknown';
  const eventBranches = enrollmentCriteria.eventFilterBranches as unknown[] | undefined;
  const listBranches = enrollmentCriteria.listMembershipFilterBranches as unknown[] | undefined;
  const eventBranchCount = eventBranches?.length ?? 0;
  const listBranchCount = listBranches?.length ?? 0;

  return `${type} with ${eventBranchCount} event branch(es) and ${listBranchCount} list branch(es)`;
}

function describeAction(action: Record<string, unknown>): string {
  const typeId = action.actionTypeId as string ?? action.type as string ?? 'unknown';
  const fields = action.fields as Record<string, unknown> | undefined;
  const fieldCount = fields ? Object.keys(fields).length : 0;

  return `${typeId}${fieldCount > 0 ? ` (${fieldCount} field${fieldCount === 1 ? '' : 's'})` : ''}`;
}

export function transformWorkflow(tenantId: string, wf: Record<string, unknown>): ChunkInput {
  const actions = wf.actions as Record<string, unknown>[] | undefined;
  const enrollmentCriteria =
    (wf.enrollmentCriteria as Record<string, unknown> | undefined)
    ?? (wf.trigger as Record<string, unknown> | undefined);
  const triggerDesc = describeTrigger(enrollmentCriteria);
  const actionsDesc = actions?.length
    ? actions.map((a, i) => `${i + 1}) ${describeAction(a)}`).join('. ')
    : 'No actions defined';
  const isEnabled = Boolean((wf.isEnabled as boolean | undefined) ?? wf.enabled);
  const shouldReEnroll = Boolean(
    (enrollmentCriteria?.shouldReEnroll as boolean | undefined) ?? wf.reenrollmentEnabled
  );

  const text = [
    `[Client: ${tenantId} | Workflow: ${wf.name}]`,
    `Status: ${isEnabled ? 'Active' : 'Inactive'}.`,
    `Type: ${wf.type ?? wf.flowType ?? 'unknown'}.`,
    `Object type: ${wf.objectTypeId ?? 'unknown'}.`,
    `Trigger: ${triggerDesc}.`,
    `Actions: ${actionsDesc}.`,
    shouldReEnroll ? 'Re-enrollment: Enabled.' : 'Re-enrollment: Disabled.',
    `Created: ${wf.createdAt ?? 'unknown'}. Last updated: ${wf.updatedAt ?? 'unknown'}.`,
  ].join(' ');

  return {
    tenantId,
    docType: 'workflow',
    configName: String(wf.name ?? 'Unnamed'),
    configId: String(wf.id),
    text,
    metadata: {
      enabled: isEnabled,
      type: wf.type ?? wf.flowType,
      objectTypeId: wf.objectTypeId,
      actionCount: actions?.length ?? 0,
    },
  };
}

// ============================================================
// Property transforms
// ============================================================

export function transformProperty(
  tenantId: string,
  objectType: string,
  prop: Record<string, unknown>
): ChunkInput {
  const options = prop.options as { label: string }[] | undefined;
  const optionsDesc = options?.length
    ? `Options: ${options.map((o) => o.label).join(', ')}.`
    : '';

  const text = [
    `[Client: ${tenantId} | Property: ${prop.label} (${prop.name})]`,
    `Object: ${objectType}.`,
    `Type: ${prop.type}. Field type: ${prop.fieldType}.`,
    `Group: ${prop.groupName}.`,
    `Description: ${prop.description || 'No description'}.`,
    optionsDesc,
    prop.calculated ? 'This is a calculated property.' : '',
    prop.externalOptions ? 'Uses external options.' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    tenantId,
    docType: 'property',
    objectType,
    configName: String(prop.label ?? prop.name),
    configId: String(prop.name),
    text,
    metadata: {
      type: prop.type,
      fieldType: prop.fieldType,
      groupName: prop.groupName,
      hasOptions: (options?.length ?? 0) > 0,
    },
  };
}

// ============================================================
// Pipeline transforms
// ============================================================

export function transformPipeline(
  tenantId: string,
  objectType: string,
  pipeline: Record<string, unknown>
): ChunkInput {
  const stages = pipeline.stages as Record<string, unknown>[] | undefined;
  const stagesDesc = stages?.length
    ? stages
        .map(
          (s, i) =>
            `${i + 1}. "${s.label}" (probability: ${(s.metadata as Record<string, unknown>)?.probability ?? 'N/A'})`
        )
        .join(', ')
    : 'No stages';

  const text = [
    `[Client: ${tenantId} | Pipeline: ${pipeline.label}]`,
    `Object: ${objectType}.`,
    `Stages: ${stagesDesc}.`,
    `Display order: ${pipeline.displayOrder}.`,
  ].join(' ');

  return {
    tenantId,
    docType: 'pipeline',
    objectType,
    configName: String(pipeline.label ?? 'Unnamed'),
    configId: String(pipeline.id),
    text,
    metadata: { stageCount: stages?.length ?? 0 },
  };
}

// ============================================================
// Form transforms
// ============================================================

export function transformForm(tenantId: string, form: Record<string, unknown>): ChunkInput {
  const fieldGroups = form.fieldGroups as Record<string, unknown>[] | undefined;
  const fields = fieldGroups
    ?.flatMap((g) => (g.fields as Record<string, unknown>[]) ?? [])
    ?? [];
  const fieldsDesc = fields.length
    ? fields.map((f) => `${f.label ?? f.name}${f.required ? ' (required)' : ''}`).join(', ')
    : 'No fields';

  const text = [
    `[Client: ${tenantId} | Form: ${form.name}]`,
    `Type: ${form.formType ?? 'unknown'}.`,
    `Fields: ${fieldsDesc}.`,
    `Created: ${form.createdAt}. Updated: ${form.updatedAt}.`,
  ].join(' ');

  return {
    tenantId,
    docType: 'form',
    configName: String(form.name ?? 'Unnamed'),
    configId: String(form.id),
    text,
    metadata: { fieldCount: fields.length, formType: form.formType },
  };
}

// ============================================================
// List transforms
// ============================================================

export function transformList(tenantId: string, list: Record<string, unknown>): ChunkInput {
  const processingType = list.processingType as string ?? list.listType as string ?? 'unknown';

  const text = [
    `[Client: ${tenantId} | List: ${list.name}]`,
    `Type: ${processingType}.`,
    `Size: ${list.size ?? list.listSize ?? 'unknown'} records.`,
    `Created: ${list.createdAt}. Updated: ${list.updatedAt}.`,
  ].join(' ');

  return {
    tenantId,
    docType: 'list',
    configName: String(list.name ?? 'Unnamed'),
    configId: String(list.listId ?? list.id),
    text,
    metadata: { processingType, size: list.size ?? list.listSize },
  };
}

// ============================================================
// Marketing email transforms
// ============================================================

export function transformMarketingEmail(tenantId: string, email: Record<string, unknown>): ChunkInput {
  const text = [
    `[Client: ${tenantId} | Marketing Email: ${email.name}]`,
    `Subject: ${email.subject ?? 'No subject'}.`,
    `Type: ${email.type ?? 'unknown'}.`,
    `Status: ${email.state ?? email.status ?? 'unknown'}.`,
    `Created: ${email.createdAt}. Updated: ${email.updatedAt}.`,
  ].join(' ');

  return {
    tenantId,
    docType: 'email_template',
    configName: String(email.name ?? 'Unnamed'),
    configId: String(email.id),
    text,
    metadata: { type: email.type, status: email.state ?? email.status },
  };
}

// ============================================================
// Owner transforms
// ============================================================

export function transformOwner(tenantId: string, owner: Record<string, unknown>): ChunkInput {
  const teams = owner.teams as Record<string, unknown>[] | undefined;
  const teamsDesc = teams?.length
    ? teams.map((t) => t.name).join(', ')
    : 'No teams';

  const text = [
    `[Client: ${tenantId} | Owner: ${owner.firstName} ${owner.lastName}]`,
    `Email: ${owner.email}.`,
    `Teams: ${teamsDesc}.`,
  ].join(' ');

  return {
    tenantId,
    docType: 'owner',
    configName: `${owner.firstName} ${owner.lastName}`,
    configId: String(owner.id),
    text,
    metadata: { email: owner.email, teamCount: teams?.length ?? 0 },
  };
}

// ============================================================
// Master transform dispatcher
// ============================================================

export function transformResourceData(
  tenantId: string,
  resourceType: ResourceType,
  data: unknown
): ChunkInput[] {
  switch (resourceType) {
    case 'workflows':
      return (data as Record<string, unknown>[]).map((wf) => transformWorkflow(tenantId, wf));

    case 'properties': {
      const propsByObject = data as Record<string, Record<string, unknown>[]>;
      return Object.entries(propsByObject).flatMap(([objectType, props]) =>
        props.map((prop) => transformProperty(tenantId, objectType, prop))
      );
    }

    case 'pipelines': {
      const pipesByObject = data as Record<string, Record<string, unknown>[]>;
      return Object.entries(pipesByObject).flatMap(([objectType, pipes]) =>
        pipes.map((pipe) => transformPipeline(tenantId, objectType, pipe))
      );
    }

    case 'forms':
      return (data as Record<string, unknown>[]).map((f) => transformForm(tenantId, f));

    case 'lists':
      return (data as Record<string, unknown>[]).map((l) => transformList(tenantId, l));

    case 'marketing_emails':
      return (data as Record<string, unknown>[]).map((e) => transformMarketingEmail(tenantId, e));

    case 'owners':
      return (data as Record<string, unknown>[]).map((o) => transformOwner(tenantId, o));

    default:
      return [];
  }
}
