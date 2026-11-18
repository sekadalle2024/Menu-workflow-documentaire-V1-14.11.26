export type WorkflowNatureId =
  | 'perm-audit'
  | 'ex-audit'
  | 'suivi-recos'
  | 'plan-audit'
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

export type TodoTaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

export type MethodologyAssessment = 'pending' | 'conforme' | 'a-justifier' | 'hors-perimetre';

export type AuditPlanScheduleStatus = 'en-avance' | 'normal' | 'en-retard';

export type AuditPlanTaskUnit = 'heure' | 'jour' | 'semaine';

export interface MissionTodoTask {
  id: string;
  nodeId: string;
  title: string;
  auditor: string;
  plannedDate: string; // YYYY-MM-DD (jour ouvrable)
  plannedEndDate?: string; // YYYY-MM-DD (date de fin prévue)
  actualEndDate?: string; // YYYY-MM-DD (date de fin réelle / ajustée)
  plannedStartHour: number; // 8..17 (base 08h/jour ouvrable)
  plannedDurationHours: number; // ex: 1..24h réparties sur 8h/j ouvrable
  unit?: AuditPlanTaskUnit;
  actualStartAt?: string; // ISO datetime du pointage début
  actualEndAt?: string; // ISO datetime du pointage fin
  actualHours?: number; // heures réelles calculées ou ajustées
  varianceHours?: number; // écart = actualHours - plannedDurationHours
  scheduleStatus?: AuditPlanScheduleStatus;
  status: TodoTaskStatus;
  blockerReason?: string;
  teamSupportRequested?: boolean;
  crippNormRef?: string;
  methodologyAssessment?: MethodologyAssessment;
  managerRedirectNote?: string;
  createdAt: string;
}

export interface AuditPlanMissionMeta {
  code: string;
  no: number;
  secteur: string;
  exercice: string;
  direction: string;
  objectif: string;
  perimetre: string;
  risque: 'Critique' | 'Élevé' | 'Moyen' | 'Faible';
  normeCripp: string;
  nbAuditeurs: number;
  auditeurs: string[];
  chefMission: string;
  dureeSemaines: number;
  dateDebut: string; // ISO YYYY-MM-DD
  dateFinPrevue: string; // ISO YYYY-MM-DD
  dateFinReelle?: string; // ISO YYYY-MM-DD
  progressionPct: number;
  budgetHeures: number;
  heuresRealisees: number;
  ecartJours: number; // < 0 en avance, 0 normal, > 0 en retard
  statutProgression: AuditPlanScheduleStatus;
}

export interface AuditPlanStepMeta {
  phase: 'Phase de préparation' | 'Phase de réalisation' | 'Phase de conclusion' | 'Outils';
  stepNumber?: number;
  dateDebut: string; // ISO YYYY-MM-DD
  dateFin: string; // ISO YYYY-MM-DD
  dateFinReelle?: string; // ISO YYYY-MM-DD
  progressionPct: number;
  ecartJours: number;
  statutProgression: AuditPlanScheduleStatus;
}

export interface RecoSourceMetadata {
  no: number;
  intitule: string;
  observation: string;
  constat: string;
  risque: string;
  recommandation: string;
  commentaireAudite: string;
  commentaireAuditeur: string;
  planAction: string;
  responsable: string;
  delai: string;
  evaluationRisque: string;
  mission: string;
  statut: string;
  document: string;
  direction: string;
  processus: string;
  emailAudite: string;
  emailAuditeur: string;
  reportDelai: string;
  refRecos: string;
  intituleRecos: string;
}

export type MissionStepFormatType = 1 | 2 | 3 | 4;

export type MissionPhaseName =
  | 'Phase de préparation'
  | 'Phase de réalisation'
  | 'Phase de conclusion';

export type SourceDocFormat = 'docx' | 'xlsx' | 'pdf' | 'csv';

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
  todoTasks?: MissionTodoTask[];
  recoMeta?: RecoSourceMetadata;
  planMissionMeta?: AuditPlanMissionMeta;
  planStepMeta?: AuditPlanStepMeta;
  isMissionStep?: boolean;
  missionStepFormatType?: MissionStepFormatType;
  missionStepKey?: string;
  missionPhase?: MissionPhaseName;
  sourceDocFormat?: SourceDocFormat;
  sqliteConversationId?: string;
  sqliteMessageId?: string;
  sqliteHasData?: boolean;
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
