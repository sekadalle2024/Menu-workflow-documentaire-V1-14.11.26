export type DocHeadingLevel = 1 | 2 | 3;

export interface DocHeadingBlock {
  id: string;
  type: 'heading';
  level: DocHeadingLevel;
  text: string;
}

export interface DocParagraphBlock {
  id: string;
  type: 'paragraph';
  text: string;
  listType?: 'bullet' | 'numbered';
}

export interface DocTableBlock {
  id: string;
  type: 'table';
  tableId: string;
  tableIndex?: number;
}

export interface DocPageBreakBlock {
  id: string;
  type: 'page-break';
}

export type MissionStepDocBlock =
  | DocHeadingBlock
  | DocParagraphBlock
  | DocTableBlock
  | DocPageBreakBlock;

export interface MissionStepDocumentData {
  headerText: string;
  footerText: string;
  blocks: MissionStepDocBlock[];
  sourceFileName?: string;
  updatedAt: number;
}
