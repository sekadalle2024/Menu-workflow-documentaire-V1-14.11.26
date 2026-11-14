import JSZip from 'jszip';
import { WorkflowTreeNode } from '../types/workflow';
import { cloneNodeWithFreshIds } from './workflowTreeOps';

interface ArchiveManifest {
  format: 'nod-n8n-workflow-archive';
  version: 1;
  exportedAt: string;
  client: string;
  ownerEmail: string;
  signature: string;
  nodes: WorkflowTreeNode[];
  wordContents: Record<string, string>;
}

function sanitizeArchiveSegment(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 80) || 'element';
}

function collectWordContents(
  nodes: WorkflowTreeNode[],
  wordBodies: Record<string, string>,
  acc: Record<string, string>
) {
  for (const n of nodes) {
    if (wordBodies[n.id]) {
      acc[n.id] = wordBodies[n.id];
    }
    if (n.children?.length) {
      collectWordContents(n.children, wordBodies, acc);
    }
  }
}

function cloneWithWordBodyMapping(
  node: WorkflowTreeNode,
  sourceWordContents: Record<string, string>,
  mappedWordBodies: Record<string, string>
): WorkflowTreeNode {
  const cloned = cloneNodeWithFreshIds(node);

  const mapIds = (orig: WorkflowTreeNode, copy: WorkflowTreeNode) => {
    if (sourceWordContents[orig.id]) {
      mappedWordBodies[copy.id] = sourceWordContents[orig.id];
    }
    if (orig.children?.length && copy.children?.length) {
      orig.children.forEach((origChild, idx) => {
        const copyChild = copy.children![idx];
        if (copyChild) mapIds(origChild, copyChild);
      });
    }
  };

  mapIds(node, cloned);
  return cloned;
}

export async function buildArchiveZipBlob(
  selectedNodes: WorkflowTreeNode[],
  wordBodies: Record<string, string>,
  meta: { client: string; email: string; signature: string }
): Promise<{ blob: Blob; filename: string; fileCount: number }> {
  const zip = new JSZip();
  let fileCount = 0;

  const writeNodeIntoZip = (node: WorkflowTreeNode, folder: JSZip) => {
    const safeName = sanitizeArchiveSegment(
      node.nodeType === 'signature' ? `[${node.label}]` : node.label
    );

    if (node.nodeType === 'document') {
      const body = wordBodies[node.id];
      const content =
        body && body.trim().length > 0
          ? body
          : `Document : ${node.label}\nClient : ${meta.client}\nRéf. Drive : ${
              node.driveId || 'N/A'
            }\nSignature : ${node.owner || meta.signature}\n`;
      folder.file(`${safeName}.txt`, content);
      fileCount += 1;
      return;
    }

    const subFolder = folder.folder(safeName) ?? folder;
    if (node.children?.length) {
      node.children.forEach((child) => writeNodeIntoZip(child, subFolder));
    } else {
      // Dossier vide conservé explicitement dans l'archive
      subFolder.file('.keep', '');
    }
  };

  selectedNodes.forEach((node) => writeNodeIntoZip(node, zip));

  const wordContents: Record<string, string> = {};
  collectWordContents(selectedNodes, wordBodies, wordContents);

  const manifest: ArchiveManifest = {
    format: 'nod-n8n-workflow-archive',
    version: 1,
    exportedAt: new Date().toISOString(),
    client: meta.client,
    ownerEmail: meta.email,
    signature: meta.signature,
    nodes: selectedNodes,
    wordContents,
  };

  zip.file('workflow-archive.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const baseName =
    selectedNodes.length === 1
      ? sanitizeArchiveSegment(selectedNodes[0].label).replace(/\s+/g, '_')
      : `selection_${selectedNodes.length}_elements`;
  const stamp = new Date().toISOString().slice(0, 10);

  return {
    blob,
    filename: `archive-${baseName}-${stamp}.zip`,
    fileCount,
  };
}

function isWorkflowNodeLike(val: unknown): val is WorkflowTreeNode {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    typeof (val as WorkflowTreeNode).label === 'string' &&
    typeof (val as WorkflowTreeNode).nodeType === 'string'
  );
}

async function buildNodesFromRawZip(
  zip: JSZip,
  ownerSignature: string,
  ownerEmail: string,
  restoredWordBodies: Record<string, string>
): Promise<WorkflowTreeNode[]> {
  const rootFolder: WorkflowTreeNode = {
    id: `imp-dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    label: 'Archive importée',
    nodeType: 'section',
    owner: ownerSignature,
    ownerEmail,
    children: [],
  };

  const folderMap = new Map<string, WorkflowTreeNode>();
  folderMap.set('', rootFolder);

  const ensureFolderPath = (dirParts: string[]): WorkflowTreeNode => {
    let currentKey = '';
    let parent = rootFolder;
    for (const part of dirParts) {
      currentKey = currentKey ? `${currentKey}/${part}` : part;
      let existing = folderMap.get(currentKey);
      if (!existing) {
        existing = {
          id: `imp-dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: part,
          nodeType: dirParts.indexOf(part) === 0 ? 'section' : 'sous-section',
          owner: ownerSignature,
          ownerEmail,
          children: [],
        };
        parent.children = [...(parent.children || []), existing];
        folderMap.set(currentKey, existing);
      }
      parent = existing;
    }
    return parent;
  };

  const entries = Object.values(zip.files).filter(
    (entry) =>
      !entry.dir &&
      !entry.name.endsWith('/.keep') &&
      entry.name !== '.keep' &&
      !entry.name.startsWith('__MACOSX/')
  );

  for (const entry of entries) {
    const parts = entry.name.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    const fileName = parts[parts.length - 1];
    const dirParts = parts.slice(0, -1);
    const parentNode = ensureFolderPath(dirParts);

    const docId = `imp-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const cleanLabel = fileName.replace(/\.txt$/i, '');
    const docNode: WorkflowTreeNode = {
      id: docId,
      label: cleanLabel,
      nodeType: 'document',
      driveId: `1drv_${Math.random().toString(36).slice(2, 10)}`,
      owner: ownerSignature,
      ownerEmail,
    };

    if (/\.(txt|md|json|csv)$/i.test(fileName)) {
      try {
        restoredWordBodies[docId] = await entry.async('string');
      } catch {
        // Ignore binary read failures
      }
    }

    parentNode.children = [...(parentNode.children || []), docNode];
  }

  return rootFolder.children || [];
}

export async function parseImportedFiles(
  fileList: FileList | File[],
  ownerSignature: string,
  ownerEmail: string
): Promise<{
  nodes: WorkflowTreeNode[];
  restoredWordBodies: Record<string, string>;
}> {
  const files = Array.from(fileList);
  const importedNodes: WorkflowTreeNode[] = [];
  const restoredWordBodies: Record<string, string> = {};

  for (const file of files) {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file('workflow-archive.json');
      if (manifestFile) {
        const rawManifest = await manifestFile.async('string');
        const parsed = JSON.parse(rawManifest) as Partial<ArchiveManifest>;
        if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          const wordMap = parsed.wordContents || {};
          parsed.nodes.forEach((n) => {
            if (isWorkflowNodeLike(n)) {
              importedNodes.push(
                cloneWithWordBodyMapping(n, wordMap, restoredWordBodies)
              );
            }
          });
          continue;
        }
      }

      const rawNodes = await buildNodesFromRawZip(
        zip,
        ownerSignature,
        ownerEmail,
        restoredWordBodies
      );
      importedNodes.push(...rawNodes);
      continue;
    }

    if (lowerName.endsWith('.json')) {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (Array.isArray(parsed.nodes) && parsed.nodes.every(isWorkflowNodeLike)) {
          const wordMap =
            (parsed.wordContents as Record<string, string> | undefined) || {};
          parsed.nodes.forEach((n) =>
            importedNodes.push(cloneWithWordBodyMapping(n, wordMap, restoredWordBodies))
          );
          continue;
        }
        if (Array.isArray(parsed.selection) && parsed.selection.every(isWorkflowNodeLike)) {
          parsed.selection.forEach((n) => importedNodes.push(cloneNodeWithFreshIds(n)));
          continue;
        }
        if (Array.isArray(parsed) && parsed.every(isWorkflowNodeLike)) {
          parsed.forEach((n) => importedNodes.push(cloneNodeWithFreshIds(n)));
          continue;
        }
        if (isWorkflowNodeLike(parsed)) {
          importedNodes.push(cloneNodeWithFreshIds(parsed));
          continue;
        }
      } catch {
        // Fallback below as document node
      }
      const docId = `imp-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      restoredWordBodies[docId] = text;
      importedNodes.push({
        id: docId,
        label: file.name,
        nodeType: 'document',
        driveId: `1drv_${Math.random().toString(36).slice(2, 10)}`,
        owner: ownerSignature,
        ownerEmail,
      });
      continue;
    }

    const docId = `imp-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    if (/\.(txt|md|csv)$/i.test(lowerName)) {
      try {
        restoredWordBodies[docId] = await file.text();
      } catch {
        // Ignore read error
      }
    }
    importedNodes.push({
      id: docId,
      label: file.name,
      nodeType: 'document',
      driveId: `1drv_${Math.random().toString(36).slice(2, 10)}`,
      owner: ownerSignature,
      ownerEmail,
    });
  }

  return { nodes: importedNodes, restoredWordBodies };
}

export async function parseImportedDirectory(
  fileList: FileList | File[],
  ownerSignature: string,
  ownerEmail: string
): Promise<{
  nodes: WorkflowTreeNode[];
  restoredWordBodies: Record<string, string>;
}> {
  const files = Array.from(fileList);
  const restoredWordBodies: Record<string, string> = {};

  if (files.length === 0) {
    return { nodes: [], restoredWordBodies };
  }

  // Si le dossier importé provient d'une archive exportée extraite (contient workflow-archive.json)
  const manifestFile = files.find((f) => {
    const rel = f.webkitRelativePath || f.name;
    const parts = rel.split('/').filter(Boolean);
    return parts[parts.length - 1] === 'workflow-archive.json' && parts.length <= 2;
  });

  if (manifestFile) {
    try {
      const rawManifest = await manifestFile.text();
      const parsed = JSON.parse(rawManifest) as Partial<ArchiveManifest>;
      if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        const wordMap = parsed.wordContents || {};
        const restoredNodes = parsed.nodes
          .filter(isWorkflowNodeLike)
          .map((n) => cloneWithWordBodyMapping(n, wordMap, restoredWordBodies));
        if (restoredNodes.length > 0) {
          return { nodes: restoredNodes, restoredWordBodies };
        }
      }
    } catch {
      // Poursuit avec la reconstruction standard de l'arborescence dossier
    }
  }

  const virtualRoot: WorkflowTreeNode = {
    id: `imp-vroot-${Date.now()}`,
    label: 'root',
    nodeType: 'root',
    children: [],
  };
  const folderMap = new Map<string, WorkflowTreeNode>();
  folderMap.set('', virtualRoot);

  const ensureFolderPath = (dirParts: string[]): WorkflowTreeNode => {
    let currentKey = '';
    let parent = virtualRoot;
    dirParts.forEach((part, idx) => {
      currentKey = currentKey ? `${currentKey}/${part}` : part;
      let existing = folderMap.get(currentKey);
      if (!existing) {
        existing = {
          id: `imp-dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          label: part,
          nodeType: idx === 0 ? 'section' : 'sous-section',
          owner: ownerSignature,
          ownerEmail,
          children: [],
        };
        parent.children = [...(parent.children || []), existing];
        folderMap.set(currentKey, existing);
      }
      parent = existing;
    });
    return parent;
  };

  for (const file of files) {
    const relPath = file.webkitRelativePath || file.name;
    const parts = relPath.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    const fileName = parts[parts.length - 1];
    if (
      fileName === '.DS_Store' ||
      fileName === 'Thumbs.db' ||
      fileName === '.keep' ||
      parts.includes('__MACOSX')
    ) {
      if (parts.length > 1 && fileName === '.keep') {
        ensureFolderPath(parts.slice(0, -1));
      }
      continue;
    }

    const dirParts = parts.slice(0, -1);
    const parentFolder = ensureFolderPath(dirParts);
    const docId = `imp-doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    if (/\.(txt|md|json|csv)$/i.test(fileName)) {
      try {
        restoredWordBodies[docId] = await file.text();
      } catch {
        // Ignore binary read failures
      }
    }

    const docNode: WorkflowTreeNode = {
      id: docId,
      label: fileName,
      nodeType: 'document',
      driveId: `1drv_${Math.random().toString(36).slice(2, 10)}`,
      owner: ownerSignature,
      ownerEmail,
    };

    parentFolder.children = [...(parentFolder.children || []), docNode];
  }

  return {
    nodes: virtualRoot.children || [],
    restoredWordBodies,
  };
}

