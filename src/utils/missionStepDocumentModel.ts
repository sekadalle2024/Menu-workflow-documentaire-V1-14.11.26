import {
  buildFormatageDataForNode,
  ParsedBaseTable,
} from '../data/missionStepsFormatData';
import { WorkflowTreeNode } from '../types/workflow';
import type {
  MissionStepDocBlock,
  MissionStepDocumentData,
} from '../types/missionStepDocument';

export interface RenderedDocumentPageItem {
  block: MissionStepDocBlock;
  resolvedTable?: ParsedBaseTable;
  resolvedTableIndex?: number;
}

export interface PaginatedDocumentPage {
  pageNumber: number;
  totalPages: number;
  items: RenderedDocumentPageItem[];
}

function makeBlockId(prefix: string, index: number): string {
  return `${prefix}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Construit un document rapport Word structuré par défaut (Page 1 : tableau d'identification + procédure,
 * Page 2+ : travaux, contrôles et conclusions) à partir des tables d'une étape de mission.
 */
export function buildDefaultMissionStepReportDocument(
  node: WorkflowTreeNode,
  tables: ParsedBaseTable[],
  clientName = 'Banque Atlantique UMOA'
): MissionStepDocumentData {
  const formatPayload = buildFormatageDataForNode(node, clientName, '2026');
  const blocks: MissionStepDocBlock[] = [];

  const firstTable = tables[0];
  if (firstTable) {
    blocks.push({
      id: makeBlockId('tbl', 0),
      type: 'table',
      tableId: firstTable.id,
      tableIndex: 0,
    });
  }

  blocks.push(
    {
      id: makeBlockId('h1', 1),
      type: 'heading',
      level: 1,
      text: `1. Procédure : ${node.label}`,
    },
    {
      id: makeBlockId('h2', 2),
      type: 'heading',
      level: 2,
      text: "1.1 Objet et champ d'application",
    },
    {
      id: makeBlockId('h3', 3),
      type: 'heading',
      level: 3,
      text: '1.1.1 Objet de la phase de contrôle',
    },
    {
      id: makeBlockId('p', 4),
      type: 'paragraph',
      text: `Cette section formalise la démarche d'audit applicable à l'étape « ${node.label} » (${formatPayload.phase} · Réf. ${formatPayload.reference}) pour l'entité ${clientName}. Elle précise le référentiel méthodologique, le périmètre des vérifications et les éléments probants attendus pour sécuriser le dossier de mission.`,
    },
    {
      id: makeBlockId('p', 5),
      type: 'paragraph',
      text: `Les travaux sont conduits en conformité avec les normes CRIPP applicables (${formatPayload.norme || 'Normes professionnelles d’audit interne'}). Chaque contrôle fait l'objet d'une documentation traçable et d'une revue de supervision avant validation finale.`,
    }
  );

  if (tables.length > 1) {
    blocks.push({
      id: makeBlockId('pb', 6),
      type: 'page-break',
    });

    blocks.push(
      {
        id: makeBlockId('h1', 7),
        type: 'heading',
        level: 1,
        text: "2. Programme de vérifications et matrices d'audit",
      },
      {
        id: makeBlockId('h2', 8),
        type: 'heading',
        level: 2,
        text: '2.1 Tableaux de travail et tests détaillés',
      }
    );

    tables.slice(1).forEach((tbl, relIdx) => {
      const tIndex = relIdx + 1;
      blocks.push({
        id: makeBlockId('h3', 20 + tIndex),
        type: 'heading',
        level: 3,
        text: `2.1.${tIndex} ${tbl.title || `Tableau ${tIndex + 1}`}`,
      });
      blocks.push({
        id: makeBlockId('tbl', 40 + tIndex),
        type: 'table',
        tableId: tbl.id,
        tableIndex: tIndex,
      });
      blocks.push({
        id: makeBlockId('p', 60 + tIndex),
        type: 'paragraph',
        text: `Synthèse intermédiaire : les éléments consignés ci-dessus servent de base à l'évaluation de la maîtrise des risques et à la formulation des constats de l'étape « ${node.label} ».`,
      });
    });
  }

  return {
    headerText: `Logiciel E-audit Pro – ${node.label}`,
    footerText: `Automatisez vos activités d'audit, risques et contrôles · ${clientName}`,
    blocks,
    updatedAt: Date.now(),
  };
}

/**
 * Synchronise les références de tables d'un document Word avec l'état courant des tableaux SQLite.
 */
export function syncDocumentWithTables(
  doc: MissionStepDocumentData,
  tables: ParsedBaseTable[]
): MissionStepDocumentData {
  const byId = new Map<string, number>();
  tables.forEach((t, idx) => byId.set(t.id, idx));

  const seenIndices = new Set<number>();
  const nextBlocks: MissionStepDocBlock[] = [];

  for (const block of doc.blocks) {
    if (block.type !== 'table') {
      nextBlocks.push(block);
      continue;
    }
    let resolvedIdx = byId.get(block.tableId);
    if (
      resolvedIdx === undefined &&
      typeof block.tableIndex === 'number' &&
      tables[block.tableIndex]
    ) {
      resolvedIdx = block.tableIndex;
    }
    if (resolvedIdx !== undefined && tables[resolvedIdx]) {
      seenIndices.add(resolvedIdx);
      nextBlocks.push({
        ...block,
        tableId: tables[resolvedIdx].id,
        tableIndex: resolvedIdx,
      });
    }
  }

  tables.forEach((t, idx) => {
    if (!seenIndices.has(idx)) {
      nextBlocks.push({
        id: makeBlockId('tbl-sync', idx),
        type: 'table',
        tableId: t.id,
        tableIndex: idx,
      });
    }
  });

  return {
    ...doc,
    blocks: nextBlocks,
  };
}

function estimateBlockHeight(
  block: MissionStepDocBlock,
  resolvedTable?: ParsedBaseTable
): number {
  if (block.type === 'page-break') return 0;
  if (block.type === 'heading') {
    if (block.level === 1) return 68;
    if (block.level === 2) return 46;
    return 38;
  }
  if (block.type === 'paragraph') {
    const lines = Math.max(1, Math.ceil((block.text?.length || 40) / 86));
    return lines * 21 + 14;
  }
  const rowsCount = resolvedTable ? Math.max(1, resolvedTable.rows.length) : 2;
  const approxTextLines = resolvedTable
    ? resolvedTable.rows.reduce((sum, row) => {
        const longest = row.reduce((m, cell) => Math.max(m, (cell || '').length), 0);
        return sum + Math.max(1, Math.ceil(longest / 46));
      }, 0)
    : rowsCount;
  return 44 + approxTextLines * 24 + rowsCount * 10 + 24;
}

/**
 * Découpe les blocs en pages A4 réalistes (respecte les sauts de page explicites
 * et garde les titres solidaires du bloc suivant).
 */
export function paginateMissionStepDocument(
  doc: MissionStepDocumentData,
  tables: ParsedBaseTable[]
): PaginatedDocumentPage[] {
  const MAX_PAGE_HEIGHT = 780;
  const byId = new Map<string, { table: ParsedBaseTable; index: number }>();
  tables.forEach((t, idx) => byId.set(t.id, { table: t, index: idx }));

  const rawPages: RenderedDocumentPageItem[][] = [];
  let currentItems: RenderedDocumentPageItem[] = [];
  let currentHeight = 0;

  const pushPage = () => {
    if (currentItems.length > 0) {
      rawPages.push(currentItems);
      currentItems = [];
      currentHeight = 0;
    }
  };

  const blocks = doc.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    if (block.type === 'page-break') {
      pushPage();
      continue;
    }

    let resolvedTable: ParsedBaseTable | undefined;
    let resolvedTableIndex: number | undefined;
    if (block.type === 'table') {
      const hit = byId.get(block.tableId);
      if (hit) {
        resolvedTable = hit.table;
        resolvedTableIndex = hit.index;
      } else if (
        typeof block.tableIndex === 'number' &&
        tables[block.tableIndex]
      ) {
        resolvedTable = tables[block.tableIndex];
        resolvedTableIndex = block.tableIndex;
      }
      if (!resolvedTable) continue;
    }

    const blockHeight = estimateBlockHeight(block, resolvedTable);

    // Éviter qu'un titre ne soit orphelin tout en bas de page
    let neededWithFollower = blockHeight;
    if (block.type === 'heading' && i + 1 < blocks.length) {
      const nextBlock = blocks[i + 1];
      if (nextBlock.type !== 'page-break') {
        const nextHit =
          nextBlock.type === 'table' ? byId.get(nextBlock.tableId) : undefined;
        neededWithFollower += Math.min(180, estimateBlockHeight(nextBlock, nextHit?.table));
      }
    }

    if (
      currentItems.length > 0 &&
      currentHeight + neededWithFollower > MAX_PAGE_HEIGHT
    ) {
      pushPage();
    }

    currentItems.push({
      block,
      resolvedTable,
      resolvedTableIndex,
    });
    currentHeight += blockHeight;
  }

  pushPage();

  if (rawPages.length === 0) {
    rawPages.push([]);
  }

  return rawPages.map((items, idx) => ({
    pageNumber: idx + 1,
    totalPages: rawPages.length,
    items,
  }));
}

export function countWordsInDocument(
  doc: MissionStepDocumentData,
  tables: ParsedBaseTable[]
): number {
  let text = '';
  for (const b of doc.blocks) {
    if (b.type === 'heading' || b.type === 'paragraph') {
      text += ' ' + b.text;
    } else if (b.type === 'table') {
      const tbl =
        tables.find((t) => t.id === b.tableId) ??
        (typeof b.tableIndex === 'number' ? tables[b.tableIndex] : undefined);
      if (tbl) {
        text += ' ' + tbl.headers.join(' ');
        for (const r of tbl.rows) {
          text += ' ' + r.join(' ');
        }
      }
    }
  }
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return tokens.length;
}
