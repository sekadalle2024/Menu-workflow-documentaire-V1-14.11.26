import { WorkflowNatureId, WorkflowTreeNode } from '../types/workflow';

export interface DemoCategoryGroup {
  slug: string;
  label: string;
  nodeType: 'activite' | 'section' | 'sous-section';
  sigOffset?: number;
  docs: Array<{ no: number | string; label: string }>;
}

const TEAM_SIGNATURES = ['SEK', 'JFK', 'TAK', 'OHA'] as const;

export function makeDocNode(
  prefix: 'user' | 'team',
  id: string,
  label: string,
  natureId: WorkflowNatureId,
  signature?: string
): WorkflowTreeNode {
  return {
    id: `${prefix}-${id}`,
    label,
    nodeType: 'document',
    natureId,
    signature,
    driveId: `1drv_${id.replace(/[^a-z0-9]/gi, '')}_${prefix === 'team' ? 'tm' : 'pr'}`,
    owner: signature || 'OHA',
    ownerEmail: 'ohada.finance@gmail.com',
  };
}

export function wrapDocsForScope(
  prefix: 'user' | 'team',
  baseId: string,
  natureId: WorkflowNatureId,
  docs: Array<{ id: string; label: string; sig?: string }>,
  sigOffset = 0
): WorkflowTreeNode[] {
  const isTeam = prefix === 'team';
  if (!isTeam) {
    return docs.map((d) => makeDocNode(prefix, d.id, d.label, natureId));
  }

  const grouped = new Map<string, Array<{ id: string; label: string }>>();
  docs.forEach((d, idx) => {
    const sig = d.sig || TEAM_SIGNATURES[(idx + sigOffset) % TEAM_SIGNATURES.length];
    const bucket = grouped.get(sig) || [];
    bucket.push({ id: d.id, label: d.label });
    grouped.set(sig, bucket);
  });

  return Array.from(grouped.entries()).map(([sig, items]) => ({
    id: `${prefix}-${baseId}-sig-${sig}`,
    label: sig,
    nodeType: 'signature',
    signature: sig,
    natureId,
    children: items.map((d) => makeDocNode(prefix, d.id, d.label, natureId, sig)),
  }));
}

export function buildCategoryTreeNodes(
  prefix: 'user' | 'team',
  natureId: WorkflowNatureId,
  docIdPrefix: string,
  groups: DemoCategoryGroup[],
  fixedNodeIdMap?: Record<string, string>
): WorkflowTreeNode[] {
  return groups.map((g, gIdx) => {
    const nodeSuffix = fixedNodeIdMap?.[g.slug] ?? `${docIdPrefix}-${g.slug}`;
    return {
      id: `${prefix}-${nodeSuffix}`,
      label: g.label,
      nodeType: g.nodeType,
      natureId,
      children: wrapDocsForScope(
        prefix,
        `${docIdPrefix}-${g.slug}`,
        natureId,
        g.docs.map((d) => ({
          id: `${docIdPrefix}-${g.slug}-${String(d.no).replace(/[^a-z0-9]/gi, '')}`,
          label: typeof d.no === 'number' ? `${String(d.no).padStart(2, '0')}. ${d.label}` : d.label,
        })),
        g.sigOffset ?? gIdx
      ),
    };
  });
}

// ---------------------------------------------------------------------------
// 1. WORKFLOW DOCUMENTAIRE DOSSIER PERMANENT - AUDIT (100 documents / 12 activités)
// ---------------------------------------------------------------------------
export const PERM_AUDIT_100_GROUPS: DemoCategoryGroup[] = [
  {
    slug: 'id',
    label: 'Identification de la cible',
    nodeType: 'activite',
    docs: [
      { no: 1, label: 'Fiche signalétique de l’entité, de la direction ou du processus audité' },
      { no: 2, label: 'Fiche de positionnement dans l’univers d’audit et dans la cartographie des risques (9.1, 9.4)' },
      { no: 3, label: 'Organigramme hiérarchique et fonctionnel de la cible' },
      { no: 4, label: 'Fiches de poste des acteurs clés' },
      { no: 5, label: 'Annuaire des responsables et interlocuteurs permanents' },
      { no: 6, label: 'Liste des sites, agences, caisses et implantations rattachés' },
      { no: 7, label: 'Historique des réorganisations et des changements majeurs' },
      { no: 8, label: 'Note de présentation de la mission récurrente (finalité, périmètre, fréquence)' },
    ],
  },
  {
    slug: 'legal',
    label: 'Cadre légal et réglementaire',
    nodeType: 'activite',
    docs: [
      { no: 9, label: 'Recueil des textes légaux et réglementaires applicables (OHADA, UMOA, CIMA, sectoriels)' },
      { no: 10, label: 'Instructions de la BCEAO, de la Commission Bancaire ou de la CRCA applicables à la cible' },
      { no: 11, label: 'Politiques internes et notes de service en vigueur' },
      { no: 12, label: 'Dispositions fiscales et sociales applicables' },
      { no: 13, label: 'Dispositif de lutte contre le blanchiment et le financement du terrorisme applicable' },
      { no: 14, label: 'Registre de veille réglementaire propre à la cible' },
      { no: 15, label: 'Tableau de conformité aux textes (exigence, source, responsable, statut)' },
      { no: 16, label: 'Historique des modifications des textes et des procédures' },
    ],
  },
  {
    slug: 'proc',
    label: 'Description du processus',
    nodeType: 'activite',
    docs: [
      { no: 17, label: 'Cartographie du macro-processus et nomenclature des sous-processus' },
      { no: 18, label: 'Logigrammes (flowcharts) des sous-processus' },
      { no: 19, label: 'Narratifs ou descriptifs détaillés des processus' },
      { no: 20, label: 'Tableau des acteurs, rôles et responsabilités (RACI)' },
      { no: 21, label: 'Liste des tâches clés par sous-processus' },
      { no: 22, label: 'Liste des documents du processus et des pièces justificatives' },
      { no: 23, label: 'Modèles de formulaires et de documents types utilisés' },
      { no: 24, label: 'Liste des données d’entrée et de sortie du processus' },
      { no: 25, label: 'Liste des informations et des données clés' },
      { no: 26, label: 'Tableau des flux physiques, comptables et financiers' },
      { no: 27, label: 'Schémas comptables associés (SYSCOHADA, plan comptable bancaire ou CIMA)' },
      { no: 28, label: 'Manuel de procédures de la cible' },
      { no: 29, label: 'Tableau d’interfaces avec les autres processus et directions' },
      { no: 30, label: 'Glossaire et lexique métier de la cible' },
    ],
  },
  {
    slug: 'ci',
    label: 'Contrôle interne',
    nodeType: 'activite',
    docs: [
      { no: 31, label: 'Référentiel de contrôle interne du processus' },
      { no: 32, label: 'Liste des contrôles clés (préventifs, détectifs, correctifs)' },
      { no: 33, label: 'Liste des contrôles d’audit associés' },
      { no: 34, label: 'Matrice des tâches, risques et contrôles' },
      { no: 35, label: 'Matrice de séparation des tâches et des fonctions incompatibles' },
      { no: 36, label: 'Tableau des délégations de pouvoirs et des limites d’autorisation' },
      { no: 37, label: 'Liste des plafonds, seuils et autorisations (caisse, décaissements, signatures)' },
      { no: 38, label: 'Dispositif de contrôle permanent de premier et de deuxième niveau' },
      { no: 39, label: 'Rapports de contrôle permanent et plans de contrôle' },
      { no: 40, label: 'Questionnaire de contrôle interne (QCI) validé et ses mises à jour' },
    ],
  },
  {
    slug: 'risques',
    label: 'Risques',
    nodeType: 'activite',
    docs: [
      { no: 41, label: 'Extrait de la cartographie des risques de la cible' },
      { no: 42, label: 'Fiches de risques par sous-processus' },
      { no: 43, label: 'Échelles de cotation applicables (impact, probabilité, maîtrise)' },
      { no: 44, label: 'Liste des zones à risques et de leur historique de cotation' },
      { no: 45, label: 'Matrice des risques bruts et résiduels' },
      { no: 46, label: 'Registre des risques de fraude et signaux d’alerte propres à la cible' },
      { no: 47, label: 'Registre des incidents, anomalies et pertes opérationnelles' },
      { no: 48, label: 'Indicateurs clés de risque (KRI) et seuils d’alerte' },
      { no: 49, label: 'Registre des risques acceptés par la direction (11.5)' },
      { no: 50, label: 'Historique des évolutions de la cotation des risques par mission' },
    ],
  },
  {
    slug: 'si',
    label: 'Systèmes d’information',
    nodeType: 'activite',
    docs: [
      { no: 51, label: 'Cartographie des applications utilisées par la cible' },
      { no: 52, label: 'Matrice des droits d’accès et des profils utilisateurs' },
      { no: 53, label: 'Documentation fonctionnelle et paramétrage des applications clés' },
      { no: 54, label: 'Dictionnaire des données et structure des fichiers clés' },
      { no: 55, label: 'Liste des interfaces et des flux automatiques' },
      { no: 56, label: 'Plan de continuité et de reprise d’activité de la cible' },
      { no: 57, label: 'Procédures de sauvegarde et de gestion des habilitations' },
      { no: 58, label: 'Requêtes et extractions standard réutilisables' },
    ],
  },
  {
    slug: 'hist',
    label: 'Historique des missions',
    nodeType: 'activite',
    docs: [
      { no: 59, label: 'Registre des missions antérieures sur la cible' },
      { no: 60, label: 'Rapports d’audit antérieurs (derniers exercices)' },
      { no: 61, label: 'Lettres de mission et périmètres antérieurs' },
      { no: 62, label: 'FRAP et fiches de constat antérieures' },
      { no: 63, label: 'Programmes de travail des missions antérieures' },
      { no: 64, label: 'Synthèse des constats récurrents et tendances' },
      { no: 65, label: 'Base consolidée des recommandations émises' },
      { no: 66, label: 'Plans d’action validés par l’audité' },
      { no: 67, label: 'Tableau de suivi des recommandations et état d’avancement (15.2)' },
      { no: 68, label: 'Historique des écarts entre le plan d’action et la réalité' },
      { no: 69, label: 'Retours d’expérience et leçons des missions précédentes' },
    ],
  },
  {
    slug: 'ext',
    label: 'Contrôles externes',
    nodeType: 'activite',
    docs: [
      { no: 70, label: 'Rapports d’inspection du régulateur et réponses de l’entité' },
      { no: 71, label: 'Lettres de recommandations du commissaire aux comptes' },
      { no: 72, label: 'Rapports de l’inspection générale ou du contrôle de la maison mère' },
      { no: 73, label: 'Rapports d’experts, de consultants et de certifications (ISO, qualité)' },
      { no: 74, label: 'Suivi des recommandations externes ouvertes' },
      { no: 75, label: 'Tableau de coordination avec les autres fonctions d’assurance (9.5)' },
    ],
  },
  {
    slug: 'data',
    label: 'Données et indicateurs',
    nodeType: 'activite',
    docs: [
      { no: 76, label: 'Tableau pluriannuel des volumes d’activité et des montants' },
      { no: 77, label: 'Balances et soldes de référence des comptes de la cible' },
      { no: 78, label: 'Budgets, effectifs et coûts de la cible' },
      { no: 79, label: 'Tableau de bord des indicateurs de performance du processus' },
      { no: 80, label: 'Statistiques des anomalies, rejets et écarts (écarts de caisse, litiges)' },
      { no: 81, label: 'Données de benchmark et comparaison entre sites' },
      { no: 82, label: 'Plan comptable et comptes mouvementés par la cible' },
    ],
  },
  {
    slug: 'outils',
    label: 'Outils réutilisables de mission',
    nodeType: 'activite',
    docs: [
      { no: 83, label: 'Liste des objets auditables de la cible' },
      { no: 84, label: 'Liste des points d’audit récurrents' },
      { no: 85, label: 'Matrice des domaines, objectifs généraux et objectifs spécifiques types' },
      { no: 86, label: 'Catalogue des assertions d’audit applicables' },
      { no: 87, label: 'Questionnaire de prise de connaissance (QPC) type' },
      { no: 88, label: 'Programme de travail type et ses mises à jour' },
      { no: 89, label: 'Catalogue des tests et techniques d’audit adaptés à la cible' },
      { no: 90, label: 'Plan de sondage et paramètres d’échantillonnage de référence' },
      { no: 91, label: 'Modèles de feuilles de travail, de PV de comptage et de FRAP propres à la cible' },
    ],
  },
  {
    slug: 'rel',
    label: 'Relations et communication',
    nodeType: 'activite',
    docs: [
      { no: 92, label: 'Liste des interlocuteurs de l’audité à contacter par étape de mission' },
      { no: 93, label: 'Comptes rendus des réunions d’ouverture et de clôture antérieures' },
      { no: 94, label: 'Correspondances importantes avec l’audité et la direction' },
      { no: 95, label: 'Questionnaires de satisfaction de l’audité et suites données' },
    ],
  },
  {
    slug: 'gestion',
    label: 'Gestion du dossier',
    nodeType: 'activite',
    docs: [
      { no: 96, label: 'Sommaire et index du dossier permanent de la cible' },
      { no: 97, label: 'Fiche de mise à jour après chaque mission (ce qui a changé, date, auteur)' },
      { no: 98, label: 'Règles d’accès, de confidentialité et de conservation (5.1, 5.2)' },
      { no: 99, label: 'Journal des versions et historique des modifications du dossier' },
      { no: 100, label: 'Checklist de revue annuelle et de validation du dossier par le responsable de l’audit' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 2. WORKFLOW SERVICE AUDIT INTERNE ("Document service audit", 100 documents / 12 activités)
// ---------------------------------------------------------------------------
export const SERVICE_AUDIT_100_GROUPS: DemoCategoryGroup[] = [
  {
    slug: 'mandat',
    label: 'Mandat et cadre statutaire',
    nodeType: 'activite',
    docs: [
      { no: 1, label: 'Charte d’audit interne approuvée par le conseil (6.2)' },
      { no: 2, label: 'Mandat d’audit interne et décision de création du service (6.1)' },
      { no: 3, label: 'Procès-verbaux d’approbation et de révision périodique de la charte' },
      { no: 4, label: 'Note de soutien du conseil et de la direction générale (6.3)' },
      { no: 5, label: 'Déclaration d’indépendance organisationnelle et rattachement hiérarchique (7.1)' },
      { no: 6, label: 'Lettre de nomination et profil du responsable de l’audit interne (7.2)' },
      { no: 7, label: 'Droits d’accès aux documents, personnes, locaux et systèmes' },
      { no: 8, label: 'Textes légaux et réglementaires encadrant la fonction (UMOA, CIMA, OHADA, sectoriels)' },
    ],
  },
  {
    slug: 'gouv',
    label: 'Gouvernance et relations avec le conseil',
    nodeType: 'activite',
    docs: [
      { no: 9, label: 'Charte du comité d’audit et règlement intérieur' },
      { no: 10, label: 'Calendrier annuel des réunions du comité d’audit' },
      { no: 11, label: 'Procès-verbaux du comité d’audit relatifs à l’audit interne (8.1)' },
      { no: 12, label: 'Rapports périodiques d’activité à la gouvernance' },
      { no: 13, label: 'Rapport annuel d’activité de l’audit interne' },
      { no: 14, label: 'Organigramme de l’organisation et schéma de gouvernance (9.1)' },
      { no: 15, label: 'Tableau des délégations de pouvoirs et des limites d’autorisation' },
      { no: 16, label: 'Politique de gestion des risques et appétit au risque' },
      { no: 17, label: 'Politique d’acceptation des risques et traitement des risques non traités (11.5)' },
    ],
  },
  {
    slug: 'ethique',
    label: 'Éthique et déontologie',
    nodeType: 'activite',
    docs: [
      { no: 18, label: 'Code de déontologie de l’auditeur interne (1.1, 1.2, 1.3)' },
      { no: 19, label: 'Code d’éthique et de conduite de l’organisation' },
      { no: 20, label: 'Déclarations annuelles d’indépendance et d’objectivité des auditeurs (2.1)' },
      { no: 21, label: 'Registre des conflits d’intérêts et mesures de sauvegarde (2.2, 2.3)' },
      { no: 22, label: 'Engagements de confidentialité des auditeurs (5.2)' },
      { no: 23, label: 'Politique de classification et de protection de l’information (5.1, 5.2)' },
      { no: 24, label: 'Dispositif d’alerte professionnelle et procédure de traitement des signalements' },
    ],
  },
  {
    slug: 'strat',
    label: 'Stratégie et planification',
    nodeType: 'activite',
    docs: [
      { no: 25, label: 'Stratégie de l’audit interne alignée sur celle de l’organisation (9.2)' },
      { no: 26, label: 'Plan stratégique pluriannuel du service' },
      { no: 27, label: 'Univers d’audit (9.4)' },
      { no: 28, label: 'Cartographie des risques de l’organisation (9.1)' },
      { no: 29, label: 'Méthodologie de construction du plan d’audit basé sur les risques' },
      { no: 30, label: 'Plans d’audit pluriannuels et annuels approuvés' },
      { no: 31, label: 'Avenants et modifications du plan et leur validation' },
      { no: 32, label: 'Cartographie des assurances et plan de coordination avec les autres fonctions (9.5)' },
      { no: 33, label: 'Tableaux de suivi de réalisation du plan' },
    ],
  },
  {
    slug: 'org',
    label: 'Organisation et ressources du service',
    nodeType: 'activite',
    docs: [
      { no: 34, label: 'Organigramme du service d’audit interne' },
      { no: 35, label: 'Fiches de poste et profils par grade' },
      { no: 36, label: 'Cartographie des compétences et matrice de polyvalence (3.1)' },
      { no: 37, label: 'Plan de formation et suivi de la formation continue (3.2)' },
      { no: 38, label: 'Dossiers des certifications et diplômes des auditeurs' },
      { no: 39, label: 'Budget annuel du service et suivi budgétaire (10.1)' },
      { no: 40, label: 'Plan de charge et gestion prévisionnelle des effectifs (10.2, 8.2)' },
      { no: 41, label: 'Procédure de recrutement et d’intégration des auditeurs' },
      { no: 42, label: 'Procédure d’évaluation de la performance des auditeurs' },
      { no: 43, label: 'Contrats de prestataires, co-sourcing et experts externes' },
      { no: 44, label: 'Inventaire des outils et logiciels d’audit (10.3)' },
    ],
  },
  {
    slug: 'meth',
    label: 'Méthodologie et procédures',
    nodeType: 'activite',
    docs: [
      { no: 45, label: 'Manuel d’audit interne du service (9.3)' },
      { no: 46, label: 'Procédure de conduite des missions (préparation, réalisation, conclusion)' },
      { no: 47, label: 'Procédure d’évaluation des risques de la mission (13.2)' },
      { no: 48, label: 'Procédure de rédaction du programme de travail (13.6)' },
      { no: 49, label: 'Guide d’échantillonnage et de sondage' },
      { no: 50, label: 'Guide des techniques et outils d’audit (observation, entretien, analyse de données)' },
      { no: 51, label: 'Guide de collecte et de documentation des preuves (14.1, 14.6)' },
      { no: 52, label: 'Procédure de traitement des constats, FRAP et analyse des causes (14.2, 14.3)' },
      { no: 53, label: 'Échelles de cotation des risques, des constats et des recommandations' },
      { no: 54, label: 'Procédure de rédaction et de diffusion du rapport (11.2, 11.3, 15.1)' },
      { no: 55, label: 'Procédure de traitement des erreurs et omissions (11.4)' },
      { no: 56, label: 'Procédure de supervision et de revue des dossiers (12.3)' },
      { no: 57, label: 'Procédure de traitement des fraudes et des missions d’investigation' },
      { no: 58, label: 'Procédure des missions de conseil et des missions non planifiées' },
      { no: 59, label: 'Procédure d’archivage et de conservation des dossiers' },
      { no: 60, label: 'Procédure de gestion des conflits et des désaccords avec l’audité' },
    ],
  },
  {
    slug: 'modeles',
    label: 'Modèles de documents',
    nodeType: 'activite',
    docs: [
      { no: 61, label: 'Modèle de lettre de mission et d’avis d’audit' },
      { no: 62, label: 'Modèle de questionnaire de prise de connaissance et de questionnaire de contrôle interne' },
      { no: 63, label: 'Modèle de programme de travail' },
      { no: 64, label: 'Modèle de feuille de travail et légende des signes de pointage' },
      { no: 65, label: 'Modèle de FRAP' },
      { no: 66, label: 'Modèle de rapport d’audit et de synthèse pour le comité' },
      { no: 67, label: 'Modèle de plan d’action et de tableau de suivi des recommandations' },
      { no: 68, label: 'Modèle de compte rendu de réunion d’ouverture et de clôture' },
      { no: 69, label: 'Modèle de questionnaire de satisfaction de l’audité' },
      { no: 70, label: 'Charte graphique et conventions de rédaction' },
    ],
  },
  {
    slug: 'orga',
    label: 'Connaissance de l’organisation',
    nodeType: 'activite',
    docs: [
      { no: 71, label: 'Présentation de l’organisation, de son activité et de sa stratégie' },
      { no: 72, label: 'Cartographie des processus et nomenclature des macro-processus' },
      { no: 73, label: 'Référentiel de contrôle interne par processus' },
      { no: 74, label: 'Manuel de procédures administratives, comptables et financières' },
      { no: 75, label: 'Cartographie applicative et architecture du système d’information' },
      { no: 76, label: 'Politique de sécurité du SI, plan de continuité et plan de reprise' },
      { no: 77, label: 'Annuaire des interlocuteurs clés par direction et par processus' },
      { no: 78, label: 'Liste des entités, filiales et implantations' },
      { no: 79, label: 'Registre des incidents et des pertes opérationnelles' },
      { no: 80, label: 'Rapports de l’inspection du régulateur, du CAC et des autres organes de contrôle' },
    ],
  },
  {
    slug: 'recos',
    label: 'Suivi des recommandations',
    nodeType: 'activite',
    docs: [
      { no: 81, label: 'Base consolidée des recommandations et état d’avancement' },
      { no: 82, label: 'Tableau de bord des recommandations en retard ou non mises en œuvre' },
      { no: 83, label: 'Procédure de relance et d’escalade (15.2)' },
      { no: 84, label: 'Historique des rapports d’audit par processus' },
      { no: 85, label: 'Synthèse des constats récurrents et tendances' },
      { no: 86, label: 'Registre des risques acceptés par la direction (11.5)' },
    ],
  },
  {
    slug: 'qaip',
    label: 'Assurance qualité',
    nodeType: 'activite',
    docs: [
      { no: 87, label: 'Programme d’assurance et d’amélioration de la qualité (8.3)' },
      { no: 88, label: 'Rapports d’évaluation interne de la qualité (12.1)' },
      { no: 89, label: 'Rapport d’évaluation externe de la qualité et plan d’action (8.4)' },
      { no: 90, label: 'Déclaration de conformité aux normes internationales (4.1)' },
      { no: 91, label: 'Indicateurs de performance du service et tableau de bord (12.2)' },
      { no: 92, label: 'Résultats des enquêtes de satisfaction des parties prenantes' },
      { no: 93, label: 'Plan d’amélioration continue du service' },
      { no: 94, label: 'Cartographie de conformité aux normes CRIPP' },
    ],
  },
  {
    slug: 'veille',
    label: 'Veille et référentiels',
    nodeType: 'activite',
    docs: [
      { no: 95, label: 'Texte intégral des normes CRIPP et des guides de mise en œuvre' },
      { no: 96, label: 'Référentiels de risques et de contrôle interne (COSO, COBIT, ISO 31000)' },
      { no: 97, label: 'Registre de veille réglementaire et professionnelle' },
      { no: 98, label: 'Recueil des bonnes pratiques et retours d’expérience (REX)' },
    ],
  },
  {
    slug: 'gestion',
    label: 'Gestion du dossier',
    nodeType: 'activite',
    docs: [
      { no: 99, label: 'Annuaire des dossiers de mission et registre des archives' },
      { no: 100, label: 'Index du dossier permanent et procédure de mise à jour annuelle' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 3. WORKFLOW DOCUMENTAIRE DOSSIER EXERCICE - AUDIT (100 documents / 10 phases)
// ---------------------------------------------------------------------------
export const EX_AUDIT_100_GROUPS: DemoCategoryGroup[] = [
  {
    slug: 'gestion',
    label: 'Gestion du dossier',
    nodeType: 'activite',
    docs: [
      { no: 1, label: 'Page de garde et fiche d’identification de la mission' },
      { no: 2, label: 'Sommaire et index de référencement des feuilles de travail' },
      { no: 3, label: 'Légende des signes de pointage (tickmarks) et conventions de référencement' },
      { no: 4, label: 'Fiche de supervision et de revue des feuilles de travail (12.3)' },
      { no: 5, label: 'Tableau de suivi d’avancement et journal des points ouverts' },
      { no: 6, label: 'Feuilles de temps et suivi du budget en jours-hommes' },
      { no: 7, label: 'Registre des demandes de documents et d’informations' },
      { no: 8, label: 'Checklist de conformité méthodologique du dossier' },
    ],
  },
  {
    slug: 'cadrage',
    label: 'Préparation / Cadrage',
    nodeType: 'activite',
    docs: [
      { no: 9, label: 'Fiche de mission extraite du plan d’audit annuel (9.4)' },
      { no: 10, label: 'Ordre de mission signé par le responsable de l’audit interne' },
      { no: 11, label: 'Désignation de l’équipe (chef de mission, auditeurs, experts)' },
      { no: 12, label: 'Déclarations d’objectivité et d’absence de conflit d’intérêts (2.1, 2.2, 2.3)' },
      { no: 13, label: 'Fiche d’évaluation des compétences requises et des besoins d’experts (3.1, 13.5)' },
      { no: 14, label: 'Budget et planning prévisionnel de la mission' },
      { no: 15, label: 'Lettre de mission ou notification adressée à l’audité (13.1)' },
      { no: 16, label: 'Avis d’audit et liste des documents à préparer par l’audité' },
      { no: 17, label: 'Liste des interlocuteurs et des personnes à auditer' },
      { no: 18, label: 'Rappel du mandat et de la charte d’audit interne (6.1, 6.2)' },
      { no: 19, label: 'Plan de communication de la mission (11.1)' },
      { no: 20, label: 'Note sur la confidentialité et la protection de l’information (5.1, 5.2)' },
    ],
  },
  {
    slug: 'connaissance',
    label: 'Préparation / Prise de connaissance',
    nodeType: 'activite',
    docs: [
      { no: 21, label: 'Dossier de prise de connaissance du processus audité' },
      { no: 22, label: 'Organigramme et fiches de poste des acteurs' },
      { no: 23, label: 'Manuel de procédures, notes de service et instructions' },
      { no: 24, label: 'Cartographie du processus (macro-processus, logigramme)' },
      { no: 25, label: 'Narratif ou descriptif du processus' },
      { no: 26, label: 'Tableau acteurs, tâches, documents et systèmes d’information' },
      { no: 27, label: 'Comptes rendus des entretiens de prise de connaissance' },
      { no: 28, label: 'Questionnaire de prise de connaissance (QPC)' },
      { no: 29, label: 'Questionnaire de contrôle interne (QCI)' },
      { no: 30, label: 'Tests de cheminement (walkthrough)' },
      { no: 31, label: 'Référentiel de contrôle interne du processus' },
      { no: 32, label: 'Textes légaux, réglementaires et politiques internes applicables' },
      { no: 33, label: 'Rapports d’audit antérieurs et suivi des recommandations' },
      { no: 34, label: 'Rapports du contrôle permanent, du régulateur, du CAC et registre des incidents' },
      { no: 35, label: 'Données chiffrées de cadrage (volumes, balances, statistiques)' },
      { no: 36, label: 'Cartographie applicative et droits d’accès aux systèmes d’information' },
    ],
  },
  {
    slug: 'risques',
    label: 'Préparation / Évaluation des risques',
    nodeType: 'activite',
    docs: [
      { no: 37, label: 'Note méthodologique et échelles de cotation (impact, probabilité, maîtrise)' },
      { no: 38, label: 'Extrait de la cartographie des risques du processus' },
      { no: 39, label: 'Liste des risques identifiés pour la mission (13.2)' },
      { no: 40, label: 'Cotation des risques bruts' },
      { no: 41, label: 'Évaluation du dispositif de maîtrise et des risques résiduels' },
      { no: 42, label: 'Matrice risques, objectifs et contrôles' },
      { no: 43, label: 'Évaluation du risque de fraude du processus' },
      { no: 44, label: 'Revue analytique préliminaire et analyse de données' },
      { no: 45, label: 'Hiérarchisation des zones à risques et choix des points d’audit' },
      { no: 46, label: 'Note de validation de l’évaluation des risques par le responsable de l’audit' },
    ],
  },
  {
    slug: 'programme',
    label: 'Préparation / Objectifs et programme',
    nodeType: 'activite',
    docs: [
      { no: 47, label: 'Objectifs généraux de la mission (13.3)' },
      { no: 48, label: 'Objectifs spécifiques et questions d’audit' },
      { no: 49, label: 'Périmètre, exclusions et limitations (13.3)' },
      { no: 50, label: 'Critères d’évaluation retenus (13.4)' },
      { no: 51, label: 'Liste des objets auditables et des points d’audit' },
      { no: 52, label: 'Matrice des domaines et des assertions d’audit' },
      { no: 53, label: 'Programme de travail (13.6)' },
      { no: 54, label: 'Techniques d’audit retenues par point d’audit' },
      { no: 55, label: 'Méthode d’échantillonnage et plan de sondage' },
      { no: 56, label: 'Fiche de validation du programme de travail par le responsable de l’audit' },
    ],
  },
  {
    slug: 'ouverture',
    label: 'Préparation / Réunion d’ouverture',
    nodeType: 'activite',
    docs: [
      { no: 57, label: 'Convocation à la réunion d’ouverture' },
      { no: 58, label: 'Feuille de présence' },
      { no: 59, label: 'Support de présentation de la mission' },
      { no: 60, label: 'Compte rendu de la réunion d’ouverture' },
      { no: 61, label: 'Calendrier d’intervention validé avec l’audité' },
      { no: 62, label: 'Note d’information aux directions et services concernés' },
    ],
  },
  {
    slug: 'travaux',
    label: 'Réalisation / Travaux',
    nodeType: 'activite',
    docs: [
      { no: 63, label: 'Feuilles de travail par point d’audit' },
      { no: 64, label: 'Feuilles de tests de conformité (procédures)' },
      { no: 65, label: 'Feuilles de tests de substance (données et soldes)' },
      { no: 66, label: 'Feuilles de sondage et résultats des échantillons' },
      { no: 67, label: 'Comptes rendus des entretiens de réalisation' },
      { no: 68, label: 'PV d’observation physique et de visite de sites' },
      { no: 69, label: 'PV de comptage ou d’inventaire inopiné (caisse, stocks, immobilisations)' },
      { no: 70, label: 'Rapprochements et recalculs' },
      { no: 71, label: 'Extractions de données et scripts d’analyse' },
      { no: 72, label: 'Tests par analyse de données (doublons, ruptures de séquence, anomalies)' },
      { no: 73, label: 'Confirmations externes (circularisation)' },
      { no: 74, label: 'Copies de pièces probantes et captures d’écran' },
      { no: 75, label: 'Fiche d’évaluation de la fiabilité et de la suffisance des preuves (14.1)' },
      { no: 76, label: 'Revue des droits d’accès et de la séparation des tâches' },
      { no: 77, label: 'Tests des indicateurs de fraude et des signaux d’alerte' },
      { no: 78, label: 'Documentation des écarts et anomalies relevés' },
      { no: 79, label: 'Fiche d’évaluation du contrôle interne par point d’audit' },
      { no: 80, label: 'Notes de revue du superviseur et réponses de l’auditeur' },
      { no: 81, label: 'Synthèse par objectif spécifique' },
      { no: 82, label: 'Comptes rendus des points d’étape avec l’audité' },
      { no: 83, label: 'Tableau de bord d’avancement de la mission' },
      { no: 84, label: 'Journal des difficultés rencontrées et limitations d’étendue' },
    ],
  },
  {
    slug: 'constats',
    label: 'Réalisation / Constats',
    nodeType: 'activite',
    docs: [
      { no: 85, label: 'Fiche de constat potentiel (14.2)' },
      { no: 86, label: 'Feuille de révélation et d’analyse de problème (FRAP)' },
      { no: 87, label: 'Analyse des causes (arbre des causes, 5 pourquoi, Ishikawa)' },
      { no: 88, label: 'Évaluation de la criticité et de l’impact des constats (14.3)' },
      { no: 89, label: 'Validation contradictoire des FRAP par l’audité (signée)' },
      { no: 90, label: 'Registre des constats de la mission' },
      { no: 91, label: 'Recommandations et projet de plan d’action (14.4)' },
    ],
  },
  {
    slug: 'rapport',
    label: 'Conclusion / Rapport',
    nodeType: 'activite',
    docs: [
      { no: 92, label: 'Compte rendu de la réunion de clôture' },
      { no: 93, label: 'Projet de rapport d’audit' },
      { no: 94, label: 'Réponses de l’audité et plan d’action proposé' },
      { no: 95, label: 'Rapport final avec synthèse, conclusions et évaluation du dispositif (14.5, 15.1)' },
      { no: 96, label: 'Lettre de transmission et liste de diffusion' },
      { no: 97, label: 'Note de synthèse destinée au comité d’audit' },
    ],
  },
  {
    slug: 'cloture',
    label: 'Suivi et clôture',
    nodeType: 'activite',
    docs: [
      { no: 98, label: 'Plan d’action validé et tableau de suivi des recommandations (15.2)' },
      { no: 99, label: 'Questionnaire de satisfaction de l’audité et bilan d’évaluation interne de la qualité (12.1, 12.2)' },
      { no: 100, label: 'Fiche de clôture et d’archivage du dossier (14.6)' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 4. WORKFLOW DOCUMENTAIRE MANUEL AUDIT - CAC (25 chapitres 0..24 + toutes sections Ex.1-11)
// ---------------------------------------------------------------------------
export interface ManuelChapterSpec {
  idSuffix: string;
  label: string;
  sections: Array<{ code: string; label: string }>;
}

export const MANUEL_AUDIT_AXE0_CHAPTERS: ManuelChapterSpec[] = [
  {
    idSuffix: 'ch0',
    label: '0. Cadre général du manuel (4.1, 9.3)',
    sections: [
      { code: '0.1', label: '0.1 Objet et champ — Public cible & périmètre bancaire' },
      { code: '0.2', label: '0.2 Cadre réglementaire bancaire — Textes BCEAO / CB-UMOA & Références CRIPP' },
      { code: '0.3', label: '0.3 Gouvernance du manuel — Versions, diffusion & approbation' },
    ],
  },
  {
    idSuffix: 'ch1',
    label: '1. Mise en place du service d’audit (7.1, 8.2, 10.1)',
    sections: [
      { code: '1.1', label: '1.1 Prise de connaissance de l’environnement — Dispositif 3 lignes & gouvernance' },
      { code: '1.2', label: '1.2 Positionnement — Rattachement fonctionnel / administratif & indépendance (7.1)' },
      { code: '1.3', label: '1.3 Organisation interne — Fonctions (DAI, senior, junior), responsabilités & délégations' },
      { code: '1.4', label: '1.4 Ressources humaines — Recrutement, accueil & plan de formation fraude / LBC-FT (3.1, 3.2)' },
      { code: '1.5', label: '1.5 Ressources financières et techniques — Budget à 3 ans, outils d’audit & accès données (10.1, 10.3)' },
      { code: '1.6', label: '1.6 Méthodologie — Rédaction du manuel, templates de mission & organisation des dossiers (9.3)' },
      { code: '1.7', label: '1.7 Plan de démarrage — Cartographie initiale, premier plan d’audit & communication (9.4, 11.1)' },
    ],
  },
  {
    idSuffix: 'ch2',
    label: '2. Charte d’audit interne (1.1-2.3, 6.1-6.3)',
    sections: [
      { code: '2.1', label: '2.1 Mandat et missions — Assurance, conseil & périmètre siège / agences / filiales (6.1)' },
      { code: '2.2', label: '2.2 Indépendance et objectivité — Déclaration, conflits d’intérêts & atteintes (2.1-2.3, 7.1)' },
      { code: '2.3', label: '2.3 Autorité et accès — Accès personnes, documents, Core Banking & confidentialité (5.1, 5.2, 6.3)' },
      { code: '2.4', label: '2.4 Déontologie — Honnêteté, attentes éthiques & aspects légaux (1.1 à 1.3)' },
      { code: '2.5', label: '2.5 Obligations de reporting — Rapports périodiques, limitations & acceptation des risques (8.1, 11.3, 11.5)' },
      { code: '2.6', label: '2.6 Approbation et révision — Validation du Conseil, revue périodique & diffusion (6.2, 6.3)' },
    ],
  },
  {
    idSuffix: 'ch3',
    label: '3. Cartographie des risques (9.1, 13.2)',
    sections: [
      { code: '3.1', label: '3.1 Collecte documentaire — Organigramme, procédures, incidents & rapports comité des risques' },
      { code: '3.2', label: '3.2 Univers des risques — Cycles (crédit, trésorerie, moyens de paiement, engagements)' },
      { code: '3.3', label: '3.3 Identification — Risques opérationnels, de fraude, de non-conformité & de crédit (13.2)' },
      { code: '3.4', label: '3.4 Cotation — Échelles probabilité/impact, criticité brute & criticité nette' },
      { code: '3.5', label: '3.5 Dispositif de maîtrise — Contrôles préventifs/détectifs niveaux 1 & 2 (DMR)' },
      { code: '3.6', label: '3.6 Plan d’action et validation — Actions, pilotes, validation & mise à jour annuelle (9.4, 11.5)' },
    ],
  },
  {
    idSuffix: 'ch4',
    label: '4. Plan d’audit (9.2, 9.4, 9.5)',
    sections: [
      { code: '4.1', label: '4.1 Définition de l’univers d’audit — Directions, agences, processus & filiales (9.4)' },
      { code: '4.2', label: '4.2 Priorisation — Score de risque, historique couverture & rotation 1/2/3 ans (9.2, 9.4)' },
      { code: '4.3', label: '4.3 Coordination des assurances — Contrôle permanent, Conformité, CAC & Commission Bancaire (9.5)' },
      { code: '4.4', label: '4.4 Ressources et budget — Jours-hommes par phase, compétences & expertise externe (8.2, 10.1)' },
      { code: '4.5', label: '4.5 Calendrier et fiches de mission — Planning trimestriel & fiches synthétiques (9.4, 13.3)' },
      { code: '4.6', label: '4.6 Validation et pilotage — Approbation comité d’audit, révision & réserve de capacité (6.3, 8.1)' },
    ],
  },
];

export const MANUEL_AUDIT_AXE5_CHAPTERS: ManuelChapterSpec[] = [
  {
    idSuffix: 'ch51',
    label: '5.1 Conduite des missions · Préparation (13.1-13.6)',
    sections: [
      { code: '5.1.1', label: '5.1.1 Planification — Trigger de la mission, équipe, budget & calendrier (13.1, 13.5)' },
      { code: '5.1.2', label: '5.1.2 Lettre de mission — Objectifs, périmètre, période auditée, accès & livrables (13.1, 13.3)' },
      { code: '5.1.3', label: '5.1.3 Rencontre avec la Direction — Préparation, compte rendu & validation auditée (11.1, 11.2)' },
      { code: '5.1.4', label: '5.1.4 Réunion d’ouverture — Ordre du jour, engagements & points d’attention (11.1)' },
      { code: '5.1.5', label: '5.1.5 Prise de connaissance — Entretiens (Outil I), Flowchart (III) & Walkthrough (V) (9.1, 14.1)' },
      { code: '5.1.6', label: '5.1.6 Évaluation des risques — Cartographie processus & hiérarchisation (Outil VI) (13.2)' },
      { code: '5.1.7', label: '5.1.7 Référentiel de contrôle interne — Référentiel (Outil VII), QCI (IX) & Forces/Faiblesses (13.4)' },
      { code: '5.1.8', label: '5.1.8 Rapport d’orientation — Objectifs retenus, risques ciblés & périmètre final (13.3)' },
      { code: '5.1.9', label: '5.1.9 Programme de travail — Objectif de contrôle, assertion, technique & échantillon (13.6, 12.3)' },
    ],
  },
  {
    idSuffix: 'ch52',
    label: '5.2 Conduite des missions · Réalisation (14.1, 14.2, 12.3)',
    sections: [
      { code: '5.2.1', label: '5.2.1 Lancement terrain — Réunion de lancement, accès Core Banking & plan d’échantillonnage (13.5, 14.1)' },
      { code: '5.2.2', label: '5.2.2 Tests et feuilles de couverture — Pointage CTR, écarts, assertions & X-Ref (14.1, 14.2, 14.6)' },
      { code: '5.2.3', label: '5.2.3 Preuves d’audit — Suffisance, pertinence, fiabilité & validation dossier de travail (14.1)' },
      { code: '5.2.4', label: '5.2.4 Analyse des causes — Diagramme cause/effet (Outil VIII), cause racine & conséquences (14.2)' },
      { code: '5.2.5', label: '5.2.5 Supervision — Revue manager, débriefing à mi-temps & ajustement programme (12.3)' },
    ],
  },
  {
    idSuffix: 'ch53',
    label: '5.3 Conduite des missions · Conclusion (14.3-15.1)',
    sections: [
      { code: '5.3.1', label: '5.3.1 FRAP — Les 5 C du constat, validation contradictoire & cotation (14.3, 11.2)' },
      { code: '5.3.2', label: '5.3.2 Synthèse et rapport provisoire — Synthèse des FRAP, opinion & plan d’action (14.4, 14.5)' },
      { code: '5.3.3', label: '5.3.3 Clôture et rapport final — Réunion de clôture, acceptation des risques & diffusion (11.3, 11.5, 15.1)' },
      { code: '5.3.4', label: '5.3.4 Archivage — Dossier de mission, revue qualité & conservation (14.6, 12.1)' },
    ],
  },
];

export const MANUEL_AUDIT_AXE6_CHAPTERS: ManuelChapterSpec[] = [
  {
    idSuffix: 'ch6',
    label: '6. Suivi des recommandations (14.4, 15.2)',
    sections: [
      { code: '6.1', label: '6.1 Principes — Rôles audit, audité, comité & responsabilités (15.2)' },
      { code: '6.2', label: '6.2 Fichier de suivi — Référence FRAP, mission source, priorité P1/P2/P3 & statut (14.4)' },
      { code: '6.3', label: '6.3 Plan d’action de l’audité — Action, pilote, échéance & livrable (14.4)' },
      { code: '6.4', label: '6.4 Relances — Calendrier, modes de relance & escalade hiérarchique (11.1)' },
      { code: '6.5', label: '6.5 Collecte et validation des preuves — Nature, fiabilité & date de réception (14.1)' },
      { code: '6.6', label: '6.6 Vérification par l’audit — Revue documentaire, re-performance, observation & re-test (15.2)' },
      { code: '6.7', label: '6.7 Acceptation du risque — Motif, décideur, durée & information comité (11.5)' },
      { code: '6.8', label: '6.8 Intégration dans les autres étapes — Cartographie, matrice de surveillance & procédures (9.1, 13.2)' },
      { code: '6.9', label: '6.9 Clôture — Statuts (soldée, partielle, abandonnée) & double validation (12.3, 15.2)' },
      { code: '6.10', label: '6.10 KPI et reporting — Taux de mise en œuvre, recos échues & tendance trimestrielle (12.2, 11.3)' },
    ],
  },
  {
    idSuffix: 'ch7',
    label: '7. Comité d’audit & Reporting (8.1, 11.3, 11.5)',
    sections: [
      { code: '7.1', label: '7.1 Cadre et composition — Mandat, membres, fréquence & quorum (6.3, 8.1)' },
      { code: '7.2', label: '7.2 Préparation des réunions — Ordre du jour, dossier & synthèse des missions (11.1)' },
      { code: '7.3', label: '7.3 Tenue des réunions — Présentation du plan et des rapports, débats & PV (11.2, 11.3)' },
      { code: '7.4', label: '7.4 Rapports périodiques — Rapport d’activité, recos critiques & ressources (8.1, 11.3, 8.2)' },
      { code: '7.5', label: '7.5 Suites du comité — Recommandations du comité, affectation & suivi (15.2)' },
      { code: '7.6', label: '7.6 Communication avec les membres — Échanges hors séance & alertes fraude (11.1, 5.2)' },
      { code: '7.7', label: '7.7 Reporting à la DG et au Conseil — Format, périodicité & confidentialité (11.3)' },
      { code: '7.8', label: '7.8 Relations avec les autorités — Commission Bancaire, BCEAO & rapports contrôle interne (9.1, 11.1)' },
      { code: '7.9', label: '7.9 Relations avec les commissaires aux comptes — Plan de coordination & échanges (9.5)' },
      { code: '7.10', label: '7.10 Qualité et évaluation externe — Programme qualité & plan d’amélioration (8.3, 8.4, 12.1)' },
    ],
  },
  {
    idSuffix: 'ch8',
    label: '8. Qualité et performance (8.3, 8.4, 12.1-12.3)',
    sections: [
      { code: '8.1', label: '8.1 Assurance qualité — Revue interne des dossiers et supervision (12.1, 12.3)' },
      { code: '8.2', label: '8.2 KPI — Indicateurs de performance des missions et de la période (12.2)' },
      { code: '8.3', label: '8.3 Évaluation externe — Revue indépendante quinquennale & programme d’amélioration (8.3, 8.4)' },
    ],
  },
];

export const MANUEL_AUDIT_AXE9_24_CHAPTERS: ManuelChapterSpec[] = [
  {
    idSuffix: 'ch9',
    label: '9. Techniques et outils d’audit (9.3, 14.1)',
    sections: [
      { code: '9.1', label: '9.1 Panorama des techniques — Entretien (I), Observation (XIV), Recalcul, Circularisation (XII)' },
      { code: '9.2', label: '9.2 Analyse des processus — Grille des tâches (II), Flowchart (III) & Approche processus (IV)' },
      { code: '9.3', label: '9.3 Test de cheminement et piste d’audit — Suivi bout en bout & piste d’audit (XI)' },
      { code: '9.4', label: '9.4 Évaluation du contrôle interne — QCI (IX), Tableau forces/faiblesses, conception & permanence' },
      { code: '9.5', label: '9.5 Hiérarchisation et analyse des causes — Outils VI, VIII (Cause/effet) & Brainstorming (X)' },
      { code: '9.6', label: '9.6 Procédures analytiques — Revue analytique (XIII), ratios bancaires & tendances' },
      { code: '9.7', label: '9.7 Outils bureautiques et scripts — Fonctions Excel, TCD & scripts Python' },
    ],
  },
  {
    idSuffix: 'ch10',
    label: '10. Échantillonnage et analyse de données (14.1, 14.2)',
    sections: [
      { code: '10.1', label: '10.1 Définition de la population — Source Core Banking / GL & exhaustivité de l’extraction' },
      { code: '10.2', label: '10.2 Méthodes de sélection — Statistique (XV), raisonné, inopiné & taille selon le risque' },
      { code: '10.3', label: '10.3 CAATs — Tests sur 100 % (doublons, seuils, ruptures de séquence) (Outil XVI)' },
      { code: '10.4', label: '10.4 Pointage et symboles — Colonnes CTR, légende (+, -, N/A) & calcul de l’écart' },
      { code: '10.5', label: '10.5 Conclusion par assertion — Validité, exhaustivité, cut-off, évaluation & présentation' },
      { code: '10.6', label: '10.6 Extrapolation — Taux d’anomalie, montant extrapolé & limites méthodologiques' },
    ],
  },
  {
    idSuffix: 'ch11',
    label: '11. Communication, rapports et contradictoire (11.1-11.5, 15.1)',
    sections: [
      { code: '11.1', label: '11.1 Principes de communication — Exactitude, clarté, opportunité & destinataires' },
      { code: '11.2', label: '11.2 FRAP et constats — 5 C, gravité, cotation & régularisation comptable SYSCOHADA' },
      { code: '11.3', label: '11.3 Procédure contradictoire — Validation par l’audité, désaccords & réserve maintenue' },
      { code: '11.4', label: '11.4 Rapport provisoire et final — Synthèse exécutive, opinion, plan d’action & annexes' },
      { code: '11.5', label: '11.5 Erreurs et omissions — Correction des rapports & information des destinataires (11.4)' },
      { code: '11.6', label: '11.6 Acceptation des risques — Alerte à la Direction & escalade au comité d’audit (11.5)' },
    ],
  },
  {
    idSuffix: 'ch12',
    label: '12. Audit du crédit et des engagements (13.2, 14.2)',
    sections: [
      { code: '12.1', label: '12.1 Octroi — Dossier de crédit, analyse de risque, délégations, comités & garanties' },
      { code: '12.2', label: '12.2 Mise en place et déblocage — Conditions suspensives & double validation' },
      { code: '12.3', label: '12.3 Suivi et recouvrement — Impayés, déclassement, provisionnement & recouvrement' },
      { code: '12.4', label: '12.4 Concentration et ratios — Division des risques & ratios prudentiels BCEAO' },
    ],
  },
  {
    idSuffix: 'ch13',
    label: '13. Audit de la trésorerie et de la caisse (13.2, 14.1)',
    sections: [
      { code: '13.1', label: '13.1 Sécurité de la caisse — Arrêté quotidien, coffre, accès & plafond d’encaisse' },
      { code: '13.2', label: '13.2 Inventaires de caisse — Inopiné, PV de comptage, écarts & signatures conjointes' },
      { code: '13.3', label: '13.3 Approvisionnement et remises en banque — Convoyage de fonds & bordereaux' },
      { code: '13.4', label: '13.4 Rapprochements bancaires — Périodicité, visa du DAF & suspens anciens' },
      { code: '13.5', label: '13.5 Liquidité et placements — Gestion liquidité, opérations interbancaires & limites' },
    ],
  },
  {
    idSuffix: 'ch14',
    label: '14. Audit des moyens de paiement et de la monétique (13.2, 14.2)',
    sections: [
      { code: '14.1', label: '14.1 Virements et chèques — Habilitations Maker-Checker, double clé & rejets' },
      { code: '14.2', label: '14.2 Cartes et monétique — Émission, plafonds, GAB & rapprochement des flux' },
      { code: '14.3', label: '14.3 Mobile banking et services numériques — Alertes SMS/OTP & plafonds' },
      { code: '14.4', label: '14.4 Comptes de passage et suspens — Ancienneté, justification & apurement' },
    ],
  },
  {
    idSuffix: 'ch15',
    label: '15. Audit des agences et du réseau (13.3, 14.1)',
    sections: [
      { code: '15.1', label: '15.1 Organisation d’une agence — Séparation des fonctions, délégations & suppléance' },
      { code: '15.2', label: '15.2 Opérations de guichet — Encaissements, décaissements & clôture de caisse' },
      { code: '15.3', label: '15.3 Comptes dormants et inactifs — Levée de blocage, mandat & double clé' },
      { code: '15.4', label: '15.4 Sécurité physique — Coffre, alarme, vidéosurveillance & plan d’urgence' },
      { code: '15.5', label: '15.5 Comparaison inter-agences — Écarts de pratiques, KRI & agences à risque' },
    ],
  },
  {
    idSuffix: 'ch16',
    label: '16. Audit de la conformité et de la LBC/FT (1.3, 13.4)',
    sections: [
      { code: '16.1', label: '16.1 Cadre réglementaire — Textes BCEAO, Commission Bancaire & Loi uniforme LBC/FT UEMOA' },
      { code: '16.2', label: '16.2 Connaissance client (KYC) — Identification, PPE & mise à jour des dossiers' },
      { code: '16.3', label: '16.3 Surveillance des opérations — Profils, alertes & déclarations de soupçon CENTIF' },
      { code: '16.4', label: '16.4 Formation et gouvernance — Responsable conformité, formation & reporting' },
      { code: '16.5', label: '16.5 Déclarations réglementaires — États périodiques, exactitude & respect des délais' },
    ],
  },
  {
    idSuffix: 'ch17',
    label: '17. Audit des systèmes d’information et cybersécurité (10.3, 14.1)',
    sections: [
      { code: '17.1', label: '17.1 Gouvernance du SI — Schéma directeur, organisation & budget informatique' },
      { code: '17.2', label: '17.2 Habilitations et accès — Profils, départs/mutations & comptes privilégiés' },
      { code: '17.3', label: '17.3 Contrôles applicatifs du Core Banking — Paramétrage, interfaces & piste d’audit' },
      { code: '17.4', label: '17.4 Sécurité et cyber-risques — Vulnérabilités, sauvegardes & détection des incidents' },
      { code: '17.5', label: '17.5 Protection de l’information — Données clients, accès audit & conservation (5.1, 5.2)' },
    ],
  },
  {
    idSuffix: 'ch18',
    label: '18. Audit de l’externalisation et continuité d’activité (9.1, 13.2)',
    sections: [
      { code: '18.1', label: '18.1 Externalisation — Contrats tiers, SLA, droit d’audit & plan de sortie' },
      { code: '18.2', label: '18.2 Plan de continuité d’activité — Analyse d’impact (BIA), plan de repli & tests' },
      { code: '18.3', label: '18.3 Gestion des incidents — Détection, escalade, clôture & retour d’expérience' },
      { code: '18.4', label: '18.4 Risques émergents — Cyber, tiers, fraude numérique & signaux faibles' },
    ],
  },
  {
    idSuffix: 'ch19',
    label: '19. Fraude, investigations et missions spéciales (11.3, 14.3)',
    sections: [
      { code: '19.1', label: '19.1 Prévention — Triangle de la fraude, cartographie des fraudes & culture éthique' },
      { code: '19.2', label: '19.2 Détection — Signaux d’alerte, analyse de données & dispositif d’alerte interne' },
      { code: '19.3', label: '19.3 Conduite d’une investigation — Déclenchement, préservation preuves & présomption d’innocence' },
      { code: '19.4', label: '19.4 Escalade et suites — Information comité, mesures disciplinaires/judiciaires' },
      { code: '19.5', label: '19.5 Retour d’expérience — Mise à jour cartographie & nouveaux contrôles clés' },
    ],
  },
  {
    idSuffix: 'ch20',
    label: '20. Missions de conseil (6.1, 13.1)',
    sections: [
      { code: '20.1', label: '20.1 Cadre — Acceptation, préservation de l’indépendance & portée (2.1, 6.1)' },
      { code: '20.2', label: '20.2 Types d’intervention — Revue de procédures, accompagnement projets & formation' },
      { code: '20.3', label: '20.3 Participation aux comités — Rôle d’observateur, limites & traçabilité (2.2)' },
      { code: '20.4', label: '20.4 Restitution — Livrables & suivi des suites de conseil (11.3)' },
    ],
  },
  {
    idSuffix: 'ch21',
    label: '21. Audit des filiales et du groupe (9.4, 9.5)',
    sections: [
      { code: '21.1', label: '21.1 Gouvernance de groupe — Rattachement fonctionnel, charte groupe & reporting (7.1, 9.5)' },
      { code: '21.2', label: '21.2 Planification consolidée — Univers d’audit groupe & coordination audits locaux (9.4)' },
      { code: '21.3', label: '21.3 Spécificités locales — Réglementation du pays, langue & pratiques locales (13.4)' },
      { code: '21.4', label: '21.4 Consolidation des résultats — Synthèse groupe & recommandations transversales (11.3, 15.2)' },
    ],
  },
  {
    idSuffix: 'ch22',
    label: '22. Organisation, dossiers et gestion documentaire (14.6, 5.2)',
    sections: [
      { code: '22.1', label: '22.1 Dossier permanent — Charte, organigramme, cartographie, manuels & textes (14.6)' },
      { code: '22.2', label: '22.2 Dossier de mission — Structure, codification, X-Ref & statut de revue (14.6)' },
      { code: '22.3', label: '22.3 Templates de mission — Lettre de mission, QCI, feuilles de test, FRAP & rapport (9.3)' },
      { code: '22.4', label: '22.4 Archivage et confidentialité — Durée de conservation, accès & sécurité (5.1, 5.2)' },
      { code: '22.5', label: '22.5 Gestion du manuel — Rédaction, mise à jour, diffusion & formation (9.3)' },
      { code: '22.6', label: '22.6 Compétences et formation continue — Méthodologie, CRIPP, fraude & LBC/FT (3.1, 3.2)' },
      { code: '22.7', label: '22.7 Pilotage de l’activité — KPI missions, KPI période, tableaux de bord & rapport (12.2)' },
      { code: '22.8', label: '22.8 Apurement des missions et supervision — Revue des dossiers & débriefing (12.3)' },
    ],
  },
  {
    idSuffix: 'ch23',
    label: '23. Relations avec les parties prenantes externes (9.5, 11.1)',
    sections: [
      { code: '23.1', label: '23.1 Commissaires aux comptes — Accueil, demandes documentaires & plan de coordination (9.5)' },
      { code: '23.2', label: '23.2 Autorités de supervision — BCEAO, Commission Bancaire & missions de contrôle (11.1)' },
      { code: '23.3', label: '23.3 Autres audits — Audit de groupe, certification & évaluation externe de l’audit (8.4, 9.5)' },
    ],
  },
  {
    idSuffix: 'ch24',
    label: '24. Annexes et outils IFACI I à XVI (14.6)',
    sections: [
      { code: '24.1', label: '24.1 Outils IFACI I à XVI — Fiches de mise en œuvre par outil (9.3)' },
      { code: '24.2', label: '24.2 Modèles de documents — Lettre de mission, QCI, FRAP, Rapport & Fiche de suivi (14.6)' },
      { code: '24.3', label: '24.3 Référentiels de contrôle interne par cycle — Crédit, Trésorerie, Paiement, Agence (13.4)' },
      { code: '24.4', label: '24.4 Glossaire et abréviations — Termes d’audit, termes bancaires UMOA & sigles (11.2)' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 5. WORKFLOW SUIVI RECOS (Exemple 5 complet : Sections 6.1 à 6.10)
// ---------------------------------------------------------------------------
export const SUIVI_RECOS_SECTIONS_2026: DemoCategoryGroup[] = [
  {
    slug: 'principes',
    label: '6.1–6.2 Principes & Fichier consolidé de suivi',
    nodeType: 'section',
    docs: [
      { no: 1, label: '6.1 Procédure de suivi des recommandations — Rôles audit, audité & comité (15.2)' },
      { no: 2, label: '6.2 Fichier consolidé de suivi des recos (Réf FRAP, Mission source, Priorité P1/P2/P3)' },
    ],
  },
  {
    slug: 'plans',
    label: '6.3–6.4 Plans d’action & Relances hiérarchiques',
    nodeType: 'section',
    docs: [
      { no: 3, label: '6.3 Plans d’action validés de l’audité (Action, Pilote, Échéance, Livrable) (14.4)' },
      { no: 4, label: '6.4 Calendrier des relances & matrice d’escalade hiérarchique (11.1)' },
    ],
  },
  {
    slug: 'preuves',
    label: '6.5–6.6 Preuves & Vérification par re-test',
    nodeType: 'section',
    docs: [
      { no: 5, label: '6.5 Dossier de collecte et validation des preuves de mise en œuvre (14.1)' },
      { no: 6, label: '6.6 Feuille de suivi — Revue documentaire, re-performance & re-tests d’audit (15.2)' },
    ],
  },
  {
    slug: 'risques-cloture',
    label: '6.7–6.10 Acceptation des risques, Clôture & KPI',
    nodeType: 'section',
    docs: [
      { no: 7, label: '6.7 Registre des risques acceptés par la direction & information comité (11.5)' },
      { no: 8, label: '6.8 Intégration des recos non réalisées vers Cartographie & Matrice de surveillance (9.1, 13.2)' },
      { no: 9, label: '6.9 Fiche de clôture & double validation des statuts (soldée, partielle, abandonnée) (12.3, 15.2)' },
      { no: 10, label: '6.10 Tableau de bord KPI — Taux de mise en œuvre, recos échues & délai moyen (12.2, 11.3)' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 6. WORKFLOW DOCUMENT MISSION & CARTOGRAPHIES (Phases + 6 Cartographies)
// ---------------------------------------------------------------------------
export const DOC_MISSION_CARTOGRAPHIES: DemoCategoryGroup[] = [
  {
    slug: 'carto-processus',
    label: 'Cartographie des processus',
    nodeType: 'sous-section',
    docs: [
      { no: 1, label: 'Référentiel complet des macro-processus & processus formalisés ou non liés aux activités' },
      { no: 2, label: 'Nomenclature des cycles bancaires & opérations clés' },
    ],
  },
  {
    slug: 'carto-procedures',
    label: 'Cartographie des procédures',
    nodeType: 'sous-section',
    docs: [
      { no: 3, label: 'Décomposition hiérarchique : Direction / Cycle / Processus / Sous-processus / Opérations / Tâches' },
      { no: 4, label: 'Tableau RACI des acteurs et séparation des tâches par procédure' },
    ],
  },
  {
    slug: 'carto-risques',
    label: 'Cartographie des risques',
    nodeType: 'sous-section',
    docs: [
      { no: 5, label: 'Cartographie des risques de l’entité & du service audit — Année N (2026)' },
      { no: 6, label: 'Historique comparatif des cartographies des risques — Années N-K (2024–2025)' },
    ],
  },
  {
    slug: 'carto-controles',
    label: 'Cartographie des activités de contrôle',
    nodeType: 'sous-section',
    docs: [
      { no: 7, label: 'Référentiel des contrôles clés préventifs, détectifs et correctifs par processus' },
      { no: 8, label: 'Matrice de surveillance permanente niveau 1 & niveau 2' },
    ],
  },
  {
    slug: 'carto-recos',
    label: 'Cartographie des recos',
    nodeType: 'sous-section',
    docs: [
      { no: 9, label: 'Vue cartographique des recommandations ouvertes, échues et soldées par direction' },
      { no: 10, label: 'Corrélation recommandations critiques vs zones à risques résiduels élevés' },
    ],
  },
  {
    slug: 'carto-docs',
    label: 'Cartographie des documents',
    nodeType: 'sous-section',
    docs: [
      { no: 11, label: 'Cartographie documentaire complète, index X-Ref et piste d’audit des preuves' },
      { no: 12, label: 'Table de correspondance Google Drive / PostgreSQL par étape de mission' },
    ],
  },
];

// ---------------------------------------------------------------------------
// 7. WORKFLOW DOSSIER EXERCICE - CAC, MANUEL PROCÉDURE CAC & EXAMEN CIA
// ---------------------------------------------------------------------------
export const EX_CAC_2026_GROUPS: DemoCategoryGroup[] = [
  {
    slug: 'acceptation',
    label: 'Acceptation, Plan de mission & Seuil de signification',
    nodeType: 'section',
    docs: [
      { no: 1, label: 'Questionnaire d’acceptation et de maintien du mandat CAC' },
      { no: 2, label: 'Déclarations annuelles d’indépendance de l’équipe CAC' },
      { no: 3, label: 'Note de détermination du seuil de signification & erreur tolérable' },
      { no: 4, label: 'Plan de mission légal & calendrier d’intervention intérimaire / final' },
    ],
  },
  {
    slug: 'cycles',
    label: 'Contrôle des cycles SYSCOHADA révisé',
    nodeType: 'section',
    docs: [
      { no: 5, label: 'Cycle Trésorerie & Emprunts — Rapprochements bancaires & circularisations banques' },
      { no: 6, label: 'Cycle Clients & Ventes — Circularisation clients, antériorité & provisions' },
      { no: 7, label: 'Cycle Fournisseurs & Achats — Recherche de passifs non enregistrés & cut-off' },
      { no: 8, label: 'Cycle Immobilisations — Tableau de variation, dotations & tests de dépréciation' },
      { no: 9, label: 'Cycle Capitaux propres, Provisions pour risques & Impôts différés' },
    ],
  },
  {
    slug: 'synthese',
    label: 'Synthèse, Revue analytique & Rapports CAC',
    nodeType: 'section',
    docs: [
      { no: 10, label: 'Revue analytique préliminaire et finale des états financiers SYSCOHADA' },
      { no: 11, label: 'Lettre d’affirmation de la Direction Générale' },
      { no: 12, label: 'Projet de rapport général sur les comptes annuels & rapport spécial (conventions)' },
    ],
  },
];

export const MANUEL_PROC_CAC_2026_GROUPS: DemoCategoryGroup[] = [
  {
    slug: 'substance',
    label: 'Guides de tests de substance SYSCOHADA révisé',
    nodeType: 'section',
    docs: [
      { no: 1, label: 'Guide des tests de substance Immobilisations corporelles & incorporelles' },
      { no: 2, label: 'Procédure de validation du cut-off Achats / Ventes & Stock de clôture' },
      { no: 3, label: 'Guide de contrôle des provisions bancaires et créances douteuses (BCEAO)' },
      { no: 4, label: 'Procédure d’audit de la paie, charges sociales & engagements hors bilan' },
    ],
  },
  {
    slug: 'normes',
    label: 'Normes d’exercice professionnel (ISA / OHADA)',
    nodeType: 'section',
    docs: [
      { no: 5, label: 'Guide pratique des confirmations externes (circularisations banques, avocats, tiers)' },
      { no: 6, label: 'Procédure d’évaluation des estimations comptables & continuité d’exploitation' },
      { no: 7, label: 'Checklist de revue des annexes aux états financiers SYSCOHADA révisé' },
    ],
  },
];

export const EXAMEN_CIA_2026_GROUPS: DemoCategoryGroup[] = [
  {
    slug: 'part2',
    label: 'CIA Part 2 · Pratique de l’audit interne',
    nodeType: 'section',
    docs: [
      { no: 1, label: 'Fiches Part 2.1 — Management de l’activité d’audit interne & planification basée sur les risques' },
      { no: 2, label: 'Fiches Part 2.2 — Planification de la mission, programme de travail & échantillonnage' },
      { no: 3, label: 'Banque de QCM CIA Part 2 — Exécution des travaux, CAATs, FRAP & suivi des recos' },
    ],
  },
  {
    slug: 'part3',
    label: 'CIA Part 3 · Connaissances Business, SI & Finance',
    nodeType: 'section',
    docs: [
      { no: 4, label: 'Fiches Part 3.1 — Sens des affaires, gouvernance & gestion des risques d’entreprise' },
      { no: 5, label: 'Fiches Part 3.2 — Sécurité de l’information, cybersécurité & continuité SI' },
      { no: 6, label: 'Banque de QCM CIA Part 3 — Comptabilité managériale, finance & contrôle interne' },
    ],
  },
];
