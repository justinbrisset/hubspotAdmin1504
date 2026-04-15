// ============================================================
// Core domain types
// ============================================================

export type AuthType = 'oauth' | 'service_key';

export type DocType =
  | 'hubspot_docs'
  | 'workflow'
  | 'property'
  | 'pipeline'
  | 'form'
  | 'list'
  | 'email_template'
  | 'owner';

export type ResourceType =
  | 'workflows'
  | 'properties'
  | 'pipelines'
  | 'forms'
  | 'lists'
  | 'marketing_emails'
  | 'owners';

export type HubSpotObjectType =
  | 'contact'
  | 'company'
  | 'deal'
  | 'ticket';

export interface Tenant {
  id: string;
  name: string;
  hubspotPortalId: string;
  authType?: AuthType;
  hubspotTokenExpiresAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PortalSnapshot {
  id: string;
  tenantId: string;
  resourceType: ResourceType;
  snapshotData: unknown;
  createdAt: Date;
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
  syncRunId?: string | null;
}

// ============================================================
// Snapshot / Sync types
// ============================================================

export interface ResourceSyncResult {
  resourceType: ResourceType;
  data: unknown;
  itemsCount: number;
  success: boolean;
  error?: string;
}

export type SyncStatusState = 'pending' | 'syncing' | 'completed' | 'error';

export interface SyncStatus {
  id: string;
  tenantId: string;
  resourceType: ResourceType;
  lastSynced: Date | null;
  status: SyncStatusState;
  errorMessage: string | null;
  itemsCount: number;
  retryCount: number;
}

export interface SyncStatusSummary {
  completed: number;
  errored: number;
  syncing: number;
  totalItems: number;
  latestSyncAt: Date | null;
}

export interface PortalChangeSample {
  id: string;
  name: string;
  objectType?: string;
}

export interface PortalChangeBucket {
  count: number;
  sampleIds: string[];
  samples: PortalChangeSample[];
}

export interface PortalChangeSummary {
  resourceType: ResourceType;
  itemCount: number;
  previousItemCount: number;
  added: PortalChangeBucket;
  updated: PortalChangeBucket;
  removed: PortalChangeBucket;
  renamed: PortalChangeBucket;
}

export interface PortalChange {
  id: string;
  tenantId: string;
  resourceType: ResourceType;
  snapshotId: string;
  previousSnapshotId: string | null;
  summary: PortalChangeSummary;
  createdAt: Date;
}

export interface PortalOverview {
  tenant: Tenant;
  syncStatuses: SyncStatus[];
  syncSummary: SyncStatusSummary;
  latestSnapshots: Partial<Record<ResourceType, PortalSnapshot>>;
  latestChanges: Partial<Record<ResourceType, PortalChange>>;
  recentChanges: PortalChange[];
}

// ============================================================
// Audit types
// ============================================================

export type AuditSeverity = 'critical' | 'warning' | 'info';

export type AuditCategory =
  | 'unused_properties'
  | 'empty_pipelines'
  | 'inactive_workflows'
  | 'missing_lifecycle_mapping'
  | 'duplicate_properties'
  | 'forms_no_submissions'
  | 'missing_required_fields'
  | 'naming_conventions'
  | 'integration_health'
  | 'undocumented_properties'
  | 'stale_assets';

export interface AuditFinding {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  recommendation: string;
  affectedResources: { type: string; name: string; id: string }[];
}

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
// Chat / retrieval types
// ============================================================

export interface ChatCitation {
  id: string;
  tenantId: string;
  docType: DocType;
  configName?: string | null;
  configId?: string | null;
  objectType?: string | null;
  excerpt: string;
  similarity: number;
  sourceLabel: string;
}

export interface RetrievedDocument {
  id: string;
  tenantId: string;
  chunkText: string;
  docType: DocType;
  objectType?: string | null;
  configName?: string | null;
  configId?: string | null;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface ConversationSummary {
  id: string;
  tenantId: string;
  title: string | null;
  preview: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredChatMessageMetadata {
  citations?: ChatCitation[];
  model?: string;
  createdAt?: number;
  totalTokens?: number;
}

// ============================================================
// Change proposals (human-in-the-loop)
// ============================================================

export type ProposalStatus = 'draft' | 'approved' | 'rejected' | 'applied' | 'rolled_back';
export type ProposalSource = 'audit' | 'chat' | 'manual';

export interface ChangeProposal {
  id: string;
  tenantId: string;
  title?: string;
  summary?: string;
  changes: ProposedChange[];
  reasoning: string;
  confidenceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  doubts?: string[];
  alternativeApproaches?: AlternativeApproach[];
}

export interface StoredChangeProposal extends ChangeProposal {
  status: ProposalStatus;
  source: ProposalSource;
  conversationId?: string | null;
  approvedAt?: Date | null;
  appliedAt?: Date | null;
  rejectedAt?: Date | null;
  rolledBackAt?: Date | null;
  approvedBy?: string | null;
  rejectedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  context?: Record<string, unknown>;
}

export interface AlternativeApproach {
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
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
