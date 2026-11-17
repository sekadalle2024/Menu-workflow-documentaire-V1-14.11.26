export type TreeNodeKind = 'folder' | 'document';

export interface DossierTreeNode {
  id: string;
  label: string;
  kind: TreeNodeKind;
  expanded?: boolean;
  children?: DossierTreeNode[];
}

export interface ClassifiedTableItem {
  id: string;
  rubriqueId: string;
  etapeMission: string;
  norme: string;
  methode: string;
  reference: string;
  displayTitle: string;
  rowCount: number;
  element: HTMLTableElement;
}

export interface AuditMessageTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface AuditChatMessage {
  id: string;
  role: 'user' | 'assistant';
  author: string;
  timestamp: string;
  content: string;
  table?: AuditMessageTable;
}

export type ActiveWorkspaceTab =
  | 'workspace'
  | 'suivi-recos-analytics'
  | 'recos'
  | 'audit-plan'
  | 'schema'
  | 'script';

export type AccordionMode = 'multi' | 'single';
