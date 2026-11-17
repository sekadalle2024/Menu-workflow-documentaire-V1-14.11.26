import {
  AuditPlanMissionMeta,
  AuditPlanScheduleStatus,
  AuditPlanStepMeta,
  AuditPlanTaskUnit,
  MissionTodoTask,
  TodoTaskStatus,
  WorkflowNodeStatus,
  WorkflowTreeNode,
} from '../types/workflow';
import { addWorkingDays, round2, snapToWorkingDay, WORKDAY_HOURS } from '../utils/auditTodoOps';

export interface AuditPlanStepTemplate {
  phase: 'Phase de préparation' | 'Phase de réalisation' | 'Phase de conclusion';
  stepNumber: number;
  label: string;
  defaultHoursPerWeekPct: number; // share of phase duration
  defaultCripp: string;
}

export const AUDIT_PLAN_PHASES_ORDER: Array<
  'Phase de préparation' | 'Phase de réalisation' | 'Phase de conclusion'
> = ['Phase de préparation', 'Phase de réalisation', 'Phase de conclusion'];

export const AUDIT_PLAN_STEPS_TEMPLATE: AuditPlanStepTemplate[] = [
  // Phase de préparation (11 étapes)
  {
    phase: 'Phase de préparation',
    stepNumber: 1,
    label: 'Planification de la mission',
    defaultHoursPerWeekPct: 0.08,
    defaultCripp: 'Norme 13.1 — Communication relative à la mission & planification',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 2,
    label: 'Lettre de mission',
    defaultHoursPerWeekPct: 0.06,
    defaultCripp: 'Norme 13.1 — Communication relative à la mission & planification',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 3,
    label: '1 Rencontre avec la Direction de l’entité auditée',
    defaultHoursPerWeekPct: 0.08,
    defaultCripp: 'Norme 11.2 — Communication efficace',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 4,
    label: '2 Compte rendu de la réunion',
    defaultHoursPerWeekPct: 0.06,
    defaultCripp: 'Norme 14.6 — Documentation & archivage des dossiers',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 5,
    label: '3 Réunion d’ouverture',
    defaultHoursPerWeekPct: 0.08,
    defaultCripp: 'Norme 13.1 — Communication relative à la mission & planification',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 6,
    label: 'Collecte documentaire (prise de connaissance du Domaine audité)',
    defaultHoursPerWeekPct: 0.14,
    defaultCripp: 'Norme 14.1 — Collecte des informations & preuves d’audit',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 7,
    label: 'Plan d’approche – référentiel de contrôle interne',
    defaultHoursPerWeekPct: 0.12,
    defaultCripp: 'Norme 13.2 — Évaluation des risques de la mission',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 8,
    label: 'Questionnaire de contrôle interne',
    defaultHoursPerWeekPct: 0.12,
    defaultCripp: 'Norme 13.4 — Critères d’évaluation',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 9,
    label: 'Tableau des forces et faiblesses apparentes',
    defaultHoursPerWeekPct: 0.08,
    defaultCripp: 'Norme 13.2 — Évaluation des risques de la mission',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 10,
    label: 'Le rapport d’orientation',
    defaultHoursPerWeekPct: 0.08,
    defaultCripp: 'Norme 13.1 — Communication relative à la mission & planification',
  },
  {
    phase: 'Phase de préparation',
    stepNumber: 11,
    label: 'Le programme de travail',
    defaultHoursPerWeekPct: 0.10,
    defaultCripp: 'Norme 13.6 — Programme de travail',
  },
  // Phase de réalisation
  {
    phase: 'Phase de réalisation',
    stepNumber: 12,
    label: 'La phase de terrain-test (feuille de couverture)',
    defaultHoursPerWeekPct: 1.0,
    defaultCripp: 'Norme 14.1 — Collecte des informations & preuves d’audit',
  },
  // Phase de conclusion (5 étapes)
  {
    phase: 'Phase de conclusion',
    stepNumber: 13,
    label: 'LA FRAP = Feuille de Révélation et d’Analyse de Problème',
    defaultHoursPerWeekPct: 0.25,
    defaultCripp: 'Norme 14.3 — Évaluation des constats (FRAP 5C)',
  },
  {
    phase: 'Phase de conclusion',
    stepNumber: 14,
    label: 'La synthèse des FRAP',
    defaultHoursPerWeekPct: 0.20,
    defaultCripp: 'Norme 14.3 — Évaluation des constats (FRAP 5C)',
  },
  {
    phase: 'Phase de conclusion',
    stepNumber: 15,
    label: 'Le rapport provisoire',
    defaultHoursPerWeekPct: 0.20,
    defaultCripp: 'Norme 15.1 — Communication des résultats finaux',
  },
  {
    phase: 'Phase de conclusion',
    stepNumber: 16,
    label: 'La réunion de clôture',
    defaultHoursPerWeekPct: 0.15,
    defaultCripp: 'Norme 11.2 — Communication efficace',
  },
  {
    phase: 'Phase de conclusion',
    stepNumber: 17,
    label: 'Le rapport final',
    defaultHoursPerWeekPct: 0.20,
    defaultCripp: 'Norme 15.1 — Communication des résultats finaux',
  },
];

export const AUDIT_PLAN_TOOLS_TEMPLATE: string[] = [
  'Outil I · Matrice RACI & Allocation équipe 08h/j',
  'Outil II · QCI & Référentiel contrôle interne industriel',
  'Outil III · Feuille de couverture & Échantillonnage statistique',
  'Outil IV · Modèle FRAP 5C & Suivi des écarts',
];

export const AUDIT_PLAN_STEP_TASK_EXAMPLES: string[] = [
  'Préciser les objectifs et le périmètre de la mission',
  'Conduire la réunion d’ouverture',
  'Analyser les processus et leurs objectifs',
  'Identifier et évaluer les risques',
  'Evaluer la conception du dispositif de contrôle',
  'Valider le référentiel d’audit',
  'Sélectionner les objectifs d’audit',
  'Elaborer le programme de travail',
  'Ajuster le budget et allouer les ressources',
  'Valider l’organisation de la mission',
  'Conduire la réunion de lancement de la phase accomplissement',
  'Collecter les informations et constituer les preuves d’audit',
  'Valider les preuves d’audit',
  'Analyser les causes',
  'Elaborer les recommandations',
  'Conduire la réunion de clôture',
  'Finaliser le plan d’actions',
  'Rédiger le rapport',
  'Valider le rapport',
];

export const AUDIT_PLAN_SCHEDULE_META: Record<
  AuditPlanScheduleStatus,
  {
    label: string;
    shortLabel: string;
    barBg: string;
    barBorder: string;
    badgeBg: string;
    textClass: string;
    hex: string;
  }
> = {
  'en-avance': {
    label: 'En avance',
    shortLabel: 'Avance',
    barBg: 'bg-sky-600',
    barBorder: 'border-sky-700',
    badgeBg: 'border-sky-200 bg-sky-50 text-sky-800',
    textClass: 'text-sky-700',
    hex: '#0284C7',
  },
  normal: {
    label: 'Progression normale',
    shortLabel: 'Normal',
    barBg: 'bg-emerald-600',
    barBorder: 'border-emerald-700',
    badgeBg: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    textClass: 'text-emerald-700',
    hex: '#16A34A',
  },
  'en-retard': {
    label: 'En retard',
    shortLabel: 'Retard',
    barBg: 'bg-red-600',
    barBorder: 'border-red-700',
    badgeBg: 'border-red-200 bg-red-50 text-red-800',
    textClass: 'text-red-700',
    hex: '#DC2626',
  },
};

export interface IndustrialMissionBlueprint {
  code: string;
  no: number;
  titre: string;
  direction: string;
  objectif: string;
  perimetre: string;
  risque: 'Critique' | 'Élevé' | 'Moyen' | 'Faible';
  normeCripp: string;
  auditeurs: string[];
  chefMission: string;
  startDate: string; // YYYY-MM-DD (2026)
  dureeSemaines: number; // ~3 weeks average
  scheduleStatus: AuditPlanScheduleStatus;
  varianceDays: number; // <0 ahead, 0 normal, >0 late
  progressionPct: number;
}

export const INDUSTRIAL_2026_MISSION_BLUEPRINTS: IndustrialMissionBlueprint[] = [
  {
    code: 'IND-26-01',
    no: 1,
    titre: 'Audit Maintenance Préventive & GMAO Ligne A/B',
    direction: 'Direction Technique & Maintenance',
    objectif: 'Fiabiliser le plan de maintenance préventive des lignes d’emboutissage et réduire les arrêts non planifiés.',
    perimetre: 'Usine Nord · GMAO SAP PM, stock pièces critiques & habilitations mécaniques',
    risque: 'Critique',
    normeCripp: 'Norme 9.4 — Plan d’audit fondé sur les risques',
    auditeurs: ['SEK', 'JFK', 'TAK'],
    chefMission: 'SEK',
    startDate: '2026-01-12',
    dureeSemaines: 3,
    scheduleStatus: 'normal',
    varianceDays: 0,
    progressionPct: 100,
  },
  {
    code: 'IND-26-02',
    no: 2,
    titre: 'Audit Gestion des Stocks Matières Premières & WMS',
    direction: 'Direction Supply Chain & Logistique',
    objectif: 'Évaluer la fiabilité des inventaires tournants, la valorisation CUMP et les écarts de réception quai.',
    perimetre: 'Entrepôt Central · Flux réceptions, sorties production & rebuts matières',
    risque: 'Élevé',
    normeCripp: 'Norme 13.6 — Programme de travail',
    auditeurs: ['JFK', 'OHA', 'TAK'],
    chefMission: 'JFK',
    startDate: '2026-02-02',
    dureeSemaines: 3,
    scheduleStatus: 'en-avance',
    varianceDays: -2,
    progressionPct: 100,
  },
  {
    code: 'IND-26-03',
    no: 3,
    titre: 'Audit Conformité Qualité ISO 9001 & Maîtrise Rebuts',
    direction: 'Direction Qualité & Méthodes',
    objectif: 'Contrôler la traçabilité des lots non conformes, les actions correctives 8D et le coût de non-qualité.',
    perimetre: 'Ateliers Assemblage 1 à 4 · Laboratoire métrologie & certificats matières',
    risque: 'Élevé',
    normeCripp: 'Norme 14.1 — Collecte des informations & preuves d’audit',
    auditeurs: ['SEK', 'OHA', 'MGR'],
    chefMission: 'SEK',
    startDate: '2026-02-23',
    dureeSemaines: 3,
    scheduleStatus: 'en-retard',
    varianceDays: 3,
    progressionPct: 100,
  },
  {
    code: 'IND-26-04',
    no: 4,
    titre: 'Audit Sécurité Industrielle HSE, Zones ATEX & EPI',
    direction: 'Direction Hygiène, Sécurité & Environnement',
    objectif: 'Vérifier l’application des permis feu, la conformité des zones ATEX et le suivi des quasi-accidents.',
    perimetre: 'Site Chimie & Peinture · Consignations LOTO, exercices évacuation & FDS',
    risque: 'Critique',
    normeCripp: 'Norme 13.2 — Évaluation des risques de la mission',
    auditeurs: ['TAK', 'JFK', 'MGR'],
    chefMission: 'MGR',
    startDate: '2026-03-16',
    dureeSemaines: 3,
    scheduleStatus: 'normal',
    varianceDays: 0,
    progressionPct: 100,
  },
  {
    code: 'IND-26-05',
    no: 5,
    titre: 'Audit Achats Industriels, Appels d’Offres & Sous-Traitance',
    direction: 'Direction Achats Industriels',
    objectif: 'Sécuriser la séparation des tâches achats/réception, prévenir les fractionnements et contrôler les avenants.',
    perimetre: 'Fournisseurs outillages, sous-traitance usinage & contrats transport',
    risque: 'Critique',
    normeCripp: 'Norme 14.3 — Évaluation des constats (FRAP 5C)',
    auditeurs: ['SEK', 'JFK', 'OHA'],
    chefMission: 'SEK',
    startDate: '2026-04-06',
    dureeSemaines: 3,
    scheduleStatus: 'en-retard',
    varianceDays: 4,
    progressionPct: 92,
  },
  {
    code: 'IND-26-06',
    no: 6,
    titre: 'Audit Cybersécurité Industrielle OT / SCADA & Automates',
    direction: 'Direction Systèmes d’Information Industriels',
    objectif: 'Tester la segmentation réseau IT/OT, les sauvegardes automates PLC et les accès télémaintenance.',
    perimetre: 'Supervision SCADA · 14 automates Siemens/Schneider & pare-feu industriels',
    risque: 'Critique',
    normeCripp: 'Norme 13.4 — Critères d’évaluation',
    auditeurs: ['OHA', 'SEK', 'TAK'],
    chefMission: 'OHA',
    startDate: '2026-04-27',
    dureeSemaines: 4,
    scheduleStatus: 'en-avance',
    varianceDays: -3,
    progressionPct: 100,
  },
  {
    code: 'IND-26-07',
    no: 7,
    titre: 'Audit Cycle Ventes Industrielles B2B & Cut-Off Expéditions',
    direction: 'Direction Commerciale & ADV',
    objectif: 'Contrôler la validation des remises OEM, les encours clients et le cut-off BL/facturation fin de mois.',
    perimetre: 'Commandes grands comptes, pénalités de retard & avoirs commerciaux',
    risque: 'Élevé',
    normeCripp: 'Norme 14.1 — Collecte des informations & preuves d’audit',
    auditeurs: ['JFK', 'TAK', 'OHA'],
    chefMission: 'JFK',
    startDate: '2026-05-25',
    dureeSemaines: 3,
    scheduleStatus: 'normal',
    varianceDays: 0,
    progressionPct: 86,
  },
  {
    code: 'IND-26-08',
    no: 8,
    titre: 'Audit Paie Postée 3x8, Primes d’Équipe & Intérim Usine',
    direction: 'Direction Ressources Humaines Usine',
    objectif: 'Vérifier le pointage badgeuse, le calcul des heures de nuit/dimanche et la facturation des agences d’intérim.',
    perimetre: '420 opérateurs postés · Badgeuses ateliers, heures supp. & contrats ETT',
    risque: 'Moyen',
    normeCripp: 'Norme 13.6 — Programme de travail',
    auditeurs: ['TAK', 'OHA', 'JFK'],
    chefMission: 'JFK',
    startDate: '2026-06-15',
    dureeSemaines: 3,
    scheduleStatus: 'en-retard',
    varianceDays: 2,
    progressionPct: 74,
  },
  {
    code: 'IND-26-09',
    no: 9,
    titre: 'Audit Projets CAPEX Industriels & Réception Machines',
    direction: 'Direction Financière & Contrôle de Gestion',
    objectif: 'Évaluer les dépassements budgétaires d’investissement, les PV de réception FAT/SAT et la mise en service.',
    perimetre: 'Nouvelle ligne robotisée Sud · Engagements CAPEX 1,8 Md FCFA',
    risque: 'Élevé',
    normeCripp: 'Norme 12.3 — Supervision des missions',
    auditeurs: ['SEK', 'MGR', 'OHA'],
    chefMission: 'SEK',
    startDate: '2026-07-06',
    dureeSemaines: 3,
    scheduleStatus: 'en-avance',
    varianceDays: -2,
    progressionPct: 68,
  },
  {
    code: 'IND-26-10',
    no: 10,
    titre: 'Audit Conformité Environnementale ICPE & Effluents',
    direction: 'Direction Hygiène, Sécurité & Environnement',
    objectif: 'Contrôler les bordereaux de suivi des déchets dangereux (BSDD) et les relevés rejets aqueux/atmosphériques.',
    perimetre: 'Station prétraitement, stockage solvants & arrêtés préfectoraux',
    risque: 'Élevé',
    normeCripp: 'Norme 14.3 — Évaluation des constats (FRAP 5C)',
    auditeurs: ['JFK', 'TAK', 'MGR'],
    chefMission: 'MGR',
    startDate: '2026-08-24',
    dureeSemaines: 3,
    scheduleStatus: 'normal',
    varianceDays: 0,
    progressionPct: 45,
  },
  {
    code: 'IND-26-11',
    no: 11,
    titre: 'Audit Douanes, Transit Import-Export & Régimes Suspensifs',
    direction: 'Direction Supply Chain & Logistique',
    objectif: 'Sécuriser les déclarations en douane, l’apurement des admissions temporaires et les frais de surestaries.',
    perimetre: 'Port autonome · 185 dossiers import composants & export produits finis',
    risque: 'Moyen',
    normeCripp: 'Norme 13.1 — Communication relative à la mission & planification',
    auditeurs: ['OHA', 'JFK', 'TAK'],
    chefMission: 'OHA',
    startDate: '2026-09-21',
    dureeSemaines: 3,
    scheduleStatus: 'en-retard',
    varianceDays: 3,
    progressionPct: 30,
  },
  {
    code: 'IND-26-12',
    no: 12,
    titre: 'Audit Performance Énergétique, Utilités & Décarbonation',
    direction: 'Direction Technique & Maintenance',
    objectif: 'Analyser la consommation kWh/tonne produite, les contrats gaz/électricité et la fiabilité du reporting RSE.',
    perimetre: 'Chaufferie vapeur, compresseurs air comprimé & compteurs divisionnaires',
    risque: 'Moyen',
    normeCripp: 'Norme 15.1 — Communication des résultats finaux',
    auditeurs: ['SEK', 'OHA', 'TAK'],
    chefMission: 'SEK',
    startDate: '2026-10-19',
    dureeSemaines: 3,
    scheduleStatus: 'normal',
    varianceDays: 0,
    progressionPct: 15,
  },
];

// 3 missions complémentaires si l'utilisateur génère 13, 14 ou 15 missions
const EXTRA_INDUSTRIAL_BLUEPRINTS: IndustrialMissionBlueprint[] = [
  {
    code: 'IND-26-13',
    no: 13,
    titre: 'Audit Ordonnancement Production MRP & Respect Délais OTIF',
    direction: 'Direction Production & Ordonnancement',
    objectif: 'Évaluer la qualité des nomenclatures BOM, gammes opératoires ERP et le taux de service OTIF client.',
    perimetre: 'Calcul des besoins nets MRP II & ordres de fabrication OF',
    risque: 'Élevé',
    normeCripp: 'Norme 13.6 — Programme de travail',
    auditeurs: ['JFK', 'SEK', 'TAK'],
    chefMission: 'SEK',
    startDate: '2026-11-09',
    dureeSemaines: 3,
    scheduleStatus: 'en-avance',
    varianceDays: -1,
    progressionPct: 10,
  },
  {
    code: 'IND-26-14',
    no: 14,
    titre: 'Audit Trésorerie Usine, Couverture Matières & Notes de Frais',
    direction: 'Direction Financière & Contrôle de Gestion',
    objectif: 'Contrôler les régies d’avances site, le rapprochement bancaire quotidien et les frais de déplacements.',
    perimetre: 'Caisse site, comptes bancaires locaux & avances mission',
    risque: 'Moyen',
    normeCripp: 'Norme 14.1 — Collecte des informations & preuves d’audit',
    auditeurs: ['OHA', 'TAK', 'MGR'],
    chefMission: 'OHA',
    startDate: '2026-11-23',
    dureeSemaines: 2,
    scheduleStatus: 'normal',
    varianceDays: 0,
    progressionPct: 5,
  },
  {
    code: 'IND-26-15',
    no: 15,
    titre: 'Audit Plan de Continuité Industrielle (PCA) & Assurances Dommages',
    direction: 'Direction Générale & Risques Industriels',
    objectif: 'Tester les scénarios sinistre majeur, les contrats pertes d’exploitation et les plans de repli fournisseurs.',
    perimetre: 'Polices dommages aux biens, bris de machine & cellule de crise',
    risque: 'Critique',
    normeCripp: 'Norme 9.4 — Plan d’audit fondé sur les risques',
    auditeurs: ['SEK', 'JFK', 'MGR'],
    chefMission: 'MGR',
    startDate: '2026-12-01',
    dureeSemaines: 3,
    scheduleStatus: 'normal',
    varianceDays: 0,
    progressionPct: 0,
  },
];

export function computeWorkingDaysBetween(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const s = new Date(`${startIso}T12:00:00`);
  const e = new Date(`${endIso}T12:00:00`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  if (s.getTime() === e.getTime()) return 0;
  const dir = e > s ? 1 : -1;
  const cursor = new Date(s);
  let count = 0;
  let guard = 0;
  while (cursor.toISOString().slice(0, 10) !== endIso && guard < 800) {
    cursor.setDate(cursor.getDate() + dir);
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      count += dir;
    }
    guard += 1;
  }
  return count;
}

export function classifyScheduleStatus(varianceDays: number): AuditPlanScheduleStatus {
  if (varianceDays < 0) return 'en-avance';
  if (varianceDays > 0) return 'en-retard';
  return 'normal';
}

export function convertUnitToHours(value: number, unit: AuditPlanTaskUnit): number {
  const safe = Math.max(0.5, Number(value) || 0.5);
  if (unit === 'semaine') return round2(safe * 5 * WORKDAY_HOURS);
  if (unit === 'jour') return round2(safe * WORKDAY_HOURS);
  return round2(safe);
}

export function formatHoursInUnit(hours: number, unit: AuditPlanTaskUnit): string {
  if (unit === 'semaine') return `${round2(hours / (5 * WORKDAY_HOURS))} sem.`;
  if (unit === 'jour') return `${round2(hours / WORKDAY_HOURS)} j`;
  return `${round2(hours)} h`;
}

function buildStepTaskList(
  stepNodeId: string,
  step: AuditPlanStepTemplate,
  stepStartIso: string,
  stepEndIso: string,
  auditors: string[],
  missionStatus: AuditPlanScheduleStatus,
  missionVarianceDays: number,
  progressionPct: number
): MissionTodoTask[] {
  // Choisir 2 ou 3 tâches par étape pour démontrer la répartition sur 08h/jour par auditeur
  const sampleTasksForPhase: Record<
    AuditPlanStepTemplate['phase'],
    string[]
  > = {
    'Phase de préparation': [
      AUDIT_PLAN_STEP_TASK_EXAMPLES[0],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[2],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[3],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[4],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[7],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[8],
    ],
    'Phase de réalisation': [
      AUDIT_PLAN_STEP_TASK_EXAMPLES[10],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[11],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[12],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[13],
    ],
    'Phase de conclusion': [
      AUDIT_PLAN_STEP_TASK_EXAMPLES[14],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[15],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[16],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[17],
      AUDIT_PLAN_STEP_TASK_EXAMPLES[18],
    ],
  };

  const pool = sampleTasksForPhase[step.phase];
  const primaryAuditor = auditors[step.stepNumber % auditors.length] || 'SEK';
  const secondaryAuditor = auditors[(step.stepNumber + 1) % auditors.length] || 'JFK';

  // Sélection déterministe de 2 tâches quotidiennes sur 08h/jour (4h + 4h ou 8h selon phase)
  const task1Title =
    step.stepNumber === 1
      ? AUDIT_PLAN_STEP_TASK_EXAMPLES[0]
      : step.stepNumber === 5
      ? AUDIT_PLAN_STEP_TASK_EXAMPLES[1]
      : step.stepNumber === 11
      ? AUDIT_PLAN_STEP_TASK_EXAMPLES[7]
      : step.stepNumber === 12
      ? AUDIT_PLAN_STEP_TASK_EXAMPLES[11]
      : step.stepNumber === 16
      ? AUDIT_PLAN_STEP_TASK_EXAMPLES[15]
      : step.stepNumber === 17
      ? AUDIT_PLAN_STEP_TASK_EXAMPLES[18]
      : pool[step.stepNumber % pool.length];

  const task2Title =
    step.stepNumber === 12
      ? AUDIT_PLAN_STEP_TASK_EXAMPLES[12]
      : pool[(step.stepNumber + 1) % pool.length];

  const isDone =
    progressionPct >= 95 ||
    (progressionPct >= 65 && step.phase === 'Phase de préparation') ||
    (progressionPct >= 85 && step.phase === 'Phase de réalisation');

  const isStarted =
    isDone ||
    (progressionPct >= 25 && step.phase === 'Phase de préparation') ||
    (progressionPct >= 50 && step.phase === 'Phase de réalisation');

  const baseHours1 = step.phase === 'Phase de réalisation' ? 8 : 4;
  const baseHours2 = step.phase === 'Phase de réalisation' ? 8 : 4;

  const varianceHours1 =
    step.phase === 'Phase de réalisation' || step.stepNumber === 11 || step.stepNumber === 15
      ? missionVarianceDays > 0
        ? round2(missionVarianceDays * 2)
        : missionVarianceDays < 0
        ? round2(missionVarianceDays * 1.5)
        : 0
      : 0;

  const actualHours1 = isDone ? Math.max(1, round2(baseHours1 + varianceHours1)) : isStarted ? round2(baseHours1 * 0.6) : undefined;
  const actualHours2 = isDone ? baseHours2 : undefined;

  const task1Schedule: AuditPlanScheduleStatus =
    varianceHours1 > 0 ? 'en-retard' : varianceHours1 < 0 ? 'en-avance' : missionStatus === 'en-retard' && !isDone && step.phase !== 'Phase de préparation' ? 'en-retard' : 'normal';

  const status1: TodoTaskStatus = isDone ? 'done' : isStarted ? 'in-progress' : 'todo';
  const status2: TodoTaskStatus = isDone ? 'done' : 'todo';

  const actualEnd1 =
    varianceHours1 !== 0
      ? addWorkingDays(stepEndIso, varianceHours1 > 0 ? 1 : -1)
      : stepEndIso;

  const tasks: MissionTodoTask[] = [
    {
      id: `pt-${stepNodeId}-1`,
      nodeId: stepNodeId,
      title: task1Title,
      auditor: primaryAuditor,
      plannedDate: stepStartIso,
      plannedEndDate: stepEndIso,
      actualEndDate: actualEnd1,
      plannedStartHour: 8,
      plannedDurationHours: baseHours1,
      unit: 'heure',
      actualHours: actualHours1,
      varianceHours: actualHours1 !== undefined ? round2(actualHours1 - baseHours1) : undefined,
      scheduleStatus: task1Schedule,
      status: status1,
      crippNormRef: step.defaultCripp,
      methodologyAssessment: isDone ? 'conforme' : 'pending',
      createdAt: '2026-01-05T08:00:00.000Z',
    },
    {
      id: `pt-${stepNodeId}-2`,
      nodeId: stepNodeId,
      title: task2Title,
      auditor: secondaryAuditor,
      plannedDate: stepStartIso,
      plannedEndDate: stepEndIso,
      actualEndDate: stepEndIso,
      plannedStartHour: step.phase === 'Phase de réalisation' ? 8 : 13,
      plannedDurationHours: baseHours2,
      unit: 'heure',
      actualHours: actualHours2,
      varianceHours: actualHours2 !== undefined ? round2(actualHours2 - baseHours2) : undefined,
      scheduleStatus: 'normal',
      status: status2,
      crippNormRef: step.defaultCripp,
      methodologyAssessment: isDone ? 'conforme' : 'pending',
      createdAt: '2026-01-05T08:30:00.000Z',
    },
  ];

  // Ajouter une 3e tâche sur la phase terrain-test ou rapport final pour illustrer 3 tâches auditeurs
  if (step.stepNumber === 12 || step.stepNumber === 13 || step.stepNumber === 17) {
    const tertiaryAuditor = auditors[2 % auditors.length] || 'TAK';
    const thirdDay = addWorkingDays(stepStartIso, 1);
    tasks.push({
      id: `pt-${stepNodeId}-3`,
      nodeId: stepNodeId,
      title:
        step.stepNumber === 12
          ? AUDIT_PLAN_STEP_TASK_EXAMPLES[13]
          : step.stepNumber === 13
          ? AUDIT_PLAN_STEP_TASK_EXAMPLES[14]
          : AUDIT_PLAN_STEP_TASK_EXAMPLES[16],
      auditor: tertiaryAuditor,
      plannedDate: thirdDay,
      plannedEndDate: stepEndIso,
      actualEndDate: actualEnd1,
      plannedStartHour: 8,
      plannedDurationHours: 8,
      unit: 'jour',
      actualHours: isDone ? Math.max(4, 8 + (missionVarianceDays > 0 ? 4 : missionVarianceDays < 0 ? -2 : 0)) : undefined,
      varianceHours: isDone ? (missionVarianceDays > 0 ? 4 : missionVarianceDays < 0 ? -2 : 0) : undefined,
      scheduleStatus: missionStatus,
      status: status2,
      crippNormRef: step.defaultCripp,
      methodologyAssessment: isDone ? 'conforme' : 'pending',
      createdAt: '2026-01-05T09:00:00.000Z',
    });
  }

  return tasks;
}

export function buildMissionNodeFromBlueprint(
  prefix: 'user' | 'team',
  bp: IndustrialMissionBlueprint,
  idSuffix = ''
): WorkflowTreeNode {
  const missionStart = snapToWorkingDay(bp.startDate);
  const totalWorkDays = Math.max(10, bp.dureeSemaines * 5); // ~15 jours ouvrables pour 3 semaines
  const prepDays = Math.max(4, Math.round(totalWorkDays * 0.35)); // ~1 semaine
  const realDays = Math.max(4, Math.round(totalWorkDays * 0.40)); // ~1 semaine+
  const concDays = Math.max(3, totalWorkDays - prepDays - realDays); // ~1 semaine

  const prepStart = missionStart;
  const prepEnd = addWorkingDays(prepStart, prepDays - 1);
  const realStart = addWorkingDays(prepEnd, 1);
  const realEnd = addWorkingDays(realStart, realDays - 1);
  const concStart = addWorkingDays(realEnd, 1);
  const concEnd = addWorkingDays(concStart, concDays - 1);

  const missionEndPlanned = concEnd;
  const missionEndReal =
    bp.varianceDays !== 0 ? addWorkingDays(missionEndPlanned, bp.varianceDays) : missionEndPlanned;

  const missionId = `${prefix}-2026-plan-m-${bp.no}${idSuffix}`;

  const phaseRanges: Record<
    AuditPlanStepTemplate['phase'],
    { start: string; end: string; days: number }
  > = {
    'Phase de préparation': { start: prepStart, end: prepEnd, days: prepDays },
    'Phase de réalisation': { start: realStart, end: realEnd, days: realDays },
    'Phase de conclusion': { start: concStart, end: concEnd, days: concDays },
  };

  const phaseNodes: WorkflowTreeNode[] = AUDIT_PLAN_PHASES_ORDER.map((phaseName, phaseIdx) => {
    const pRange = phaseRanges[phaseName];
    const phaseSteps = AUDIT_PLAN_STEPS_TEMPLATE.filter((s) => s.phase === phaseName);
    const phaseId = `${missionId}-p${phaseIdx + 1}`;

    const stepNodes: WorkflowTreeNode[] = phaseSteps.map((step, sIdx) => {
      const stepOffset =
        phaseSteps.length <= 1
          ? 0
          : Math.floor((sIdx / phaseSteps.length) * pRange.days);
      const nextOffset =
        phaseSteps.length <= 1
          ? pRange.days - 1
          : Math.max(stepOffset, Math.floor(((sIdx + 1) / phaseSteps.length) * pRange.days) - 1);

      const sStart = addWorkingDays(pRange.start, stepOffset);
      const sEnd = addWorkingDays(pRange.start, nextOffset);
      const applyVariance =
        phaseName === 'Phase de réalisation' || phaseName === 'Phase de conclusion';
      const stepVar = applyVariance ? bp.varianceDays : 0;
      const sEndReal = stepVar !== 0 ? addWorkingDays(sEnd, stepVar) : sEnd;
      const stepSched: AuditPlanScheduleStatus =
        stepVar > 0 ? 'en-retard' : stepVar < 0 ? 'en-avance' : 'normal';

      const stepProgress =
        bp.progressionPct >= 95
          ? 100
          : phaseName === 'Phase de préparation'
          ? Math.min(100, Math.round(bp.progressionPct * 1.4))
          : phaseName === 'Phase de réalisation'
          ? Math.min(100, Math.max(0, Math.round((bp.progressionPct - 25) * 1.35)))
          : Math.min(100, Math.max(0, Math.round((bp.progressionPct - 65) * 2.5)));

      const stepStatus: WorkflowNodeStatus =
        stepProgress === 100
          ? 'validated'
          : stepProgress >= 60
          ? 'in-review'
          : stepProgress > 0
          ? 'in-progress'
          : 'todo';

      const stepId = `${phaseId}-s${step.stepNumber}`;
      const stepMeta: AuditPlanStepMeta = {
        phase: phaseName,
        stepNumber: step.stepNumber,
        dateDebut: sStart,
        dateFin: sEnd,
        dateFinReelle: sEndReal,
        progressionPct: stepProgress,
        ecartJours: stepVar,
        statutProgression: stepSched,
      };

      const tasks = buildStepTaskList(
        stepId,
        step,
        sStart,
        sEnd,
        bp.auditeurs,
        bp.scheduleStatus,
        bp.varianceDays,
        bp.progressionPct
      );

      return {
        id: stepId,
        label: step.label,
        nodeType: 'sous-section',
        natureId: 'plan-audit',
        owner: bp.auditeurs[sIdx % bp.auditeurs.length],
        assignee: bp.auditeurs[sIdx % bp.auditeurs.length],
        dueDate: sEnd,
        status: stepStatus,
        managerReviewed: stepProgress === 100,
        planStepMeta: stepMeta,
        todoTasks: tasks,
        children: [
          {
            id: `${stepId}-doc`,
            label: `${String(step.stepNumber).padStart(2, '0')}. Livrable — ${step.label} (${bp.code})`,
            nodeType: 'document',
            natureId: 'plan-audit',
            driveId: `1drv_pa_${bp.no}_${step.stepNumber}`,
            signature: bp.auditeurs[sIdx % bp.auditeurs.length],
            owner: bp.auditeurs[sIdx % bp.auditeurs.length],
            assignee: bp.auditeurs[sIdx % bp.auditeurs.length],
            dueDate: sEnd,
            status: stepStatus,
            managerReviewed: stepProgress === 100,
          },
        ],
      };
    });

    const phaseProgress =
      stepNodes.length > 0
        ? Math.round(
            stepNodes.reduce((sum, st) => sum + (st.planStepMeta?.progressionPct || 0), 0) /
              stepNodes.length
          )
        : 0;

    return {
      id: phaseId,
      label: phaseName,
      nodeType: 'section',
      natureId: 'plan-audit',
      owner: bp.chefMission,
      dueDate: pRange.end,
      status:
        phaseProgress === 100
          ? 'validated'
          : phaseProgress > 0
          ? 'in-progress'
          : 'todo',
      planStepMeta: {
        phase: phaseName,
        dateDebut: pRange.start,
        dateFin: pRange.end,
        dateFinReelle:
          phaseName === 'Phase de préparation'
            ? pRange.end
            : bp.varianceDays !== 0
            ? addWorkingDays(pRange.end, bp.varianceDays)
            : pRange.end,
        progressionPct: phaseProgress,
        ecartJours: phaseName === 'Phase de préparation' ? 0 : bp.varianceDays,
        statutProgression:
          phaseName === 'Phase de préparation' ? 'normal' : bp.scheduleStatus,
      },
      children: stepNodes,
    };
  });

  // Outils node
  const outilsNode: WorkflowTreeNode = {
    id: `${missionId}-outils`,
    label: 'Outils',
    nodeType: 'section',
    natureId: 'plan-audit',
    owner: bp.chefMission,
    status: bp.progressionPct >= 50 ? 'in-progress' : 'todo',
    children: AUDIT_PLAN_TOOLS_TEMPLATE.map((toolLabel, idx) => ({
      id: `${missionId}-tool-${idx + 1}`,
      label: `${toolLabel} (${bp.code})`,
      nodeType: 'document',
      natureId: 'plan-audit',
      driveId: `1drv_pa_tool_${bp.no}_${idx + 1}`,
      signature: bp.auditeurs[idx % bp.auditeurs.length],
      owner: bp.auditeurs[idx % bp.auditeurs.length],
      status: bp.progressionPct >= 80 ? 'validated' : 'in-progress',
    })),
  };

  // Calcul budget/réel cohérent (3 semaines * ~3 auditeurs -> ~120h budget standard par mission)
  const budgetHeures = round2(bp.dureeSemaines * 5 * WORKDAY_HOURS * (bp.auditeurs.length / 3) * 1);
  const ratio = bp.progressionPct / 100;
  const heuresRealisees = round2(
    budgetHeures * ratio + (bp.varianceDays * 3)
  );

  const missionMeta: AuditPlanMissionMeta = {
    code: bp.code,
    no: bp.no,
    secteur: 'Industrie',
    exercice: '2026',
    direction: bp.direction,
    objectif: bp.objectif,
    perimetre: bp.perimetre,
    risque: bp.risque,
    normeCripp: bp.normeCripp,
    nbAuditeurs: bp.auditeurs.length,
    auditeurs: bp.auditeurs,
    chefMission: bp.chefMission,
    dureeSemaines: bp.dureeSemaines,
    dateDebut: missionStart,
    dateFinPrevue: missionEndPlanned,
    dateFinReelle: missionEndReal,
    progressionPct: bp.progressionPct,
    budgetHeures,
    heuresRealisees: Math.max(0, heuresRealisees),
    ecartJours: bp.varianceDays,
    statutProgression: bp.scheduleStatus,
  };

  return {
    id: missionId,
    label: `${bp.code} · ${bp.titre}`,
    nodeType: 'activite',
    natureId: 'plan-audit',
    owner: bp.chefMission,
    assignee: bp.auditeurs.join(', '),
    dueDate: missionEndPlanned,
    status:
      bp.progressionPct === 100
        ? 'validated'
        : bp.progressionPct >= 65
        ? 'in-review'
        : bp.progressionPct > 0
        ? 'in-progress'
        : 'todo',
    managerReviewed: bp.progressionPct === 100,
    planMissionMeta: missionMeta,
    children: [...phaseNodes, outilsNode],
  };
}

export function generateIndustrialAuditPlanMissions(
  prefix: 'user' | 'team',
  count = 12,
  idSuffix = ''
): WorkflowTreeNode[] {
  const safeCount = Math.min(15, Math.max(10, Math.round(count)));
  const pool = [...INDUSTRIAL_2026_MISSION_BLUEPRINTS, ...EXTRA_INDUSTRIAL_BLUEPRINTS];
  return pool.slice(0, safeCount).map((bp) => buildMissionNodeFromBlueprint(prefix, bp, idSuffix));
}

export function buildPlanAudit2026Children(prefix: 'user' | 'team'): WorkflowTreeNode[] {
  return generateIndustrialAuditPlanMissions(prefix, 12);
}

export interface LivePlanTaskRow {
  task: MissionTodoTask;
  stepNodeId: string;
  stepLabel: string;
  phaseName: string;
}

export interface LivePlanStepRow {
  node: WorkflowTreeNode;
  phaseName: string;
  stepNumber: number;
  dateDebut: string;
  dateFin: string;
  dateFinReelle: string;
  ecartJours: number;
  progressionPct: number;
  statutProgression: AuditPlanScheduleStatus;
  tasks: MissionTodoTask[];
}

export interface LivePlanPhaseRow {
  node: WorkflowTreeNode;
  phaseName: 'Phase de préparation' | 'Phase de réalisation' | 'Phase de conclusion';
  dateDebut: string;
  dateFin: string;
  dateFinReelle: string;
  ecartJours: number;
  progressionPct: number;
  statutProgression: AuditPlanScheduleStatus;
  steps: LivePlanStepRow[];
}

export interface LiveAuditPlanMission {
  node: WorkflowTreeNode;
  meta: AuditPlanMissionMeta;
  phases: LivePlanPhaseRow[];
  outilsNode?: WorkflowTreeNode;
  allTasks: LivePlanTaskRow[];
  plannedTaskHours: number;
  actualTaskHours: number;
  varianceTaskHours: number;
}

export function extractPlanMissionsFromTrees(
  trees: WorkflowTreeNode[],
  scopeNodeId?: string
): LiveAuditPlanMission[] {
  const results: LiveAuditPlanMission[] = [];
  const seenIds = new Set<string>();

  const buildLiveMission = (missionNode: WorkflowTreeNode): LiveAuditPlanMission => {
    const baseMeta = missionNode.planMissionMeta!;
    const phases: LivePlanPhaseRow[] = [];
    const allTasks: LivePlanTaskRow[] = [];
    let outilsNode: WorkflowTreeNode | undefined;

    for (const child of missionNode.children || []) {
      if (child.label === 'Outils' || child.planStepMeta?.phase === 'Outils') {
        outilsNode = child;
        continue;
      }

      const phaseName =
        (child.planStepMeta?.phase as LivePlanPhaseRow['phaseName']) ||
        (child.label.includes('préparation')
          ? 'Phase de préparation'
          : child.label.includes('réalisation')
          ? 'Phase de réalisation'
          : 'Phase de conclusion');

      const steps: LivePlanStepRow[] = [];
      for (const sNode of child.children || []) {
        const sMeta = sNode.planStepMeta;
        const sTasks = sNode.todoTasks || [];
        for (const t of sTasks) {
          allTasks.push({
            task: t,
            stepNodeId: sNode.id,
            stepLabel: sNode.label,
            phaseName,
          });
        }

        const dateDebut = sMeta?.dateDebut || baseMeta.dateDebut;
        const dateFin = sMeta?.dateFin || sNode.dueDate || baseMeta.dateFinPrevue;
        const dateFinReelle = sMeta?.dateFinReelle || dateFin;
        const ecartJours =
          sMeta?.ecartJours !== undefined
            ? sMeta.ecartJours
            : computeWorkingDaysBetween(dateFin, dateFinReelle);

        const doneCount = sTasks.filter((t) => t.status === 'done').length;
        const computedStepPct =
          sTasks.length > 0 && sMeta?.progressionPct === undefined
            ? Math.round((doneCount / sTasks.length) * 100)
            : sMeta?.progressionPct ?? (sNode.status === 'validated' ? 100 : 50);

        steps.push({
          node: sNode,
          phaseName,
          stepNumber: sMeta?.stepNumber ?? steps.length + 1,
          dateDebut,
          dateFin,
          dateFinReelle,
          ecartJours,
          progressionPct: computedStepPct,
          statutProgression: classifyScheduleStatus(ecartJours),
          tasks: sTasks,
        });
      }

      const phaseStart =
        steps.length > 0
          ? steps.reduce((min, s) => (s.dateDebut < min ? s.dateDebut : min), steps[0].dateDebut)
          : child.planStepMeta?.dateDebut || baseMeta.dateDebut;
      const phaseEnd =
        steps.length > 0
          ? steps.reduce((max, s) => (s.dateFin > max ? s.dateFin : max), steps[0].dateFin)
          : child.planStepMeta?.dateFin || baseMeta.dateFinPrevue;
      const phaseEndReal =
        steps.length > 0
          ? steps.reduce(
              (max, s) => (s.dateFinReelle > max ? s.dateFinReelle : max),
              steps[0].dateFinReelle
            )
          : child.planStepMeta?.dateFinReelle || phaseEnd;
      const phaseVariance = computeWorkingDaysBetween(phaseEnd, phaseEndReal);
      const phaseProgress =
        steps.length > 0
          ? Math.round(steps.reduce((sum, s) => sum + s.progressionPct, 0) / steps.length)
          : child.planStepMeta?.progressionPct ?? 0;

      phases.push({
        node: child,
        phaseName,
        dateDebut: phaseStart,
        dateFin: phaseEnd,
        dateFinReelle: phaseEndReal,
        ecartJours: phaseVariance,
        progressionPct: phaseProgress,
        statutProgression: classifyScheduleStatus(phaseVariance),
        steps,
      });
    }

    const plannedTaskHours = round2(
      allTasks.reduce((sum, r) => sum + (r.task.plannedDurationHours || 0), 0)
    );
    const actualTaskHours = round2(
      allTasks.reduce(
        (sum, r) =>
          sum + (r.task.actualHours !== undefined ? r.task.actualHours : r.task.plannedDurationHours),
        0
      )
    );
    const varianceTaskHours = round2(
      allTasks.reduce((sum, r) => sum + (r.task.varianceHours || 0), 0)
    );

    const missionStart =
      phases.length > 0
        ? phases.reduce((min, p) => (p.dateDebut < min ? p.dateDebut : min), phases[0].dateDebut)
        : baseMeta.dateDebut;
    const missionEnd =
      phases.length > 0
        ? phases.reduce((max, p) => (p.dateFin > max ? p.dateFin : max), phases[0].dateFin)
        : baseMeta.dateFinPrevue;
    const missionEndReal =
      phases.length > 0
        ? phases.reduce(
            (max, p) => (p.dateFinReelle > max ? p.dateFinReelle : max),
            phases[0].dateFinReelle
          )
        : baseMeta.dateFinReelle || missionEnd;

    // Calcul de l'écart en jours : on intègre la date de fin des phases/étapes et l'écart horaire des tâches
    const stepDaysDelta = computeWorkingDaysBetween(missionEnd, missionEndReal);
    const taskDaysDelta = Math.round(varianceTaskHours / WORKDAY_HOURS);
    const effectiveVarianceDays =
      stepDaysDelta !== 0 ? stepDaysDelta : taskDaysDelta !== 0 ? taskDaysDelta : baseMeta.ecartJours;

    const liveStatus = classifyScheduleStatus(effectiveVarianceDays);
    const dynamicProgress =
      phases.length > 0
        ? Math.round(phases.reduce((sum, p) => sum + p.progressionPct, 0) / phases.length)
        : baseMeta.progressionPct;

    return {
      node: missionNode,
      meta: {
        ...baseMeta,
        dateDebut: missionStart,
        dateFinPrevue: missionEnd,
        dateFinReelle: missionEndReal,
        ecartJours: effectiveVarianceDays,
        statutProgression: liveStatus,
        progressionPct: dynamicProgress,
      },
      phases,
      outilsNode,
      allTasks,
      plannedTaskHours,
      actualTaskHours,
      varianceTaskHours,
    };
  };

  const walk = (nodes: WorkflowTreeNode[]) => {
    for (const n of nodes) {
      if (n.planMissionMeta && !seenIds.has(n.id)) {
        seenIds.add(n.id);
        results.push(buildLiveMission(n));
        continue;
      }
      if (n.children?.length) walk(n.children);
    }
  };

  if (scopeNodeId) {
    const findScope = (nodes: WorkflowTreeNode[]): WorkflowTreeNode | null => {
      for (const n of nodes) {
        if (n.id === scopeNodeId) return n;
        if (n.children?.length) {
          const found = findScope(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    const scope = findScope(trees);
    if (scope) {
      walk([scope]);
    }
  }

  // Fallback sur le scope utilisateur 2026 si scopeNodeId vide ou sans missions
  if (results.length === 0) {
    const userRoot = trees.find((r) => r.id === 'root-workflow') || trees[0];
    if (userRoot) walk([userRoot]);
  }

  return results.sort((a, b) => a.meta.no - b.meta.no);
}

export interface AuditPlanMetricsSummary {
  nbMissions: number;
  avgProgressionPct: number;
  avgDurationWeeks: number;
  avgAuditorsPerMission: number;
  totalBudgetHours: number;
  totalActualHours: number;
  totalPlannedTaskHours: number;
  totalVarianceHours: number;
  avgVarianceDays: number;
  countAhead: number;
  countNormal: number;
  countLate: number;
  criticalCount: number;
  totalTasks: number;
  doneTasks: number;
}

export function computeAuditPlanMetrics(
  missions: LiveAuditPlanMission[]
): AuditPlanMetricsSummary {
  const n = missions.length;
  if (n === 0) {
    return {
      nbMissions: 0,
      avgProgressionPct: 0,
      avgDurationWeeks: 0,
      avgAuditorsPerMission: 0,
      totalBudgetHours: 0,
      totalActualHours: 0,
      totalPlannedTaskHours: 0,
      totalVarianceHours: 0,
      avgVarianceDays: 0,
      countAhead: 0,
      countNormal: 0,
      countLate: 0,
      criticalCount: 0,
      totalTasks: 0,
      doneTasks: 0,
    };
  }

  let sumProg = 0;
  let sumWeeks = 0;
  let sumAuditors = 0;
  let totalBudgetHours = 0;
  let totalActualHours = 0;
  let totalPlannedTaskHours = 0;
  let totalVarianceHours = 0;
  let sumVarianceDays = 0;
  let countAhead = 0;
  let countNormal = 0;
  let countLate = 0;
  let criticalCount = 0;
  let totalTasks = 0;
  let doneTasks = 0;

  for (const m of missions) {
    sumProg += m.meta.progressionPct;
    sumWeeks += m.meta.dureeSemaines;
    sumAuditors += m.meta.nbAuditeurs;
    totalBudgetHours += m.meta.budgetHeures;
    totalActualHours += m.meta.heuresRealisees;
    totalPlannedTaskHours += m.plannedTaskHours;
    totalVarianceHours += m.varianceTaskHours;
    sumVarianceDays += m.meta.ecartJours;

    if (m.meta.statutProgression === 'en-avance') countAhead += 1;
    else if (m.meta.statutProgression === 'en-retard') countLate += 1;
    else countNormal += 1;

    if (m.meta.risque === 'Critique') criticalCount += 1;

    for (const r of m.allTasks) {
      totalTasks += 1;
      if (r.task.status === 'done') doneTasks += 1;
    }
  }

  return {
    nbMissions: n,
    avgProgressionPct: Math.round(sumProg / n),
    avgDurationWeeks: round2(sumWeeks / n),
    avgAuditorsPerMission: round2(sumAuditors / n),
    totalBudgetHours: round2(totalBudgetHours),
    totalActualHours: round2(totalActualHours),
    totalPlannedTaskHours: round2(totalPlannedTaskHours),
    totalVarianceHours: round2(totalVarianceHours),
    avgVarianceDays: round2(sumVarianceDays / n),
    countAhead,
    countNormal,
    countLate,
    criticalCount,
    totalTasks,
    doneTasks,
  };
}

export interface ContextMenuNodeMetrics {
  mode: 'plan-audit' | 'standard';
  headline: string;
  primaryPct: number;
  docsCount: number;
  validatedDocs: number;
  tasksCount: number;
  plannedHours: number;
  actualHours: number;
  varianceHours: number;
  openNotes: number;
  overdueCount: number;
  // Plan-specific
  missionsCount?: number;
  aheadCount?: number;
  normalCount?: number;
  lateCount?: number;
  avgVarianceDays?: number;
}

export function computeContextualWorkflowMetrics(
  node: WorkflowTreeNode | null,
  trees: WorkflowTreeNode[]
): ContextMenuNodeMetrics {
  const scopeNodes = node ? [node] : trees;
  const todayIso = new Date().toISOString().slice(0, 10);

  let docsCount = 0;
  let validatedDocs = 0;
  let tasksCount = 0;
  let plannedHours = 0;
  let actualHours = 0;
  let varianceHours = 0;
  let openNotes = 0;
  let overdueCount = 0;

  const planMissionNodes: WorkflowTreeNode[] = [];

  const walk = (n: WorkflowTreeNode) => {
    if (n.planMissionMeta) {
      planMissionNodes.push(n);
    }
    if (n.nodeType === 'document') {
      docsCount += 1;
      if (n.status === 'validated') validatedDocs += 1;
    }
    if (n.dueDate && n.dueDate < todayIso && n.status !== 'validated') {
      overdueCount += 1;
    }
    for (const rn of n.reviewNotes || []) {
      if (rn.status === 'open') openNotes += 1;
    }
    for (const t of n.todoTasks || []) {
      tasksCount += 1;
      plannedHours += t.plannedDurationHours || 0;
      actualHours += t.actualHours !== undefined ? t.actualHours : t.plannedDurationHours || 0;
      varianceHours += t.varianceHours || 0;
    }
    n.children?.forEach(walk);
  };

  scopeNodes.forEach(walk);

  const isPlanContext =
    node?.natureId === 'plan-audit' || planMissionNodes.length > 0;

  if (isPlanContext && planMissionNodes.length > 0) {
    const liveMissions = extractPlanMissionsFromTrees(scopeNodes, node?.id);
    const summary = computeAuditPlanMetrics(liveMissions);
    return {
      mode: 'plan-audit',
      headline:
        node?.planMissionMeta
          ? `${node.planMissionMeta.code} · ${node.planMissionMeta.direction}`
          : `Plan annuel · ${summary.nbMissions} missions`,
      primaryPct: summary.avgProgressionPct,
      docsCount,
      validatedDocs,
      tasksCount: summary.totalTasks,
      plannedHours: round2(plannedHours),
      actualHours: round2(actualHours),
      varianceHours: round2(varianceHours),
      openNotes,
      overdueCount,
      missionsCount: summary.nbMissions,
      aheadCount: summary.countAhead,
      normalCount: summary.countNormal,
      lateCount: summary.countLate,
      avgVarianceDays: summary.avgVarianceDays,
    };
  }

  return {
    mode: 'standard',
    headline: node ? node.label : 'Tous les workflows',
    primaryPct: docsCount > 0 ? Math.round((validatedDocs / docsCount) * 100) : 0,
    docsCount,
    validatedDocs,
    tasksCount,
    plannedHours: round2(plannedHours),
    actualHours: round2(actualHours),
    varianceHours: round2(varianceHours),
    openNotes,
    overdueCount,
  };
}

export function injectMissionsIntoPlanNode(
  trees: WorkflowTreeNode[],
  targetNodeId: string,
  count: number,
  actor: string
): { trees: WorkflowTreeNode[]; injectedCount: number; targetNatureId?: string } {
  const safeCount = Math.min(15, Math.max(10, Math.round(count)));
  const scopePrefix: 'user' | 'team' = targetNodeId.startsWith('team-') ? 'team' : 'user';
  const suffix = `-inj-${Date.now().toString(36).slice(-4)}`;
  const missions = generateIndustrialAuditPlanMissions(scopePrefix, safeCount, suffix);

  let injectedToId: string | undefined;

  // Trouver le nœud nature plan-audit si l'utilisateur a ciblé une mission ou sous-nœud à l'intérieur
  const walkUpdate = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((n) => {
      if (n.id === targetNodeId && (n.nodeType === 'nature' || n.nodeType === 'exercice')) {
        injectedToId = n.id;
        return {
          ...n,
          children: missions,
          auditTrail: [
            {
              id: `aud-${Date.now()}`,
              timestamp: new Date().toISOString(),
              actor,
              action: 'Intégration Plan d’audit',
              detail: `${missions.length} missions injectées (moy. 3 sem., 3 auditeurs/mission)`,
            },
            ...(n.auditTrail || []),
          ].slice(0, 80),
        };
      }
      if (n.nodeType === 'nature' && n.natureId === 'plan-audit') {
        // Check if targetNodeId is inside this nature
        const containsTarget = (sub: WorkflowTreeNode): boolean =>
          sub.id === targetNodeId || Boolean(sub.children?.some(containsTarget));
        if (containsTarget(n)) {
          injectedToId = n.id;
          return {
            ...n,
            children: missions,
            auditTrail: [
              {
                id: `aud-${Date.now()}`,
                timestamp: new Date().toISOString(),
                actor,
                action: 'Intégration Plan d’audit',
                detail: `${missions.length} missions injectées (moy. 3 sem., 3 auditeurs/mission)`,
              },
              ...(n.auditTrail || []),
            ].slice(0, 80),
          };
        }
      }
      if (n.children?.length) {
        return { ...n, children: walkUpdate(n.children) };
      }
      return n;
    });

  const nextTrees = walkUpdate(trees);
  return { trees: nextTrees, injectedCount: missions.length, targetNatureId: injectedToId };
}

export function updatePlanStepDatesInTree(
  trees: WorkflowTreeNode[],
  stepNodeId: string,
  dateDebut: string,
  dateFin: string,
  dateFinReelle: string | undefined,
  actor: string
): WorkflowTreeNode[] {
  const safeStart = snapToWorkingDay(dateDebut);
  const safeEnd = snapToWorkingDay(dateFin >= safeStart ? dateFin : safeStart);
  const safeReal = dateFinReelle ? snapToWorkingDay(dateFinReelle) : safeEnd;
  const ecartJours = computeWorkingDaysBetween(safeEnd, safeReal);
  const statusProg = classifyScheduleStatus(ecartJours);

  const walk = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((n) => {
      if (n.id === stepNodeId) {
        const prevMeta = n.planStepMeta || {
          phase: 'Phase de préparation' as const,
          stepNumber: 1,
          dateDebut: safeStart,
          dateFin: safeEnd,
          progressionPct: 50,
          ecartJours: 0,
          statutProgression: 'normal' as const,
        };
        return {
          ...n,
          dueDate: safeEnd,
          planStepMeta: {
            ...prevMeta,
            dateDebut: safeStart,
            dateFin: safeEnd,
            dateFinReelle: safeReal,
            ecartJours,
            statutProgression: statusProg,
          },
          auditTrail: [
            {
              id: `aud-${Date.now()}`,
              timestamp: new Date().toISOString(),
              actor,
              action: 'Dates étape planifiées',
              detail: `${safeStart} → ${safeEnd} (réel ${safeReal} · écart ${ecartJours > 0 ? `+${ecartJours}` : ecartJours} j)`,
            },
            ...(n.auditTrail || []),
          ].slice(0, 80),
        };
      }
      if (n.children?.length) {
        return { ...n, children: walk(n.children) };
      }
      return n;
    });

  return walk(trees);
}

export function updatePlanMissionMetaInTree(
  trees: WorkflowTreeNode[],
  missionNodeId: string,
  patch: Partial<AuditPlanMissionMeta> & { titre?: string },
  actor: string
): WorkflowTreeNode[] {
  const walk = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((n) => {
      if (n.id === missionNodeId && n.planMissionMeta) {
        const prevMeta = n.planMissionMeta;
        const nextCode =
          patch.code !== undefined ? patch.code.trim() || prevMeta.code : prevMeta.code;
        const currentTitre = n.label.startsWith(`${prevMeta.code} · `)
          ? n.label.slice(`${prevMeta.code} · `.length)
          : n.label;
        const nextTitre =
          patch.titre !== undefined ? patch.titre.trim() || currentTitre : currentTitre;
        const nextDebut = patch.dateDebut ? snapToWorkingDay(patch.dateDebut) : prevMeta.dateDebut;
        const nextFinPrevueRaw = patch.dateFinPrevue
          ? snapToWorkingDay(patch.dateFinPrevue)
          : prevMeta.dateFinPrevue;
        const nextFinPrevue = nextFinPrevueRaw >= nextDebut ? nextFinPrevueRaw : nextDebut;
        const nextFinReelle =
          patch.dateFinReelle !== undefined
            ? patch.dateFinReelle
              ? snapToWorkingDay(patch.dateFinReelle)
              : nextFinPrevue
            : prevMeta.dateFinReelle || nextFinPrevue;
        const nextAuditeurs =
          patch.auditeurs && patch.auditeurs.length > 0 ? patch.auditeurs : prevMeta.auditeurs;
        const nextChef = patch.chefMission || prevMeta.chefMission;
        const nextEcartJours =
          patch.dateFinPrevue !== undefined || patch.dateFinReelle !== undefined
            ? computeWorkingDaysBetween(nextFinPrevue, nextFinReelle)
            : patch.ecartJours !== undefined
            ? patch.ecartJours
            : prevMeta.ecartJours;
        const nextStatut = classifyScheduleStatus(nextEcartJours);
        const nextProg =
          patch.progressionPct !== undefined
            ? Math.min(100, Math.max(0, Math.round(patch.progressionPct)))
            : prevMeta.progressionPct;

        const nextMeta: AuditPlanMissionMeta = {
          ...prevMeta,
          ...patch,
          code: nextCode,
          dateDebut: nextDebut,
          dateFinPrevue: nextFinPrevue,
          dateFinReelle: nextFinReelle,
          auditeurs: nextAuditeurs,
          nbAuditeurs: nextAuditeurs.length,
          chefMission: nextChef,
          ecartJours: nextEcartJours,
          statutProgression: nextStatut,
          progressionPct: nextProg,
        };

        const phasesChanged =
          patch.dateDebut !== undefined ||
          patch.dateFinPrevue !== undefined ||
          patch.dateFinReelle !== undefined ||
          patch.progressionPct !== undefined;

        const phaseChildren = n.children || [];
        const updatedChildren = phasesChanged
          ? phaseChildren.map((child, pIdx) => {
              if (child.label === 'Outils' || child.planStepMeta?.phase === 'Outils') {
                return child;
              }
              const isFirstPhase = pIdx === 0;
              const isLastPhase =
                pIdx ===
                phaseChildren.filter(
                  (c) => c.label !== 'Outils' && c.planStepMeta?.phase !== 'Outils'
                ).length -
                  1;
              const steps = child.children || [];
              const nextSteps = steps.map((st, sIdx) => {
                if (!st.planStepMeta) return st;
                const sDebut =
                  isFirstPhase && sIdx === 0 && patch.dateDebut
                    ? nextDebut
                    : st.planStepMeta.dateDebut < nextDebut
                    ? nextDebut
                    : st.planStepMeta.dateDebut;
                const sFin =
                  isLastPhase && sIdx === steps.length - 1 && patch.dateFinPrevue
                    ? nextFinPrevue
                    : st.planStepMeta.dateFin > nextFinPrevue
                    ? nextFinPrevue
                    : st.planStepMeta.dateFin;
                const sReal =
                  isLastPhase &&
                  sIdx === steps.length - 1 &&
                  (patch.dateFinReelle !== undefined || patch.dateFinPrevue !== undefined)
                    ? nextFinReelle
                    : st.planStepMeta.dateFinReelle || sFin;
                const sEcart = computeWorkingDaysBetween(sFin, sReal);
                return {
                  ...st,
                  dueDate: sFin,
                  planStepMeta: {
                    ...st.planStepMeta,
                    dateDebut: sDebut,
                    dateFin: sFin >= sDebut ? sFin : sDebut,
                    dateFinReelle: sReal,
                    ecartJours: sEcart,
                    statutProgression: classifyScheduleStatus(sEcart),
                    progressionPct:
                      patch.progressionPct !== undefined ? nextProg : st.planStepMeta.progressionPct,
                  },
                };
              });
              return {
                ...child,
                children: nextSteps,
                planStepMeta: child.planStepMeta
                  ? {
                      ...child.planStepMeta,
                      dateDebut:
                        isFirstPhase && patch.dateDebut ? nextDebut : child.planStepMeta.dateDebut,
                      dateFin:
                        isLastPhase && patch.dateFinPrevue
                          ? nextFinPrevue
                          : child.planStepMeta.dateFin,
                      dateFinReelle:
                        isLastPhase && patch.dateFinReelle !== undefined
                          ? nextFinReelle
                          : child.planStepMeta.dateFinReelle,
                      progressionPct:
                        patch.progressionPct !== undefined
                          ? nextProg
                          : child.planStepMeta.progressionPct,
                    }
                  : undefined,
              };
            })
          : phaseChildren;

        return {
          ...n,
          label: `${nextCode} · ${nextTitre}`,
          owner: nextChef,
          assignee: nextAuditeurs.join(', '),
          dueDate: nextFinPrevue,
          planMissionMeta: nextMeta,
          children: updatedChildren,
          auditTrail: [
            {
              id: `aud-${Date.now()}`,
              timestamp: new Date().toISOString(),
              actor,
              action: 'Modification fiche mission Plan d’audit',
              detail: `${nextCode} · ${nextMeta.direction} (${nextMeta.risque})`,
            },
            ...(n.auditTrail || []),
          ].slice(0, 80),
        };
      }
      if (n.children?.length) {
        return { ...n, children: walk(n.children) };
      }
      return n;
    });

  return walk(trees);
}

