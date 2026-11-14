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
  | 'document';

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
