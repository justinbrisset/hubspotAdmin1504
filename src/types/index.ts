// ============================================================
// Core domain types
// ============================================================

export interface Tenant {
  id: string;
  name: string;
  hubspotPortalId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DocumentChunk {
  id: string;
  tenantId: string;
  docType: DocType;
  objectType?: HubSpotObjectType;
  configName?: string;
  configId?: string;
  chunkText: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  embedding: number[];
  lastSynced: Date;
}

export type DocType =
  | 'hubspot_docs'
  | 'workflow'
  | 'property'
  | 'pipeline'
  | 'form'
  | 'list'
  | 'email_template'
  | 'owner';

export type HubSpotObjectType =
  | 'contact'
  | 'company'
  | 'deal'
  | 'ticket';

// ============================================================
// Change proposals (human-in-the-loop)
// ============================================================

export interface ChangeProposal {
  id: string;
  tenantId: string;
  changes: ProposedChange[];
  reasoning: string;
  confidenceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  doubts?: string[];
  alternativeApproaches?: AlternativeApproach[];
}

export interface ProposedChange {
  action: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId?: string;
  resourceName: string;
  field?: string;
  currentValue?: unknown;
  proposedValue: unknown;
  reversible: boolean;
  requiresUI: boolean;
  uiInstructions?: string;
}

export interface AlternativeApproach {
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

// ============================================================
// Audit types
// ============================================================

export interface AuditFinding {
  id: string;
  category: AuditCategory;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
  affectedResources: { type: string; name: string; id: string }[];
}

export type AuditCategory =
  | 'unused_properties'
  | 'empty_pipelines'
  | 'inactive_workflows'
  | 'missing_lifecycle_mapping'
  | 'duplicate_properties'
  | 'forms_no_submissions'
  | 'missing_required_fields'
  | 'naming_conventions'
  | 'integration_health';

export interface AuditReport {
  tenantId: string;
  tenantName: string;
  generatedAt: Date;
  overallScore: number;
  findings: AuditFinding[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    totalResources: number;
  };
}

// ============================================================
// Snapshot / Sync types
// ============================================================

export type ResourceType =
  | 'workflows'
  | 'properties'
  | 'pipelines'
  | 'forms'
  | 'lists'
  | 'marketing_emails'
  | 'owners';

export interface ResourceSyncResult {
  resourceType: ResourceType;
  data: unknown;
  itemsCount: number;
  success: boolean;
  error?: string;
}

export interface SyncStatus {
  id: string;
  tenantId: string;
  resourceType: ResourceType;
  lastSynced: Date | null;
  status: 'pending' | 'syncing' | 'completed' | 'error';
  errorMessage: string | null;
  itemsCount: number;
  retryCount: number;
}

// ============================================================
// Embedding pipeline types
// ============================================================

export interface ChunkInput {
  tenantId: string;
  docType: string;
  objectType?: string;
  configName: string;
  configId: string;
  text: string;
  metadata: Record<string, unknown>;
}
