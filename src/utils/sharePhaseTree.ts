import { SharedPhaseKey, SharedPhasesConfig } from '../types/share';
import { WorkflowTreeNode } from '../types/workflow';
import { findNodeById, findNodePath } from './workflowTreeOps';

export const EMPTY_SHARED_PHASES: SharedPhasesConfig = {
  preparation: false,
  realisation: false,
  conclusion: false,
};

export const SHARED_PHASE_OPTIONS: Array<{
  key: SharedPhaseKey;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    key: 'preparation',
    label: 'Phase de préparation',
    shortLabel: 'Préparation',
    description:
      'Planification, lettre de mission, entretiens, QCI, TFFA, programme de travail & pièces de préparation.',
  },
  {
    key: 'realisation',
    label: 'Phase de réalisation',
    shortLabel: 'Réalisation',
    description:
      'Feuille de couverture, feuille de révision, travaux de terrain-test & pièces justificatives.',
  },
  {
    key: 'conclusion',
    label: 'Phase de conclusion',
    shortLabel: 'Conclusion',
    description:
      'FRAP, recommandations, rapports provisoire/final, création de collections & ajout de pièces.',
  },
];

export function detectNodePhaseKey(node: WorkflowTreeNode): SharedPhaseKey | null {
  if (node.missionPhase === 'Phase de préparation') return 'preparation';
  if (node.missionPhase === 'Phase de réalisation') return 'realisation';
  if (node.missionPhase === 'Phase de conclusion') return 'conclusion';

  // Seules les sous-sections / dossiers de phase portent une phase dédiée
  if (
    node.nodeType === 'sous-section' ||
    node.nodeType === 'section' ||
    node.nodeType === 'activite'
  ) {
    const normalized = node.label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    if (/^phase\s+(de\s+)?preparation\b/.test(normalized)) return 'preparation';
    if (/^phase\s+(de\s+)?realisation\b/.test(normalized)) return 'realisation';
    if (/^phase\s+(de\s+)?conclusion\b/.test(normalized)) return 'conclusion';
  }

  return null;
}

export function subtreeContainsPhaseNodes(node: WorkflowTreeNode): boolean {
  if (detectNodePhaseKey(node) !== null) return true;
  if (!node.children || node.children.length === 0) return false;
  return node.children.some((child) => subtreeContainsPhaseNodes(child));
}

export function hasAnyAllowedPhase(allowed?: SharedPhasesConfig): boolean {
  return Boolean(
    allowed && (allowed.preparation || allowed.realisation || allowed.conclusion)
  );
}

export function getEnabledPhaseLabels(allowed?: SharedPhasesConfig): string[] {
  if (!allowed) return [];
  return SHARED_PHASE_OPTIONS.filter((opt) => allowed[opt.key]).map((opt) => opt.label);
}

export function detectPhaseKeyFromText(text?: string): SharedPhaseKey | null {
  if (!text) return null;
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (/phase\s+(de\s+)?preparation\b/.test(normalized)) return 'preparation';
  if (/phase\s+(de\s+)?realisation\b/.test(normalized)) return 'realisation';
  if (/phase\s+(de\s+)?conclusion\b/.test(normalized)) return 'conclusion';
  return null;
}

export function suggestDraftPhasesForNode(
  node: WorkflowTreeNode,
  fallbackText?: string
): SharedPhasesConfig {
  const directPhase = detectNodePhaseKey(node) ?? detectPhaseKeyFromText(fallbackText);
  if (directPhase) {
    return {
      preparation: directPhase === 'preparation',
      realisation: directPhase === 'realisation',
      conclusion: directPhase === 'conclusion',
    };
  }
  return {
    preparation: false,
    realisation: false,
    conclusion: true,
  };
}

function deepCloneNode(node: WorkflowTreeNode): WorkflowTreeNode {
  return {
    ...node,
    children: node.children ? node.children.map(deepCloneNode) : undefined,
  };
}

function nodeContainsTargetId(node: WorkflowTreeNode, targetId: string): boolean {
  if (node.id === targetId) return true;
  if (!node.children || node.children.length === 0) return false;
  return node.children.some((c) => nodeContainsTargetId(c, targetId));
}

export function findMissionContainerForStep(
  trees: WorkflowTreeNode[],
  stepId: string
): WorkflowTreeNode | null {
  const path = findNodePath(trees, stepId);
  if (!path || path.length < 2) return null;

  // Chercher le conteneur de mission le plus proche au-dessus des dossiers de phases
  for (let i = path.length - 2; i >= 1; i -= 1) {
    const candidate = path[i];
    if (
      candidate.nodeType !== 'root' &&
      detectNodePhaseKey(candidate) === null &&
      subtreeContainsPhaseNodes(candidate)
    ) {
      return candidate;
    }
  }

  // Repli sur le dossier parent direct (hors signature/racine si possible)
  for (let i = path.length - 2; i >= 1; i -= 1) {
    const candidate = path[i];
    if (candidate.nodeType !== 'root' && candidate.nodeType !== 'signature') {
      return candidate;
    }
  }

  return path[path.length - 2] ?? null;
}

export function filterMissionTreeForStepAndPhases(
  missionNode: WorkflowTreeNode,
  stepId: string,
  allowedPhases?: SharedPhasesConfig
): WorkflowTreeNode {
  const isPhased = subtreeContainsPhaseNodes(missionNode);
  if (!isPhased) {
    return deepCloneNode(missionNode);
  }

  const walk = (node: WorkflowTreeNode, isRoot: boolean): WorkflowTreeNode | null => {
    const phaseKey = detectNodePhaseKey(node);
    if (phaseKey !== null) {
      if (allowedPhases?.[phaseKey]) {
        return deepCloneNode(node);
      }
      if (nodeContainsTargetId(node, stepId)) {
        const branchChildren = (node.children || [])
          .map((child) => walk(child, false))
          .filter((c): c is WorkflowTreeNode => c !== null);
        return {
          ...node,
          children: branchChildren,
        };
      }
      return null;
    }

    if (node.id === stepId) {
      return deepCloneNode(node);
    }

    if (!node.children || node.children.length === 0) {
      return isRoot ? { ...node, children: [] } : null;
    }

    const filteredChildren = node.children
      .map((child) => walk(child, false))
      .filter((c): c is WorkflowTreeNode => c !== null);

    if (filteredChildren.length === 0 && !isRoot) {
      return null;
    }

    return {
      ...node,
      children: filteredChildren,
    };
  };

  return (
    walk(missionNode, true) ?? {
      ...missionNode,
      children: [],
    }
  );
}

export function filterNodeByAllowedPhases(
  rootNode: WorkflowTreeNode,
  allowedPhases?: SharedPhasesConfig
): WorkflowTreeNode {
  if (!allowedPhases || !subtreeContainsPhaseNodes(rootNode)) {
    return deepCloneNode(rootNode);
  }

  const walk = (node: WorkflowTreeNode, isRoot: boolean): WorkflowTreeNode | null => {
    const phaseKey = detectNodePhaseKey(node);
    if (phaseKey !== null) {
      if (!allowedPhases[phaseKey]) {
        return null;
      }
      return deepCloneNode(node);
    }

    if (!node.children || node.children.length === 0) {
      return isRoot ? { ...node, children: [] } : null;
    }

    const filteredChildren = node.children
      .map((child) => walk(child, false))
      .filter((c): c is WorkflowTreeNode => c !== null);

    if (filteredChildren.length === 0 && !isRoot) {
      return null;
    }

    return {
      ...node,
      children: filteredChildren,
    };
  };

  return (
    walk(rootNode, true) ?? {
      ...rootNode,
      children: [],
    }
  );
}

export function collectSubtreeNodeIds(
  node: WorkflowTreeNode | undefined,
  acc = new Set<string>()
): Set<string> {
  if (!node) return acc;
  acc.add(node.id);
  node.children?.forEach((c) => collectSubtreeNodeIds(c, acc));
  return acc;
}

export function collectAuthorizedPhaseNodeIds(
  rootNode: WorkflowTreeNode | undefined,
  allowedPhases?: SharedPhasesConfig
): Set<string> {
  const ids = new Set<string>();
  if (!rootNode) return ids;
  if (!allowedPhases || !subtreeContainsPhaseNodes(rootNode)) {
    return collectSubtreeNodeIds(rootNode, ids);
  }

  const walk = (node: WorkflowTreeNode, insideAllowed: boolean) => {
    const phaseKey = detectNodePhaseKey(node);
    const nowAllowed =
      insideAllowed || (phaseKey !== null && Boolean(allowedPhases[phaseKey]));
    if (nowAllowed) {
      ids.add(node.id);
    }
    node.children?.forEach((c) => walk(c, nowAllowed));
  };
  walk(rootNode, false);
  return ids;
}

export function isNodeInsideAuthorizedPhase(
  rootNode: WorkflowTreeNode | undefined,
  targetId: string | undefined,
  allowedPhases?: SharedPhasesConfig
): boolean {
  if (!rootNode || !targetId) return false;
  const authorizedIds = collectAuthorizedPhaseNodeIds(rootNode, allowedPhases);
  return authorizedIds.has(targetId);
}

export function findPreferredAuthorizedPhaseNode(
  rootNode: WorkflowTreeNode | undefined,
  allowedPhases?: SharedPhasesConfig
): WorkflowTreeNode | null {
  if (!rootNode) return null;
  if (!allowedPhases || !subtreeContainsPhaseNodes(rootNode)) {
    return rootNode;
  }

  const matches: Array<{ key: SharedPhaseKey; node: WorkflowTreeNode }> = [];
  const walk = (node: WorkflowTreeNode) => {
    const phaseKey = detectNodePhaseKey(node);
    if (phaseKey && allowedPhases[phaseKey]) {
      matches.push({ key: phaseKey, node });
      return;
    }
    node.children?.forEach(walk);
  };
  walk(rootNode);

  const conclusionMatch = matches.find((m) => m.key === 'conclusion');
  if (conclusionMatch) return conclusionMatch.node;
  return matches[0]?.node ?? null;
}

export function mergeAuthorizedPhaseChangesIntoTrees(
  ownerTrees: WorkflowTreeNode[],
  guestSubtree: WorkflowTreeNode,
  allowedPhases?: SharedPhasesConfig,
  sharedStepId?: string
): {
  trees: WorkflowTreeNode[];
  changed: boolean;
  updatedPhaseLabels: string[];
  newlyAddedNodeIds: string[];
  authorizedDocIds: Set<string>;
} {
  const isPhased = subtreeContainsPhaseNodes(guestSubtree);
  const updatedPhaseLabels: string[] = [];
  const newlyAddedNodeIds: string[] = [];
  const authorizedDocIds = new Set<string>();

  if (isPhased) {
    const guestSharedStep = sharedStepId
      ? findNodeById([guestSubtree], sharedStepId)
      : null;

    if (!hasAnyAllowedPhase(allowedPhases) && !guestSharedStep) {
      return {
        trees: ownerTrees,
        changed: false,
        updatedPhaseLabels,
        newlyAddedNodeIds,
        authorizedDocIds,
      };
    }

    const guestPhaseMap = new Map<string, { key: SharedPhaseKey; node: WorkflowTreeNode }>();
    const collectGuestPhases = (node: WorkflowTreeNode) => {
      const key = detectNodePhaseKey(node);
      if (key !== null) {
        if (allowedPhases?.[key]) {
          guestPhaseMap.set(node.id, { key, node });
          collectSubtreeNodeIds(node, authorizedDocIds);
        }
        return;
      }
      node.children?.forEach(collectGuestPhases);
    };
    collectGuestPhases(guestSubtree);

    if (guestSharedStep) {
      authorizedDocIds.add(guestSharedStep.id);
    }

    if (guestPhaseMap.size === 0 && !guestSharedStep) {
      return {
        trees: ownerTrees,
        changed: false,
        updatedPhaseLabels,
        newlyAddedNodeIds,
        authorizedDocIds,
      };
    }

    let changed = false;
    const applyMerge = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
      nodes.map((ownerNode) => {
        const guestEntry = guestPhaseMap.get(ownerNode.id);
        const ownerPhaseKey = detectNodePhaseKey(ownerNode);
        if (
          guestEntry &&
          ownerPhaseKey === guestEntry.key &&
          allowedPhases?.[guestEntry.key] &&
          !ownerNode.locked
        ) {
          const prevChildren = ownerNode.children || [];
          const nextChildren = (guestEntry.node.children || []).map(deepCloneNode);
          if (JSON.stringify(prevChildren) !== JSON.stringify(nextChildren)) {
            changed = true;
            updatedPhaseLabels.push(ownerNode.label);
            const prevIds = new Set<string>();
            prevChildren.forEach((c) => collectSubtreeNodeIds(c, prevIds));
            const nextIds = new Set<string>();
            nextChildren.forEach((c) => collectSubtreeNodeIds(c, nextIds));
            nextIds.forEach((id) => {
              if (!prevIds.has(id)) newlyAddedNodeIds.push(id);
            });
            return {
              ...ownerNode,
              children: nextChildren,
            };
          }
          return ownerNode;
        }

        // Si l'étape partagée réside dans une phase non validée, on ne fusionne que son statut / auditTrail
        if (
          guestSharedStep &&
          ownerNode.id === guestSharedStep.id &&
          !ownerNode.locked
        ) {
          const statusChanged = ownerNode.status !== guestSharedStep.status;
          const labelChanged = ownerNode.label !== guestSharedStep.label;
          const trailChanged =
            JSON.stringify(ownerNode.auditTrail || []) !==
            JSON.stringify(guestSharedStep.auditTrail || []);
          if (statusChanged || labelChanged || trailChanged) {
            changed = true;
            if (!updatedPhaseLabels.includes(ownerNode.label)) {
              updatedPhaseLabels.push(ownerNode.label);
            }
            return {
              ...ownerNode,
              label: guestSharedStep.label,
              status: guestSharedStep.status,
              auditTrail: guestSharedStep.auditTrail,
            };
          }
        }

        if (ownerNode.children?.length) {
          return {
            ...ownerNode,
            children: applyMerge(ownerNode.children),
          };
        }
        return ownerNode;
      });

    const trees = applyMerge(ownerTrees);
    return {
      trees: changed ? trees : ownerTrees,
      changed,
      updatedPhaseLabels,
      newlyAddedNodeIds,
      authorizedDocIds,
    };
  }

  // Fallback pour un nœud workflow sans structure de phases
  let changed = false;
  collectSubtreeNodeIds(guestSubtree, authorizedDocIds);
  const applyDirectMerge = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((ownerNode) => {
      if (ownerNode.id === guestSubtree.id && !ownerNode.locked) {
        const prevChildren = ownerNode.children || [];
        const nextChildren = (guestSubtree.children || []).map(deepCloneNode);
        if (JSON.stringify(prevChildren) !== JSON.stringify(nextChildren)) {
          changed = true;
          updatedPhaseLabels.push(ownerNode.label);
          const prevIds = new Set<string>();
          prevChildren.forEach((c) => collectSubtreeNodeIds(c, prevIds));
          const nextIds = new Set<string>();
          nextChildren.forEach((c) => collectSubtreeNodeIds(c, nextIds));
          nextIds.forEach((id) => {
            if (!prevIds.has(id)) newlyAddedNodeIds.push(id);
          });
          return {
            ...ownerNode,
            children: nextChildren,
          };
        }
        return ownerNode;
      }
      if (ownerNode.children?.length) {
        return {
          ...ownerNode,
          children: applyDirectMerge(ownerNode.children),
        };
      }
      return ownerNode;
    });

  const trees = applyDirectMerge(ownerTrees);
  return {
    trees: changed ? trees : ownerTrees,
    changed,
    updatedPhaseLabels,
    newlyAddedNodeIds,
    authorizedDocIds,
  };
}
