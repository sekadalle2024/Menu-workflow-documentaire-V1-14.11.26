export type WorkflowNatureId =
  | 'perm-audit'
  | 'ex-audit'
  | 'suivi-recos'
  | 'perm-cac'
  | 'ex-cac'
  | 'manuel-proc-cac'
  | 'manuel-audit'
  | 'service-audit'
  | 'examen-cia'
  | 'doc-mission';

export type WorkflowNodeType =
  | 'root'
  | 'nature'
  | 'exercice'
  | 'activite'
  | 'section'
  | 'sous-section'
  | 'signature'
  | 'collection'
  | 'document';

export type WorkflowNodeStatus = 'todo' | 'in-progress' | 'in-review' | 'validated';

export interface ReviewNoteItem {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  status: 'open' | 'resolved';
  resolvedAt?: string;
}

export interface NodeVersionEntry {
  id: string;
  versionLabel: string;
  author: string;
  timestamp: string;
  summary: string;
  labelSnapshot: string;
  wordBodySnapshot: string;
}

export interface AuditTrailEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface WorkflowTreeNode {
  id: string;
  label: string;
  nodeType: WorkflowNodeType;
  natureId?: WorkflowNatureId;
  signature?: string;
  driveId?: string;
  owner?: string;
  ownerEmail?: string;
  locked?: boolean;
  lockPin?: string;
  managerReviewed?: boolean;
  status?: WorkflowNodeStatus;
  reviewNotes?: ReviewNoteItem[];
  versions?: NodeVersionEntry[];
  crossRefs?: string[];
  assignee?: string;
  dueDate?: string;
  auditTrail?: AuditTrailEntry[];
  children?: WorkflowTreeNode[];
}

export interface WorkflowSubMenuItem {
  id: string;
  label: string;
  targetNodeSuffix: string;
}

export interface WorkflowCategoryMeta {
  id: WorkflowNatureId;
  label: string;
  shortLabel: string;
  iconKey: string;
  subItems: WorkflowSubMenuItem[];
}

export interface ClientSessionConfig {
  client: string;
  email: string;
  userSignature: string;
  userApiKey: string;
  teamApiKey: string;
  userWorkflowVisible: boolean;
  teamWorkflowVisible: boolean;
}

export interface PostgresDocumentRow {
  no: number;
  client: string;
  nature_workflow: string;
  exercice: string;
  activite: string;
  section: string;
  sous_section: string;
  sous_categorie: string;
  nom_document: string;
  nature: string;
  id_google_drive: string;
  owner: string;
  user_api_key_token: string;
  owner_email: string;
}
