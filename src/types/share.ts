import { ParsedBaseTable } from '../data/missionStepsFormatData';
import {
  RecoSourceMetadata,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from './workflow';

export type ShareTargetType =
  | 'mission-step'
  | 'workflow-dossier'
  | 'suivi-recos'
  | 'audit-plan';

export type SharedPhaseKey = 'preparation' | 'realisation' | 'conclusion';

export interface SharedPhasesConfig {
  preparation: boolean;
  realisation: boolean;
  conclusion: boolean;
}

export interface ShareChangeLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  summary: string;
}

export interface SharedRecoRowSnapshot {
  nodeId: string;
  label: string;
  status: WorkflowNodeStatus;
  missionLabel: string;
  exerciceLabel: string;
  record: RecoSourceMetadata;
}

export interface SharedRecoUpdate {
  recoMeta?: Partial<RecoSourceMetadata>;
  status?: WorkflowNodeStatus;
  updatedAt: number;
  actor: string;
}

export interface SharedWorkspaceRoom {
  token: string;
  active: boolean;
  allowEdit: boolean;
  shareType: ShareTargetType;
  title: string;
  subtitle?: string;
  ownerName: string;
  ownerEmail: string;
  ownerSignature: string;
  clientName: string;
  nodeId?: string;
  node?: WorkflowTreeNode;
  includeMissionWorkflow?: boolean;
  missionRootNodeId?: string;
  missionTree?: WorkflowTreeNode;
  allowedPhases?: SharedPhasesConfig;
  phasesValidatedAt?: number;
  wordBodies?: Record<string, string>;
  tablesByNodeId: Record<string, ParsedBaseTable[]>;
  recoUpdatesByNodeId: Record<string, SharedRecoUpdate>;
  recoRowsSnapshot?: SharedRecoRowSnapshot[];
  createdAt: number;
  updatedAt: number;
  lastModifiedBy?: string;
  changeLog: ShareChangeLogEntry[];
}
