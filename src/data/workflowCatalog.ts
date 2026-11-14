import {
  ClientSessionConfig,
  WorkflowCategoryMeta,
  WorkflowNatureId,
  WorkflowTreeNode,
} from '../types/workflow';
import { cloneNodeWithFreshIds } from '../utils/workflowTreeOps';
import {
  DOC_MISSION_CARTOGRAPHIES,
  EX_AUDIT_100_GROUPS,
  EX_CAC_2026_GROUPS,
  EXAMEN_CIA_2026_GROUPS,
  MANUEL_AUDIT_AXE0_CHAPTERS,
  MANUEL_AUDIT_AXE5_CHAPTERS,
  MANUEL_AUDIT_AXE6_CHAPTERS,
  MANUEL_AUDIT_AXE9_24_CHAPTERS,
  MANUEL_PROC_CAC_2026_GROUPS,
  ManuelChapterSpec,
  PERM_AUDIT_100_GROUPS,
  SERVICE_AUDIT_100_GROUPS,
  SUIVI_RECOS_SECTIONS_2026,
  buildCategoryTreeNodes,
  wrapDocsForScope,
} from './workflowDemoData';

export const INITIAL_CLIENT_SESSION: ClientSessionConfig = {
  client: 'Banque Atlantique UMOA',
  email: 'ohada.finance@gmail.com',
  userSignature: 'OHA',
  userApiKey: 'usr_live_ba_umoa_94a2f7',
  teamApiKey: 'team_live_ba_umoa_38c1e9',
  userWorkflowVisible: true,
  teamWorkflowVisible: true,
};

export const WORKFLOW_SIDEBAR_ITEMS: WorkflowCategoryMeta[] = [
  {
    id: 'perm-audit',
    label: 'Workflow Dossier permanent - Audit',
    shortLabel: 'Permanent Audit',
    iconKey: 'folder-lock',
    subItems: [
      { id: 'sm-perm-id', label: '1. Identification de la cible (01–08)', targetNodeSuffix: '2025-perm-audit-act-id' },
      { id: 'sm-perm-legal', label: '2. Cadre légal et réglementaire (09–16)', targetNodeSuffix: '2025-perm-audit-act-legal' },
      { id: 'sm-perm-proc', label: '3. Description du processus (17–30)', targetNodeSuffix: '2025-perm-audit-act-proc' },
      { id: 'sm-perm-ci', label: '4. Contrôle interne (31–40)', targetNodeSuffix: '2025-perm-audit-act-ci' },
      { id: 'sm-perm-risques', label: '5. Risques & incidents (41–50)', targetNodeSuffix: '2025-perm-audit-act-risques' },
      { id: 'sm-perm-si', label: '6. Systèmes d’information (51–58)', targetNodeSuffix: '2025-perm-audit-act-si' },
      { id: 'sm-perm-hist', label: '7-8. Historique & Contrôles externes (59–75)', targetNodeSuffix: '2025-perm-audit-act-hist' },
      { id: 'sm-perm-outils', label: '9-12. Indicateurs, Outils & Gestion (76–100)', targetNodeSuffix: '2025-perm-audit-act-outils' },
    ],
  },
  {
    id: 'ex-audit',
    label: 'Workflow Dossier exercice - Audit',
    shortLabel: 'Exercice Audit',
    iconKey: 'briefcase',
    subItems: [
      { id: 'sm-ex-2026', label: 'Exercice 2026 · Missions & 100 docs (01–100)', targetNodeSuffix: '2026-ex-audit' },
      { id: 'sm-ex-2026-cadrage', label: 'Préparation & Cadrage 2026 (09–62)', targetNodeSuffix: '2026-ea100-cadrage' },
      { id: 'sm-ex-2026-travaux', label: 'Réalisation, Travaux & Constats (63–91)', targetNodeSuffix: '2026-ea100-travaux' },
      { id: 'sm-ex-2025', label: 'Exercice 2025 (Trésorerie, Vente, Fraude)', targetNodeSuffix: '2025-ex-audit' },
      { id: 'sm-ex-2024', label: 'Exercice 2024 (Archives & Clôture)', targetNodeSuffix: '2024-ex-audit' },
    ],
  },
  {
    id: 'suivi-recos',
    label: 'Workflow Suivi recos',
    shortLabel: 'Suivi Recos',
    iconKey: 'list-checks',
    subItems: [
      { id: 'sm-recos-relance', label: '2026 · Sections 6.1 à 6.10 & KPI', targetNodeSuffix: '2026-suivi-recos' },
      { id: 'sm-recos-base', label: '2025 · Base consolidée & Preuves', targetNodeSuffix: '2025-suivi-recos' },
    ],
  },
  {
    id: 'perm-cac',
    label: 'Workflow Dossier permanent - CAC',
    shortLabel: 'Permanent CAC',
    iconKey: 'shield-check',
    subItems: [
      { id: 'sm-pcac-ci', label: '2026 · Dossier permanent CAC complet (100 docs)', targetNodeSuffix: '2026-perm-cac' },
      { id: 'sm-pcac-id', label: '2025 · Statuts OHADA & Coordination CAC', targetNodeSuffix: '2025-perm-cac' },
    ],
  },
  {
    id: 'ex-cac',
    label: 'Workflow Dossier exercice - CAC',
    shortLabel: 'Exercice CAC',
    iconKey: 'file-spreadsheet',
    subItems: [
      { id: 'sm-ecac-2026', label: 'Exercice 2026 · Cycles SYSCOHADA', targetNodeSuffix: '2026-ex-cac' },
      { id: 'sm-ecac-2025', label: 'Exercice 2025 · Seuil & Circularisations', targetNodeSuffix: '2025-ex-cac' },
      { id: 'sm-ecac-2024', label: 'Exercice 2024 · Rapports généraux', targetNodeSuffix: '2024-ex-cac' },
    ],
  },
  {
    id: 'manuel-proc-cac',
    label: 'Workflow Manuel procédure - CAC',
    shortLabel: 'Procédure CAC',
    iconKey: 'book-open',
    subItems: [
      { id: 'sm-mpcac-subst', label: '2026 · Tests substance SYSCOHADA & ISA', targetNodeSuffix: '2026-manuel-proc-cac' },
      { id: 'sm-mpcac-cycles', label: '2025 · Cycles & Contrôles clés', targetNodeSuffix: '2025-manuel-proc-cac' },
    ],
  },
  {
    id: 'manuel-audit',
    label: 'Workflow Manuel audit - CAC',
    shortLabel: 'Manuel Audit',
    iconKey: 'book-marked',
    subItems: [
      { id: 'sm-ma-cadre', label: 'Ch. 0–4 · Cadre, Charte, Cartographie & Plan', targetNodeSuffix: '2026-manuel-audit-ch0' },
      { id: 'sm-ma-mission', label: 'Ch. 5 · Conduite des missions (5.1 à 5.3.4)', targetNodeSuffix: '2026-manuel-audit-ch5' },
      { id: 'sm-ma-qualite', label: 'Ch. 6–8 · Suivi, Comité d’audit & Qualité', targetNodeSuffix: '2026-manuel-audit-ch6' },
      { id: 'sm-ma-theme', label: 'Ch. 9–24 · Méthodologie, Bancaire & Annexes', targetNodeSuffix: '2026-manuel-audit-ch12' },
    ],
  },
  {
    id: 'service-audit',
    label: 'Workflow Service audit interne',
    shortLabel: 'Service Audit',
    iconKey: 'building-2',
    subItems: [
      { id: 'sm-sa-mandat', label: 'Mandat, Statuts & Gouvernance (01–17)', targetNodeSuffix: '2026-service-audit-mandat' },
      { id: 'sm-sa-ethique', label: 'Éthique & Déontologie (18–24)', targetNodeSuffix: '2026-service-audit-ethique' },
      { id: 'sm-sa-strat', label: 'Stratégie, Plan & Ressources (25–44)', targetNodeSuffix: '2026-service-audit-strat' },
      { id: 'sm-sa-meth', label: 'Méthodologie, Modèles & Orga (45–80)', targetNodeSuffix: '2026-service-audit-meth' },
      { id: 'sm-sa-qaip', label: 'Recos, Assurance qualité & Veille (81–100)', targetNodeSuffix: '2026-service-audit-qaip' },
    ],
  },
  {
    id: 'examen-cia',
    label: 'Workflow Examen CIA',
    shortLabel: 'Examen CIA',
    iconKey: 'graduation-cap',
    subItems: [
      { id: 'sm-cia-p2', label: '2026 · CIA Partie 2 & Partie 3', targetNodeSuffix: '2026-examen-cia' },
      { id: 'sm-cia-p1', label: '2025 · CIA Partie 1 (Fondamentaux)', targetNodeSuffix: '2025-examen-cia' },
    ],
  },
  {
    id: 'doc-mission',
    label: 'Workflow Document mission & Cartographies',
    shortLabel: 'Mission & Carto',
    iconKey: 'git-branch',
    subItems: [
      { id: 'sm-dm-prep', label: 'Phases de mission (Prépa, Réalisation, Concl.)', targetNodeSuffix: '2026-doc-mission-phases' },
      { id: 'sm-dm-carto', label: '6 Cartographies (Processus, Risques, Recos...)', targetNodeSuffix: '2026-doc-mission-carto' },
    ],
  },
];

function buildManuelChapters(
  prefix: 'user' | 'team',
  docIdPrefix: string,
  chapters: ManuelChapterSpec[]
): WorkflowTreeNode[] {
  return chapters.map((ch, idx) => ({
    id: `${prefix}-${docIdPrefix}-${ch.idSuffix}`,
    label: ch.label,
    nodeType: 'sous-section',
    natureId: 'manuel-audit',
    children: wrapDocsForScope(
      prefix,
      `${docIdPrefix}-${ch.idSuffix}`,
      'manuel-audit',
      ch.sections.map((sec) => ({
        id: `${docIdPrefix}-${ch.idSuffix}-${sec.code.replace(/[^a-z0-9]/gi, '')}`,
        label: sec.label,
      })),
      idx
    ),
  }));
}

function buildExerciceFirstTrees(prefix: 'user' | 'team'): WorkflowTreeNode[] {
  // -------------------------------------------------------------------------
  // EXERCICE 2026
  // -------------------------------------------------------------------------
  const exercice2026Workflows: WorkflowTreeNode[] = [
    {
      id: `${prefix}-2026-ex-audit`,
      label: 'Workflow Dossier exercice - Audit',
      nodeType: 'nature',
      natureId: 'ex-audit',
      children: [
        {
          id: `${prefix}-2026-ex-audit-tresorerie`,
          label: 'Audit trésorerie',
          nodeType: 'section',
          natureId: 'ex-audit',
          children: wrapDocsForScope(prefix, '26-ea-tres', 'ex-audit', [
            { id: 'ea26-a29', label: 'A29 - Caisse & contrôle inopiné', sig: 'SEK' },
            { id: 'ea26-lm', label: '15. Lettre de mission Trésorerie 2026 (13.1)', sig: 'SEK' },
            { id: 'ea26-fc', label: '63. Feuille couverture — Rapprochements bancaires', sig: 'JFK' },
            { id: 'ea26-pv', label: '69. PV de comptage coffre & encaisse 2026', sig: 'TAK' },
          ]),
        },
        {
          id: `${prefix}-2026-ex-audit-vente`,
          label: 'Audit vente',
          nodeType: 'section',
          natureId: 'ex-audit',
          children: wrapDocsForScope(prefix, '26-ea-vente', 'ex-audit', [
            { id: 'ea26-v-risk', label: '38. Cartographie des risques Cycle Ventes 2026 (13.2)', sig: 'TAK' },
            { id: 'ea26-v-test', label: '65. Feuille de tests substance facturation & cut-off', sig: 'JFK' },
          ]),
        },
        {
          id: `${prefix}-2026-ex-audit-fraude`,
          label: 'Audit fraude',
          nodeType: 'section',
          natureId: 'ex-audit',
          children: wrapDocsForScope(prefix, '26-ea-fraude', 'ex-audit', [
            { id: 'ea26-f-caat', label: '72. Plan de tests analytiques CAATs (doublons, séquences)', sig: 'SEK' },
            { id: 'ea26-f-alerte', label: '77. Tests des indicateurs de fraude & signaux d’alerte', sig: 'OHA' },
          ]),
        },
        ...buildCategoryTreeNodes(prefix, 'ex-audit', '2026-ea100', EX_AUDIT_100_GROUPS),
      ],
    },
    {
      id: `${prefix}-2026-perm-audit`,
      label: 'Workflow Dossier permanent - Audit',
      nodeType: 'nature',
      natureId: 'perm-audit',
      children: buildCategoryTreeNodes(prefix, 'perm-audit', '2026-pa-upd', [
        {
          slug: 'maj-id',
          label: 'Actualisation 2026 · Identification & Gouvernance',
          nodeType: 'activite',
          docs: [
            { no: '01', label: '01. Fiche signalétique actualisée Banque Atlantique UMOA (2026)' },
            { no: '03', label: '03. Organigramme hiérarchique & fonctionnel révisé (T1 2026)' },
            { no: '07', label: '07. Historique des réorganisations & nouvelles agences 2026' },
          ],
        },
        {
          slug: 'maj-ci',
          label: 'Actualisation 2026 · Contrôle interne & Risques',
          nodeType: 'activite',
          docs: [
            { no: '36', label: '36. Tableau des délégations de pouvoirs & plafonds 2026' },
            { no: '41', label: '41. Extrait actualisé de la cartographie des risques 2026' },
            { no: '49', label: '49. Registre des risques acceptés par la direction 2026 (11.5)' },
          ],
        },
        {
          slug: 'maj-si',
          label: 'Actualisation 2026 · SI & Gestion du dossier',
          nodeType: 'activite',
          docs: [
            { no: '52', label: '52. Matrice des droits d’accès Core Banking révisée 2026' },
            { no: '97', label: '97. Fiche de mise à jour annuelle du dossier permanent' },
            { no: '100', label: '100. Checklist revue annuelle & validation DAI (2026)' },
          ],
        },
      ]),
    },
    {
      id: `${prefix}-2026-suivi-recos`,
      label: 'Workflow Suivi recos',
      nodeType: 'nature',
      natureId: 'suivi-recos',
      children: buildCategoryTreeNodes(prefix, 'suivi-recos', '2026-sr', SUIVI_RECOS_SECTIONS_2026),
    },
    {
      id: `${prefix}-2026-perm-cac`,
      label: 'Workflow Dossier permanent - CAC',
      nodeType: 'nature',
      natureId: 'perm-cac',
      children: buildCategoryTreeNodes(prefix, 'perm-cac', '2026-pcac100', PERM_AUDIT_100_GROUPS),
    },
    {
      id: `${prefix}-2026-ex-cac`,
      label: 'Workflow Dossier exercice - CAC',
      nodeType: 'nature',
      natureId: 'ex-cac',
      children: buildCategoryTreeNodes(prefix, 'ex-cac', '2026-ecac', EX_CAC_2026_GROUPS),
    },
    {
      id: `${prefix}-2026-manuel-proc-cac`,
      label: 'Workflow Manuel procédure - CAC',
      nodeType: 'nature',
      natureId: 'manuel-proc-cac',
      children: buildCategoryTreeNodes(
        prefix,
        'manuel-proc-cac',
        '2026-mpcac',
        MANUEL_PROC_CAC_2026_GROUPS
      ),
    },
    {
      id: `${prefix}-2026-manuel-audit`,
      label: 'Workflow Manuel audit - CAC',
      nodeType: 'nature',
      natureId: 'manuel-audit',
      children: [
        {
          id: `${prefix}-2026-manuel-audit-ch0`,
          label: 'Ch. 0–4 · Cadre, Mise en place, Charte, Cartographie & Plan',
          nodeType: 'section',
          natureId: 'manuel-audit',
          children: buildManuelChapters(prefix, '2026-ma-a0', MANUEL_AUDIT_AXE0_CHAPTERS),
        },
        {
          id: `${prefix}-2026-manuel-audit-ch5`,
          label: 'Ch. 5 · Conduite des missions (Préparation, Réalisation, Conclusion)',
          nodeType: 'section',
          natureId: 'manuel-audit',
          children: buildManuelChapters(prefix, '2026-ma-a5', MANUEL_AUDIT_AXE5_CHAPTERS),
        },
        {
          id: `${prefix}-2026-manuel-audit-ch6`,
          label: 'Ch. 6–8 · Suivi recos, Comité d’audit & Qualité',
          nodeType: 'section',
          natureId: 'manuel-audit',
          children: buildManuelChapters(prefix, '2026-ma-a6', MANUEL_AUDIT_AXE6_CHAPTERS),
        },
        {
          id: `${prefix}-2026-manuel-audit-ch12`,
          label: 'Ch. 9–24 · Méthodologie, Audits thématiques bancaires & Annexes',
          nodeType: 'section',
          natureId: 'manuel-audit',
          children: buildManuelChapters(prefix, '2026-ma-a9', MANUEL_AUDIT_AXE9_24_CHAPTERS),
        },
      ],
    },
    {
      id: `${prefix}-2026-service-audit`,
      label: 'Workflow Service audit interne',
      nodeType: 'nature',
      natureId: 'service-audit',
      children: buildCategoryTreeNodes(
        prefix,
        'service-audit',
        '2026-sa',
        SERVICE_AUDIT_100_GROUPS,
        {
          mandat: '2026-service-audit-mandat',
          ethique: '2026-service-audit-ethique',
          strat: '2026-service-audit-strat',
          meth: '2026-service-audit-meth',
          qaip: '2026-service-audit-qaip',
        }
      ),
    },
    {
      id: `${prefix}-2026-examen-cia`,
      label: 'Workflow Examen CIA',
      nodeType: 'nature',
      natureId: 'examen-cia',
      children: buildCategoryTreeNodes(prefix, 'examen-cia', '2026-cia', EXAMEN_CIA_2026_GROUPS),
    },
    {
      id: `${prefix}-2026-doc-mission`,
      label: 'Workflow Document mission & Cartographies',
      nodeType: 'nature',
      natureId: 'doc-mission',
      children: [
        {
          id: `${prefix}-2026-doc-mission-phases`,
          label: 'Phases de mission',
          nodeType: 'section',
          natureId: 'doc-mission',
          children: [
            {
              id: `${prefix}-2026-dm-prep`,
              label: 'Phase de préparation',
              nodeType: 'sous-section',
              natureId: 'doc-mission',
              children: wrapDocsForScope(prefix, '26-dm-p', 'doc-mission', [
                { id: 'dm26-lm', label: '01. Lettre de mission & Avis d’audit (Norme 13.1)', sig: 'SEK' },
                { id: 'dm26-qpc', label: '02. Questionnaire de prise de connaissance (QPC) & Entretiens', sig: 'JFK' },
                { id: 'dm26-flow', label: '03. Flowchart (Outil III) & Test de cheminement (Outil V)', sig: 'TAK' },
                { id: 'dm26-risk', label: '04. Cartographie des risques mission & Référentiel CI (Outils VI-VII)', sig: 'SEK' },
                { id: 'dm26-qci', label: '05. Questionnaire de contrôle interne — QCI (Outil IX)', sig: 'JFK' },
                { id: 'dm26-ro', label: '06. Rapport d’orientation & Objectifs spécifiques (13.3)', sig: 'OHA' },
                { id: 'dm26-pt', label: '07. Le programme de travail — Norme 13.6 (Programme-001)', sig: 'SEK' },
              ]),
            },
            {
              id: `${prefix}-2026-dm-real`,
              label: 'Phase de réalisation',
              nodeType: 'sous-section',
              natureId: 'doc-mission',
              children: wrapDocsForScope(prefix, '26-dm-r', 'doc-mission', [
                { id: 'dm26-fc', label: '08. Feuille couverture — Tests de conformité & substance (CTR)', sig: 'JFK' },
                { id: 'dm26-pv', label: '09. PV d’inventaire inopiné & observations physiques (Outil XIV)', sig: 'TAK' },
                { id: 'dm26-caat', label: '10. Extractions Core Banking & analyses CAATs (Outil XVI)', sig: 'SEK' },
                { id: 'dm26-rev', label: '11. Notes de revue superviseur & validation des preuves (12.3, 14.1)', sig: 'OHA' },
              ]),
            },
            {
              id: `${prefix}-2026-dm-conc`,
              label: 'Phase de conclusion',
              nodeType: 'sous-section',
              natureId: 'doc-mission',
              children: wrapDocsForScope(prefix, '26-dm-c', 'doc-mission', [
                { id: 'dm26-frap', label: '12. LA FRAP = Feuille de Révélation et d’Analyse de Problème (5C)', sig: 'TAK' },
                { id: 'dm26-rp', label: '13. Projet de rapport provisoire & validation contradictoire (11.2)', sig: 'SEK' },
                { id: 'dm26-clot', label: '14. Compte rendu réunion de clôture & réponses de l’audité', sig: 'JFK' },
                { id: 'dm26-rf', label: '15. Le rapport final, plan d’action & fiche d’archivage (14.6, 15.1)', sig: 'OHA' },
              ]),
            },
          ],
        },
        {
          id: `${prefix}-2026-doc-mission-carto`,
          label: 'Cartographies transverses (Processus, Procédures, Risques, Contrôles, Recos, Docs)',
          nodeType: 'section',
          natureId: 'doc-mission',
          children: buildCategoryTreeNodes(
            prefix,
            'doc-mission',
            '2026-dm-carto',
            DOC_MISSION_CARTOGRAPHIES
          ),
        },
      ],
    },
  ];

  // -------------------------------------------------------------------------
  // EXERCICE 2025
  // -------------------------------------------------------------------------
  const exercice2025Workflows: WorkflowTreeNode[] = [
    {
      id: `${prefix}-2025-ex-audit`,
      label: 'Workflow Dossier exercice - Audit',
      nodeType: 'nature',
      natureId: 'ex-audit',
      children: [
        {
          id: `${prefix}-2025-ex-audit-tresorerie`,
          label: 'Audit trésorerie',
          nodeType: 'section',
          natureId: 'ex-audit',
          children: wrapDocsForScope(prefix, '25-ea-tres', 'ex-audit', [
            { id: 'ea25-c100', label: 'C100-cadrage immobilisation & caisse', sig: 'SEK' },
            { id: 'ea25-pt-tr', label: '53. Programme de travail Trésorerie 2025 (13.6)', sig: 'SEK' },
            { id: 'ea25-fc-tr', label: '63. Feuille couverture — Inventaire caisse inopiné', sig: 'JFK' },
            { id: 'ea25-rap-tr', label: '60. Compte rendu réunion d’ouverture Trésorerie', sig: 'TAK' },
          ]),
        },
        {
          id: `${prefix}-2025-ex-audit-vente`,
          label: 'Audit vente',
          nodeType: 'section',
          natureId: 'ex-audit',
          children: wrapDocsForScope(prefix, '25-ea-vente', 'ex-audit', [
            { id: 'ea25-v-qci', label: '29. Questionnaire de contrôle interne — Cycle Ventes 2025', sig: 'SEK' },
            { id: 'ea25-v-walk', label: '30. Test de cheminement facturation & encaissement', sig: 'JFK' },
            { id: 'ea25-v-rev', label: '80. Notes de revue superviseur — Ventes', sig: 'TAK' },
          ]),
        },
        {
          id: `${prefix}-2025-ex-audit-fraude`,
          label: 'Audit fraude',
          nodeType: 'section',
          natureId: 'ex-audit',
          children: wrapDocsForScope(prefix, '25-ea-fraude', 'ex-audit', [
            { id: 'ea25-f-sig', label: '77. Tests des indicateurs de fraude et signaux d’alerte', sig: 'SEK' },
            { id: 'ea25-b1', label: 'B1-Revue analytique & détection doublons CAATs', sig: 'JFK' },
            { id: 'ea25-f-frap', label: '86. FRAP — Fractionnement de paiements sous seuil', sig: 'TAK' },
          ]),
        },
        {
          id: `${prefix}-2025-ex-audit-synthese`,
          label: 'Conclusion & Clôture des missions 2025',
          nodeType: 'section',
          natureId: 'ex-audit',
          children: wrapDocsForScope(prefix, '25-ea-clot', 'ex-audit', [
            { id: 'ea25-rf', label: '95. Rapport final consolidé des missions 2025 (15.1)', sig: 'SEK' },
            { id: 'ea25-pa', label: '98. Plan d’action validé & suivi des recommandations 2025', sig: 'TAK' },
            { id: 'ea25-arc', label: '100. Fiche de clôture et d’archivage des dossiers 2025 (14.6)', sig: 'JFK' },
          ]),
        },
      ],
    },
    {
      id: `${prefix}-2025-perm-audit`,
      label: 'Workflow Dossier permanent - Audit',
      nodeType: 'nature',
      natureId: 'perm-audit',
      children: buildCategoryTreeNodes(
        prefix,
        'perm-audit',
        '2025-pa100',
        PERM_AUDIT_100_GROUPS,
        {
          id: '2025-perm-audit-act-id',
          legal: '2025-perm-audit-act-legal',
          proc: '2025-perm-audit-act-proc',
          ci: '2025-perm-audit-act-ci',
          risques: '2025-perm-audit-act-risques',
          si: '2025-perm-audit-act-si',
          hist: '2025-perm-audit-act-hist',
          ext: '2025-perm-audit-act-ext',
          data: '2025-perm-audit-act-data',
          outils: '2025-perm-audit-act-outils',
          rel: '2025-perm-audit-act-rel',
          gestion: '2025-perm-audit-act-gestion',
        }
      ),
    },
    {
      id: `${prefix}-2025-suivi-recos`,
      label: 'Workflow Suivi recos',
      nodeType: 'nature',
      natureId: 'suivi-recos',
      children: wrapDocsForScope(prefix, '25-sr', 'suivi-recos', [
        { id: 'sr25-1', label: '6.2 Fichier consolidé de suivi des recos 2025 (P1/P2/P3)', sig: 'JFK' },
        { id: 'sr25-2', label: '6.5 Dossier de preuves et re-tests de validation 2025 (15.2)', sig: 'JFK' },
        { id: 'sr25-3', label: '6.9 Clôture & double validation des actions soldées 2025', sig: 'SEK' },
        { id: 'sr25-4', label: '6.10 KPI annuels de mise en œuvre des recommandations 2025', sig: 'TAK' },
      ]),
    },
    {
      id: `${prefix}-2025-perm-cac`,
      label: 'Workflow Dossier permanent - CAC',
      nodeType: 'nature',
      natureId: 'perm-cac',
      children: wrapDocsForScope(prefix, '25-pcac', 'perm-cac', [
        { id: 'pcac25-1', label: 'Statuts juridiques, RCCM, Kbis & PV Assemblées OHADA', sig: 'SEK' },
        { id: 'pcac25-2', label: 'Schémas comptables SYSCOHADA révisé & conventions réglementées', sig: 'SEK' },
        { id: 'pcac25-3', label: 'Lettre de mission CAC & plan de coordination audit (9.5)', sig: 'JFK' },
      ]),
    },
    {
      id: `${prefix}-2025-ex-cac`,
      label: 'Workflow Dossier exercice - CAC',
      nodeType: 'nature',
      natureId: 'ex-cac',
      children: wrapDocsForScope(prefix, '25-ecac', 'ex-cac', [
        { id: 'ecac25-seuil', label: 'Note de seuil de signification & plan de mission 2025', sig: 'SEK' },
        { id: 'ecac25-circ', label: 'Circularisations banques, clients & fournisseurs 2025', sig: 'SEK' },
        { id: 'ecac25-rap', label: 'Rapport général & rapport spécial CAC exercice 2025', sig: 'JFK' },
      ]),
    },
    {
      id: `${prefix}-2025-manuel-proc-cac`,
      label: 'Workflow Manuel procédure - CAC',
      nodeType: 'nature',
      natureId: 'manuel-proc-cac',
      children: wrapDocsForScope(prefix, '25-mpcac', 'manuel-proc-cac', [
        { id: 'mpcac25-1', label: 'Procédure contrôle des comptes Immobilisations & Amortissements', sig: 'TAK' },
        { id: 'mpcac25-2', label: 'Procédure cut-off Achats / Ventes & Provisions réglementées', sig: 'TAK' },
      ]),
    },
    {
      id: `${prefix}-2025-service-audit`,
      label: 'Workflow Service audit interne',
      nodeType: 'nature',
      natureId: 'service-audit',
      children: wrapDocsForScope(prefix, '25-sa', 'service-audit', [
        { id: 'sa25-charte', label: '01. Charte d’audit interne révisée 2025 (6.2)', sig: 'SEK' },
        { id: 'sa25-plan', label: '30. Plan annuel d’audit approuvé 2025 (9.4)', sig: 'JFK' },
        { id: 'sa25-qaip', label: '88. Rapport d’évaluation interne de la qualité 2025 (12.1)', sig: 'TAK' },
      ]),
    },
    {
      id: `${prefix}-2025-examen-cia`,
      label: 'Workflow Examen CIA',
      nodeType: 'nature',
      natureId: 'examen-cia',
      children: wrapDocsForScope(prefix, '25-cia', 'examen-cia', [
        { id: 'cia25-1', label: 'Fiches CIA Part 1.1 — Fondamentaux, Charte, Indépendance & Objectivité', sig: 'JFK' },
        { id: 'cia25-2', label: 'Fiches CIA Part 1.2 — Gouvernance, Gestion des risques & Contrôle interne', sig: 'OHA' },
        { id: 'cia25-3', label: 'Banque de QCM CIA Part 1 — Risques de fraude & Normes CRIPP', sig: 'SEK' },
      ]),
    },
  ];

  // -------------------------------------------------------------------------
  // EXERCICE 2024
  // -------------------------------------------------------------------------
  const exercice2024Workflows: WorkflowTreeNode[] = [
    {
      id: `${prefix}-2024-ex-audit`,
      label: 'Workflow Dossier exercice - Audit',
      nodeType: 'nature',
      natureId: 'ex-audit',
      children: wrapDocsForScope(prefix, '24-ea', 'ex-audit', [
        { id: 'ea24-prep', label: '15. Lettre de mission & programme de travail archivés 2024', sig: 'SEK' },
        { id: 'ea24-frap', label: '86. Recueil des FRAP validées exercice 2024', sig: 'JFK' },
        { id: 'ea24-arc', label: '100. Fiche de clôture et archivage dossier 2024 (14.6)', sig: 'TAK' },
      ]),
    },
    {
      id: `${prefix}-2024-ex-cac`,
      label: 'Workflow Dossier exercice - CAC',
      nodeType: 'nature',
      natureId: 'ex-cac',
      children: wrapDocsForScope(prefix, '24-ecac', 'ex-cac', [
        { id: 'ecac24-rev', label: 'Dossier de révision & feuilles maîtresses SYSCOHADA 2024', sig: 'JFK' },
        { id: 'ecac24-r', label: 'Rapport général & rapport spécial CAC 2024', sig: 'TAK' },
      ]),
    },
    {
      id: `${prefix}-2024-suivi-recos`,
      label: 'Workflow Suivi recos',
      nodeType: 'nature',
      natureId: 'suivi-recos',
      children: wrapDocsForScope(prefix, '24-sr', 'suivi-recos', [
        { id: 'sr24-arc', label: '6.9 Bilan de clôture des recommandations 2024 (soldées & reportées)', sig: 'TAK' },
      ]),
    },
  ];

  return [
    {
      id: `${prefix}-ex-2024`,
      label: 'Exercice 2024',
      nodeType: 'exercice',
      children: exercice2024Workflows,
    },
    {
      id: `${prefix}-ex-2025`,
      label: 'Exercice 2025',
      nodeType: 'exercice',
      children: exercice2025Workflows,
    },
    {
      id: `${prefix}-ex-2026`,
      label: 'Exercice 2026',
      nodeType: 'exercice',
      children: exercice2026Workflows,
    },
  ];
}

export function createInitialWorkflowTrees(): WorkflowTreeNode[] {
  return [
    {
      id: 'root-workflow',
      label: 'Workflow',
      nodeType: 'root',
      children: buildExerciceFirstTrees('user'),
    },
    {
      id: 'root-team-workflow',
      label: 'Team Workflow',
      nodeType: 'root',
      children: buildExerciceFirstTrees('team'),
    },
  ];
}

export function createFullNatureWorkflowNode(
  natureId: WorkflowNatureId,
  scope: 'user' | 'team'
): WorkflowTreeNode {
  const exercices = buildExerciceFirstTrees(scope);
  const allNatures: WorkflowTreeNode[] = [];
  exercices.forEach((ex) => {
    ex.children?.forEach((wf) => {
      if (wf.nodeType === 'nature' && wf.natureId === natureId) {
        allNatures.push(wf);
      }
    });
  });

  // Choisit la version la plus riche pour cette nature (ex. perm-audit 2025 avec 12 activités / 100 docs)
  const countDescendants = (n: WorkflowTreeNode): number =>
    1 + (n.children?.reduce((sum, c) => sum + countDescendants(c), 0) ?? 0);

  const richest = allNatures.sort((a, b) => countDescendants(b) - countDescendants(a))[0];
  if (richest) {
    return cloneNodeWithFreshIds(richest);
  }

  const meta = WORKFLOW_SIDEBAR_ITEMS.find((i) => i.id === natureId);
  return {
    id: `${scope}-wf-${natureId}-${Date.now()}`,
    label: meta?.label || `Workflow ${natureId}`,
    nodeType: 'nature',
    natureId,
    children: (meta?.subItems || []).map((sm, idx) => ({
      id: `${scope}-sec-${natureId}-${idx}-${Date.now()}`,
      label: sm.label,
      nodeType: 'section',
      natureId,
      children: [],
    })),
  };
}
