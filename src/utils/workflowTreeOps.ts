import {
  ClientSessionConfig,
  PostgresDocumentRow,
  WorkflowCategoryMeta,
  WorkflowNatureId,
  WorkflowTreeNode,
} from '../types/workflow';

export function findNodeById(
  nodes: WorkflowTreeNode[],
  targetId: string
): WorkflowTreeNode | null {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (node.children?.length) {
      const found = findNodeById(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

export function findNodePath(
  nodes: WorkflowTreeNode[],
  targetId: string,
  acc: WorkflowTreeNode[] = []
): WorkflowTreeNode[] | null {
  for (const node of nodes) {
    const nextAcc = [...acc, node];
    if (node.id === targetId) return nextAcc;
    if (node.children?.length) {
      const found = findNodePath(node.children, targetId, nextAcc);
      if (found) return found;
    }
  }
  return null;
}

export function findNodeIdsByNatureId(
  nodes: WorkflowTreeNode[],
  natureId: WorkflowNatureId
): string[] {
  const ids: string[] = [];
  const walk = (items: WorkflowTreeNode[]) => {
    for (const n of items) {
      if (n.nodeType === 'nature' && n.natureId === natureId) {
        ids.push(n.id);
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return ids;
}

export function resolveRootIdForTarget(
  trees: WorkflowTreeNode[],
  targetId?: string
): string {
  if (!targetId) return 'root-workflow';
  const path = findNodePath(trees, targetId);
  return path?.[0]?.id || 'root-workflow';
}

export function getLeafIds(node: WorkflowTreeNode): string[] {
  if (!node.children?.length) return [node.id];
  return node.children.flatMap((c) => getLeafIds(c));
}

export function getWorkflowCheckState(
  node: WorkflowTreeNode,
  checkedIds: Set<string>
): 'checked' | 'unchecked' | 'indeterminate' {
  // La sélection d'un nœud enfant ne doit jamais cocher son parent :
  // l'état d'un nœud reflète uniquement sa propre appartenance à checkedIds.
  return checkedIds.has(node.id) ? 'checked' : 'unchecked';
}

export function toggleWorkflowNodeCheck(
  node: WorkflowTreeNode,
  checkedIds: Set<string>
): Set<string> {
  const next = new Set(checkedIds);
  const shouldCheck = !checkedIds.has(node.id);

  // Propagation descendante uniquement : cocher/décocher un parent agit sur ses enfants,
  // mais agir sur un enfant ne modifie jamais ses parents.
  const walk = (n: WorkflowTreeNode) => {
    if (shouldCheck) next.add(n.id);
    else next.delete(n.id);
    n.children?.forEach(walk);
  };
  walk(node);
  return next;
}

export function filterTopLevelSelectedIds(
  trees: WorkflowTreeNode[],
  ids: Iterable<string>
): string[] {
  const idSet = new Set(ids);
  const topIds: string[] = [];
  const walk = (nodes: WorkflowTreeNode[], hasSelectedAncestor: boolean) => {
    for (const node of nodes) {
      const isSelected = node.nodeType !== 'root' && idSet.has(node.id);
      if (isSelected && !hasSelectedAncestor) {
        topIds.push(node.id);
      }
      if (node.children?.length) {
        walk(node.children, hasSelectedAncestor || isSelected);
      }
    }
  };
  walk(trees, false);
  return topIds;
}

export function collectAllWorkflowNodeIds(nodes: WorkflowTreeNode[]): string[] {
  const list: string[] = [];
  const walk = (items: WorkflowTreeNode[]) => {
    for (const n of items) {
      list.push(n.id);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return list;
}

export function collectAllNodesList(nodes: WorkflowTreeNode[]): WorkflowTreeNode[] {
  const list: WorkflowTreeNode[] = [];
  const walk = (items: WorkflowTreeNode[]) => {
    for (const n of items) {
      list.push(n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return list;
}

export function collectAllExpandableWorkflowIds(nodes: WorkflowTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (items: WorkflowTreeNode[]) => {
    for (const n of items) {
      if (n.children?.length) {
        ids.add(n.id);
        walk(n.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

export function collectSubtreeExpandableIds(node: WorkflowTreeNode): string[] {
  const ids: string[] = [];
  const walk = (n: WorkflowTreeNode) => {
    if (n.children?.length) {
      ids.push(n.id);
      n.children.forEach(walk);
    }
  };
  walk(node);
  return ids;
}

function extractExerciceYear(label: string): number {
  const match = label.match(/\b(19|20)\d{2}\b/);
  return match ? Number.parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

export function sortExercicesChronologically(
  nodes: WorkflowTreeNode[]
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (!node.children?.length) return node;
    const sortedChildren = sortExercicesChronologically(node.children);
    if (node.nodeType === 'root' || node.nodeType === 'exercice') {
      const onlyOrMixedExercices = [...sortedChildren].sort((a, b) => {
        if (a.nodeType === 'exercice' && b.nodeType === 'exercice') {
          const yearDiff = extractExerciceYear(a.label) - extractExerciceYear(b.label);
          if (yearDiff !== 0) return yearDiff;
          return a.label.localeCompare(b.label, 'fr');
        }
        return 0;
      });
      return { ...node, children: onlyOrMixedExercices };
    }
    return { ...node, children: sortedChildren };
  });
}

let uniqueSeq = 1000;
function nextUid(prefix: string): string {
  uniqueSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${uniqueSeq}`;
}

export function cloneNodeWithFreshIds(
  node: WorkflowTreeNode,
  overrideSignature?: string
): WorkflowTreeNode {
  return {
    ...node,
    id: nextUid(node.nodeType),
    signature: overrideSignature ?? node.signature,
    driveId: node.driveId ? `1drv_${Math.random().toString(36).slice(2, 10)}` : undefined,
    children: node.children?.map((c) => cloneNodeWithFreshIds(c, overrideSignature)),
  };
}

export function renameNodeInTree(
  nodes: WorkflowTreeNode[],
  targetId: string,
  newLabel: string
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return { ...node, label: newLabel };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: renameNodeInTree(node.children, targetId, newLabel),
      };
    }
    return node;
  });
}

export function deleteNodesInTree(
  nodes: WorkflowTreeNode[],
  idsToDelete: Set<string>
): WorkflowTreeNode[] {
  return nodes
    .filter((node) => node.nodeType === 'root' || !idsToDelete.has(node.id))
    .map((node) => {
      if (node.children?.length) {
        return {
          ...node,
          children: deleteNodesInTree(node.children, idsToDelete),
        };
      }
      return node;
    });
}

export function duplicateNodesInTree(
  nodes: WorkflowTreeNode[],
  idsToDuplicate: Set<string>
): WorkflowTreeNode[] {
  const out: WorkflowTreeNode[] = [];
  for (const node of nodes) {
    const updatedNode = node.children?.length
      ? { ...node, children: duplicateNodesInTree(node.children, idsToDuplicate) }
      : node;
    out.push(updatedNode);

    if (node.nodeType !== 'root' && idsToDuplicate.has(node.id)) {
      const cloned = cloneNodeWithFreshIds(updatedNode);
      cloned.label = `${updatedNode.label} (copie)`;
      out.push(cloned);
    }
  }
  return out;
}

export function addChildNodeToTarget(
  nodes: WorkflowTreeNode[],
  targetId: string,
  newChild: WorkflowTreeNode
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return {
        ...node,
        children: [...(node.children || []), newChild],
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: addChildNodeToTarget(node.children, targetId, newChild),
      };
    }
    return node;
  });
}

function withSignatureRecursive(
  node: WorkflowTreeNode,
  sigCode: string
): WorkflowTreeNode {
  return {
    ...node,
    signature: sigCode,
    owner: sigCode,
    children: node.children?.map((c) => withSignatureRecursive(c, sigCode)),
  };
}

function isDescendantOrSelf(
  nodes: WorkflowTreeNode[],
  ancestorId: string,
  candidateId: string
): boolean {
  if (ancestorId === candidateId) return true;
  const ancestor = findNodeById(nodes, ancestorId);
  if (!ancestor?.children?.length) return false;
  return Boolean(findNodeById(ancestor.children, candidateId));
}

export function isNodeLockedOrWithinLockedAncestor(
  nodes: WorkflowTreeNode[],
  targetId: string
): boolean {
  const path = findNodePath(nodes, targetId);
  return Boolean(path?.some((n) => Boolean(n.locked)));
}

export function hasLockedNodeInIds(
  nodes: WorkflowTreeNode[],
  ids: Iterable<string>
): boolean {
  const idSet = new Set(ids);
  const checkSubtree = (n: WorkflowTreeNode): boolean => {
    if (n.locked) return true;
    return Boolean(n.children?.some(checkSubtree));
  };
  for (const id of idSet) {
    if (isNodeLockedOrWithinLockedAncestor(nodes, id)) return true;
    const found = findNodeById(nodes, id);
    if (found && checkSubtree(found)) return true;
  }
  return false;
}

export function insertNodesAtTarget(
  nodes: WorkflowTreeNode[],
  destinationId: string,
  itemsToInsert: WorkflowTreeNode[]
): WorkflowTreeNode[] {
  const destPath = findNodePath(nodes, destinationId);
  if (!destPath || itemsToInsert.length === 0) return nodes;
  const destNode = destPath[destPath.length - 1];

  // Si la cible est un document, on insère juste APRÈS ce fichier dans son parent direct
  if (destNode.nodeType === 'document' && destPath.length >= 2) {
    const parentId = destPath[destPath.length - 2].id;
    const insertIntoParent = (list: WorkflowTreeNode[]): WorkflowTreeNode[] =>
      list.map((n) => {
        if (n.id === parentId) {
          const children = [...(n.children || [])];
          const idx = children.findIndex((c) => c.id === destNode.id);
          const insertIdx = idx >= 0 ? idx + 1 : children.length;
          children.splice(insertIdx, 0, ...itemsToInsert);
          return { ...n, children };
        }
        if (n.children?.length) {
          return { ...n, children: insertIntoParent(n.children) };
        }
        return n;
      });
    return insertIntoParent(nodes);
  }

  // Sinon, on insère à l'intérieur du dossier/section/exercice cible en dernière position
  let updated = nodes;
  for (const item of itemsToInsert) {
    updated = addChildNodeToTarget(updated, destinationId, item);
  }
  return updated;
}

export function transferNodesToTarget(
  nodes: WorkflowTreeNode[],
  sourceIds: string[],
  targetId: string,
  userSignature: string
): WorkflowTreeNode[] {
  const targetPath = findNodePath(nodes, targetId);
  if (!targetPath) return nodes;

  const isTargetTeam = targetPath[0]?.id === 'root-team-workflow';
  const sigCode = (userSignature || 'OHA').toUpperCase().slice(0, 3);

  const sourceNodes = sourceIds
    .map((id) => findNodeById(nodes, id))
    .filter((n): n is WorkflowTreeNode => Boolean(n && n.nodeType !== 'root'));

  if (sourceNodes.length === 0) return nodes;

  // Conserve la nomenclature source de Workflow lors du transfert vers Team Workflow
  // (l'intégration sous [SIG] se fait ensuite via l'action contextuelle « Signature »)
  const clonedItems = sourceNodes.map((src) =>
    cloneNodeWithFreshIds(src, isTargetTeam ? sigCode : src.signature)
  );

  return insertNodesAtTarget(nodes, targetId, clonedItems);
}

export function applySignatureToNodes(
  nodes: WorkflowTreeNode[],
  targetIds: string[],
  userSignature: string
): { trees: WorkflowTreeNode[]; signatureFolderIds: string[]; signedCount: number } {
  const sigCode = (userSignature || 'OHA').toUpperCase().slice(0, 3);
  let updated = nodes;
  const signatureFolderIds = new Set<string>();
  let signedCount = 0;

  for (const targetId of targetIds) {
    const path = findNodePath(updated, targetId);
    if (!path || path.length < 2) continue;

    const node = path[path.length - 1];
    if (node.nodeType === 'root' || node.nodeType === 'signature' || node.locked) {
      continue;
    }

    const directParent = path[path.length - 2];
    // Si l'élément est déjà dans le dossier signature [sigCode], on met simplement à jour la signature
    if (directParent.nodeType === 'signature' && directParent.label.toUpperCase() === sigCode) {
      signatureFolderIds.add(directParent.id);
      continue;
    }

    // Section concernée = parent direct (ou grand-parent si déplacé depuis une autre signature)
    const sectionContainer =
      directParent.nodeType === 'signature' && path.length >= 3
        ? path[path.length - 3]
        : directParent;

    const signedNode = withSignatureRecursive(node, sigCode);

    // 1. Retirer l'élément de sa position actuelle
    updated = deleteNodesInTree(updated, new Set([node.id]));

    // 2. Intégrer sous [sigCode] dans la section concernée
    const refreshedSection = findNodeById(updated, sectionContainer.id);
    const existingSigChild = refreshedSection?.children?.find(
      (c) => c.nodeType === 'signature' && c.label.toUpperCase() === sigCode
    );

    if (existingSigChild) {
      updated = addChildNodeToTarget(updated, existingSigChild.id, signedNode);
      signatureFolderIds.add(existingSigChild.id);
    } else {
      const sigFolder: WorkflowTreeNode = {
        id: nextUid(`sig-${sigCode}`),
        label: sigCode,
        nodeType: 'signature',
        signature: sigCode,
        natureId: sectionContainer.natureId,
        children: [signedNode],
      };
      updated = addChildNodeToTarget(updated, sectionContainer.id, sigFolder);
      signatureFolderIds.add(sigFolder.id);
    }
    signedCount += 1;
  }

  return {
    trees: updated,
    signatureFolderIds: Array.from(signatureFolderIds),
    signedCount,
  };
}

export function lockNodesInTree(
  nodes: WorkflowTreeNode[],
  targetIds: Set<string>,
  pin: string
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    const isTarget = node.nodeType !== 'root' && targetIds.has(node.id);
    const nextChildren = node.children
      ? lockNodesInTree(node.children, targetIds, pin)
      : undefined;
    if (!isTarget && !nextChildren) return node;
    return {
      ...node,
      ...(isTarget ? { locked: true, lockPin: pin } : {}),
      ...(nextChildren ? { children: nextChildren } : {}),
    };
  });
}

export function unlockNodeInTree(
  nodes: WorkflowTreeNode[],
  targetId: string,
  pin: string
): { trees: WorkflowTreeNode[]; unlocked: boolean } {
  let unlocked = false;
  const walk = (list: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    list.map((node) => {
      if (node.id === targetId) {
        if (node.lockPin === pin) {
          unlocked = true;
          const { locked: _l, lockPin: _p, ...rest } = node;
          void _l;
          void _p;
          return {
            ...rest,
            children: node.children ? walk(node.children) : undefined,
          };
        }
        return node;
      }
      if (node.children?.length) {
        return { ...node, children: walk(node.children) };
      }
      return node;
    });

  return { trees: walk(nodes), unlocked };
}

export function toggleManagerReviewInTree(
  nodes: WorkflowTreeNode[],
  targetIds: Set<string>
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    const isTarget = node.nodeType !== 'root' && targetIds.has(node.id);
    const nextChildren = node.children
      ? toggleManagerReviewInTree(node.children, targetIds)
      : undefined;
    if (!isTarget && !nextChildren) return node;
    return {
      ...node,
      ...(isTarget ? { managerReviewed: !node.managerReviewed } : {}),
      ...(nextChildren ? { children: nextChildren } : {}),
    };
  });
}

export function moveNodesToTarget(
  nodes: WorkflowTreeNode[],
  sourceIds: string[],
  destinationId: string
): { trees: WorkflowTreeNode[]; movedCount: number; error?: string } {
  if (isNodeLockedOrWithinLockedAncestor(nodes, destinationId)) {
    return {
      trees: nodes,
      movedCount: 0,
      error: 'Destination verrouillée : déverrouillez-la avant d’y déplacer un élément.',
    };
  }

  const validSources: WorkflowTreeNode[] = [];
  for (const sid of sourceIds) {
    const found = findNodeById(nodes, sid);
    if (!found || found.nodeType === 'root') continue;
    if (hasLockedNodeInIds(nodes, [sid])) {
      return {
        trees: nodes,
        movedCount: 0,
        error: `« ${found.label} » (ou un sous-élément) est verrouillé : déverrouillez-le avant de le déplacer.`,
      };
    }
    if (isDescendantOrSelf(nodes, sid, destinationId)) {
      return {
        trees: nodes,
        movedCount: 0,
        error: 'Impossible de déplacer un dossier à l’intérieur de lui-même.',
      };
    }
    validSources.push(found);
  }

  if (validSources.length === 0) {
    return { trees: nodes, movedCount: 0 };
  }

  const removeSet = new Set(validSources.map((s) => s.id));
  const withoutSources = deleteNodesInTree(nodes, removeSet);
  const updated = insertNodesAtTarget(withoutSources, destinationId, validSources);

  return { trees: updated, movedCount: validSources.length };
}

export function pasteNodesToTarget(
  nodes: WorkflowTreeNode[],
  sourceIds: string[],
  destinationId: string
): { trees: WorkflowTreeNode[]; pastedCount: number; error?: string } {
  if (isNodeLockedOrWithinLockedAncestor(nodes, destinationId)) {
    return {
      trees: nodes,
      pastedCount: 0,
      error: 'Destination verrouillée : déverrouillez-la avant d’y coller un élément.',
    };
  }
  if (hasLockedNodeInIds(nodes, sourceIds)) {
    return {
      trees: nodes,
      pastedCount: 0,
      error: 'Copie bloquée : un élément verrouillé ne peut pas être copié.',
    };
  }

  const clonedItems = sourceIds
    .map((id) => findNodeById(nodes, id))
    .filter((n): n is WorkflowTreeNode => Boolean(n && n.nodeType !== 'root'))
    .map((src) => cloneNodeWithFreshIds(src));

  if (clonedItems.length === 0) {
    return { trees: nodes, pastedCount: 0 };
  }

  return {
    trees: insertNodesAtTarget(nodes, destinationId, clonedItems),
    pastedCount: clonedItems.length,
  };
}

const RANDOM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const RANDOM_MISSION_STEPS = [
  'Leadsheet_Ventes_',
  'Etat_des_ventes_Sage100_Metalux_',
  "Test de cadrage du chiffre d'affaires-",
  'Feuille_couverture_Tresorerie_',
  'QCI_Cycle_Achats_Fournisseurs',
  'FRAP_Separation_des_fonctions',
  'Programme_travail_Caisse_Inopine',
  'Rapprochement_bancaire_SYSCOHADA',
  'Circularisation_Clients_Tiers',
  'Revue_analytique_Marge_Brute',
  'Test_cheminement_Facturation',
  'Cartographie_risques_Fraude',
  'PV_comptage_inventaire_physique',
  'Note_synthese_Comite_Audit',
  'Fiche_suivi_recommandations_P1',
  'Extraction_CAATs_Doublons_Paiements',
  'Lettre_mission_Audit_Interne',
  'Matrice_droits_acces_CoreBanking',
];

export function generateRandomAuditDocumentName(): string {
  const letterCount = Math.random() < 0.25 ? 1 : 2;
  let letters = '';
  for (let i = 0; i < letterCount; i += 1) {
    letters += RANDOM_LETTERS[Math.floor(Math.random() * RANDOM_LETTERS.length)];
  }
  const useThreeDigits = Math.random() < 0.7;
  const maxStep = useThreeDigits ? 99 : 9;
  const multipleTen = (Math.floor(Math.random() * maxStep) + 1) * 10;
  const digits = useThreeDigits
    ? String(multipleTen).padStart(3, '0')
    : String(multipleTen).padStart(2, '0');

  const separators = ['-', ' - ', '- '];
  const sep = separators[Math.floor(Math.random() * separators.length)];
  const step =
    RANDOM_MISSION_STEPS[Math.floor(Math.random() * RANDOM_MISSION_STEPS.length)];

  return `${letters}${digits}${sep}${step}`;
}

export function resolveContainerTargetId(
  trees: WorkflowTreeNode[],
  targetId: string
): string {
  const path = findNodePath(trees, targetId);
  if (!path || path.length === 0) return targetId;
  const targetNode = path[path.length - 1];
  if (targetNode.nodeType === 'document' && path.length >= 2) {
    return path[path.length - 2].id;
  }
  return targetId;
}

export function createBlankWorkflowNode(label = 'Workflow domaine'): WorkflowTreeNode {
  return {
    id: nextUid('wf-blank'),
    label,
    nodeType: 'nature',
    children: ['Section X', 'Section Y', 'Section Z'].map((secLabel) => ({
      id: nextUid('sec'),
      label: secLabel,
      nodeType: 'section',
      children: ['Sous-section X', 'Sous-section Y', 'Sous-section Z', 'Sous-section W'].map(
        (subLabel) => ({
          id: nextUid('sub'),
          label: subLabel,
          nodeType: 'sous-section',
          children: [],
        })
      ),
    })),
  };
}

export function createNatureWorkflowNode(meta: WorkflowCategoryMeta): WorkflowTreeNode {
  return {
    id: nextUid(`wf-${meta.id}`),
    label: meta.label,
    nodeType: 'nature',
    natureId: meta.id,
    children: meta.subItems.map((sm) => ({
      id: nextUid('sec'),
      label: sm.label,
      nodeType: 'section',
      natureId: meta.id,
      children: [],
    })),
  };
}

export function addWorkflowToExercice(
  trees: WorkflowTreeNode[],
  targetNodeId: string | undefined,
  workflowNode: WorkflowTreeNode
): { trees: WorkflowTreeNode[]; targetExerciceId: string; rootId: string } {
  const path = targetNodeId ? findNodePath(trees, targetNodeId) : null;
  const rootNode = path?.[0] ?? trees.find((t) => t.id === 'root-workflow') ?? trees[0];
  const rootId = rootNode?.id || 'root-workflow';

  const ancestorExercice = path?.find((n) => n.nodeType === 'exercice');
  if (ancestorExercice) {
    return {
      trees: addChildNodeToTarget(trees, ancestorExercice.id, workflowNode),
      targetExerciceId: ancestorExercice.id,
      rootId,
    };
  }

  const existingExercice =
    rootNode?.children?.find(
      (c) => c.nodeType === 'exercice' && c.label.includes('2026')
    ) ?? rootNode?.children?.find((c) => c.nodeType === 'exercice');

  if (existingExercice) {
    return {
      trees: addChildNodeToTarget(trees, existingExercice.id, workflowNode),
      targetExerciceId: existingExercice.id,
      rootId,
    };
  }

  const newExercice: WorkflowTreeNode = {
    id: nextUid('ex-2026'),
    label: 'Exercice 2026',
    nodeType: 'exercice',
    children: [workflowNode],
  };

  return {
    trees: addChildNodeToTarget(trees, rootId, newExercice),
    targetExerciceId: newExercice.id,
    rootId,
  };
}

export function buildPostgresRowsFromTrees(
  trees: WorkflowTreeNode[],
  session: ClientSessionConfig
): PostgresDocumentRow[] {
  const rows: PostgresDocumentRow[] = [];
  let rowNo = 1;

  const walk = (node: WorkflowTreeNode, path: WorkflowTreeNode[]) => {
    const currentPath = [...path, node];
    if (node.nodeType === 'document') {
      const rootNode = currentPath[0];
      const natureNode = currentPath.find((n) => n.nodeType === 'nature');
      const exerciceNode = currentPath.find((n) => n.nodeType === 'exercice');
      const activiteNode = currentPath.find((n) => n.nodeType === 'activite');
      const sectionNode = currentPath.find((n) => n.nodeType === 'section');
      const subSectionNode = currentPath.find((n) => n.nodeType === 'sous-section');
      const sigNode = currentPath.find((n) => n.nodeType === 'signature');

      const isTeam = rootNode?.id === 'root-team-workflow';
      rows.push({
        no: rowNo++,
        client: session.client,
        nature_workflow: natureNode?.label || 'Workflow personnalisé',
        exercice: exerciceNode?.label || 'Exercice 2026',
        activite: activiteNode?.label || 'Audit & Contrôle',
        section: sectionNode?.label || 'Général',
        sous_section: subSectionNode?.label || (sigNode ? `[${sigNode.label}]` : 'Standard'),
        sous_categorie: isTeam ? 'Team Workflow' : 'Workflow',
        nom_document: node.label,
        nature: isTeam ? 'Partagé Équipe' : 'Personnel',
        id_google_drive: node.driveId || `1drv_${node.id.slice(0, 10)}`,
        owner: node.owner || sigNode?.label || session.userSignature,
        user_api_key_token: isTeam ? session.teamApiKey : session.userApiKey,
        owner_email: node.ownerEmail || session.email,
      });
    }
    node.children?.forEach((child) => walk(child, currentPath));
  };

  trees.forEach((root) => walk(root, []));
  return rows;
}
