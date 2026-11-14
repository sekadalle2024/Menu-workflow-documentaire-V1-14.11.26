import { AuditChatMessage, DossierTreeNode } from '../types/dossier';

export const STRUCTURE_DOSSIER: DossierTreeNode[] = [
  {
    id: 'demarrer',
    label: 'Dossier Démarrer',
    kind: 'folder',
    children: [],
  },
  {
    id: 'guide',
    label: 'Dossier Guide',
    kind: 'folder',
    children: [],
  },
  {
    id: 'exercice',
    label: 'Dossier Exercice',
    kind: 'folder',
    children: [],
  },
  {
    id: 'preparation',
    label: 'Phase de préparation',
    kind: 'folder',
    expanded: true,
    children: [
      { id: 'plan-pluriannuel', label: "Plan pluri-annuel d'audit interne", kind: 'folder' },
      { id: 'planification', label: 'Planification de la mission', kind: 'folder' },
      { id: 'lettre-mission', label: 'Lettre de mission', kind: 'folder' },
      {
        id: 'rencontre-direction',
        label: "Rencontre avec la Direction de l'entité auditée",
        kind: 'folder',
      },
      { id: 'compte-rendu', label: 'Compte rendu de la réunion', kind: 'folder' },
      { id: 'reunion-ouverture', label: "Réunion d'ouverture", kind: 'folder' },
      {
        id: 'collecte-documentaire',
        label: 'Collecte documentaire (prise de connaissance du Domaine audité)',
        kind: 'folder',
      },
      { id: 'cartographie-risques', label: 'Cartographie des risques', kind: 'folder' },
      {
        id: 'plan-approche',
        label: "Plan d'approche – référentiel de contrôle interne",
        kind: 'folder',
      },
      { id: 'qci', label: 'Questionnaire de contrôle interne', kind: 'folder' },
      { id: 'tffa', label: 'Tableau des forces et faiblesses apparentes', kind: 'folder' },
      { id: 'rapport-orientation', label: "Le rapport d'orientation", kind: 'folder' },
      {
        id: 'programme-travail',
        label: 'Le programme de travail',
        kind: 'folder',
        expanded: true,
        children: [
          { id: 'pt-etape', label: 'Etape de mission - Programme de travail', kind: 'document' },
          { id: 'pt-norme', label: 'Norme - 13.6 Programme de travail', kind: 'document' },
          {
            id: 'pt-methode',
            label: 'Méthode - Méthode des contrôles clés par les risques',
            kind: 'document',
          },
          { id: 'pt-reference', label: 'Reference - Programme-001', kind: 'document' },
        ],
      },
      {
        id: 'qci-programme',
        label: 'Le questionnaire de contrôle interne du programme de travail',
        kind: 'folder',
      },
    ],
  },
  {
    id: 'realisation',
    label: 'Phase de réalisation',
    kind: 'folder',
    expanded: true,
    children: [{ id: 'feuille-couverture', label: 'Feuille couverture', kind: 'folder' }],
  },
  {
    id: 'conclusion',
    label: 'Phase de conclusion',
    kind: 'folder',
    expanded: true,
    children: [
      {
        id: 'frap',
        label: "LA FRAP = Feuille de Révélation et d'Analyse de Problème",
        kind: 'folder',
      },
      { id: 'synthese-frap', label: 'La synthèse des FRAP', kind: 'folder' },
      { id: 'rapport-provisoire', label: 'Le rapport provisoire', kind: 'folder' },
      { id: 'reunion-cloture', label: 'La réunion de clôture', kind: 'folder' },
      { id: 'rapport-final', label: 'Le rapport final', kind: 'folder' },
    ],
  },
  {
    id: 'permanent',
    label: 'Dossier Permanent',
    kind: 'folder',
    children: [],
  },
  {
    id: 'donnees-externes',
    label: 'Données Externes',
    kind: 'folder',
    children: [],
  },
  {
    id: 'analyse-donnees',
    label: "Dossier Analyse de données",
    kind: 'folder',
    children: [],
  },
  {
    id: 'dashboard',
    label: 'Dossier Dashboard',
    kind: 'folder',
    children: [],
  },
];

export const KEYWORD_MAPPING: Record<string, string> = {
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
  'direction': 'rencontre-direction',
};

export const INITIAL_AUDIT_MESSAGES: AuditChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    author: 'Auditeur interne',
    timestamp: '09:12',
    content:
      "Génère le cadrage initial de la mission d'audit du cycle Achats-Fournisseurs : lettre de mission, cartographie des risques majeurs et programme de travail selon la norme 13.6.",
  },
  {
    id: 'msg-2',
    role: 'assistant',
    author: 'Assistant Mission Audit',
    timestamp: '09:13',
    content:
      'Voici la fiche de cadrage pour la lettre de mission validée par la Direction Générale :',
    table: {
      caption: 'Cadrage — Lettre de mission',
      headers: ['Etape de mission', 'Norme', 'Méthode', 'Reference'],
      rows: [
        [
          'Lettre de mission',
          'Norme 13.1 — Planification de la mission',
          'Mandat officiel et périmètre Achats',
          'LM-2026-04',
        ],
      ],
    },
  },
  {
    id: 'msg-3',
    role: 'assistant',
    author: 'Assistant Mission Audit',
    timestamp: '09:14',
    content:
      'La cartographie préliminaire identifie quatre zones de risques prioritaires sur la séparation des tâches et la validation des bons de commande :',
    table: {
      caption: 'Cartographie des risques — Cycle Achats',
      headers: ['Etape de mission', 'Risque identifié', 'Criticité', 'Reference'],
      rows: [
        [
          'Cartographie des risques',
          'Création fournisseur sans validation indépendante',
          'Élevée (4/5)',
          'RISK-ACH-01',
        ],
        [
          'Cartographie des risques',
          'Fractionnement de commandes sous seuil',
          'Critique (5/5)',
          'RISK-ACH-02',
        ],
      ],
    },
  },
  {
    id: 'msg-4',
    role: 'assistant',
    author: 'Assistant Mission Audit',
    timestamp: '09:16',
    content:
      'Programme de travail structuré selon la méthode des contrôles clés par les risques :',
    table: {
      caption: 'Programme de travail — Phase de préparation',
      headers: ['Etape de mission', 'Norme', 'Méthode', 'Reference'],
      rows: [
        [
          'Programme de travail',
          'Norme 13.6 Programme de travail',
          'Méthode des contrôles clés par les risques',
          'Programme-001',
        ],
      ],
    },
  },
  {
    id: 'msg-5',
    role: 'assistant',
    author: 'Assistant Mission Audit',
    timestamp: '09:19',
    content:
      "Première FRAP documentée suite aux tests de cheminement sur l'échantillon T1 :",
    table: {
      caption: 'FRAP — Absence de rapprochement tripartite',
      headers: ['Etape de mission', 'Constat', 'Norme', 'Reference'],
      rows: [
        [
          'FRAP',
          '14 % des factures réglées sans bon de réception signé',
          'Norme 14.3 Communication des résultats',
          'FRAP-2026-001',
        ],
      ],
    },
  },
];

export interface AuditTemplateOption {
  id: string;
  label: string;
  prompt: string;
  message: Omit<AuditChatMessage, 'id' | 'timestamp'>;
}

export const SAMPLE_AUDIT_TEMPLATES: AuditTemplateOption[] = [
  {
    id: 'tpl-qci',
    label: 'Questionnaire de contrôle interne (QCI)',
    prompt: 'Ajouter un QCI Achats',
    message: {
      role: 'assistant',
      author: 'Assistant Mission Audit',
      content: 'Questionnaire de contrôle interne généré pour le processus réception et facturation :',
      table: {
        caption: 'QCI — Réception & Facturation',
        headers: ['Etape de mission', 'Question de contrôle', 'Méthode', 'Reference'],
        rows: [
          [
            'Questionnaire de contrôle interne',
            'Les réceptions sont-elles rapprochées automatiquement des bons de commande ?',
            'Entretien et test de conformité',
            'QCI-ACH-07',
          ],
        ],
      },
    },
  },
  {
    id: 'tpl-tffa',
    label: 'Tableau des forces et faiblesses (TFFA)',
    prompt: 'Ajouter un TFFA',
    message: {
      role: 'assistant',
      author: 'Assistant Mission Audit',
      content: 'Synthèse des forces et faiblesses apparentes issue de la prise de connaissance :',
      table: {
        caption: 'TFFA — Gouvernance Achats',
        headers: ['Etape de mission', 'Force / Faiblesse', 'Impact', 'Reference'],
        rows: [
          [
            'Tableau des forces et faiblesses apparentes',
            'Faiblesse : délégations de signature non mises à jour',
            'Risque de dépassement de budget',
            'TFFA-003',
          ],
        ],
      },
    },
  },
  {
    id: 'tpl-feuille',
    label: 'Feuille couverture (Réalisation)',
    prompt: 'Ajouter une Feuille couverture',
    message: {
      role: 'assistant',
      author: 'Assistant Mission Audit',
      content: 'Feuille couverture associée au test de validation des factures fournisseurs :',
      table: {
        caption: 'Feuille couverture — Test FT-04',
        headers: ['Etape de mission', 'Objectif du test', 'Méthode', 'Reference'],
        rows: [
          [
            'Feuille couverture',
            'Vérifier la double signature au-delà de 15 000 €',
            'Échantillonnage stratifié (30 pièces)',
            'FC-REAL-004',
          ],
        ],
      },
    },
  },
  {
    id: 'tpl-rapport-provisoire',
    label: 'Rapport provisoire (Conclusion)',
    prompt: 'Ajouter un Rapport provisoire',
    message: {
      role: 'assistant',
      author: 'Assistant Mission Audit',
      content: 'Projet de rapport provisoire transmis aux audités pour recueil des plans d’action :',
      table: {
        caption: 'Rapport provisoire — Mission Achats',
        headers: ['Etape de mission', 'Norme', 'Statut', 'Reference'],
        rows: [
          [
            'Rapport provisoire',
            'Norme 14.5 Rapport final et suivi',
            'Soumis pour commentaires audités',
            'RP-2026-V1',
          ],
        ],
      },
    },
  },
];
