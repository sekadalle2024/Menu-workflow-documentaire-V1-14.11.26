import { KEYWORD_MAPPING } from '../data/dossierStructure';
import { ClassifiedTableItem, DossierTreeNode } from '../types/dossier';

export function getInitialExpandedIds(nodes: DossierTreeNode[]): Set<string> {
  const expanded = new Set<string>();
  const walk = (list: DossierTreeNode[]) => {
    for (const node of list) {
      if (node.expanded) {
        expanded.add(node.id);
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return expanded;
}

export function collectAllExpandableIds(nodes: DossierTreeNode[]): Set<string> {
  const ids = new Set<string>();
  const walk = (list: DossierTreeNode[]) => {
    for (const node of list) {
      if (node.children?.length) {
        ids.add(node.id);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

export function collectSubtreeDossierExpandableIds(
  node: DossierTreeNode,
  classifiedByRubrique?: Map<string, ClassifiedTableItem[]>
): string[] {
  const ids: string[] = [];
  const walk = (n: DossierTreeNode) => {
    const hasChildren = Boolean(n.children?.length);
    const hasItems = Boolean(classifiedByRubrique?.get(n.id)?.length);
    if (hasChildren || hasItems) {
      ids.push(n.id);
    }
    n.children?.forEach(walk);
  };
  walk(node);
  return ids;
}

export function findSiblingIds(nodes: DossierTreeNode[], targetId: string): string[] {
  for (const node of nodes) {
    if (node.id === targetId) {
      return nodes.map((n) => n.id);
    }
    if (node.children?.length) {
      const found = findSiblingIds(node.children, targetId);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export function collectAllNodeIds(nodes: DossierTreeNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: DossierTreeNode[]) => {
    for (const node of list) {
      ids.push(node.id);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

export function getDescendantLeafIds(node: DossierTreeNode): string[] {
  if (!node.children?.length) {
    return [node.id];
  }
  return node.children.flatMap((child) => getDescendantLeafIds(child));
}

export function getNodeCheckState(
  node: DossierTreeNode,
  checkedIds: Set<string>
): 'checked' | 'unchecked' | 'indeterminate' {
  // Sélection descendante uniquement : cocher un enfant ne coche jamais le parent
  return checkedIds.has(node.id) ? 'checked' : 'unchecked';
}

export function toggleNodeChecked(
  node: DossierTreeNode,
  checkedIds: Set<string>,
  classifiedByRubrique?: Map<string, ClassifiedTableItem[]>
): Set<string> {
  const next = new Set(checkedIds);
  const shouldCheck = !checkedIds.has(node.id);

  const applyRecursive = (n: DossierTreeNode) => {
    if (shouldCheck) {
      next.add(n.id);
    } else {
      next.delete(n.id);
    }
    const items = classifiedByRubrique?.get(n.id) || [];
    items.forEach((item) => {
      if (shouldCheck) next.add(item.id);
      else next.delete(item.id);
    });
    n.children?.forEach(applyRecursive);
  };

  applyRecursive(node);
  return next;
}

function classifyByKeywords(searchText: string): string {
  const normalized = searchText.toLowerCase();
  const entries = Object.entries(KEYWORD_MAPPING).sort(
    ([a], [b]) => b.length - a.length
  );
  for (const [keyword, rubriqueId] of entries) {
    if (normalized.includes(keyword.toLowerCase())) {
      return rubriqueId;
    }
  }
  return 'donnees-externes';
}

export function extractTableMetadata(
  table: HTMLTableElement,
  container: Element
): Omit<ClassifiedTableItem, 'id' | 'rubriqueId' | 'element'> | null {
  let etapeMission = '';
  let norme = '';
  let methode = '';
  let reference = '';

  const rows = Array.from(table.querySelectorAll('tr'));
  const headerCells = rows[0] ? Array.from(rows[0].querySelectorAll('th, td')) : [];

  // Mode 1: Tableau à en-têtes en colonne (thead -> tbody)
  if (rows.length > 1 && headerCells.length > 0) {
    const firstBodyCells = Array.from(rows[1].querySelectorAll('td, th'));
    headerCells.forEach((cell, idx) => {
      const headerLower = (cell.textContent || '').trim().toLowerCase();
      const val = (firstBodyCells[idx]?.textContent || '').trim();
      if (!val) return;
      if (headerLower.includes('etape de mission') || headerLower.includes('étape de mission')) {
        etapeMission = etapeMission || val;
      } else if (headerLower.includes('norme')) {
        norme = norme || val;
      } else if (headerLower.includes('méthode') || headerLower.includes('methode')) {
        methode = methode || val;
      } else if (headerLower.includes('reference') || headerLower.includes('référence')) {
        reference = reference || val;
      }
    });
  }

  // Mode 2: Paires clé/valeur horizontales dans les lignes
  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td, th'));
    cells.forEach((cell, idx) => {
      const text = (cell.textContent || '').trim();
      const textLower = text.toLowerCase();
      const nextText = (cells[idx + 1]?.textContent || '').trim();

      if (
        (textLower.includes('etape de mission') || textLower.includes('étape de mission')) &&
        nextText &&
        !etapeMission
      ) {
        etapeMission = nextText;
      }
      if (textLower === 'norme' && nextText && !norme) {
        norme = nextText;
      }
      if ((textLower === 'méthode' || textLower === 'methode') && nextText && !methode) {
        methode = nextText;
      }
      if ((textLower === 'reference' || textLower === 'référence') && nextText && !reference) {
        reference = nextText;
      }
      if (textLower === 'programme de travail' && !etapeMission) {
        etapeMission = text;
      }
      if (textLower.includes('programme-') && !reference) {
        reference = text;
      }
    });
  });

  // Fallback sur les mots-clés du texte de la table ou du message
  const tableText = (table.textContent || '').toLowerCase();
  const containerText = (container.textContent || '').toLowerCase();
  if (!etapeMission && !reference) {
    const sortedKeywords = Object.keys(KEYWORD_MAPPING).sort((a, b) => b.length - a.length);
    for (const kw of sortedKeywords) {
      if (tableText.includes(kw) || containerText.includes(kw)) {
        etapeMission = kw;
        break;
      }
    }
  }

  if (!etapeMission && !reference && !norme) {
    return null;
  }

  const captionText = table.querySelector('caption')?.textContent?.trim();
  const displayTitle = captionText || etapeMission || reference || 'Table audit';
  const bodyRowsCount = Math.max(0, rows.length - (table.querySelector('thead') ? 1 : 0));

  return {
    etapeMission,
    norme,
    methode,
    reference,
    displayTitle,
    rowCount: bodyRowsCount,
  };
}

export function scanDomForAuditTables(
  rootElement: HTMLElement | null
): Map<string, ClassifiedTableItem[]> {
  const result = new Map<string, ClassifiedTableItem[]>();
  if (!rootElement) return result;

  const messageContainers = rootElement.querySelectorAll(
    '[data-role="assistant"], [class*="message"], [class*="assistant"], .prose, .markdown-body'
  );

  // Déduplication stricte des éléments <table> déjà inspectés
  const seenTables = new Set<HTMLTableElement>();
  let seq = 0;

  messageContainers.forEach((container) => {
    if (
      container.closest('[data-role="user"]') ||
      container.classList.contains('user-message')
    ) {
      return;
    }

    const tables = container.querySelectorAll('table');
    tables.forEach((table) => {
      if (seenTables.has(table)) return;
      seenTables.add(table);

      const meta = extractTableMetadata(table, container);
      if (!meta) return;

      const rubriqueId = classifyByKeywords(
        `${meta.etapeMission} ${meta.reference} ${meta.norme} ${meta.methode}`
      );

      if (!result.has(rubriqueId)) {
        result.set(rubriqueId, []);
      }

      seq += 1;
      result.get(rubriqueId)!.push({
        ...meta,
        id: `tbl-${seq}-${rubriqueId}`,
        rubriqueId,
        element: table,
      });
    });
  });

  return result;
}

export interface ScriptAdaptation {
  id: string;
  area: string;
  issue: string;
  adaptation: string;
}

export const SCRIPT_ADAPTATIONS: ScriptAdaptation[] = [
  {
    id: 'dedup',
    area: 'Analyse DOM',
    issue: 'Double comptage des <table> quand .prose est imbriqué dans [class*="message"].',
    adaptation: 'Déduplication par Set<HTMLTableElement> avant extraction et classification.',
  },
  {
    id: 'table-layout',
    area: 'Extraction métadonnées',
    issue: 'Lecture limitée aux paires clé/valeur horizontales (cells[idx + 1]).',
    adaptation: 'Support des tableaux Markdown standards (en-têtes <thead> + valeurs <tbody> par colonne).',
  },
  {
    id: 'parent-nodes',
    area: 'Rendu TreeView',
    issue: 'Condition !hasChildren masquant les tables classées sur "programme-travail".',
    adaptation: 'Affichage des livrables classés même sur les dossiers contenant des sous-rubriques.',
  },
  {
    id: 'expanded-init',
    area: 'État initial',
    issue: 'Le noeud "programme-travail" (expanded: true) était ignoré dans le constructeur.',
    adaptation: 'Initialisation récursive de expandedNodes à partir de STRUCTURE_DOSSIER.',
  },
  {
    id: 'a11y-responsive',
    area: 'Accessibilité & Mobile',
    issue: 'min-width: 500px cassait les écrans mobiles et aucun rôle ARIA n’était posé.',
    adaptation: 'Largeur responsive min(100vw, 560px), attributs role="tree"/"treeitem" et aria-expanded.',
  },
  {
    id: 'keyword-priority',
    area: 'Classification',
    issue: 'Mots-clés courts ("risque") pouvant masquer des libellés plus spécifiques.',
    adaptation: 'Tri des mots-clés par longueur décroissante et prise en compte du champ Méthode.',
  },
  {
    id: 'checkbox-tree',
    area: 'Sélection TreeView',
    issue: 'Aucune case à cocher pour suivre ou sélectionner les rubriques d’audit.',
    adaptation: 'Cases à cocher tri-état (coché / décoché / indéterminé) avec propagation parent-enfants.',
  },
];

export const ADAPTED_DEPLOYABLE_SCRIPT = `/**
 * Dossier Mission Audit - Menu Accordéon & TreeView V2.1 (Adapté & Déployable)
 * - Déduplication DOM des tables
 * - Support des tableaux en colonnes (<thead>/<tbody>) et clé/valeur
 * - Initialisation récursive des noeuds ouverts + rendu sur noeuds parents
 * - Mode accordéon / multi-sections + accessibilité ARIA + responsive mobile
 */
(function () {
    'use strict';

    const CONFIG = {
        panelId: 'dossier-mission-panel',
        overlayId: 'dossier-mission-overlay',
        accordionSingleMode: false,
        debugMode: false
    };

    const STRUCTURE_DOSSIER = [
        { id: 'demarrer', label: 'Dossier Démarrer', icon: '📁', children: [] },
        { id: 'guide', label: 'Dossier Guide', icon: '📁', children: [] },
        { id: 'exercice', label: 'Dossier Exercice', icon: '📁', children: [] },
        {
            id: 'preparation',
            label: 'Phase de préparation',
            icon: '📂',
            expanded: true,
            children: [
                { id: 'plan-pluriannuel', label: "Plan pluri-annuel d'audit interne", icon: '📁' },
                { id: 'planification', label: 'Planification de la mission', icon: '📁' },
                { id: 'lettre-mission', label: 'Lettre de mission', icon: '📁' },
                { id: 'rencontre-direction', label: "Rencontre avec la Direction de l'entité auditée", icon: '📁' },
                { id: 'compte-rendu', label: 'Compte rendu de la réunion', icon: '📁' },
                { id: 'reunion-ouverture', label: "Réunion d'ouverture", icon: '📁' },
                { id: 'collecte-documentaire', label: 'Collecte documentaire (prise de connaissance du Domaine audité)', icon: '📁' },
                { id: 'cartographie-risques', label: 'Cartographie des risques', icon: '📁' },
                { id: 'plan-approche', label: "Plan d'approche – référentiel de contrôle interne", icon: '📁' },
                { id: 'qci', label: 'Questionnaire de contrôle interne', icon: '📁' },
                { id: 'tffa', label: 'Tableau des forces et faiblesses apparentes', icon: '📁' },
                { id: 'rapport-orientation', label: "Le rapport d'orientation", icon: '📁' },
                {
                    id: 'programme-travail',
                    label: 'Le programme de travail',
                    icon: '📂',
                    expanded: true,
                    children: [
                        { id: 'pt-etape', label: 'Etape de mission - Programme de travail', icon: '📄' },
                        { id: 'pt-norme', label: 'Norme - 13.6 Programme de travail', icon: '📄' },
                        { id: 'pt-methode', label: 'Méthode - Méthode des contrôles clés par les risques', icon: '📄' },
                        { id: 'pt-reference', label: 'Reference - Programme-001', icon: '📄' }
                    ]
                },
                { id: 'qci-programme', label: 'Le questionnaire de contrôle interne du programme de travail', icon: '📁' }
            ]
        },
        {
            id: 'realisation',
            label: 'Phase de réalisation',
            icon: '📂',
            expanded: true,
            children: [
                { id: 'feuille-couverture', label: 'Feuille couverture', icon: '📁' }
            ]
        },
        {
            id: 'conclusion',
            label: 'Phase de conclusion',
            icon: '📂',
            expanded: true,
            children: [
                { id: 'frap', label: "LA FRAP = Feuille de Révélation et d'Analyse de Problème", icon: '📁' },
                { id: 'synthese-frap', label: 'La synthèse des FRAP', icon: '📁' },
                { id: 'rapport-provisoire', label: 'Le rapport provisoire', icon: '📁' },
                { id: 'reunion-cloture', label: 'La réunion de clôture', icon: '📁' },
                { id: 'rapport-final', label: 'Le rapport final', icon: '📁' }
            ]
        },
        { id: 'permanent', label: 'Dossier Permanent', icon: '📁', children: [] },
        { id: 'donnees-externes', label: 'Données Externes', icon: '📁', children: [] },
        { id: 'analyse-donnees', label: 'Dossier Analyse de données', icon: '📁', children: [] },
        { id: 'dashboard', label: 'Dossier Dashboard', icon: '📁', children: [] }
    ];

    const KEYWORD_MAPPING = {
        'programme de travail': 'programme-travail',
        'programme-travail': 'programme-travail',
        'programme travail': 'programme-travail',
        'etape mission - programme': 'programme-travail',
        'planification': 'planification',
        'lettre de mission': 'lettre-mission',
        'cartographie': 'cartographie-risques',
        'risque': 'cartographie-risques',
        'questionnaire': 'qci',
        'qci': 'qci',
        'contrôle interne': 'qci',
        'frap': 'frap',
        'révélation': 'frap',
        'analyse de problème': 'frap',
        'rapport final': 'rapport-final',
        'rapport provisoire': 'rapport-provisoire',
        'réunion de clôture': 'reunion-cloture',
        "réunion d'ouverture": 'reunion-ouverture',
        'collecte documentaire': 'collecte-documentaire',
        'prise de connaissance': 'collecte-documentaire',
        "plan d'approche": 'plan-approche',
        'référentiel': 'plan-approche',
        'forces et faiblesses': 'tffa',
        'tffa': 'tffa',
        "rapport d'orientation": 'rapport-orientation',
        'synthèse': 'synthese-frap',
        'feuille couverture': 'feuille-couverture',
        'plan pluriannuel': 'plan-pluriannuel',
        'plan pluri-annuel': 'plan-pluriannuel',
        'compte rendu': 'compte-rendu',
        'rencontre': 'rencontre-direction',
        'direction': 'rencontre-direction'
    };

    class DossierMissionMenu {
        constructor() {
            this.isOpen = false;
            this.panel = null;
            this.overlay = null;
            this.expandedNodes = this.collectInitialExpanded(STRUCTURE_DOSSIER);
            this.checkedIds = new Set();
            this.classifiedMessages = new Map();
            this.escapeHandler = null;
            this.init();
        }

        collectInitialExpanded(nodes, acc = new Set()) {
            nodes.forEach((node) => {
                if (node.expanded) acc.add(node.id);
                if (node.children?.length) this.collectInitialExpanded(node.children, acc);
            });
            return acc;
        }

        getLeafIds(node) {
            if (!node.children?.length) return [node.id];
            return node.children.flatMap((c) => this.getLeafIds(c));
        }

        getNodeCheckState(node) {
            if (!node.children?.length) return this.checkedIds.has(node.id) ? 'checked' : 'unchecked';
            const leaves = this.getLeafIds(node);
            const count = leaves.filter((id) => this.checkedIds.has(id)).length;
            if (count === 0) return 'unchecked';
            if (count === leaves.length) return 'checked';
            return 'indeterminate';
        }

        toggleNodeCheck(node) {
            const shouldCheck = this.getNodeCheckState(node) !== 'checked';
            const walk = (n) => {
                shouldCheck ? this.checkedIds.add(n.id) : this.checkedIds.delete(n.id);
                n.children?.forEach(walk);
            };
            walk(node);
            this.refreshContent();
        }

        init() {
            this.createPanel();
            this.attachEventListeners();
        }

        createPanel() {
            document.getElementById(CONFIG.panelId)?.remove();
            document.getElementById(CONFIG.overlayId)?.remove();

            this.overlay = document.createElement('div');
            this.overlay.id = CONFIG.overlayId;
            this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.45);backdrop-filter:blur(4px);z-index:99998;display:none;opacity:0;transition:opacity 0.2s ease-out;';
            this.overlay.addEventListener('click', () => this.close());
            document.body.appendChild(this.overlay);

            this.panel = document.createElement('aside');
            this.panel.id = CONFIG.panelId;
            this.panel.setAttribute('aria-label', 'Dossier de Mission');
            this.panel.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:min(100vw,560px);background:#0f172a;color:#f8fafc;box-shadow:-8px 0 30px rgba(0,0,0,0.35);z-index:99999;display:none;flex-direction:column;transform:translateX(100%);transition:transform 0.25s cubic-bezier(0.16,1,0.3,1);border-left:1px solid rgba(255,255,255,0.1);';

            this.panel.appendChild(this.createHeader());

            const content = document.createElement('div');
            content.id = 'dossier-treeview-content';
            content.setAttribute('role', 'tree');
            content.style.cssText = 'flex:1;overflow-y:auto;padding:16px;';
            this.panel.appendChild(content);

            document.body.appendChild(this.panel);
        }

        createHeader() {
            const header = document.createElement('div');
            header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.1);';

            const title = document.createElement('div');
            title.innerHTML = '<h2 style="margin:0;font-size:16px;font-weight:600;color:#fff;">Dossier de Mission</h2><p style="margin:2px 0 0;font-size:12px;color:#94a3b8;">Structure d\\'audit interne</p>';

            const actions = document.createElement('div');
            actions.style.cssText = 'display:flex;gap:8px;';

            const refreshBtn = document.createElement('button');
            refreshBtn.type = 'button';
            refreshBtn.textContent = 'Actualiser';
            refreshBtn.style.cssText = 'padding:6px 12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#f8fafc;border-radius:6px;cursor:pointer;font-size:12px;';
            refreshBtn.addEventListener('click', () => this.refreshContent());

            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.textContent = 'Fermer';
            closeBtn.style.cssText = 'padding:6px 12px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#cbd5e1;border-radius:6px;cursor:pointer;font-size:12px;';
            closeBtn.addEventListener('click', () => this.close());

            actions.append(refreshBtn, closeBtn);
            header.append(title, actions);
            return header;
        }

        open() {
            if (this.isOpen) return;
            this.overlay.style.display = 'block';
            this.panel.style.display = 'flex';
            requestAnimationFrame(() => {
                this.overlay.style.opacity = '1';
                this.panel.style.transform = 'translateX(0)';
            });
            this.isOpen = true;
            this.refreshContent();
            this.escapeHandler = (e) => { if (e.key === 'Escape') this.close(); };
            document.addEventListener('keydown', this.escapeHandler);
        }

        close() {
            if (!this.isOpen) return;
            this.overlay.style.opacity = '0';
            this.panel.style.transform = 'translateX(100%)';
            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.panel.style.display = 'none';
            }, 250);
            this.isOpen = false;
            if (this.escapeHandler) document.removeEventListener('keydown', this.escapeHandler);
        }

        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        analyzeMessages() {
            this.classifiedMessages.clear();
            const containers = document.querySelectorAll('[data-role="assistant"], [class*="message"], [class*="assistant"], .prose, .markdown-body');
            const seenTables = new Set();

            containers.forEach((container) => {
                if (container.closest('[data-role="user"]') || container.classList.contains('user-message')) return;
                container.querySelectorAll('table').forEach((table) => {
                    if (seenTables.has(table)) return;
                    seenTables.add(table);
                    const data = this.extractMessageData(table, container);
                    if (!data) return;
                    const rubriqueId = this.classifyMessage(data);
                    if (!this.classifiedMessages.has(rubriqueId)) this.classifiedMessages.set(rubriqueId, []);
                    this.classifiedMessages.get(rubriqueId).push({ ...data, id: \`tbl-\${seenTables.size}-\${rubriqueId}\`, element: table });
                });
            });
        }

        extractMessageData(table, container) {
            const data = { etapeMission: '', norme: '', methode: '', reference: '' };
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length > 1) {
                const headers = Array.from(rows[0].querySelectorAll('th, td'));
                const values = Array.from(rows[1].querySelectorAll('td, th'));
                headers.forEach((cell, idx) => {
                    const h = cell.textContent.trim().toLowerCase();
                    const v = values[idx]?.textContent.trim() || '';
                    if (h.includes('etape de mission') || h.includes('étape de mission')) data.etapeMission ||= v;
                    if (h.includes('norme')) data.norme ||= v;
                    if (h.includes('méthode') || h.includes('methode')) data.methode ||= v;
                    if (h.includes('reference') || h.includes('référence')) data.reference ||= v;
                });
            }
            if (!data.etapeMission && !data.reference && !data.norme) {
                const text = (table.textContent + ' ' + container.textContent).toLowerCase();
                for (const kw of Object.keys(KEYWORD_MAPPING).sort((a, b) => b.length - a.length)) {
                    if (text.includes(kw)) { data.etapeMission = kw; break; }
                }
            }
            return (data.etapeMission || data.reference || data.norme) ? data : null;
        }

        classifyMessage(data) {
            const haystack = \`\${data.etapeMission} \${data.reference} \${data.norme} \${data.methode}\`.toLowerCase();
            const sorted = Object.entries(KEYWORD_MAPPING).sort(([a], [b]) => b.length - a.length);
            for (const [kw, id] of sorted) {
                if (haystack.includes(kw.toLowerCase())) return id;
            }
            return 'donnees-externes';
        }

        refreshContent() {
            this.analyzeMessages();
            const content = document.getElementById('dossier-treeview-content');
            if (!content) return;
            content.innerHTML = '';
            STRUCTURE_DOSSIER.forEach((node) => content.appendChild(this.renderTreeNode(node, 0)));
        }

        renderTreeNode(node, level) {
            const wrapper = document.createElement('div');
            const hasChildren = Boolean(node.children?.length);
            const isExpanded = this.expandedNodes.has(node.id);
            const messages = this.classifiedMessages.get(node.id) || [];
            const checkState = this.getNodeCheckState(node);

            const row = document.createElement('div');
            row.setAttribute('role', 'treeitem');
            if (hasChildren) row.setAttribute('aria-expanded', String(isExpanded));
            row.style.cssText = \`display:flex;align-items:center;width:100%;padding:6px 8px 6px \${level * 16 + 8}px;border-radius:6px;color:#f8fafc;font-size:13px;gap:8px;\`;

            const chevron = document.createElement('button');
            chevron.type = 'button';
            chevron.textContent = hasChildren ? (isExpanded ? '▾' : '▸') : '';
            chevron.style.cssText = 'width:16px;background:transparent;border:none;color:#94a3b8;font-size:11px;cursor:pointer;padding:0;flex-shrink:0;';
            if (hasChildren) {
                chevron.addEventListener('click', () => {
                    if (CONFIG.accordionSingleMode && level === 0) {
                        STRUCTURE_DOSSIER.forEach((n) => n.id !== node.id && this.expandedNodes.delete(n.id));
                    }
                    isExpanded ? this.expandedNodes.delete(node.id) : this.expandedNodes.add(node.id);
                    this.refreshContent();
                });
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = checkState === 'checked';
            checkbox.indeterminate = checkState === 'indeterminate';
            checkbox.setAttribute('aria-label', \`Sélectionner \${node.label}\`);
            checkbox.style.cssText = 'width:15px;height:15px;accent-color:#2563eb;cursor:pointer;flex-shrink:0;';
            checkbox.addEventListener('change', () => this.toggleNodeCheck(node));

            const label = document.createElement('button');
            label.type = 'button';
            label.textContent = node.label;
            label.style.cssText = 'flex:1;text-align:left;background:transparent;border:none;color:inherit;font-size:13px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0;';
            label.addEventListener('click', () => {
                if (hasChildren) chevron.click();
            });

            row.append(chevron, checkbox, label);
            if (messages.length > 0) {
                const count = document.createElement('span');
                count.textContent = String(messages.length);
                count.style.cssText = 'font-variant-numeric:tabular-nums;font-size:12px;color:#60a5fa;font-weight:600;';
                row.appendChild(count);
            }
            wrapper.appendChild(row);

            if (messages.length > 0 && (!hasChildren || isExpanded)) {
                messages.forEach((msg) => {
                    const itemRow = document.createElement('div');
                    itemRow.style.cssText = \`display:flex;align-items:center;gap:8px;margin-left:\${(level + 1) * 16 + 8}px;padding:5px 8px;background:rgba(255,255,255,0.04);border-radius:5px;margin-top:2px;\`;
                    const itemCb = document.createElement('input');
                    itemCb.type = 'checkbox';
                    itemCb.checked = this.checkedIds.has(msg.id);
                    itemCb.style.cssText = 'width:14px;height:14px;accent-color:#2563eb;cursor:pointer;flex-shrink:0;';
                    itemCb.addEventListener('change', () => {
                        this.checkedIds.has(msg.id) ? this.checkedIds.delete(msg.id) : this.checkedIds.add(msg.id);
                        this.refreshContent();
                    });
                    const itemBtn = document.createElement('button');
                    itemBtn.type = 'button';
                    itemBtn.textContent = msg.etapeMission || msg.reference || 'Table';
                    itemBtn.style.cssText = 'flex:1;text-align:left;background:transparent;border:none;color:#cbd5e1;font-size:12px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0;';
                    itemBtn.addEventListener('click', () => {
                        msg.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        msg.element.style.outline = '2px solid #3b82f6';
                        setTimeout(() => { msg.element.style.outline = ''; }, 2000);
                    });
                    itemRow.append(itemCb, itemBtn);
                    wrapper.appendChild(itemRow);
                });
            }

            if (hasChildren && isExpanded) {
                node.children.forEach((child) => wrapper.appendChild(this.renderTreeNode(child, level + 1)));
            }
            return wrapper;
        }

        attachEventListeners() {
            document.addEventListener('click', (e) => {
                if (e.target.closest('[data-page="dossier"]')) {
                    e.preventDefault();
                    this.toggle();
                }
            });
            document.addEventListener('dossier:toggle', () => this.toggle());
        }
    }

    const boot = () => {
        window.dossierMissionMenu = new DossierMissionMenu();
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();`;
