import {
  RecoSourceMetadata,
  ReviewNoteItem,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import { SUIVI_RECOS_2025_DATA, SuiviRecoRecord } from './suiviRecosData';
import { SUIVI_RECOS_2024_DATA } from './suiviRecos2024Data';

export { SUIVI_RECOS_2024_DATA, SUIVI_RECOS_2025_DATA };
export type { SuiviRecoRecord };

export interface LiveSuiviRecoEntry {
  node: WorkflowTreeNode;
  record: RecoSourceMetadata;
  exerciceLabel: string;
  missionLabel: string;
}

const RECO_BY_REF_MAP: Map<string, SuiviRecoRecord> = (() => {
  const map = new Map<string, SuiviRecoRecord>();
  [...SUIVI_RECOS_2024_DATA, ...SUIVI_RECOS_2025_DATA].forEach((r) => {
    map.set(r.refRecos.toUpperCase(), r);
  });
  return map;
})();

export function findRecoRecordByRefOrLabel(labelOrRef: string): SuiviRecoRecord | undefined {
  const trimmed = (labelOrRef || '').trim();
  if (!trimmed) return undefined;
  const direct = RECO_BY_REF_MAP.get(trimmed.toUpperCase());
  if (direct) return direct;
  const match = trimmed.match(/(Recos-[A-Z]+-\d+-\d{4})/i);
  if (match) {
    return RECO_BY_REF_MAP.get(match[1].toUpperCase());
  }
  return undefined;
}

function parseFrDateToIso(dateStr: string): string {
  const clean = (dateStr || '').trim();
  const match = clean.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '2025-06-30';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function mapRecoStatutToNodeStatus(statut: string): WorkflowNodeStatus {
  switch (statut.trim()) {
    case 'Réalisé':
      return 'validated';
    case 'En attente':
      return 'in-review';
    case 'Reporté':
      return 'in-progress';
    case 'Non réalisé':
    default:
      return 'todo';
  }
}

function mapAuditorInfo(emailAuditeur: string): { label: string; signature: string } {
  const normalized = (emailAuditeur || '').toLowerCase();
  if (normalized.includes('senior')) {
    return { label: 'Auditeur Senior', signature: 'SEN' };
  }
  if (normalized.includes('auditeur1')) {
    return { label: 'Auditeur 1', signature: 'AU1' };
  }
  if (normalized.includes('auditeur2')) {
    return { label: 'Auditeur 2', signature: 'AU2' };
  }
  if (normalized.includes('auditeur3')) {
    return { label: 'Auditeur 3', signature: 'AU3' };
  }
  return { label: 'Auditeur Interne', signature: 'AUD' };
}

export function getSimulatedDocCountForReco(row: SuiviRecoRecord): number {
  switch (row.statut.trim()) {
    case 'Non réalisé':
      return row.no % 4 === 0 ? 1 : 0;
    case 'Reporté':
      return row.no % 3;
    case 'En attente':
      return 1 + (row.no % 3);
    case 'Réalisé':
    default:
      return 2 + (row.no % 3);
  }
}

function buildSimulatedDocumentTitles(row: SuiviRecoRecord): string[] {
  const count = getSimulatedDocCountForReco(row);
  if (count === 0) return [];

  const docParts = row.document
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  const primaryDoc = docParts[0] || `Pièce justificative ${row.refRecos}`;
  const secondaryDoc = docParts[1] || `Extraction ${row.processus}`;
  const thirdDoc = docParts[2] || `Feuille de test & re-performance ${row.refRecos}`;

  const pool: string[] = [
    row.statut === 'Non réalisé'
      ? `Relance formelle & point en suspens — ${primaryDoc} (${row.refRecos})`
      : `${primaryDoc} — ${row.refRecos}`,
    `${secondaryDoc} — ${row.refRecos}`,
    `${thirdDoc} (${row.statut})`,
    `PV de vérification & validation auditeur — ${row.responsable}`,
  ];

  return pool.slice(0, count);
}

function formatRecoWordBody(row: SuiviRecoRecord, auditorLabel: string): string {
  return [
    `FICHE DE SUIVI DE RECOMMANDATION D'AUDIT — ${row.refRecos}`,
    `====================================================================`,
    `N° d'ordre           : ${row.no}`,
    `Référence Recos      : ${row.refRecos}`,
    `Nom intégral recos   : ${row.refRecos} - ${row.intituleRecos}`,
    `Intitulé complet     : ${row.intitule}`,
    `Mission source       : ${row.mission}`,
    `Direction concernée  : ${row.direction}`,
    `Processus            : ${row.processus}`,
    `Évaluation Risque    : ${row.evaluationRisque}`,
    `Statut actuel        : ${row.statut}`,
    ``,
    `PILOTAGE & RESPONSABILITÉS`,
    `--------------------------------------------------------------------`,
    `Responsable (Audité) : ${row.responsable} (${row.emailAudite})`,
    `Auditeur en charge   : ${auditorLabel} (${row.emailAuditeur})`,
    `Délai initial        : ${row.delai}`,
    `Report de délai      : ${row.reportDelai}`,
    `Pièces attendues     : ${row.document}`,
    ``,
    `1. CRITÈRE / OBSERVATION`,
    row.observation,
    ``,
    `2. CONSTAT D'AUDIT`,
    row.constat,
    ``,
    `3. RISQUE IDENTIFIÉ`,
    row.risque,
    ``,
    `4. RECOMMANDATION FORMULÉE`,
    row.recommandation,
    ``,
    `5. PLAN D'ACTION`,
    row.planAction,
    ``,
    `6. COMMENTAIRE DE L'AUDITÉ`,
    row.commentaireAudite,
    ``,
    `7. COMMENTAIRE ET DILIGENCES DE L'AUDITEUR`,
    row.commentaireAuditeur,
  ].join('\n');
}

function formatCollectionWordBody(row: SuiviRecoRecord, docTitles: string[]): string {
  const listText =
    docTitles.length > 0
      ? docTitles.map((t, idx) => `  ${idx + 1}. ${t}`).join('\n')
      : '  (Aucun document probant déposé dans cette collection pour le moment)';

  return [
    `COLLECTION DOCUMENTAIRE — Collection - ${row.refRecos}`,
    `====================================================================`,
    `Recommandation parente : ${row.refRecos} - ${row.intituleRecos}`,
    `Mission                : ${row.mission}`,
    `Direction / Processus  : ${row.direction} · ${row.processus}`,
    `Statut de suivi        : ${row.statut} (Criticité : ${row.evaluationRisque})`,
    `Responsable            : ${row.responsable} (${row.emailAudite})`,
    `Auditeur               : ${row.emailAuditeur}`,
    `Échéance               : ${row.reportDelai !== 'Néant' ? `${row.reportDelai} (report de ${row.delai})` : row.delai}`,
    `Pièces référentielles  : ${row.document}`,
    ``,
    `DOCUMENTS SIMULÉS DANS LA COLLECTION (${docTitles.length}/4) :`,
    listText,
  ].join('\n');
}

function formatSimulatedDocWordBody(
  row: SuiviRecoRecord,
  docTitle: string,
  docIndex: number,
  totalDocs: number,
  auditorLabel: string
): string {
  return [
    `PREUVE / DOCUMENT D'AUDIT (${docIndex + 1}/${totalDocs})`,
    `Document : ${docTitle}`,
    `Collection : Collection - ${row.refRecos}`,
    `--------------------------------------------------------------------`,
    `Mission              : ${row.mission}`,
    `Recommandation       : ${row.refRecos} - ${row.intituleRecos}`,
    `Direction            : ${row.direction}`,
    `Processus            : ${row.processus}`,
    `Statut / Risque      : ${row.statut} / ${row.evaluationRisque}`,
    `Responsable (Audité) : ${row.responsable} (${row.emailAudite})`,
    `Auditeur vérificateur: ${auditorLabel} (${row.emailAuditeur})`,
    ``,
    `Objet du document probant :`,
    `Pièce attendue au titre de « ${row.document} » pour justifier la mise en œuvre de l'action suivante :`,
    `→ ${row.planAction}`,
    ``,
    `Synthèse de revue auditeur :`,
    row.commentaireAuditeur,
    ``,
    `Réponse audité :`,
    row.commentaireAudite,
  ].join('\n');
}

function buildReviewNotesForReco(
  prefix: 'user' | 'team',
  year: '2024' | '2025',
  row: SuiviRecoRecord,
  auditorLabel: string
): ReviewNoteItem[] | undefined {
  const shortYear = year.slice(-2);
  if (row.statut === 'Non réalisé' || row.statut === 'Reporté') {
    return [
      {
        id: `${prefix}-sr${shortYear}-rn-${row.no}`,
        author: auditorLabel,
        text: `[${row.evaluationRisque} · ${row.statut}] ${row.commentaireAuditeur}`,
        createdAt: `${year}-05-12T09:30:00.000Z`,
        status: 'open',
      },
    ];
  }
  if (row.statut === 'En attente' && row.evaluationRisque === 'Critique') {
    return [
      {
        id: `${prefix}-sr${shortYear}-rn-${row.no}`,
        author: auditorLabel,
        text: `[Revue Critique · En attente] ${row.commentaireAuditeur}`,
        createdAt: `${year}-05-14T14:15:00.000Z`,
        status: 'open',
      },
    ];
  }
  return undefined;
}

function buildSuiviRecosChildrenForYear(
  year: '2024' | '2025',
  records: SuiviRecoRecord[],
  prefix: 'user' | 'team'
): WorkflowTreeNode[] {
  const missionMap = new Map<string, SuiviRecoRecord[]>();

  records.forEach((row) => {
    const bucket = missionMap.get(row.mission);
    if (bucket) {
      bucket.push(row);
    } else {
      missionMap.set(row.mission, [row]);
    }
  });

  const missionNodes: WorkflowTreeNode[] = [];
  const shortYear = year.slice(-2);
  let missionIdx = 0;

  missionMap.forEach((rows, missionName) => {
    missionIdx += 1;
    const allValidated = rows.every((r) => r.statut === 'Réalisé');
    const anyTodo = rows.some((r) => r.statut === 'Non réalisé');
    const missionStatus: WorkflowNodeStatus = allValidated
      ? 'validated'
      : anyTodo
      ? 'todo'
      : 'in-review';

    const firstAuditor = mapAuditorInfo(rows[0].emailAuditeur);

    const recoNodes: WorkflowTreeNode[] = rows.map((row) => {
      const refSlug = row.refRecos.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const nodeStatus = mapRecoStatutToNodeStatus(row.statut);
      const auditor = mapAuditorInfo(row.emailAuditeur);
      const effectiveDate =
        row.reportDelai && row.reportDelai !== 'Néant' ? row.reportDelai : row.delai;
      const dueDate = parseFrDateToIso(effectiveDate);
      const docTitles = buildSimulatedDocumentTitles(row);

      const simDocs: WorkflowTreeNode[] = docTitles.map((docTitle, docIdx) => ({
        id: `${prefix}-${year}-sr-doc-${refSlug}-${docIdx + 1}`,
        label: docTitle,
        nodeType: 'document',
        natureId: 'suivi-recos',
        signature: auditor.signature,
        driveId: `1drv_sr${shortYear}_${row.no}_${docIdx + 1}`,
        owner: row.responsable,
        ownerEmail: row.emailAudite,
        assignee: auditor.label,
        dueDate,
        status: nodeStatus,
        managerReviewed: row.statut === 'Réalisé',
      }));

      const collectionNode: WorkflowTreeNode = {
        id: `${prefix}-${year}-sr-col-${refSlug}`,
        label: `Collection - ${row.refRecos}`,
        nodeType: 'collection',
        natureId: 'suivi-recos',
        signature: auditor.signature,
        driveId: `1drv_col_${shortYear}_${refSlug}`,
        owner: row.responsable,
        ownerEmail: row.emailAudite,
        assignee: auditor.label,
        dueDate,
        status: nodeStatus,
        managerReviewed: row.statut === 'Réalisé',
        children: simDocs,
      };

      const reviewNotes = buildReviewNotesForReco(prefix, year, row, auditor.label);

      return {
        id: `${prefix}-${year}-sr-reco-${refSlug}`,
        label: `${row.refRecos} - ${row.intituleRecos}`,
        nodeType: 'sous-section',
        natureId: 'suivi-recos',
        signature: auditor.signature,
        driveId: `1drv_${shortYear}_${refSlug}`,
        owner: row.responsable,
        ownerEmail: row.emailAudite,
        assignee: auditor.label,
        dueDate,
        status: nodeStatus,
        managerReviewed: row.statut === 'Réalisé',
        recoMeta: row,
        ...(reviewNotes ? { reviewNotes } : {}),
        children: [collectionNode],
      };
    });

    missionNodes.push({
      id: `${prefix}-${year}-sr-mission-${missionIdx}`,
      label: missionName,
      nodeType: 'section',
      natureId: 'suivi-recos',
      signature: firstAuditor.signature,
      assignee: firstAuditor.label,
      status: missionStatus,
      managerReviewed: allValidated,
      children: recoNodes,
    });
  });

  return missionNodes;
}

export function buildSuiviRecos2024Children(prefix: 'user' | 'team'): WorkflowTreeNode[] {
  return buildSuiviRecosChildrenForYear('2024', SUIVI_RECOS_2024_DATA, prefix);
}

export function buildSuiviRecos2025Children(prefix: 'user' | 'team'): WorkflowTreeNode[] {
  return buildSuiviRecosChildrenForYear('2025', SUIVI_RECOS_2025_DATA, prefix);
}

export function buildInitialSuiviRecosWordBodies(): Record<string, string> {
  const bodies: Record<string, string> = {};
  const prefixes: Array<'user' | 'team'> = ['user', 'team'];
  const datasets: Array<{ year: '2024' | '2025'; rows: SuiviRecoRecord[] }> = [
    { year: '2024', rows: SUIVI_RECOS_2024_DATA },
    { year: '2025', rows: SUIVI_RECOS_2025_DATA },
  ];

  datasets.forEach(({ year, rows }) => {
    rows.forEach((row) => {
      const refSlug = row.refRecos.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const auditor = mapAuditorInfo(row.emailAuditeur);
      const docTitles = buildSimulatedDocumentTitles(row);

      const recoBody = formatRecoWordBody(row, auditor.label);
      const colBody = formatCollectionWordBody(row, docTitles);

      prefixes.forEach((prefix) => {
        bodies[`${prefix}-${year}-sr-reco-${refSlug}`] = recoBody;
        bodies[`${prefix}-${year}-sr-col-${refSlug}`] = colBody;
        docTitles.forEach((docTitle, docIdx) => {
          bodies[`${prefix}-${year}-sr-doc-${refSlug}-${docIdx + 1}`] = formatSimulatedDocWordBody(
            row,
            docTitle,
            docIdx,
            docTitles.length,
            auditor.label
          );
        });
      });
    });
  });

  return bodies;
}

export function extractSuiviRecosFromTrees(
  trees: WorkflowTreeNode[],
  scopeNodeId?: string
): LiveSuiviRecoEntry[] {
  const results: LiveSuiviRecoEntry[] = [];
  const seen = new Set<string>();

  const findScopedRoot = (
    nodes: WorkflowTreeNode[],
    targetId: string
  ): { node: WorkflowTreeNode; exerciceLabel: string; missionLabel: string } | null => {
    const walkFind = (
      list: WorkflowTreeNode[],
      curEx: string,
      curMis: string
    ): { node: WorkflowTreeNode; exerciceLabel: string; missionLabel: string } | null => {
      for (const n of list) {
        const nextEx =
          n.nodeType === 'exercice' || /^Exercice\s+\d{4}/i.test(n.label) ? n.label : curEx;
        const nextMis =
          n.natureId === 'suivi-recos' && n.nodeType === 'section' && !n.recoMeta
            ? n.label
            : curMis;
        if (n.id === targetId) {
          return { node: n, exerciceLabel: nextEx, missionLabel: nextMis };
        }
        if (n.children?.length) {
          const found = walkFind(n.children, nextEx, nextMis);
          if (found) return found;
        }
      }
      return null;
    };
    return walkFind(nodes, 'Exercice 2025', '');
  };

  const collect = (
    node: WorkflowTreeNode,
    curEx: string,
    curMis: string,
    insideSuivi: boolean
  ) => {
    const nextEx =
      node.nodeType === 'exercice' || /^Exercice\s+\d{4}/i.test(node.label)
        ? node.label
        : curEx;
    const isSuivi =
      insideSuivi || node.natureId === 'suivi-recos' || Boolean(node.recoMeta);
    const nextMis =
      isSuivi && node.nodeType === 'section' && !node.recoMeta ? node.label : curMis;

    const record =
      node.recoMeta ??
      (isSuivi && node.nodeType === 'sous-section'
        ? findRecoRecordByRefOrLabel(node.label)
        : undefined);

    if (record && !seen.has(node.id)) {
      seen.add(node.id);
      results.push({
        node,
        record,
        exerciceLabel: nextEx || 'Exercice 2025',
        missionLabel: nextMis || record.mission,
      });
      return;
    }

    if (node.children?.length) {
      for (const child of node.children) {
        collect(child, nextEx, nextMis, isSuivi);
      }
    }
  };

  if (scopeNodeId) {
    const scoped = findScopedRoot(trees, scopeNodeId);
    if (scoped) {
      collect(
        scoped.node,
        scoped.exerciceLabel,
        scoped.missionLabel,
        scoped.node.natureId === 'suivi-recos' || Boolean(scoped.node.recoMeta)
      );
      if (results.length > 0) return results;
    }
  }

  for (const root of trees) {
    collect(root, 'Exercice 2025', '', false);
  }
  return results;
}

export function updateRecoMetaInTree(
  trees: WorkflowTreeNode[],
  recoNodeId: string,
  patch: Partial<RecoSourceMetadata>,
  actor: string
): WorkflowTreeNode[] {
  const nowIso = new Date().toISOString();

  const walk = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((node) => {
      if (node.id === recoNodeId) {
        const currentMeta =
          node.recoMeta ?? findRecoRecordByRefOrLabel(node.label);
        if (!currentMeta) return node;

        const nextMeta: RecoSourceMetadata = {
          ...currentMeta,
          ...patch,
          no:
            patch.no !== undefined && Number.isFinite(Number(patch.no))
              ? Math.max(1, Math.round(Number(patch.no)))
              : currentMeta.no,
        };

        const effectiveDate =
          nextMeta.reportDelai && nextMeta.reportDelai.trim().toLowerCase() !== 'néant'
            ? nextMeta.reportDelai
            : nextMeta.delai;

        const nextStatus = mapRecoStatutToNodeStatus(nextMeta.statut);
        const nextLabel = `${nextMeta.refRecos.trim() || currentMeta.refRecos} - ${
          nextMeta.intituleRecos.trim() || currentMeta.intituleRecos
        }`;

        return {
          ...node,
          label: nextLabel,
          owner: nextMeta.responsable,
          ownerEmail: nextMeta.emailAudite,
          dueDate: parseFrDateToIso(effectiveDate),
          status: nextStatus,
          managerReviewed:
            nextMeta.statut.trim() === 'Réalisé' ? true : node.managerReviewed,
          recoMeta: nextMeta,
          auditTrail: [
            ...(node.auditTrail || []),
            {
              id: `at-reco-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: nowIso,
              actor,
              action: 'Modification rubrique Suivi Recos',
              detail: `${nextMeta.refRecos} (${nextMeta.statut})`,
            },
          ],
        };
      }

      if (node.children?.length) {
        const nextChildren = walk(node.children);
        if (nextChildren !== node.children) {
          return { ...node, children: nextChildren };
        }
      }
      return node;
    });

  return walk(trees);
}
