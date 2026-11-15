import {
  AuditTrailEntry,
  ClientSessionConfig,
  NodeVersionEntry,
  PostgresDocumentRow,
  ReviewNoteItem,
  WorkflowCategoryMeta,
  WorkflowNatureId,
  WorkflowNodeStatus,
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

export type NodeMoveDirection = 'up' | 'down' | 'left' | 'right';

function replaceChildrenOfNode(
  nodes: WorkflowTreeNode[],
  targetParentId: string,
  updater: (children: WorkflowTreeNode[]) => WorkflowTreeNode[]
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (node.id === targetParentId) {
      return {
        ...node,
        children: updater(node.children || []),
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: replaceChildrenOfNode(node.children, targetParentId, updater),
      };
    }
    return node;
  });
}

function moveSingleNodeByDirection(
  nodes: WorkflowTreeNode[],
  nodeId: string,
  direction: NodeMoveDirection
): {
  trees: WorkflowTreeNode[];
  moved: boolean;
  expandedParentIds: string[];
  error?: string;
} {
  const path = findNodePath(nodes, nodeId);
  if (!path || path.length < 2) {
    return {
      trees: nodes,
      moved: false,
      expandedParentIds: [],
      error: 'Les racines principales ne peuvent pas être déplacées.',
    };
  }

  const node = path[path.length - 1];
  const parent = path[path.length - 2];
  const grandParent = path.length >= 3 ? path[path.length - 3] : null;
  const siblings = parent.children || [];
  const idx = siblings.findIndex((c) => c.id === nodeId);

  if (idx < 0) {
    return { trees: nodes, moved: false, expandedParentIds: [] };
  }

  if (direction === 'up') {
    if (idx > 0) {
      const updated = replaceChildrenOfNode(nodes, parent.id, (children) => {
        const next = [...children];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        return next;
      });
      return { trees: updated, moved: true, expandedParentIds: [parent.id] };
    }

    if (!grandParent || parent.nodeType === 'root') {
      return {
        trees: nodes,
        moved: false,
        expandedParentIds: [],
        error: 'Élément déjà en première position sous la racine.',
      };
    }

    if (isNodeLockedOrWithinLockedAncestor(nodes, grandParent.id)) {
      return {
        trees: nodes,
        moved: false,
        expandedParentIds: [],
        error: 'Déplacement bloqué : niveau parent verrouillé par code PIN.',
      };
    }

    let updated = replaceChildrenOfNode(nodes, parent.id, (children) =>
      children.filter((c) => c.id !== nodeId)
    );
    updated = replaceChildrenOfNode(updated, grandParent.id, (children) => {
      const pIdx = children.findIndex((c) => c.id === parent.id);
      const next = [...children];
      next.splice(pIdx >= 0 ? pIdx : 0, 0, node);
      return next;
    });

    return { trees: updated, moved: true, expandedParentIds: [grandParent.id] };
  }

  if (direction === 'down') {
    if (idx < siblings.length - 1) {
      const updated = replaceChildrenOfNode(nodes, parent.id, (children) => {
        const next = [...children];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        return next;
      });
      return { trees: updated, moved: true, expandedParentIds: [parent.id] };
    }

    if (!grandParent || parent.nodeType === 'root') {
      return {
        trees: nodes,
        moved: false,
        expandedParentIds: [],
        error: 'Élément déjà en dernière position sous la racine.',
      };
    }

    if (isNodeLockedOrWithinLockedAncestor(nodes, grandParent.id)) {
      return {
        trees: nodes,
        moved: false,
        expandedParentIds: [],
        error: 'Déplacement bloqué : niveau parent verrouillé par code PIN.',
      };
    }

    const gpChildren = grandParent.children || [];
    const pIdx = gpChildren.findIndex((c) => c.id === parent.id);
    const nextUncle = pIdx >= 0 && pIdx < gpChildren.length - 1 ? gpChildren[pIdx + 1] : null;

    if (nextUncle && nextUncle.nodeType !== 'document') {
      if (nextUncle.locked || isNodeLockedOrWithinLockedAncestor(nodes, nextUncle.id)) {
        return {
          trees: nodes,
          moved: false,
          expandedParentIds: [],
          error: `Déplacement bloqué : « ${nextUncle.label} » est verrouillé par code PIN.`,
        };
      }

      let updated = replaceChildrenOfNode(nodes, parent.id, (children) =>
        children.filter((c) => c.id !== nodeId)
      );
      updated = replaceChildrenOfNode(updated, nextUncle.id, (children) => [
        node,
        ...children,
      ]);

      return {
        trees: updated,
        moved: true,
        expandedParentIds: [grandParent.id, nextUncle.id],
      };
    }

    let updated = replaceChildrenOfNode(nodes, parent.id, (children) =>
      children.filter((c) => c.id !== nodeId)
    );
    updated = replaceChildrenOfNode(updated, grandParent.id, (children) => {
      const curPIdx = children.findIndex((c) => c.id === parent.id);
      const next = [...children];
      next.splice(curPIdx >= 0 ? curPIdx + 1 : next.length, 0, node);
      return next;
    });

    return { trees: updated, moved: true, expandedParentIds: [grandParent.id] };
  }

  if (direction === 'left') {
    if (!grandParent || parent.nodeType === 'root') {
      return {
        trees: nodes,
        moved: false,
        expandedParentIds: [],
        error: 'Niveau minimum atteint : impossible de déplacer plus à gauche que la racine.',
      };
    }

    if (isNodeLockedOrWithinLockedAncestor(nodes, grandParent.id)) {
      return {
        trees: nodes,
        moved: false,
        expandedParentIds: [],
        error: 'Déplacement bloqué : niveau cible verrouillé par code PIN.',
      };
    }

    let updated = replaceChildrenOfNode(nodes, parent.id, (children) =>
      children.filter((c) => c.id !== nodeId)
    );
    updated = replaceChildrenOfNode(updated, grandParent.id, (children) => {
      const pIdx = children.findIndex((c) => c.id === parent.id);
      const next = [...children];
      next.splice(pIdx >= 0 ? pIdx + 1 : next.length, 0, node);
      return next;
    });

    return { trees: updated, moved: true, expandedParentIds: [grandParent.id] };
  }

  // direction === 'right'
  if (idx === 0) {
    return {
      trees: nodes,
      moved: false,
      expandedParentIds: [],
      error: 'Aucun élément précédent au même niveau pour recevoir cet élément.',
    };
  }

  const prevSibling = siblings[idx - 1];
  if (prevSibling.locked || isNodeLockedOrWithinLockedAncestor(nodes, prevSibling.id)) {
    return {
      trees: nodes,
      moved: false,
      expandedParentIds: [],
      error: `Déplacement bloqué : « ${prevSibling.label} » est verrouillé par code PIN.`,
    };
  }

  if (
    prevSibling.nodeType === 'document' &&
    node.nodeType !== 'document' &&
    node.nodeType !== 'collection'
  ) {
    return {
      trees: nodes,
      moved: false,
      expandedParentIds: [],
      error: 'Hiérarchie invalide : un dossier ne peut pas devenir le fils d’un document.',
    };
  }

  let updated = replaceChildrenOfNode(nodes, parent.id, (children) =>
    children.filter((c) => c.id !== nodeId)
  );
  updated = replaceChildrenOfNode(updated, prevSibling.id, (children) => [
    ...children,
    node,
  ]);

  return {
    trees: updated,
    moved: true,
    expandedParentIds: [parent.id, prevSibling.id],
  };
}

export function moveNodesByDirection(
  nodes: WorkflowTreeNode[],
  sourceIds: string[],
  direction: NodeMoveDirection
): {
  trees: WorkflowTreeNode[];
  movedCount: number;
  expandedParentIds: string[];
  movedIds: string[];
  error?: string;
} {
  const validIds = sourceIds.filter((id) => {
    const found = findNodeById(nodes, id);
    return Boolean(found && found.nodeType !== 'root');
  });

  if (validIds.length === 0) {
    return {
      trees: nodes,
      movedCount: 0,
      expandedParentIds: [],
      movedIds: [],
      error: 'Les racines principales ne peuvent pas être déplacées.',
    };
  }

  if (hasLockedNodeInIds(nodes, validIds)) {
    return {
      trees: nodes,
      movedCount: 0,
      expandedParentIds: [],
      movedIds: [],
      error: 'Déplacement bloqué : un élément verrouillé nécessite son code PIN.',
    };
  }

  const preOrderIndex = new Map<string, number>();
  let orderCounter = 0;
  const indexWalk = (list: WorkflowTreeNode[]) => {
    for (const item of list) {
      preOrderIndex.set(item.id, orderCounter++);
      if (item.children?.length) indexWalk(item.children);
    }
  };
  indexWalk(nodes);

  const orderedIds = [...validIds].sort((a, b) => {
    const diff = (preOrderIndex.get(a) ?? 0) - (preOrderIndex.get(b) ?? 0);
    return direction === 'down' || direction === 'left' ? -diff : diff;
  });

  let updated = nodes;
  let movedCount = 0;
  const expandedSet = new Set<string>();
  const movedIds: string[] = [];
  let firstError: string | undefined;

  for (const id of orderedIds) {
    const res = moveSingleNodeByDirection(updated, id, direction);
    if (res.moved) {
      updated = res.trees;
      movedCount += 1;
      movedIds.push(id);
      res.expandedParentIds.forEach((eid) => expandedSet.add(eid));
    } else if (res.error && !firstError) {
      firstError = res.error;
    }
  }

  return {
    trees: updated,
    movedCount,
    expandedParentIds: Array.from(expandedSet),
    movedIds,
    error: movedCount === 0 ? firstError : undefined,
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

export const WORKFLOW_STATUS_LABELS: Record<WorkflowNodeStatus, string> = {
  todo: 'À faire',
  'in-progress': 'En cours',
  'in-review': 'En revue',
  validated: 'Validé',
};

function makeAuditEntry(actor: string, action: string, detail?: string): AuditTrailEntry {
  return {
    id: nextUid('aud'),
    timestamp: new Date().toISOString(),
    actor: (actor || 'OHA').toUpperCase().slice(0, 12),
    action,
    ...(detail ? { detail } : {}),
  };
}

export function appendAuditTrailToNodes(
  nodes: WorkflowTreeNode[],
  targetIds: Set<string>,
  actor: string,
  action: string,
  detail?: string
): WorkflowTreeNode[] {
  if (targetIds.size === 0) return nodes;
  return nodes.map((node) => {
    const isTarget = targetIds.has(node.id);
    const nextChildren = node.children
      ? appendAuditTrailToNodes(node.children, targetIds, actor, action, detail)
      : undefined;
    if (!isTarget && !nextChildren) return node;
    return {
      ...node,
      ...(isTarget
        ? {
            auditTrail: [
              makeAuditEntry(actor, action, detail),
              ...(node.auditTrail || []),
            ].slice(0, 80),
          }
        : {}),
      ...(nextChildren ? { children: nextChildren } : {}),
    };
  });
}

export function setNodesStatusInTree(
  nodes: WorkflowTreeNode[],
  targetIds: Set<string>,
  status: WorkflowNodeStatus,
  actor: string
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    const isTarget = node.nodeType !== 'root' && targetIds.has(node.id);
    const nextChildren = node.children
      ? setNodesStatusInTree(node.children, targetIds, status, actor)
      : undefined;
    if (!isTarget && !nextChildren) return node;
    return {
      ...node,
      ...(isTarget
        ? {
            status,
            auditTrail: [
              makeAuditEntry(actor, 'Statut mis à jour', WORKFLOW_STATUS_LABELS[status]),
              ...(node.auditTrail || []),
            ].slice(0, 80),
          }
        : {}),
      ...(nextChildren ? { children: nextChildren } : {}),
    };
  });
}

export function addReviewNoteToNode(
  nodes: WorkflowTreeNode[],
  targetId: string,
  author: string,
  text: string
): WorkflowTreeNode[] {
  const cleanText = text.trim();
  if (!cleanText) return nodes;
  const note: ReviewNoteItem = {
    id: nextUid('note'),
    author: (author || 'OHA').toUpperCase().slice(0, 12),
    text: cleanText,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  return nodes.map((node) => {
    if (node.id === targetId) {
      return {
        ...node,
        reviewNotes: [note, ...(node.reviewNotes || [])],
        auditTrail: [
          makeAuditEntry(author, 'Note de revue ajoutée', cleanText.slice(0, 80)),
          ...(node.auditTrail || []),
        ].slice(0, 80),
      };
    }
    if (node.children?.length) {
      return { ...node, children: addReviewNoteToNode(node.children, targetId, author, text) };
    }
    return node;
  });
}

export function toggleReviewNoteStatusInTree(
  nodes: WorkflowTreeNode[],
  targetId: string,
  noteId: string,
  actor: string
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      const nextNotes = (node.reviewNotes || []).map((n) => {
        if (n.id !== noteId) return n;
        const nextStatus: 'open' | 'resolved' = n.status === 'open' ? 'resolved' : 'open';
        return {
          ...n,
          status: nextStatus,
          resolvedAt: nextStatus === 'resolved' ? new Date().toISOString() : undefined,
        };
      });
      const changed = nextNotes.find((n) => n.id === noteId);
      return {
        ...node,
        reviewNotes: nextNotes,
        auditTrail: changed
          ? [
              makeAuditEntry(
                actor,
                changed.status === 'resolved' ? 'Note de revue levée' : 'Note de revue rouverte',
                changed.text.slice(0, 80)
              ),
              ...(node.auditTrail || []),
            ].slice(0, 80)
          : node.auditTrail,
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: toggleReviewNoteStatusInTree(node.children, targetId, noteId, actor),
      };
    }
    return node;
  });
}

export function deleteReviewNoteInTree(
  nodes: WorkflowTreeNode[],
  targetId: string,
  noteId: string,
  actor: string
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (node.id === targetId) {
      const removed = (node.reviewNotes || []).find((n) => n.id === noteId);
      return {
        ...node,
        reviewNotes: (node.reviewNotes || []).filter((n) => n.id !== noteId),
        auditTrail: removed
          ? [
              makeAuditEntry(actor, 'Note de revue supprimée', removed.text.slice(0, 80)),
              ...(node.auditTrail || []),
            ].slice(0, 80)
          : node.auditTrail,
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: deleteReviewNoteInTree(node.children, targetId, noteId, actor),
      };
    }
    return node;
  });
}

export function saveNodeVersionSnapshot(
  nodes: WorkflowTreeNode[],
  targetId: string,
  author: string,
  summary: string,
  wordBodySnapshot: string
): { trees: WorkflowTreeNode[]; versionLabel?: string } {
  let createdLabel: string | undefined;
  const walk = (list: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    list.map((node) => {
      if (node.id === targetId) {
        const existing = node.versions || [];
        createdLabel = `v${existing.length + 1}`;
        const entry: NodeVersionEntry = {
          id: nextUid('ver'),
          versionLabel: createdLabel,
          author: (author || 'OHA').toUpperCase().slice(0, 12),
          timestamp: new Date().toISOString(),
          summary: summary.trim() || 'Sauvegarde manuelle',
          labelSnapshot: node.label,
          wordBodySnapshot,
        };
        return {
          ...node,
          versions: [entry, ...existing].slice(0, 30),
          auditTrail: [
            makeAuditEntry(actorSafe(author), `Version ${createdLabel} enregistrée`, entry.summary),
            ...(node.auditTrail || []),
          ].slice(0, 80),
        };
      }
      if (node.children?.length) {
        return { ...node, children: walk(node.children) };
      }
      return node;
    });

  return { trees: walk(nodes), versionLabel: createdLabel };
}

function actorSafe(actor: string): string {
  return (actor || 'OHA').toUpperCase().slice(0, 12);
}

export function restoreNodeVersionSnapshot(
  nodes: WorkflowTreeNode[],
  targetId: string,
  versionId: string,
  actor: string
): {
  trees: WorkflowTreeNode[];
  restoredBody?: string;
  restoredLabel?: string;
  versionLabel?: string;
} {
  let restoredBody: string | undefined;
  let restoredLabel: string | undefined;
  let versionLabel: string | undefined;

  const walk = (list: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    list.map((node) => {
      if (node.id === targetId) {
        const targetVer = (node.versions || []).find((v) => v.id === versionId);
        if (!targetVer) return node;
        restoredBody = targetVer.wordBodySnapshot;
        restoredLabel = targetVer.labelSnapshot;
        versionLabel = targetVer.versionLabel;
        return {
          ...node,
          label: targetVer.labelSnapshot,
          auditTrail: [
            makeAuditEntry(
              actor,
              `Version ${targetVer.versionLabel} restaurée`,
              targetVer.summary
            ),
            ...(node.auditTrail || []),
          ].slice(0, 80),
        };
      }
      if (node.children?.length) {
        return { ...node, children: walk(node.children) };
      }
      return node;
    });

  return { trees: walk(nodes), restoredBody, restoredLabel, versionLabel };
}

export function addCrossReferenceToNode(
  nodes: WorkflowTreeNode[],
  sourceId: string,
  targetRefId: string,
  actor: string,
  targetLabel: string
): WorkflowTreeNode[] {
  if (!sourceId || !targetRefId || sourceId === targetRefId) return nodes;
  return nodes.map((node) => {
    if (node.id === sourceId) {
      const current = node.crossRefs || [];
      if (current.includes(targetRefId)) return node;
      return {
        ...node,
        crossRefs: [...current, targetRefId],
        auditTrail: [
          makeAuditEntry(actor, 'Référence croisée ajoutée', targetLabel),
          ...(node.auditTrail || []),
        ].slice(0, 80),
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: addCrossReferenceToNode(node.children, sourceId, targetRefId, actor, targetLabel),
      };
    }
    return node;
  });
}

export function removeCrossReferenceFromNode(
  nodes: WorkflowTreeNode[],
  sourceId: string,
  targetRefId: string,
  actor: string,
  targetLabel?: string
): WorkflowTreeNode[] {
  return nodes.map((node) => {
    if (node.id === sourceId) {
      return {
        ...node,
        crossRefs: (node.crossRefs || []).filter((id) => id !== targetRefId),
        auditTrail: [
          makeAuditEntry(actor, 'Référence croisée retirée', targetLabel || targetRefId),
          ...(node.auditTrail || []),
        ].slice(0, 80),
      };
    }
    if (node.children?.length) {
      return {
        ...node,
        children: removeCrossReferenceFromNode(
          node.children,
          sourceId,
          targetRefId,
          actor,
          targetLabel
        ),
      };
    }
    return node;
  });
}

export function buildParentCrossRefMap(
  nodes: WorkflowTreeNode[]
): Map<string, WorkflowTreeNode[]> {
  const map = new Map<string, WorkflowTreeNode[]>();
  const walk = (items: WorkflowTreeNode[]) => {
    for (const n of items) {
      if (n.crossRefs && n.crossRefs.length > 0) {
        for (const targetId of n.crossRefs) {
          const existing = map.get(targetId) || [];
          if (!existing.some((p) => p.id === n.id)) {
            existing.push(n);
            map.set(targetId, existing);
          }
        }
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return map;
}

export function assignNodesInTree(
  nodes: WorkflowTreeNode[],
  targetIds: Set<string>,
  assignee: string,
  dueDate: string,
  actor: string
): WorkflowTreeNode[] {
  const cleanAssignee = assignee.trim();
  const cleanDueDate = dueDate.trim();
  return nodes.map((node) => {
    const isTarget = node.nodeType !== 'root' && targetIds.has(node.id);
    const nextChildren = node.children
      ? assignNodesInTree(node.children, targetIds, assignee, dueDate, actor)
      : undefined;
    if (!isTarget && !nextChildren) return node;
    const detailParts = [
      cleanAssignee ? `Responsable: ${cleanAssignee}` : 'Responsable effacé',
      cleanDueDate ? `Échéance: ${cleanDueDate}` : '',
    ].filter(Boolean);
    return {
      ...node,
      ...(isTarget
        ? {
            assignee: cleanAssignee || undefined,
            dueDate: cleanDueDate || undefined,
            auditTrail: [
              makeAuditEntry(actor, 'Assignation / Échéance', detailParts.join(' · ')),
              ...(node.auditTrail || []),
            ].slice(0, 80),
          }
        : {}),
      ...(nextChildren ? { children: nextChildren } : {}),
    };
  });
}

export interface SubtreeCompletionStats {
  total: number;
  validated: number;
  inReview: number;
  inProgress: number;
  todo: number;
  percent: number;
}

export function computeSubtreeCompletionStats(node: WorkflowTreeNode): SubtreeCompletionStats {
  const stats: SubtreeCompletionStats = {
    total: 0,
    validated: 0,
    inReview: 0,
    inProgress: 0,
    todo: 0,
    percent: 0,
  };

  const walk = (n: WorkflowTreeNode) => {
    if (n.nodeType === 'document') {
      stats.total += 1;
      const s = n.status || 'todo';
      if (s === 'validated') stats.validated += 1;
      else if (s === 'in-review') stats.inReview += 1;
      else if (s === 'in-progress') stats.inProgress += 1;
      else stats.todo += 1;
    }
    n.children?.forEach(walk);
  };
  walk(node);

  stats.percent = stats.total > 0 ? Math.round((stats.validated / stats.total) * 100) : 0;
  return stats;
}

export interface AuditReadinessFinding {
  id: string;
  nodeId: string;
  nodeLabel: string;
  severity: 'critical' | 'warning';
  category:
    | 'empty-doc'
    | 'unsigned'
    | 'no-manager-review'
    | 'open-note'
    | 'overdue'
    | 'not-validated';
  message: string;
}

export interface AuditReadinessReport {
  scopeId: string;
  scopeLabel: string;
  checkedAt: string;
  stats: SubtreeCompletionStats;
  findings: AuditReadinessFinding[];
  isReady: boolean;
}

export function runAuditReadinessCheck(
  scopeNode: WorkflowTreeNode,
  wordBodies: Record<string, string>,
  todayIso = new Date().toISOString().slice(0, 10)
): AuditReadinessReport {
  const findings: AuditReadinessFinding[] = [];
  const stats = computeSubtreeCompletionStats(scopeNode);

  const walk = (n: WorkflowTreeNode) => {
    if (n.nodeType !== 'root') {
      const openNotes = (n.reviewNotes || []).filter((rn) => rn.status === 'open');
      if (openNotes.length > 0) {
        findings.push({
          id: `rd-note-${n.id}`,
          nodeId: n.id,
          nodeLabel: n.label,
          severity: 'critical',
          category: 'open-note',
          message: `${openNotes.length} note(s) de revue ouverte(s) non soldée(s)`,
        });
      }

      if (n.dueDate && n.dueDate < todayIso && n.status !== 'validated') {
        findings.push({
          id: `rd-due-${n.id}`,
          nodeId: n.id,
          nodeLabel: n.label,
          severity: 'critical',
          category: 'overdue',
          message: `Échéance dépassée (${n.dueDate}) sans validation`,
        });
      }
    }

    if (n.nodeType === 'document') {
      const body = wordBodies[n.id];
      if (!body || body.trim().length === 0) {
        findings.push({
          id: `rd-empty-${n.id}`,
          nodeId: n.id,
          nodeLabel: n.label,
          severity: 'warning',
          category: 'empty-doc',
          message: 'Contenu Word encore vierge',
        });
      }
      if (!n.signature && !n.owner) {
        findings.push({
          id: `rd-sig-${n.id}`,
          nodeId: n.id,
          nodeLabel: n.label,
          severity: 'warning',
          category: 'unsigned',
          message: 'Document sans signature préparateur',
        });
      }
      if (!n.managerReviewed) {
        findings.push({
          id: `rd-mgr-${n.id}`,
          nodeId: n.id,
          nodeLabel: n.label,
          severity: 'warning',
          category: 'no-manager-review',
          message: 'Revue manager manquante',
        });
      }
      if (n.status !== 'validated') {
        findings.push({
          id: `rd-stat-${n.id}`,
          nodeId: n.id,
          nodeLabel: n.label,
          severity: 'warning',
          category: 'not-validated',
          message: `Statut actuel : ${WORKFLOW_STATUS_LABELS[n.status || 'todo']}`,
        });
      }
    }

    n.children?.forEach(walk);
  };

  walk(scopeNode);

  return {
    scopeId: scopeNode.id,
    scopeLabel: scopeNode.label,
    checkedAt: new Date().toISOString(),
    stats,
    findings,
    isReady: findings.length === 0 && stats.total > 0,
  };
}

export function collectDocumentsInNode(node: WorkflowTreeNode): WorkflowTreeNode[] {
  const docs: WorkflowTreeNode[] = [];
  const walk = (n: WorkflowTreeNode) => {
    if (n.nodeType === 'document') {
      docs.push(n);
    }
    n.children?.forEach(walk);
  };
  walk(node);
  return docs;
}

export function countDocumentsInNode(node: WorkflowTreeNode): number {
  let count = 0;
  const walk = (n: WorkflowTreeNode) => {
    if (n.nodeType === 'document') count += 1;
    n.children?.forEach(walk);
  };
  walk(node);
  return count;
}

export function collectAllCollections(nodes: WorkflowTreeNode[]): WorkflowTreeNode[] {
  const list: WorkflowTreeNode[] = [];
  const walk = (items: WorkflowTreeNode[]) => {
    for (const n of items) {
      if (n.nodeType === 'collection') {
        list.push(n);
      }
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return list;
}

function cloneNodeMappingBodies(
  node: WorkflowTreeNode,
  sourceWordBodies: Record<string, string>,
  copiedBodies: Record<string, string>
): WorkflowTreeNode {
  const cloned = cloneNodeWithFreshIds(node);
  const mapWalk = (orig: WorkflowTreeNode, copy: WorkflowTreeNode) => {
    if (sourceWordBodies[orig.id]) {
      copiedBodies[copy.id] = sourceWordBodies[orig.id];
    }
    if (orig.children?.length && copy.children?.length) {
      orig.children.forEach((origChild, idx) => {
        const copyChild = copy.children![idx];
        if (copyChild) mapWalk(origChild, copyChild);
      });
    }
  };
  mapWalk(node, cloned);
  return cloned;
}

export function mergeCollectionsInTree(
  nodes: WorkflowTreeNode[],
  sourceCollectionId: string,
  targetCollectionId: string,
  actor: string,
  wordBodies: Record<string, string> = {},
  removeSource = true
): {
  trees: WorkflowTreeNode[];
  mergedItemsCount: number;
  copiedWordBodies: Record<string, string>;
  error?: string;
} {
  if (!sourceCollectionId || !targetCollectionId || sourceCollectionId === targetCollectionId) {
    return {
      trees: nodes,
      mergedItemsCount: 0,
      copiedWordBodies: {},
      error: 'Sélectionnez deux collections différentes à fusionner.',
    };
  }

  const sourceCol = findNodeById(nodes, sourceCollectionId);
  const targetCol = findNodeById(nodes, targetCollectionId);
  if (!sourceCol || sourceCol.nodeType !== 'collection' || !targetCol || targetCol.nodeType !== 'collection') {
    return {
      trees: nodes,
      mergedItemsCount: 0,
      copiedWordBodies: {},
      error: 'Les deux éléments sélectionnés doivent être des collections documentaires.',
    };
  }

  if (hasLockedNodeInIds(nodes, [sourceCollectionId, targetCollectionId])) {
    return {
      trees: nodes,
      mergedItemsCount: 0,
      copiedWordBodies: {},
      error: 'Fusion bloquée : l’une des collections (ou un sous-élément) est verrouillée par code PIN.',
    };
  }

  if (isDescendantOrSelf(nodes, sourceCollectionId, targetCollectionId)) {
    return {
      trees: nodes,
      mergedItemsCount: 0,
      copiedWordBodies: {},
      error: 'Impossible de fusionner une collection parente dans sa propre sous-collection.',
    };
  }

  const sourceChildren = sourceCol.children || [];
  const copiedWordBodies: Record<string, string> = {};
  const itemsToAppend = removeSource
    ? sourceChildren
    : sourceChildren.map((child) => cloneNodeMappingBodies(child, wordBodies, copiedWordBodies));

  let updated = nodes;
  if (removeSource) {
    updated = deleteNodesInTree(updated, new Set([sourceCollectionId]));
  }

  for (const item of itemsToAppend) {
    updated = addChildNodeToTarget(updated, targetCollectionId, item);
  }

  updated = appendAuditTrailToNodes(
    updated,
    new Set([targetCollectionId]),
    actor,
    'Fusion de collection',
    `${sourceCol.label} (${itemsToAppend.length} élément(s))`
  );

  return {
    trees: updated,
    mergedItemsCount: itemsToAppend.length,
    copiedWordBodies,
  };
}

export function addExistingNodesToCollection(
  nodes: WorkflowTreeNode[],
  sourceIds: string[],
  targetCollectionId: string,
  wordBodies: Record<string, string>,
  actor: string
): {
  trees: WorkflowTreeNode[];
  addedCount: number;
  copiedWordBodies: Record<string, string>;
  error?: string;
} {
  const targetCol = findNodeById(nodes, targetCollectionId);
  if (!targetCol || targetCol.nodeType !== 'collection') {
    return {
      trees: nodes,
      addedCount: 0,
      copiedWordBodies: {},
      error: 'La destination doit être une collection documentaire.',
    };
  }

  if (isNodeLockedOrWithinLockedAncestor(nodes, targetCollectionId)) {
    return {
      trees: nodes,
      addedCount: 0,
      copiedWordBodies: {},
      error: 'Collection verrouillée : déverrouillez-la avant d’y ajouter des éléments.',
    };
  }

  const validSourceIds = sourceIds.filter((sid) => {
    const src = findNodeById(nodes, sid);
    if (!src || src.nodeType === 'root') return false;
    if (isDescendantOrSelf(nodes, sid, targetCollectionId)) return false;
    return true;
  });

  if (validSourceIds.length === 0) {
    return {
      trees: nodes,
      addedCount: 0,
      copiedWordBodies: {},
      error: 'Aucun élément valide à ajouter dans cette collection.',
    };
  }

  if (hasLockedNodeInIds(nodes, validSourceIds)) {
    return {
      trees: nodes,
      addedCount: 0,
      copiedWordBodies: {},
      error: 'Ajout bloqué : un des éléments sélectionnés est verrouillé par code PIN.',
    };
  }

  const copiedWordBodies: Record<string, string> = {};
  let updated = nodes;
  let addedCount = 0;

  for (const sid of validSourceIds) {
    const src = findNodeById(nodes, sid);
    if (!src) continue;
    const cloned = cloneNodeMappingBodies(src, wordBodies, copiedWordBodies);
    updated = addChildNodeToTarget(updated, targetCollectionId, cloned);
    addedCount += 1;
  }

  updated = appendAuditTrailToNodes(
    updated,
    new Set([targetCollectionId]),
    actor,
    'Ajout dans collection',
    `${addedCount} élément(s) regroupé(s)`
  );

  return {
    trees: updated,
    addedCount,
    copiedWordBodies,
  };
}


