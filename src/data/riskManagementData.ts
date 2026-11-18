import {
  RiskManagementMetadata,
  RiskSortDirection,
  RiskSortField,
  WorkflowTreeNode,
} from '../types/workflow';
import { findNodeById, findNodePath } from '../utils/workflowTreeOps';

export interface RiskManagementColumnSpec {
  key: keyof RiskManagementMetadata;
  header: string;
  label: string;
  multiline?: boolean;
  levelBadge?: boolean;
}

export const RISK_MANAGEMENT_COLUMNS: RiskManagementColumnSpec[] = [
  { key: 'no', header: 'no', label: '1. N°' },
  { key: 'cycle', header: 'Cycle', label: '2. Cycle' },
  { key: 'processus', header: 'Processus', label: '3. Processus' },
  { key: 'direction', header: 'Direction', label: '4. Direction' },
  { key: 'operationnel', header: 'opérationnel', label: '5. Opérationnel' },
  { key: 'refRisque', header: 'Ref risque', label: '6. Ref risque' },
  { key: 'risque', header: 'risque', label: '7. Risque', multiline: true },
  { key: 'probabilite', header: 'probabilité', label: '8. Probabilité', levelBadge: true },
  { key: 'impact', header: 'impact', label: '9. Impact', levelBadge: true },
  { key: 'evaluationRisque', header: 'évaluation risque', label: '10. Évaluation risque', levelBadge: true },
  { key: 'planAction', header: 'Plan d’action', label: '11. Plan d’action', multiline: true },
  { key: 'controleNiveau1', header: 'controle de premier niveau', label: '12. Contrôle de premier niveau', multiline: true },
  { key: 'controleNiveau2', header: 'controle de second niveau', label: '13. Contrôle de second niveau', multiline: true },
  { key: 'controleNiveau3', header: 'controle de troisieme niveau', label: '14. Contrôle de troisième niveau', multiline: true },
  { key: 'causes', header: 'causes', label: '15. Causes', multiline: true },
  { key: 'consequences', header: 'consequences', label: '16. Conséquences', multiline: true },
  { key: 'facteursRisque', header: 'facteurs de risque', label: '17. Facteurs de risque', multiline: true },
  { key: 'facteurDeclencheur', header: 'Facteur declencheur', label: '18. Facteur déclencheur', multiline: true },
  { key: 'familleBale', header: 'Famille Bâle', label: '19. Famille Bâle' },
  { key: 'ligneMetierBale', header: 'Ligne de métier Bâle', label: '20. Ligne de métier Bâle' },
  { key: 'categorieBale', header: 'Catégorie Bâle', label: '21. Catégorie Bâle' },
  { key: 'sousCategorieBale', header: 'Sous-catégorie Bâle', label: '22. Sous-catégorie Bâle' },
  { key: 'natureRisque', header: 'Nature du risque', label: '23. Nature du risque' },
];

export const RISK_MANAGEMENT_2026_DATA: RiskManagementMetadata[] = [
  {
    "no": 1,
    "cycle": "Cycle Gouvernance et Pilotage",
    "processus": "Fonctionnement du Conseil et Comités",
    "direction": "DG",
    "operationnel": "Secrétaire Général",
    "refRisque": "Risk-DG-01-2025",
    "risque": "Non-conformité des comités à la Circulaire 01-2017/CB/C",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Nommer des administrateurs indépendants et actualiser les chartes",
    "controleNiveau1": "Vérification trimestrielle des PV et présences par le SG",
    "controleNiveau2": "Revue annuelle d'adéquation gouvernance par la Conformité",
    "controleNiveau3": "Audit périodique du dispositif de gouvernance",
    "causes": "Veille statutaire insuffisante et mandats expirés",
    "consequences": "Sanctions Commission Bancaire et nullité des décisions",
    "facteursRisque": "Actionnariat concentré et rareté d'indépendants qualifiés",
    "facteurDeclencheur": "Inspection Commission Bancaire ou départ administrateur",
    "familleBale": "Risque Stratégique",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Gouvernance et pilotage",
    "sousCategorieBale": "Conformité des organes",
    "natureRisque": "Risque de gouvernance"
  },
  {
    "no": 2,
    "cycle": "Cycle Gouvernance et Pilotage",
    "processus": "Délégations de pouvoirs et signatures",
    "direction": "DG",
    "operationnel": "Directeur Général Adjoint",
    "refRisque": "Risk-DG-02-2025",
    "risque": "Engagements pris hors plafonds ou sans délégation valide",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Intégrer le recueil des pouvoirs dans le Core Banking",
    "controleNiveau1": "Double validation hiérarchique et blocage sur seuil",
    "controleNiveau2": "Contrôle semestriel recueil vs habilitations SI",
    "controleNiveau3": "Audit d'un échantillon de contrats et engagements",
    "causes": "Délégations obsolètes non révoquées après mobilité",
    "consequences": "Pertes financières non autorisées et litiges juridiques",
    "facteursRisque": "Culture orale et défaut de centralisation des pouvoirs",
    "facteurDeclencheur": "Signature urgente en l'absence d'un dirigeant",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque juridique et opérationnel"
  },
  {
    "no": 3,
    "cycle": "Cycle Gouvernance et Pilotage",
    "processus": "Prévention des conflits d'intérêts",
    "direction": "DG",
    "operationnel": "Secrétaire Général",
    "refRisque": "Risk-DG-03-2025",
    "risque": "Concours aux apparentés au-delà des plafonds UMOA",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Tenir un registre des apparentés visé par le Conseil",
    "controleNiveau1": "Déclaration d'intérêts préalable avant tout comité",
    "controleNiveau2": "Suivi mensuel du plafond global (< 20% FP)",
    "controleNiveau3": "Audit annuel des transactions avec parties liées",
    "causes": "Dissimulation de liens capitalistiques ou familiaux",
    "consequences": "Sanctions BCEAO, défaut de gouvernance et pertes",
    "facteursRisque": "Tissu économique local restreint et interconnexions",
    "facteurDeclencheur": "Demande accélérée d'une entité liée à un dirigeant",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Pratiques commerciales incorrectes",
    "natureRisque": "Risque de conformité"
  },
  {
    "no": 4,
    "cycle": "Cycle Gouvernance et Pilotage",
    "processus": "Planification stratégique et budget",
    "direction": "DG",
    "operationnel": "Contrôleur de Gestion",
    "refRisque": "Risk-DG-04-2025",
    "risque": "Objectifs commerciaux incompatibles avec l'appétence aux risques",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Aligner le budget sur le cadre d'appétence (RAF)",
    "controleNiveau1": "Revue mensuelle budget/risques en Comité Exécutif",
    "controleNiveau2": "Suivi trimestriel des limites RAF par les Risques",
    "controleNiveau3": "Évaluation du pilotage budgétaire et fonds propres",
    "causes": "Pression actionnariale sur la croissance court terme",
    "consequences": "Hausse du coût du risque et tension solvabilité",
    "facteursRisque": "Concurrence accrue et volatilité macroéconomique",
    "facteurDeclencheur": "Campagne commerciale intensive sans avis Risques",
    "familleBale": "Risque Stratégique",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Gouvernance et pilotage",
    "sousCategorieBale": "Stratégie et appétence",
    "natureRisque": "Risque stratégique"
  },
  {
    "no": 5,
    "cycle": "Cycle Gouvernance et Pilotage",
    "processus": "Communication de crise et image",
    "direction": "DG",
    "operationnel": "Responsable Communication",
    "refRisque": "Risk-DG-05-2025",
    "risque": "Communication de crise tardive déclenchant des retraits massifs",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Adopter un plan de crise et former les porte-paroles",
    "controleNiveau1": "Validation DG et Juridique de tout communiqué externe",
    "controleNiveau2": "Veille e-réputation et simulation annuelle de crise",
    "controleNiveau3": "Audit du plan de gestion de crise et d'alerte",
    "causes": "Absence de cellule préparée et fuites internes",
    "consequences": "Ruée bancaire (bank run) et crise de liquidité",
    "facteursRisque": "Amplification virale sur les réseaux sociaux",
    "facteurDeclencheur": "Rumeur financière ou panne SI visible",
    "familleBale": "Risque Stratégique",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Gouvernance et pilotage",
    "sousCategorieBale": "Gestion de réputation",
    "natureRisque": "Risque de réputation"
  },
  {
    "no": 6,
    "cycle": "Cycle Gouvernance et Pilotage",
    "processus": "Suivi des injonctions et recommandations",
    "direction": "DG",
    "operationnel": "Directeur Audit Interne",
    "refRisque": "Risk-DG-06-2025",
    "risque": "Inexécution des injonctions UMOA et recommandations critiques",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Déployer un suivi automatisé avec escalade au Comité d'Audit",
    "controleNiveau1": "Reporting mensuel d'avancement par chaque Direction",
    "controleNiveau2": "Challenge documentaire des clôtures par les Risques",
    "controleNiveau3": "Audit de suivi semestriel de l'effectivité",
    "causes": "Responsabilisation faible et surcharge opérationnelle",
    "consequences": "Sanctions administratives et persistance de failles",
    "facteursRisque": "Multiplicité des missions sans priorisation",
    "facteurDeclencheur": "Échéance Commission Bancaire imminente",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque réglementaire"
  },
  {
    "no": 7,
    "cycle": "Cycle Ressources Humaines",
    "processus": "Recrutement et honorabilité",
    "direction": "DRH",
    "operationnel": "Chargé de Recrutement",
    "refRisque": "Risk-DRH-01-2025",
    "risque": "Recrutement sur postes sensibles sans enquête d'honorabilité",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Exiger casier judiciaire et contrôle diplômes avant embauche",
    "controleNiveau1": "Check-list dossier d'embauche visée par le DRH",
    "controleNiveau2": "Contrôle trimestriel des dossiers sensibles (Conformité)",
    "controleNiveau3": "Audit annuel des recrutements et tests d'intégrité",
    "causes": "Urgence de pourvoir et confiance excessive aux CV",
    "consequences": "Fraudes internes et erreurs professionnelles graves",
    "facteursRisque": "Falsification de diplômes et turn-over commercial",
    "facteurDeclencheur": "Ouverture d'agence avec recrutement urgent",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Pratiques en matière d'emploi",
    "sousCategorieBale": "Relations du travail",
    "natureRisque": "Risque RH et de fraude"
  },
  {
    "no": 8,
    "cycle": "Cycle Ressources Humaines",
    "processus": "Gestion de la paie et primes",
    "direction": "DRH",
    "operationnel": "Gestionnaire Paie",
    "refRisque": "Risk-DRH-02-2025",
    "risque": "Salaires fictifs, primes erronées ou défaut reversement CNPS/ITS",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Interfacer badgeuse/SIRH-paie et valider avant virement",
    "controleNiveau1": "Rapprochement journal paie N/N-1 et visa DRH-DFC",
    "controleNiveau2": "Contrôle semestriel CNPS/DGI et formules de primes",
    "controleNiveau3": "Audit annuel paie et effectifs physiques vs payés",
    "causes": "Saisie manuelle des variables et cumul de tâches",
    "consequences": "Pertes financières et redressements fiscaux/sociaux",
    "facteursRisque": "Grilles de bonus complexes et défaut de séparation",
    "facteurDeclencheur": "Absence du Responsable Paie en clôture",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque RH et fiscal"
  },
  {
    "no": 9,
    "cycle": "Cycle Ressources Humaines",
    "processus": "Départs et révocation des accès",
    "direction": "DRH",
    "operationnel": "Gestionnaire Admin RH",
    "refRisque": "Risk-DRH-03-2025",
    "risque": "Maintien actif des accès SI et badges après départ d'un agent",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Automatiser l'alerte DRH vers DSI dès rupture/mobilité",
    "controleNiveau1": "Rapprochement hebdomadaire départs RH et comptes actifs",
    "controleNiveau2": "Contrôle mensuel des comptes orphelins (Conformité)",
    "controleNiveau3": "Audit semestriel des accès sur échantillon de sortants",
    "causes": "Rupture de communication entre DRH et DSI",
    "consequences": "Fraude interne ou sabotage via identifiants anciens",
    "facteursRisque": "Absence de passerelle IAM entre SIRH et Active Directory",
    "facteurDeclencheur": "Licenciement conflictuel ou démission sans préavis",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Activités non autorisées",
    "natureRisque": "Risque informatique et fraude"
  },
  {
    "no": 10,
    "cycle": "Cycle Ressources Humaines",
    "processus": "Séparation des tâches et congés",
    "direction": "DRH",
    "operationnel": "Responsable Dév RH",
    "refRisque": "Risk-DRH-04-2025",
    "risque": "Cumul de tâches et défaut de congés facilitant la fraude",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Imposer 15 jours continus de congés avec coupure des accès",
    "controleNiveau1": "Planning validé par N+1 et blocage temporaire accès",
    "controleNiveau2": "Revue trimestrielle du taux de congés et intérims",
    "controleNiveau3": "Audit du respect des congés continus et rotation",
    "causes": "Sous-effectif chronique et culture d'agents indispensables",
    "consequences": "Détournements durables non détectés (cavalerie)",
    "facteursRisque": "Forte charge en agences et faible polyvalence",
    "facteurDeclencheur": "Refus répété de congés par un chef d'agence",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de fraude"
  },
  {
    "no": 11,
    "cycle": "Cycle Ressources Humaines",
    "processus": "Prêts au personnel",
    "direction": "DRH",
    "operationnel": "Chargé Avantages Sociaux",
    "refRisque": "Risk-DRH-05-2025",
    "risque": "Surendettement du personnel ou maintien taux bonifié post-départ",
    "probabilite": "Moyen",
    "impact": "Faible",
    "evaluationRisque": "Faible",
    "planAction": "Calculer la quotité cessible et basculer au taux normal au départ",
    "controleNiveau1": "Vérification bulletin de paie et visa DRH avant comité",
    "controleNiveau2": "Contrôle semestriel du portefeuille et taux post-départ",
    "controleNiveau3": "Audit annuel des concours au personnel",
    "causes": "Absence de lien suivi prêts et solde de tout compte",
    "consequences": "Impayés post-départ et surendettement interne",
    "facteursRisque": "Multiplication d'avances et prêts externes parallèles",
    "facteurDeclencheur": "Démission ou retraite d'un agent très endetté",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Défaillance prêts personnel",
    "natureRisque": "Risque RH et de crédit"
  },
  {
    "no": 12,
    "cycle": "Cycle Ressources Humaines",
    "processus": "Climat social et sécurité HSE",
    "direction": "DRH",
    "operationnel": "Resp. Relations Sociales",
    "refRisque": "Risk-DRH-06-2025",
    "risque": "Grève généralisée ou accident grave paralysant l'activité",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Maintenir le dialogue social et déployer les plans HSE",
    "controleNiveau1": "Suivi trimestriel des doléances et visites sécurité",
    "controleNiveau2": "Évaluation annuelle risque social et couverture PCA",
    "controleNiveau3": "Audit du dispositif HSE et conformité Code du Travail",
    "causes": "Revendications non traitées ou vétusté des locaux",
    "consequences": "Fermeture d'agences et perte de clientèle",
    "facteursRisque": "Contexte inflationniste et tensions sectorielles",
    "facteurDeclencheur": "Échec des négociations annuelles ou sinistre agence",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Pratiques en matière d'emploi",
    "sousCategorieBale": "Sécurité lieu de travail",
    "natureRisque": "Risque continuité d'activité"
  },
  {
    "no": 13,
    "cycle": "Cycle Ressources Humaines",
    "processus": "Formation réglementaire et éthique",
    "direction": "DRH",
    "operationnel": "Responsable Formation",
    "refRisque": "Risk-DRH-07-2025",
    "risque": "Méconnaissance des normes LBC/FT et PCB-UMOA par les agents",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Déployer un e-learning annuel obligatoire et certifiant",
    "controleNiveau1": "Suivi mensuel des taux de complétion par les managers",
    "controleNiveau2": "Contrôle annuel des formations LBC/FT (exigence CENTIF)",
    "controleNiveau3": "Audit de conformité du plan de formation et acquis",
    "causes": "Budget insuffisant et faible recyclage terrain",
    "consequences": "Erreurs répétées et vulnérabilité aux fraudeurs",
    "facteursRisque": "Évolution rapide des normes et intégration stagiaires",
    "facteurDeclencheur": "Recrutement massif ou nouvelle circulaire BCEAO",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Pratiques en matière d'emploi",
    "sousCategorieBale": "Relations du travail",
    "natureRisque": "Risque de non-conformité"
  },
  {
    "no": 14,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Entrée en relation et KYC",
    "direction": "DCOM",
    "operationnel": "Chargé de Clientèle",
    "refRisque": "Risk-DCOM-01-2025",
    "risque": "Ouverture de compte sur faux documents ou KYC incomplet",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Bloquer l'activation des comptes sans validation KYC complète",
    "controleNiveau1": "Contrôle Chef d'Agence et validation back-office",
    "controleNiveau2": "Contrôle permanent sur échantillon des nouveaux comptes",
    "controleNiveau3": "Audit KYC sur dossiers particuliers, PME et PPE",
    "causes": "Pression commerciale sur les objectifs d'ouvertures",
    "consequences": "Sanctions LBC/FT, blanchiment et fraude identitaire",
    "facteursRisque": "Multiplicité de pièces non sécurisées dans le secteur informel",
    "facteurDeclencheur": "Campagne d'ouverture de comptes de masse",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Admission et documentation clients",
    "natureRisque": "Risque LBC/FT et fraude"
  },
  {
    "no": 15,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Comptes dormants et inactifs",
    "direction": "DCOM",
    "operationnel": "Responsable Back-Office",
    "refRisque": "Risk-DCOM-02-2025",
    "risque": "Non-cantonnement des comptes inactifs (Instruction BCEAO 2013)",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Automatiser le basculement des comptes sans mouvement à 1 an",
    "controleNiveau1": "Revue mensuelle de la balance des comptes sans mouvement",
    "controleNiveau2": "Contrôle trimestriel des transferts vers la BCEAO (10 ans)",
    "controleNiveau3": "Audit de conformité de gestion des comptes dormants",
    "causes": "Paramétrage SI défaillant et absence d'archivage",
    "consequences": "Détournement sur soldes dormants et sanctions BCEAO",
    "facteursRisque": "Volume élevé de petits comptes inactifs non purgés",
    "facteurDeclencheur": "Réclamation tardive d'héritiers ou mission BCEAO",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Gestion des comptes clients",
    "natureRisque": "Risque réglementaire et fraude"
  },
  {
    "no": 16,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Réactivation des comptes dormants",
    "direction": "DCOM",
    "operationnel": "Chef d'Agence",
    "refRisque": "Risk-DCOM-03-2025",
    "risque": "Déblocage et décaissement frauduleux sur comptes dormants",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Imposer double clé agence-siège (Maker-Checker) et OTP client",
    "controleNiveau1": "Demande écrite certifiée et validation Conformité siège",
    "controleNiveau2": "Contrôle permanent de 100% des réactivations > seuil",
    "controleNiveau3": "Audit annuel ciblé des levées de blocage et retraits",
    "causes": "Collusion interne et modification frauduleuse du numéro client",
    "consequences": "Détournement direct des avoirs clients et litiges",
    "facteursRisque": "Accès non restreint aux modifications de fiche client",
    "facteurDeclencheur": "Décès connu d'un client titulaire d'un compte garni",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de fraude"
  },
  {
    "no": 17,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Délivrance des chéquiers",
    "direction": "DCOM",
    "operationnel": "Agent Accueil / Guichet",
    "refRisque": "Risk-DCOM-04-2025",
    "risque": "Remise de chéquiers à un tiers non mandaté ou client interdit",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Imposer remise contre signature biométrique et contrôle CIP",
    "controleNiveau1": "Vérification statut CIP-UEMOA et procuration légalisée",
    "controleNiveau2": "Contrôle mensuel du stock de chéquiers non retirés",
    "controleNiveau3": "Audit annuel des inventaires de valeurs et remises",
    "causes": "Négligence au guichet et stockage non sécurisé",
    "consequences": "Émission de chèques sans provision et fraude",
    "facteursRisque": "Forte rotation des agents d'accueil en agence",
    "facteurDeclencheur": "Délivrance par complaisance sans pièce originale",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Gestion des comptes clients",
    "natureRisque": "Risque opérationnel et fraude"
  },
  {
    "no": 18,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Compensation chèques SICA-UEMOA",
    "direction": "DOP",
    "operationnel": "Resp. Compensation",
    "refRisque": "Risk-DOP-01-2025",
    "risque": "Paiement de chèques faux, falsifiés ou hors provision (SICA)",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Généraliser la lecture UV/MICR et validation signature > seuil",
    "controleNiveau1": "Double contrôle signature et provision avant validation",
    "controleNiveau2": "Contrôle permanent des rejets et suspens SICA > 48h",
    "controleNiveau3": "Audit semestriel du circuit de compensation chèques",
    "causes": "Absence de contrôle physique des formules et délais courts",
    "consequences": "Pertes financières directes et réclamations clients",
    "facteursRisque": "Sophistication des falsifications de chèques de banque",
    "facteurDeclencheur": "Remise de chèque d'un montant inhabituel en caisse",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de fraude externe"
  },
  {
    "no": 19,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Incidents paiement et CIP-UEMOA",
    "direction": "DOP",
    "operationnel": "Resp. Moyens de Paiement",
    "refRisque": "Risk-DOP-02-2025",
    "risque": "Déclaration tardive ou erronée des incidents au CIP-UEMOA",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Automatiser les flux déclaratifs vers la centrale BCEAO",
    "controleNiveau1": "Contrôle quotidien des rejets et envoi des injonctions",
    "controleNiveau2": "Revue mensuelle des délais de déclaration et mainlevées",
    "controleNiveau3": "Audit de conformité du processus CIP-UEMOA",
    "causes": "Rejets techniques non traités et erreurs manuelles",
    "consequences": "Sanctions BCEAO et recours en responsabilité civile",
    "facteursRisque": "Instabilité des flux interbancaires et pannes batch",
    "facteurDeclencheur": "Modification manuelle d'un rejet ou panne SICA",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque réglementaire"
  },
  {
    "no": 20,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Virements RTGS (STAR-UEMOA)",
    "direction": "DOP",
    "operationnel": "Resp. Virements",
    "refRisque": "Risk-DOP-03-2025",
    "risque": "Exécution de virements erronés, doublonnés ou frauduleux",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Appliquer validation 4-yeux stricte et contre-appel client",
    "controleNiveau1": "Vérification signature, provision et contre-appel téléphonique",
    "controleNiveau2": "Contrôle permanent des virements manuels de gros montant",
    "controleNiveau3": "Audit annuel de la sécurité des flux STAR-UEMOA",
    "causes": "Saisie manuelle d'ordres papier et usurpation d'email",
    "consequences": "Perte irréversible des fonds transférés en temps réel",
    "facteursRisque": "Multiplication des fraudes au président par email",
    "facteurDeclencheur": "Réception d'un ordre de virement urgent par messagerie",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque opérationnel et fraude"
  },
  {
    "no": 21,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Virements SWIFT et contrôle des changes",
    "direction": "DOP",
    "operationnel": "Resp. Opérations Internationales",
    "refRisque": "Risk-DOP-04-2025",
    "risque": "Infraction au Règlement 09/2010/CM/UEMOA des changes",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Bloquer tout transfert sans pièces douanières et domiciliation",
    "controleNiveau1": "Check-list réglementaire et visa Responsable Etranger",
    "controleNiveau2": "Contrôle permanent de l'apurement des dossiers import (90j)",
    "controleNiveau3": "Audit annuel de conformité des opérations de change",
    "causes": "Pression client pour transfert sans facture définitive",
    "consequences": "Sanctions lourdes BCEAO/Trésor et suspension agrément",
    "facteursRisque": "Complexité des opérations d'import-export et sous-facturation",
    "facteurDeclencheur": "Demande de transfert urgent hors cadre domicilié",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque réglementaire"
  },
  {
    "no": 22,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Cartes bancaires (GIM-UEMOA / Visa)",
    "direction": "DOP",
    "operationnel": "Responsable Monétique",
    "refRisque": "Risk-DOP-05-2025",
    "risque": "Fraude à la carte, clonage ou vol de codes PIN non sécurisés",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Activer 3D-Secure, puce EMV et remise séparée carte/PIN",
    "controleNiveau1": "Contrôle stock cartes/PIN et rapprochement journaux GIM",
    "controleNiveau2": "Veille permanente des transactions monétiques suspectes",
    "controleNiveau3": "Audit annuel du dispositif monétique et conformité GIM",
    "causes": "Remise simultanée carte/PIN et absence d'alertes temps réel",
    "consequences": "Pertes sur chargebacks et insatisfaction clientèle",
    "facteursRisque": "Hausse de la cybercriminalité sur paiements en ligne",
    "facteurDeclencheur": "Activation de paiements internationaux sans plafond",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de fraude et monétique"
  },
  {
    "no": 23,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Mobile Money et Bank-to-Wallet",
    "direction": "DCOM",
    "operationnel": "Chef Produit Digital",
    "refRisque": "Risk-DCOM-05-2025",
    "risque": "Écarts de réconciliation avec les opérateurs télécoms (MNO)",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Automatiser le rapprochement quotidien des comptes de cantonnement",
    "controleNiveau1": "Pointage quotidien des flux API et suspens < 24h",
    "controleNiveau2": "Contrôle mensuel des comptes miroirs et écarts MNO",
    "controleNiveau3": "Audit des interfaces Bank-to-Wallet et réconciliations",
    "causes": "Latence réseau, coupures API et transactions orphelines",
    "consequences": "Pertes financières non recouvrées et blocage clients",
    "facteursRisque": "Explosion des volumes et multiplicité des partenaires MNO",
    "facteurDeclencheur": "Pic de transactions en fin de mois ou panne MNO",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Dysfonctionnement de l'activité et systèmes",
    "sousCategorieBale": "Systèmes",
    "natureRisque": "Risque opérationnel et IT"
  },
  {
    "no": 24,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Banque digitale et E-banking",
    "direction": "DCOM",
    "operationnel": "Resp. Banque Digitale",
    "refRisque": "Risk-DCOM-06-2025",
    "risque": "Piratage de comptes clients par phishing ou SIM-swapping",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Imposer authentification forte biométrique et alertes temps réel",
    "controleNiveau1": "Blocage automatique après tentatives erronées et OTP",
    "controleNiveau2": "Analyse mensuelle des incidents cyber et fraudes digitales",
    "controleNiveau3": "Test d'intrusion annuel et audit applicatif mobile",
    "causes": "Sensibilisation client faible et absence de contrôle IMEI",
    "consequences": "Détournement d'épargne et atteinte grave à l'image",
    "facteursRisque": "Fraudeurs organisés ciblant le Mobile Banking UEMOA",
    "facteurDeclencheur": "Campagne massive de phishing SMS ciblant les clients",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Sécurité des systèmes",
    "natureRisque": "Risque cyber et fraude"
  },
  {
    "no": 25,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Tarification, TEG et services gratuits",
    "direction": "DCOM",
    "operationnel": "Resp. Marketing & Produits",
    "refRisque": "Risk-DCOM-07-2025",
    "risque": "Dépassement du seuil d'usure ou facturation de services gratuits",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Verrouiller les barèmes SI selon les avis BCEAO (15%/18%)",
    "controleNiveau1": "Contrôle mensuel des commissions facturées et calcul TEG",
    "controleNiveau2": "Revue trimestrielle de la grille tarifaire par la Conformité",
    "controleNiveau3": "Audit annuel de conformité tarifaire et calcul du TEG",
    "causes": "Paramétrage manuel de frais et méconnaissance des arrêtés",
    "consequences": "Sanctions pécuniaires BCEAO et remboursement clients",
    "facteursRisque": "Fréquence des offres promotionnelles et évolutions réglementaires",
    "facteurDeclencheur": "Lancement d'un crédit avec frais de dossier élevés",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Pratiques commerciales incorrectes",
    "natureRisque": "Risque réglementaire"
  },
  {
    "no": 26,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Gestion des réclamations clients",
    "direction": "DCOM",
    "operationnel": "Resp. Qualité & Réclamations",
    "refRisque": "Risk-DCOM-08-2025",
    "risque": "Traitement tardif ou non-résolution des réclamations clients",
    "probabilite": "Moyen",
    "impact": "Faible",
    "evaluationRisque": "Faible",
    "planAction": "Déployer un outil CRM avec SLA réglementaire et escalade",
    "controleNiveau1": "Suivi hebdomadaire des tickets ouverts par les agences",
    "controleNiveau2": "Analyse trimestrielle des motifs et délais (Conformité)",
    "controleNiveau3": "Audit du processus de traitement et saisine médiateur",
    "causes": "Absence de suivi centralisé et dilution des responsabilités",
    "consequences": "Saisine du Médiateur Bancaire et attrition clientèle",
    "facteursRisque": "Hausse des incidents monétiques et digitaux",
    "facteurDeclencheur": "Réclamation client restée sans réponse > 15 jours",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque de réputation"
  },
  {
    "no": 27,
    "cycle": "Cycle Exploitation et Paiements",
    "processus": "Démarchage et ventes forcées",
    "direction": "DCOM",
    "operationnel": "Directeur Commercial",
    "refRisque": "Risk-DCOM-09-2025",
    "risque": "Ventes liées abusives ou défaut de devoir de conseil client",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Interdire la vente forcée dans les scripts et tracer l'accord",
    "controleNiveau1": "Double signature fiche d'information précontractuelle",
    "controleNiveau2": "Contrôle mystère et écoute appels par la Conformité",
    "controleNiveau3": "Audit des pratiques commerciales et produits d'assurance",
    "causes": "Rémunération variable axée uniquement sur le volume",
    "consequences": "Annulation de contrats, litiges et sanctions régulateur",
    "facteursRisque": "Pression commerciale forte sur les chargés de clientèle",
    "facteurDeclencheur": "Lancement d'un challenge de vente bancassurance",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Pratiques commerciales incorrectes",
    "natureRisque": "Risque commercial et conformité"
  },
  {
    "no": 28,
    "cycle": "Cycle Caisse et Agences",
    "processus": "Opérations de guichet espèces",
    "direction": "DOP",
    "operationnel": "Caissier Principal",
    "refRisque": "Risk-DOP-06-2025",
    "risque": "Erreur de saisie, omission d'écriture ou détournement au guichet",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Imposer double validation au-delà d'un seuil et reçu édité",
    "controleNiveau1": "Pointage fin de journée brouillard vs pièces justificatives",
    "controleNiveau2": "Contrôle inopiné mensuel des journaux de caisse",
    "controleNiveau3": "Audit des opérations de caisse et analyse des écarts",
    "causes": "Surcharge aux guichets et absence de contrôle journalier",
    "consequences": "Écarts de caisse, pertes financières et litiges clients",
    "facteursRisque": "Fort volume d'espèces dans l'économie ouest-africaine",
    "facteurDeclencheur": "Affluence exceptionnelle de fin de mois en agence",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque opérationnel et fraude"
  },
  {
    "no": 29,
    "cycle": "Cycle Caisse et Agences",
    "processus": "Arrêtés et inventaires de caisse",
    "direction": "DOP",
    "operationnel": "Chef d'Agence",
    "refRisque": "Risk-DOP-07-2025",
    "risque": "Absence de comptage contradictoire dissimulant un manquant",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Exiger PV d'arrêté quotidien cosigné et inventaires inopinés",
    "controleNiveau1": "Comptage physique quotidien contradictoire à la fermeture",
    "controleNiveau2": "Inventaires inopinés trimestriels par le Contrôle Permanent",
    "controleNiveau3": "Audit inopiné annuel de 100% des caisses du réseau",
    "causes": "Complicité agence/caissier ou négligence du superviseur",
    "consequences": "Cavalerie de caisse et perte financière cumulée",
    "facteursRisque": "Éloignement des agences régionales du siège",
    "facteurDeclencheur": "Caissier seul à détenir les clés et réaliser l'arrêté",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de fraude interne"
  },
  {
    "no": 30,
    "cycle": "Cycle Caisse et Agences",
    "processus": "Plafonds d'encaisse et coffres",
    "direction": "DOP",
    "operationnel": "Chef d'Agence",
    "refRisque": "Risk-DOP-08-2025",
    "risque": "Dépassement du plafond d'encaisse assuré dans le coffre",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Bloquer les encaissements SI au plafond et évacuer à J+1",
    "controleNiveau1": "Alerte automatique de dépassement et appel convoyeur",
    "controleNiveau2": "Suivi quotidien des soldes de caisse par la Trésorerie",
    "controleNiveau3": "Audit du respect des plafonds et couverture assurance",
    "causes": "Retard de ramassage des fonds ou anticipation de retraits",
    "consequences": "Sinistre non couvert par l'assureur en cas de braquage",
    "facteursRisque": "Insécurité routière et disponibilité des transporteurs",
    "facteurDeclencheur": "Versement massif en espèces en fin d'après-midi",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Dommages aux actifs physiques",
    "sousCategorieBale": "Catastrophes et sinistres",
    "natureRisque": "Risque de sécurité et financier"
  },
  {
    "no": 31,
    "cycle": "Cycle Caisse et Agences",
    "processus": "Convoyage de fonds (BCEAO/agences)",
    "direction": "DOP",
    "operationnel": "Trésorier Espèces",
    "refRisque": "Risk-DOP-09-2025",
    "risque": "Attaque ou perte de valeurs lors du transport de fonds",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Utiliser des sociétés agréées blindées et tracer par GPS",
    "controleNiveau1": "Vérification identité convoyeurs et scellés au départ/arrivée",
    "controleNiveau2": "Contrôle trimestriel des contrats et incidents transport",
    "controleNiveau3": "Audit du dispositif de sécurisation et assurances",
    "causes": "Non-respect des protocoles de discrétion et d'escorte",
    "consequences": "Perte financière majeure et atteinte à la vie humaine",
    "facteursRisque": "Risque sécuritaire sur certains axes routiers régionaux",
    "facteurDeclencheur": "Transport de sommes importantes sans escorte blindée",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de sécurité physique"
  },
  {
    "no": 32,
    "cycle": "Cycle Caisse et Agences",
    "processus": "Alimentation et suivi des GAB/DAB",
    "direction": "DOP",
    "operationnel": "Gestionnaire Monétique",
    "refRisque": "Risk-DOP-10-2025",
    "risque": "Écarts d'encaisse sur GAB ou défaut de réconciliation caissettes",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Séparer chargement GAB et rapprochement comptable",
    "controleNiveau1": "Comptage en binôme et apurement sous 48h des suspens",
    "controleNiveau2": "Contrôle mensuel des comptes d'attente GAB/DAB",
    "controleNiveau3": "Audit des écarts GAB et respect des procédures",
    "causes": "Chargement par un seul agent et pannes de lecteur",
    "consequences": "Pertes non justifiées et indisponibilité des automates",
    "facteursRisque": "Usure mécanique des billets FCFA et coupures réseau",
    "facteurDeclencheur": "Bourrage papier fréquent lors des pics de retraits",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque opérationnel"
  },
  {
    "no": 33,
    "cycle": "Cycle Caisse et Agences",
    "processus": "Faux billets et change manuel",
    "direction": "DOP",
    "operationnel": "Caissier Principal",
    "refRisque": "Risk-DOP-11-2025",
    "risque": "Acceptation de faux billets (FCFA/devises) ou change illégal",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Doter tous les guichets de détecteurs homologués à jour",
    "controleNiveau1": "Passage obligatoire en trieuse et contrôle pièce d'identité",
    "controleNiveau2": "Contrôle trimestriel des registres de change manuel",
    "controleNiveau3": "Audit de la conformité du change et qualité des équipements",
    "causes": "Vétusté des détecteurs et défaut de formation caissiers",
    "consequences": "Perte nette à charge de la banque et sanction BCEAO",
    "facteursRisque": "Circulation de fausses coupures USD/EUR/FCFA",
    "facteurDeclencheur": "Opération de change rapide d'un client de passage",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque opérationnel et fraude"
  },
  {
    "no": 34,
    "cycle": "Cycle Caisse et Agences",
    "processus": "Coffres-forts clients",
    "direction": "DOP",
    "operationnel": "Chef d'Agence",
    "refRisque": "Risk-DOP-12-2025",
    "risque": "Accès non autorisé à un coffre client ou sinistre",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Tenir un registre d'accès biométrique et double clé stricte",
    "controleNiveau1": "Vérification identité, procuration et présence client",
    "controleNiveau2": "Contrôle semestriel des registres d'accès et contrats",
    "controleNiveau3": "Audit annuel du service coffres-forts et sécurité",
    "causes": "Perte du double des clés ou accès sans mandat",
    "consequences": "Litiges pour disparition de valeurs et atteinte image",
    "facteursRisque": "Absence de caméras orientées sur la salle des coffres",
    "facteurDeclencheur": "Demande d'accès d'un héritier sans acte notarié",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque juridique et sécurité"
  },
  {
    "no": 35,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Montage des dossiers PME/Corporate",
    "direction": "DC",
    "operationnel": "Chargé d'Affaires",
    "refRisque": "Risk-DC-01-2025",
    "risque": "Octroi de crédit sur états financiers falsifiés ou dossier incomplet",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Exiger états certifiés OHADA/visés DGI et consultation BIC",
    "controleNiveau1": "Check-list documentaire validée par l'Analyste Crédit",
    "controleNiveau2": "Revue indépendante des dossiers par la Direction Risques",
    "controleNiveau3": "Audit de qualité du portefeuille et conformité dossiers",
    "causes": "Complaisance commerciale et absence de vérification externe",
    "consequences": "Défaut précoce de l'emprunteur et perte en capital",
    "facteursRisque": "Pratique de doubles bilans dans l'économie informelle",
    "facteurDeclencheur": "Dossier présenté en urgence en fin de trimestre",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Octroi sur dossier falsifié",
    "natureRisque": "Risque de crédit et fraude"
  },
  {
    "no": 36,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Analyse financière et scoring",
    "direction": "DC",
    "operationnel": "Analyste Crédit",
    "refRisque": "Risk-DC-02-2025",
    "risque": "Sous-estimation du risque client par analyse financière défaillante",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Standardiser la grille d'analyse et croiser le BIC-UMOA",
    "controleNiveau1": "Contre-analyse indépendante et avis motivé des Risques",
    "controleNiveau2": "Contrôle qualité trimestriel des notations internes",
    "controleNiveau3": "Audit du modèle de notation et des décisions d'octroi",
    "causes": "Pression hiérarchique et hypothèses de cash-flow optimistes",
    "consequences": "Survenance d'impayés et hausse du coût du risque",
    "facteursRisque": "Volatilité des marchés locaux et manque de données",
    "facteurDeclencheur": "Refinancement d'un client en difficulté non détecté",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Défaut d'évaluation crédit",
    "natureRisque": "Risque de crédit"
  },
  {
    "no": 37,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Crédits particuliers et fonctionnaires",
    "direction": "DC",
    "operationnel": "Chargé de Clientèle",
    "refRisque": "Risk-DC-03-2025",
    "risque": "Dépassement de la quotité cessible ou fraude sur domiciliation",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Vérifier bulletins auprès du Trésor/employeur et blocage SI",
    "controleNiveau1": "Calcul automatique du reste à vivre et avis hiérarchique",
    "controleNiveau2": "Contrôle permanent sur échantillon des crédits conso",
    "controleNiveau3": "Audit des dossiers particuliers et irrévocabilité virements",
    "causes": "Multi-bancarisation dissimulée et fausses attestations",
    "consequences": "Explosion du taux d'impayés sur portefeuille retail",
    "facteursRisque": "Absence d'interconnexion temps réel sur dettes informelles",
    "facteurDeclencheur": "Changement d'employeur ou révocation de domiciliation",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Surendettement des ménages",
    "natureRisque": "Risque de crédit"
  },
  {
    "no": 38,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Financement de campagnes agricoles",
    "direction": "DC",
    "operationnel": "Resp. Financements Structurés",
    "refRisque": "Risk-DC-04-2025",
    "risque": "Détournement de stocks gagés ou défaut en tierce détention",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Agréer les tiers détenteurs et inspecter les magasins",
    "controleNiveau1": "Suivi hebdomadaire des stocks et bordereaux de livraison",
    "controleNiveau2": "Contrôle mensuel de couverture stock/encours et visites",
    "controleNiveau3": "Audit des financements cacao/anacarde et tiers détenteurs",
    "causes": "Collusion entre exportateur et tiers détenteur",
    "consequences": "Perte sèche importante sans garantie réalisable",
    "facteursRisque": "Fluctuation des cours mondiaux et risques climatiques",
    "facteurDeclencheur": "Baisse brutale du cours ou retard d'embarquement port",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Fraude sur collatéral",
    "natureRisque": "Risque de crédit et fraude"
  },
  {
    "no": 39,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Crédits immobiliers",
    "direction": "DC",
    "operationnel": "Analyste Crédit",
    "refRisque": "Risk-DC-05-2025",
    "risque": "Financement de projets à l'arrêt ou détournement des appels de fonds",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Conditionner chaque tranche au PV d'expertise technique",
    "controleNiveau1": "Déblocage direct aux entreprises sur factures visées",
    "controleNiveau2": "Suivi trimestriel des chantiers par expert indépendant",
    "controleNiveau3": "Audit des financements promoteurs et déblocages",
    "causes": "Absence de suivi physique des travaux sur site",
    "consequences": "Actif inachevé invendable et créance douteuse",
    "facteursRisque": "Litiges fonciers fréquents et faillite d'entrepreneurs",
    "facteurDeclencheur": "Retard de chantier > 6 mois sans justification",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Financement des entreprises",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Risque financement projet",
    "natureRisque": "Risque de crédit"
  },
  {
    "no": 40,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Dérogations et comités de crédit",
    "direction": "DC",
    "operationnel": "Secrétaire Comité Crédit",
    "refRisque": "Risk-DC-06-2025",
    "risque": "Octroi de dérogations abusives hors délégation du comité",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Traçabiliser toute dérogation dans le SI avec double visa DG/DR",
    "controleNiveau1": "Vérification du quorum et procès-verbal signé du comité",
    "controleNiveau2": "Suivi mensuel du taux de dérogation par les Risques",
    "controleNiveau3": "Audit des procès-verbaux et décisions hors normes",
    "causes": "Contournement des limites sous pression commerciale",
    "consequences": "Dégradation rapide de la qualité du portefeuille",
    "facteursRisque": "Gouvernance faible du processus d'exception",
    "facteurDeclencheur": "Validation par circuit informel (email/téléphone)",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Gouvernance octroi crédit",
    "natureRisque": "Risque de crédit et gouvernance"
  },
  {
    "no": 41,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Prise et validité des sûretés OHADA",
    "direction": "DC",
    "operationnel": "Chargé des Garanties",
    "refRisque": "Risk-DC-07-2025",
    "risque": "Déblocage de crédit avant inscription valide des sûretés OHADA",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Bloquer informatiquement la mise en place sans bordereau inscrit",
    "controleNiveau1": "Check-list juridique et visa Juridique avant déblocage",
    "controleNiveau2": "Contrôle trimestriel de la validité et renouvellement",
    "controleNiveau3": "Audit des dossiers de sûretés (hypothèques, nantissements)",
    "causes": "Lenteurs administratives foncières (ACD/Conservation)",
    "consequences": "Garantie inopposable en cas de défaut et perte totale",
    "facteursRisque": "Complexité du régime foncier et défaut d'expertise",
    "facteurDeclencheur": "Déblocage sur simple promesse d'hypothèque",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Admission et documentation clients",
    "natureRisque": "Risque juridique et de crédit"
  },
  {
    "no": 42,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Cautions et garanties par signature",
    "direction": "DC",
    "operationnel": "Resp. Engagements Signature",
    "refRisque": "Risk-DC-08-2025",
    "risque": "Émission de cautions hors modèle ou non suivies en hors-bilan",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Utiliser des modèles types visés par le Juridique et saisie SI",
    "controleNiveau1": "Double signature sur acte de caution et mainlevée tracée",
    "controleNiveau2": "Rapprochement mensuel des cautions actives et commissions",
    "controleNiveau3": "Audit du hors-bilan et des appels en garantie",
    "causes": "Cautions émises manuellement hors système central",
    "consequences": "Mise en jeu imprévue et sortie de trésorerie",
    "facteursRisque": "Forte demande BTP et marchés publics sans couverture",
    "facteurDeclencheur": "Appel en garantie sur un marché public abandonné",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque de crédit et opérationnel"
  },
  {
    "no": 43,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Crédits documentaires (CREDOC)",
    "direction": "DC",
    "operationnel": "Resp. Trade Finance",
    "refRisque": "Risk-DC-09-2025",
    "risque": "Paiement sur documents non conformes ou fraude maritime",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Appliquer strictement les RUU 600 et vérifier les connaissements",
    "controleNiveau1": "Double contrôle documentaire et couverture change/provision",
    "controleNiveau2": "Contrôle permanent des levées de réserves clients",
    "controleNiveau3": "Audit annuel du portefeuille Trade Finance",
    "causes": "Méconnaissance des règles UCP 600 et pression importateur",
    "consequences": "Refus de remboursement par le client ou litige",
    "facteursRisque": "Falsification de connaissements dans le négoce",
    "facteurDeclencheur": "Levée de réserves accordée sans accord écrit client",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque opérationnel et crédit"
  },
  {
    "no": 44,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Déblocage des crédits dans le SI",
    "direction": "DC",
    "operationnel": "Agent Administration Crédit",
    "refRisque": "Risk-DC-10-2025",
    "risque": "Saisie erronée des taux, échéances ou déblocage sur mauvais compte",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Paramétrer des produits standards et validation 4-yeux",
    "controleNiveau1": "Rapprochement ticket de mise en place vs PV comité",
    "controleNiveau2": "Contrôle mensuel des paramètres de taux et échéanciers",
    "controleNiveau3": "Audit des opérations de mise en place et avenants",
    "causes": "Saisie manuelle des caractéristiques et absence de 4-yeux",
    "consequences": "Perte d'intérêts, litige client et erreur comptable",
    "facteursRisque": "Multiplicité des produits sur mesure",
    "facteurDeclencheur": "Modification manuelle d'un échéancier après accord",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque opérationnel"
  },
  {
    "no": 45,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Surveillance des découverts et lignes",
    "direction": "DC",
    "operationnel": "Chargé d'Affaires",
    "refRisque": "Risk-DC-11-2025",
    "risque": "Tolérance de dépassements non autorisés devenant des impayés",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Bloquer les autorisations échues et escalader à J+15",
    "controleNiveau1": "Revue hebdomadaire des comptes débiteurs hors limites",
    "controleNiveau2": "Suivi mensuel des dépassements > 30 jours par les Risques",
    "controleNiveau3": "Audit des autorisations temporaires et dépassements",
    "causes": "Renouvellements tacites sans réexamen financier",
    "consequences": "Immobilisation de lignes court terme en défaut",
    "facteursRisque": "Manque de rigueur dans le suivi quotidien en agence",
    "facteurDeclencheur": "Dépassement non régularisé à 30 jours",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Défaut de surveillance crédit",
    "natureRisque": "Risque de crédit"
  },
  {
    "no": 46,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Grands risques et division des risques",
    "direction": "DR",
    "operationnel": "Analyste Risque Crédit",
    "refRisque": "Risk-DR-01-2025",
    "risque": "Dépassement du plafond division des risques (25% FP) UMOA",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Calculer l'exposition groupe consolidée avant tout comité",
    "controleNiveau1": "Alerte SI à 20% des fonds propres par groupe d'intérêts",
    "controleNiveau2": "Contrôle mensuel des grands risques et ratio global",
    "controleNiveau3": "Audit annuel de l'identification des groupes liés",
    "causes": "Méconnaissance des liens économiques entre sociétés",
    "consequences": "Sanctions Commission Bancaire et risque systémique",
    "facteursRisque": "Économie dominée par quelques grands groupes",
    "facteurDeclencheur": "Nouvel engagement sur une filiale d'un grand groupe",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Financement des entreprises",
    "categorieBale": "Risque de concentration",
    "sousCategorieBale": "Concentration sur contrepartie",
    "natureRisque": "Risque de crédit et réglementaire"
  },
  {
    "no": 47,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Concentration sectorielle",
    "direction": "DR",
    "operationnel": "Responsable Risques Crédit",
    "refRisque": "Risk-DR-02-2025",
    "risque": "Concentration excessive sur un secteur vulnérable (BTP, négoce)",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Fixer des plafonds sectoriels annuels validés par le Conseil",
    "controleNiveau1": "Reporting mensuel de répartition du portefeuille",
    "controleNiveau2": "Stress-test semestriel sectoriel par les Risques",
    "controleNiveau3": "Évaluation du dispositif de suivi de concentration",
    "causes": "Opportunisme commercial sur les secteurs en croissance",
    "consequences": "Chute simultanée d'emprunteurs lors d'un choc sectoriel",
    "facteursRisque": "Spécialisation de l'économie locale (matières premières)",
    "facteurDeclencheur": "Crise de paiement de l'État envers le BTP",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Risque de concentration",
    "sousCategorieBale": "Concentration sectorielle",
    "natureRisque": "Risque de crédit"
  },
  {
    "no": 48,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Déclassement et provisionnement BCEAO",
    "direction": "DR",
    "operationnel": "Resp. Risques & Provisions",
    "refRisque": "Risk-DR-03-2025",
    "risque": "Retard de déclassement en créances douteuses (90j) et sous-provision",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Automatiser le basculement à 90 jours et recalculer les décotes",
    "controleNiveau1": "Revue mensuelle des impayés et justificatifs de garanties",
    "controleNiveau2": "Validation trimestrielle des provisions par le Comité Risques",
    "controleNiveau3": "Audit annuel de la qualité des créances et provisions",
    "causes": "Restructurations cosmétiques (evergreening) pour masquer",
    "consequences": "Surestimation du résultat et sanctions Commission Bancaire",
    "facteursRisque": "Pression sur le coût du risque en clôture d'exercice",
    "facteurDeclencheur": "Rééchelonnement répété d'un client en impayé",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque réglementaire et financier"
  },
  {
    "no": 49,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Recouvrement amiable",
    "direction": "DREC",
    "operationnel": "Gestionnaire Recouvrement",
    "refRisque": "Risk-DREC-01-2025",
    "risque": "Inaction précoce sur premiers impayés réduisant les chances de recouvrement",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Automatiser les relances dès J+5 et transfert recouvrement à J+30",
    "controleNiveau1": "Suivi hebdomadaire des promesses de paiement",
    "controleNiveau2": "Revue mensuelle du taux de recouvrement par âge",
    "controleNiveau3": "Audit d'efficacité du recouvrement amiable",
    "causes": "Conservation trop longue des dossiers par les commerciaux",
    "consequences": "Passage en perte définitive et baisse du taux de récupération",
    "facteursRisque": "Conflit d'intérêt commercial sur le suivi client",
    "facteurDeclencheur": "Retard de transfert d'un dossier après 2 échéances",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Suivi des impayés",
    "natureRisque": "Risque de crédit"
  },
  {
    "no": 50,
    "cycle": "Cycle Engagements et Crédit",
    "processus": "Contentieux et réalisation des garanties",
    "direction": "DREC",
    "operationnel": "Juriste Contentieux",
    "refRisque": "Risk-DREC-02-2025",
    "risque": "Prescription de créances ou échec de réalisation des sûretés OHADA",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Respecter les délais procéduraux OHADA et contrôler les avocats",
    "controleNiveau1": "Suivi mensuel de l'agenda judiciaire et des diligences",
    "controleNiveau2": "Revue trimestrielle des dossiers contentieux et honoraires",
    "controleNiveau3": "Audit des dossiers contentieux et réalisations de gages",
    "causes": "Lenteurs judiciaires et inaction des conseils externes",
    "consequences": "Créances irrécouvrables et coûts juridiques élevés",
    "facteursRisque": "Encombrement des juridictions commerciales locales",
    "facteurDeclencheur": "Dépassement du délai légal d'action ou erreur d'huissier",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Banque commerciale",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Gestion du contentieux",
    "natureRisque": "Risque juridique et crédit"
  },
  {
    "no": 51,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Liquidité quotidienne et réserves BCEAO",
    "direction": "DT",
    "operationnel": "Trésorier Principal",
    "refRisque": "Risk-DT-01-2025",
    "risque": "Déficit de réserves obligatoires BCEAO ou défaut d'illiquidité",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Établir un prévisionnel quotidien de trésorerie à J+30",
    "controleNiveau1": "Pointage journalier du compte de règlement BCEAO",
    "controleNiveau2": "Suivi hebdomadaire des coussins de liquidité (ALCO)",
    "controleNiveau3": "Audit annuel de la gestion de liquidité et réserves",
    "causes": "Sorties de fonds imprévues (État, grands déposants)",
    "consequences": "Pénalités BCEAO, coût de refinancement et crise",
    "facteursRisque": "Forte volatilité des dépôts publics et institutionnels",
    "facteurDeclencheur": "Retrait massif d'un client institutionnel non anticipé",
    "familleBale": "Risque de Liquidité",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Risque de liquidité",
    "sousCategorieBale": "Liquidité court terme",
    "natureRisque": "Risque de liquidité"
  },
  {
    "no": 52,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Ratios prudentiels de liquidité (LCR)",
    "direction": "DT",
    "operationnel": "Responsable ALM",
    "refRisque": "Risk-DT-02-2025",
    "risque": "Non-respect du LCR (< 100%) ou transformation excessive",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Piloter l'adossement ressources-emplois en Comité ALCO",
    "controleNiveau1": "Calcul hebdomadaire des ratios de liquidité et alertes",
    "controleNiveau2": "Challenge mensuel des hypothèses de stabilité dépôts",
    "controleNiveau3": "Audit des calculs réglementaires LCR et coefficient",
    "causes": "Financement d'emplois longs par des dépôts à vue",
    "consequences": "Sanctions prudentielles et restriction d'octroi de crédits",
    "facteursRisque": "Structure de dépôts majoritairement à vue en UMOA",
    "facteurDeclencheur": "Octroi massif de crédits long terme sans ressource longue",
    "familleBale": "Risque de Liquidité",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Risque de liquidité",
    "sousCategorieBale": "Transformation bilantielle",
    "natureRisque": "Risque de liquidité"
  },
  {
    "no": 53,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Refinancement BCEAO",
    "direction": "DT",
    "operationnel": "Trésorier Principal",
    "refRisque": "Risk-DT-03-2025",
    "risque": "Insuffisance de titres éligibles au guichet de refinancement",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Maintenir un stock tampon de titres publics mobilisables",
    "controleNiveau1": "Suivi quotidien des titres nantis et marge disponible",
    "controleNiveau2": "Revue mensuelle de la capacité de mobilisation en ALCO",
    "controleNiveau3": "Audit de la gestion du collatéral éligible BCEAO",
    "causes": "Mobilisation maximale lors de tensions de liquidité",
    "consequences": "Impossibilité d'accéder aux appels d'offres BCEAO",
    "facteursRisque": "Resserrement de la politique monétaire de la BCEAO",
    "facteurDeclencheur": "Baisse des dépôts ou hausse du besoin de liquidité",
    "familleBale": "Risque de Liquidité",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Risque de liquidité",
    "sousCategorieBale": "Accès au refinancement",
    "natureRisque": "Risque de liquidité"
  },
  {
    "no": 54,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Opérations interbancaires",
    "direction": "DT",
    "operationnel": "Opérateur Marché",
    "refRisque": "Risk-DT-04-2025",
    "risque": "Défaillance d'une banque contrepartie sur prêt interbancaire en blanc",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Privilégier les pensions livrées et plafonds par contrepartie",
    "controleNiveau1": "Blocage SI des limites de contrepartie avant négociation",
    "controleNiveau2": "Revue trimestrielle des limites interbancaires (Risques)",
    "controleNiveau3": "Audit du respect des limites et confirmations deals",
    "causes": "Octroi de prêts en blanc sans notation récente",
    "consequences": "Perte de liquidité immédiate et dépréciation d'actif",
    "facteursRisque": "Fragilité financière de certaines banques locales",
    "facteurDeclencheur": "Rumeur de défaut sur une banque partenaire",
    "familleBale": "Risque de Crédit",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Risque de contrepartie / défaut",
    "sousCategorieBale": "Défaut contrepartie bancaire",
    "natureRisque": "Risque de crédit et marché"
  },
  {
    "no": 55,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Portefeuille titres (UMOA-Titres)",
    "direction": "DT",
    "operationnel": "Gérant Portefeuille Titres",
    "refRisque": "Risk-DT-05-2025",
    "risque": "Moins-values latentes ou défaut d'un émetteur souverain/privé",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Diversifier les échéances et émetteurs selon limites ALCO",
    "controleNiveau1": "Valorisation quotidienne mark-to-market des titres",
    "controleNiveau2": "Suivi mensuel de la sensibilité et limites (Risques)",
    "controleNiveau3": "Audit de la comptabilisation et valorisation titres",
    "causes": "Concentration sur une maturité longue en hausse de taux",
    "consequences": "Dépréciation des fonds propres et perte en capital",
    "facteursRisque": "Risque souverain régional et hausse des taux directeurs",
    "facteurDeclencheur": "Adjudication à taux élevé ou défaut d'un émetteur",
    "familleBale": "Risque de Marché",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Risque de taux et émetteur",
    "sousCategorieBale": "Valorisation portefeuille titres",
    "natureRisque": "Risque de marché"
  },
  {
    "no": 56,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Opérations de change et position",
    "direction": "DT",
    "operationnel": "Cambiste",
    "refRisque": "Risk-DT-06-2025",
    "risque": "Dépassement de la position de change réglementaire",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Automatiser le calcul temps réel et fixer des stop-loss",
    "controleNiveau1": "Contrôle fin de journée de la position nette par devise",
    "controleNiveau2": "Contrôle quotidien du respect des limites par Middle-Office",
    "controleNiveau3": "Audit annuel de la salle des marchés et change",
    "causes": "Opérations clients tardives non couvertes",
    "consequences": "Perte de change sur devises volatiles (USD/NGN/GHS)",
    "facteursRisque": "Forte volatilité des devises hors zone franc",
    "facteurDeclencheur": "Couverture tardive d'un gros ordre d'achat devises",
    "familleBale": "Risque de Marché",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Risque de change",
    "sousCategorieBale": "Position de change ouverte",
    "natureRisque": "Risque de marché"
  },
  {
    "no": 57,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Gestion du risque de taux global (ALM)",
    "direction": "DT",
    "operationnel": "Responsable ALM",
    "refRisque": "Risk-DT-07-2025",
    "risque": "Compression de la marge d'intérêt en cas de choc de taux",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Réaliser des simulations de chocs de taux (+/- 200 pdb)",
    "controleNiveau1": "Suivi trimestriel des gaps de taux fixe/variable",
    "controleNiveau2": "Validation ALCO des stratégies de couverture",
    "controleNiveau3": "Audit du modèle ALM et fiabilité des données d'entrée",
    "causes": "Asymétrie taux fixes actifs et refinancement variable",
    "consequences": "Baisse durable du PNB et de la rentabilité",
    "facteursRisque": "Hausse des taux de refinancement BCEAO et dépôts",
    "facteurDeclencheur": "Relèvement des taux directeurs par la BCEAO",
    "familleBale": "Risque de Taux (ALM)",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Risque de taux bilan",
    "sousCategorieBale": "Mismatch de taux",
    "natureRisque": "Risque financier (ALM)"
  },
  {
    "no": 58,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Séparation Front/Middle/Back-Office",
    "direction": "DT",
    "operationnel": "Responsable Back-Office Marché",
    "refRisque": "Risk-DT-08-2025",
    "risque": "Cumul de saisie et confirmation dissimulant des opérations fictives",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Isoler strictement les accès SI entre Front, Middle et Back",
    "controleNiveau1": "Confirmation externe directe par le Back-Office seul",
    "controleNiveau2": "Revue mensuelle des annulations et amendements de deals",
    "controleNiveau3": "Audit de séparation des fonctions en salle des marchés",
    "causes": "Effectifs réduits en trésorerie et confiance excessive",
    "consequences": "Fraude de marché non détectée et perte majeure",
    "facteursRisque": "Absence de progiciel dédié Front-to-Back",
    "facteurDeclencheur": "Modification manuelle d'un deal déjà validé",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Activités de marché",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Activités non autorisées",
    "natureRisque": "Risque de fraude et opérationnel"
  },
  {
    "no": 59,
    "cycle": "Cycle Trésorerie et ALM",
    "processus": "Rapprochement Nostri / Vostri",
    "direction": "DT",
    "operationnel": "Comptable Trésorerie",
    "refRisque": "Risk-DT-09-2025",
    "risque": "Suspens anciens non apurés sur comptes correspondants",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Automatiser le lettrage SWIFT MT940/MT950 quotidien",
    "controleNiveau1": "Apurement quotidien et escalade des suspens > 5 jours",
    "controleNiveau2": "Contrôle mensuel de la balance âgée des suspens",
    "controleNiveau3": "Audit des rapprochements Nostri/Vostri et provisions",
    "causes": "Manque de réactivité des correspondants étrangers",
    "consequences": "Pertes non détectées, fraudes ou erreurs de change",
    "facteursRisque": "Multiplication des correspondants et flux manuels",
    "facteurDeclencheur": "Rejet SWIFT ou frais non identifiés > 30 jours",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque opérationnel et comptable"
  },
  {
    "no": 60,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Paramétrage comptable PCB-UMOA",
    "direction": "DFC",
    "operationnel": "Resp. Normes Comptables",
    "refRisque": "Risk-DFC-01-2025",
    "risque": "Schémas comptables non conformes au PCB-UMOA révisé",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Valider tout nouveau schéma par DFC et Conformité avant prod",
    "controleNiveau1": "Contrôle de cohérence des balances quotidiennes",
    "controleNiveau2": "Revue trimestrielle des comptes sensibles et schémas",
    "controleNiveau3": "Audit annuel du paramétrage comptable Core Banking",
    "causes": "Lancement rapide de produits sans recette comptable",
    "consequences": "États financiers inexacts et rejet des états BCEAO",
    "facteursRisque": "Complexité des nouvelles normes PCB-UMOA",
    "facteurDeclencheur": "Création d'un nouveau produit ou compte dans le SI",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque comptable"
  },
  {
    "no": 61,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Comptes d'attente et de liaison",
    "direction": "DFC",
    "operationnel": "Chef Comptable",
    "refRisque": "Risk-DFC-02-2025",
    "risque": "Maintien de soldes élevés non justifiés en comptes d'attente",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Interdire la saisie manuelle directe et imposer apurement < 15j",
    "controleNiveau1": "Analyse hebdomadaire et justification de chaque solde",
    "controleNiveau2": "Contrôle mensuel de l'ancienneté des suspens (DFC/Risques)",
    "controleNiveau3": "Audit des comptes de passage, 37x et liaisons inter-agences",
    "causes": "Défaut d'automatisation et négligence opérationnelle",
    "consequences": "Dissimulation de pertes ou détournements internes",
    "facteursRisque": "Volume élevé d'opérations rejetées aux guichets",
    "facteurDeclencheur": "Solde d'un compte d'attente restant > 30 jours",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque comptable et fraude"
  },
  {
    "no": 62,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Arrêté mensuel et clôture annuelle",
    "direction": "DFC",
    "operationnel": "Directeur Financier",
    "refRisque": "Risk-DFC-03-2025",
    "risque": "Erreurs de cut-off ou retard de publication des états financiers",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Appliquer un calendrier de clôture strict avec cut-off SI",
    "controleNiveau1": "Check-list de clôture et revue analytique des écarts",
    "controleNiveau2": "Contrôle de cohérence interne avant certification",
    "controleNiveau3": "Audit légal (CAC) et audit interne des arrêtés",
    "causes": "Saisies manuelles tardives et mauvaise coordination",
    "consequences": "Sanctions pour publication tardive et perte de crédibilité",
    "facteursRisque": "Charge de travail concentrée en clôture annuelle",
    "facteurDeclencheur": "Retard de transmission des données par les métiers",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque comptable"
  },
  {
    "no": 63,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Évaluation des provisions et décotes",
    "direction": "DFC",
    "operationnel": "Chef Comptable",
    "refRisque": "Risk-DFC-04-2025",
    "risque": "Sous-évaluation des provisions pour risques ou litiges",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Documenter les bases de calcul et valider avec Juridique/Risques",
    "controleNiveau1": "Rapprochement mensuel balance crédit et états provisions",
    "controleNiveau2": "Challenge trimestriel par le Comité Risques et Audit",
    "controleNiveau3": "Audit annuel des provisions crédit, sociales et litiges",
    "causes": "Pression sur le résultat net et estimations subjectives",
    "consequences": "Réserves des CAC et redressements Commission Bancaire",
    "facteursRisque": "Litiges complexes et règles de décote des sûretés",
    "facteurDeclencheur": "Réception d'une assignation judiciaire importante",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque comptable et réglementaire"
  },
  {
    "no": 64,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Ratio de solvabilité (Bâle II/III)",
    "direction": "DFC",
    "operationnel": "Resp. Reporting Prudentiel",
    "refRisque": "Risk-DFC-05-2025",
    "risque": "Calcul erroné ou chute du ratio de solvabilité sous les normes",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Automatiser l'extraction des pondérations de risques (RWA)",
    "controleNiveau1": "Double vérification des fonds propres et pondérations",
    "controleNiveau2": "Simulation trimestrielle de solvabilité et coussins",
    "controleNiveau3": "Audit de fiabilité du calcul du ratio de solvabilité",
    "causes": "Erreur d'affectation des pondérations Bâle II/III",
    "consequences": "Injonction d'augmentation de capital ou sanctions UMOA",
    "facteursRisque": "Croissance rapide du bilan et distribution de dividendes",
    "facteurDeclencheur": "Baisse brutale des fonds propres ou hausse RWA",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque prudentiel"
  },
  {
    "no": 65,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "États réglementaires (FODEP/DEC2000)",
    "direction": "DFC",
    "operationnel": "Resp. Reporting Prudentiel",
    "refRisque": "Risk-DFC-06-2025",
    "risque": "Retards ou incohérences dans les états transmis à la BCEAO",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Automatiser la génération FODEP avec contrôles de cohérence",
    "controleNiveau1": "Rapprochement balance générale vs états FODEP",
    "controleNiveau2": "Revue pré-envoi par le DFC et la Conformité",
    "controleNiveau3": "Audit annuel de la chaîne de reporting réglementaire",
    "causes": "Retraitements manuels sur Excel avant dépôt",
    "consequences": "Pénalités financières BCEAO par jour de retard",
    "facteursRisque": "Multiplication et évolution des canevas déclarables",
    "facteurDeclencheur": "Décalage de clôture comptable ou bug d'extraction",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque réglementaire"
  },
  {
    "no": 66,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Déclarations fiscales (IS, TVA, TOB)",
    "direction": "DFC",
    "operationnel": "Fiscaliste / Comptable",
    "refRisque": "Risk-DFC-07-2025",
    "risque": "Erreur ou retard de déclaration fiscale (TOB, TVA, IS, RAS)",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Tenir un échéancier fiscal digitalisé avec revue par conseil",
    "controleNiveau1": "Rapprochement mensuel bases imposables et comptabilité",
    "controleNiveau2": "Revue fiscale trimestrielle et veille Loi de Finances",
    "controleNiveau3": "Audit fiscal annuel de conformité déclarative",
    "causes": "Méconnaissance des spécificités fiscales locales (TOB)",
    "consequences": "Redressements fiscaux, majorations et pénalités",
    "facteursRisque": "Changements fréquents des lois de finances en UEMOA",
    "facteurDeclencheur": "Avis de vérification générale de comptabilité DGI",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque fiscal"
  },
  {
    "no": 67,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Immobilisations et inventaire physique",
    "direction": "DFC",
    "operationnel": "Comptable Immobilisations",
    "refRisque": "Risk-DFC-08-2025",
    "risque": "Actifs fictifs, disparus ou amortissements mal calculés",
    "probabilite": "Moyen",
    "impact": "Faible",
    "evaluationRisque": "Faible",
    "planAction": "Étiqueter par code-barres et rapprocher inventaire/fichier",
    "controleNiveau1": "Rapprochement annuel inventaire physique vs fichier immo",
    "controleNiveau2": "Contrôle semestriel des sorties et mises au rebut",
    "controleNiveau3": "Audit du cycle immobilisations et calcul dotations",
    "causes": "Absence d'inventaire physique et sorties non signalées",
    "consequences": "Surévaluation des actifs et erreurs de résultat",
    "facteursRisque": "Décentralisation des équipements sur de nombreuses agences",
    "facteurDeclencheur": "Déménagement ou fermeture d'une agence régionale",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque comptable"
  },
  {
    "no": 68,
    "cycle": "Cycle Comptable et Fiscal",
    "processus": "Factures fournisseurs et notes de frais",
    "direction": "DFC",
    "operationnel": "Comptable Fournisseurs",
    "refRisque": "Risk-DFC-09-2025",
    "risque": "Double paiement ou règlement de factures fictives",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Exiger rapprochement 3-voies (BC, BL, Facture) avant paiement",
    "controleNiveau1": "Blocage SI des doublons de numéro facture et visa DAF",
    "controleNiveau2": "Contrôle permanent sur échantillon des décaissements",
    "controleNiveau3": "Audit annuel du cycle achats-fournisseurs",
    "causes": "Validation sur copie et défaut de vérification du service fait",
    "consequences": "Pertes de trésorerie directe et rejet fiscal",
    "facteursRisque": "Urgence de paiement et fraude au faux fournisseur",
    "facteurDeclencheur": "Demande de changement de RIB d'un fournisseur",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque opérationnel et fraude"
  },
  {
    "no": 69,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Filtrage listes de sanctions",
    "direction": "DCONF",
    "operationnel": "Analyste Conformité",
    "refRisque": "Risk-DCONF-01-2025",
    "risque": "Exécution de flux avec des entités sous sanctions internationales",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Paramétrer filtrage temps réel bloquant sur listes ONU/OFAC/UE",
    "controleNiveau1": "Traitement quotidien des alertes bloquées avant exécution",
    "controleNiveau2": "Contrôle de la pertinence et mise à jour des listes",
    "controleNiveau3": "Audit annuel d'efficacité et tests de filtrage",
    "causes": "Seuils de correspondance flous trop larges ou liste obsolète",
    "consequences": "Sanctions internationales lourdes et perte correspondants USD",
    "facteursRisque": "Homonymie fréquente et absence de dates de naissance",
    "facteurDeclencheur": "Mise à jour majeure d'une liste ONU/OFAC ou flux USD",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque sanctions internationales"
  },
  {
    "no": 70,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Détection des opérations atypiques",
    "direction": "DCONF",
    "operationnel": "Resp. Sécurité Financière",
    "refRisque": "Risk-DCONF-02-2025",
    "risque": "Non-détection d'opérations de blanchiment ou fractionnement espèces",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Calibrer des scénarios LBC/FT adaptés au contexte UEMOA",
    "controleNiveau1": "Analyse sous 48h des alertes générées par l'outil AML",
    "controleNiveau2": "Revue trimestrielle des scénarios et faux négatifs",
    "controleNiveau3": "Audit annuel d'efficacité du dispositif LBC/FT",
    "causes": "Outil AML non paramétré pour les flux espèces et mobiles",
    "consequences": "Blanchiment de capitaux et sanctions sévères régulateur",
    "facteursRisque": "Prédominance du cash dans l'économie régionale",
    "facteurDeclencheur": "Dépôts espèces fractionnés sans justification économique",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque LBC/FT"
  },
  {
    "no": 71,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Déclarations de Soupçon (DOS)",
    "direction": "DCONF",
    "operationnel": "Correspondant CENTIF",
    "refRisque": "Risk-DCONF-03-2025",
    "risque": "Défaut ou retard de déclaration de soupçon à la CENTIF",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Formaliser la procédure de remontée interne confidentielle",
    "controleNiveau1": "Analyse des dossiers suspects et décision documentée",
    "controleNiveau2": "Contrôle annuel du registre des alertes et DOS",
    "controleNiveau3": "Audit de conformité LBC/FT (confidentialité et délais)",
    "causes": "Crainte de perdre un gros client ou fuite d'information",
    "consequences": "Responsabilité pénale dirigeants et sanctions CENTIF",
    "facteursRisque": "Pression commerciale sur les gros déposants",
    "facteurDeclencheur": "Alerte interne grave non remontée au correspondant",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque LBC/FT et pénal"
  },
  {
    "no": 72,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Surveillance des PPE",
    "direction": "DCONF",
    "operationnel": "Chargé Conformité",
    "refRisque": "Risk-DCONF-04-2025",
    "risque": "Entrée en relation avec une PPE sans vigilance renforcée",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Exiger validation DG et origine des fonds pour toute PPE",
    "controleNiveau1": "Identification PPE dès l'entrée en relation et revue annuelle",
    "controleNiveau2": "Contrôle permanent sur 100% des dossiers PPE actifs",
    "controleNiveau3": "Audit annuel des comptes PPE et mouvements financiers",
    "causes": "Base PPE incomplète sur les mandataires locaux",
    "consequences": "Risque réputationnel majeur, corruption et blanchiment",
    "facteursRisque": "Forte imbrication sphère politique et affaires locales",
    "facteurDeclencheur": "Nomination politique d'un client existant non détectée",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Admission et documentation clients",
    "natureRisque": "Risque LBC/FT et réputation"
  },
  {
    "no": 73,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Conformité FATCA / CRS",
    "direction": "DCONF",
    "operationnel": "Responsable Conformité",
    "refRisque": "Risk-DCONF-05-2025",
    "risque": "Défaut de déclaration des clients américains (FATCA)",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Intégrer les indices d'américanité bloquants à l'ouverture",
    "controleNiveau1": "Collecte formulaires W-8/W-9 et auto-certification",
    "controleNiveau2": "Revue annuelle des comptes présentant des indices",
    "controleNiveau3": "Audit de conformité du reporting FATCA / CRS",
    "causes": "Méconnaissance des indices d'américanité en agence",
    "consequences": "Retenue fiscale pénalisante de 30% sur flux USD",
    "facteursRisque": "Clients binationaux ou résidents US non identifiés",
    "facteurDeclencheur": "Ouverture compte client avec adresse/téléphone US",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque réglementaire international"
  },
  {
    "no": 74,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Protection des données personnelles",
    "direction": "DCONF",
    "operationnel": "DPO / Resp. Conformité",
    "refRisque": "Risk-DCONF-06-2025",
    "risque": "Fuite ou usage illicite de données clients (loi ARTCI/UEMOA)",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Chiffrer les bases, déclarer les traitements et limiter exports",
    "controleNiveau1": "Restriction des droits d'extraction de fichiers clients",
    "controleNiveau2": "Contrôle trimestriel des consentements et accès données",
    "controleNiveau3": "Audit annuel de conformité RGPD local / ARTCI",
    "causes": "Exports Excel non sécurisés et partage sur messagerie",
    "consequences": "Sanctions de l'autorité (ARTCI) et perte de confiance",
    "facteursRisque": "Absence de solutions DLP contre les fuites de données",
    "facteurDeclencheur": "Vol d'un ordinateur non chiffré ou fuite fichier",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Dysfonctionnement de l'activité et systèmes",
    "sousCategorieBale": "Sécurité des données",
    "natureRisque": "Risque juridique et cyber"
  },
  {
    "no": 75,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Prévention corruption et cadeaux",
    "direction": "DCONF",
    "operationnel": "Responsable Éthique",
    "refRisque": "Risk-DCONF-07-2025",
    "risque": "Actes de corruption passive/active dans l'octroi ou achats",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Appliquer politique tolérance zéro et registre des cadeaux",
    "controleNiveau1": "Déclaration obligatoire de tout avantage reçu > seuil",
    "controleNiveau2": "Contrôle annuel du registre cadeaux et dispositif alerte",
    "controleNiveau3": "Audit éthique et enquêtes sur alertes de fraude",
    "causes": "Culture tolérante aux pourboires et faibles contrôles",
    "consequences": "Poursuites pénales, perte de licences et fraude",
    "facteursRisque": "Sollicitation lors de marchés ou dossiers de crédit",
    "facteurDeclencheur": "Dépôt d'un signalement via le canal d'alerte éthique",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque éthique et pénal"
  },
  {
    "no": 76,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Validation nouveaux produits (NPNA)",
    "direction": "DCONF",
    "operationnel": "Comité Produits",
    "refRisque": "Risk-DCONF-08-2025",
    "risque": "Lancement de produit sans avis préalable Risques/Conformité",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Rendre obligatoire le visa Comité NPNA avant mise en marché",
    "controleNiveau1": "Fiche d'impact risques, IT, fiscal et juridique signée",
    "controleNiveau2": "Contrôle trimestriel des produits commercialisés vs catalogue",
    "controleNiveau3": "Audit du respect du processus d'approbation produits",
    "causes": "Course au time-to-market et contournement comité",
    "consequences": "Produit non conforme, pertes cachées ou bug SI",
    "facteursRisque": "Concurrence forte des Fintechs et banques digitales",
    "facteurDeclencheur": "Lancement précipité d'une offre promotionnelle",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Défauts de produits",
    "natureRisque": "Risque de conformité et produit"
  },
  {
    "no": 77,
    "cycle": "Cycle Conformité et LBC/FT",
    "processus": "Transferts rapides (MTO)",
    "direction": "DCONF",
    "operationnel": "Resp. Conformité Opé.",
    "refRisque": "Risk-DCONF-09-2025",
    "risque": "Usage des transferts rapides pour financement illicite",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Plafonner les opérations espèces et croiser l'identité client",
    "controleNiveau1": "Vérification pièce originale et saisie motif opération",
    "controleNiveau2": "Contrôle mensuel des clients récurrents (fractionnement)",
    "controleNiveau3": "Audit annuel de l'activité transfert rapide (Western, etc.)",
    "causes": "Saisie de pièces tierces et défaut de vigilance guichet",
    "consequences": "Sanctions BCEAO/CENTIF et rupture avec partenaire MTO",
    "facteursRisque": "Flux informels transfrontaliers très importants",
    "facteurDeclencheur": "Opérations répétées d'un même client sous les seuils",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque LBC/FT"
  },
  {
    "no": 78,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Droits d'accès Core Banking",
    "direction": "DSI",
    "operationnel": "Admin Sécurité SI",
    "refRisque": "Risk-DSI-01-2025",
    "risque": "Cumul de droits incompatibles ou abus de comptes privilégiés",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Déployer matrice SoD et coffre-fort PAM pour comptes admin",
    "controleNiveau1": "Validation hiérarchique stricte de toute demande d'accès",
    "controleNiveau2": "Revue trimestrielle des profils et comptes à privilèges",
    "controleNiveau3": "Audit annuel des habilitations et matrice SoD SI",
    "causes": "Profils dupliqués lors de mobilités sans purge",
    "consequences": "Fraude interne massive ou manipulation comptable",
    "facteursRisque": "Absence d'outil automatisé de gestion des identités",
    "facteurDeclencheur": "Mutation d'un agent gardant ses anciens droits",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Activités non autorisées",
    "natureRisque": "Risque IT et fraude"
  },
  {
    "no": 79,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Cybersécurité et ransomwares",
    "direction": "DSI",
    "operationnel": "RSSI",
    "refRisque": "Risk-DSI-02-2025",
    "risque": "Intrusion réseau ou cryptolocker paralysant les systèmes",
    "probabilite": "Élevé",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Déployer EDR/SOC 24/7, MFA généralisé et segmentation",
    "controleNiveau1": "Surveillance quotidienne des alertes SOC et antivirus",
    "controleNiveau2": "Exercices annuels de crise cyber et tests d'intrusion",
    "controleNiveau3": "Audit de maturité cybersécurité (ISO 27001 / NIST)",
    "causes": "Failles non patchées et clic sur email malveillant",
    "consequences": "Paralysie totale des activités et perte de données",
    "facteursRisque": "Recrudescence des attaques cyber sur les banques UMOA",
    "facteurDeclencheur": "Ouverture d'une pièce jointe infectée sur poste interne",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Sécurité des systèmes",
    "natureRisque": "Risque cyber"
  },
  {
    "no": 80,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Gestion des changements SI",
    "direction": "DSI",
    "operationnel": "Resp. Études & Dév",
    "refRisque": "Risk-DSI-03-2025",
    "risque": "Mise en production non testée provoquant panne ou faille",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Séparer strictement environnements Dev/Test/Prod et CAB",
    "controleNiveau1": "Cahier de recettes signé par le métier avant bascule",
    "controleNiveau2": "Contrôle mensuel des changements urgents hors CAB",
    "controleNiveau3": "Audit du processus de gestion des changements SI",
    "causes": "Développeurs ayant accès en production et urgence",
    "consequences": "Indisponibilité Core Banking et erreurs de calcul",
    "facteursRisque": "Dépendance forte envers l'éditeur du Core Banking",
    "facteurDeclencheur": "Déploiement d'un correctif urgent sans test",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Dysfonctionnement de l'activité et systèmes",
    "sousCategorieBale": "Systèmes",
    "natureRisque": "Risque informatique"
  },
  {
    "no": 81,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Sauvegardes et restauration",
    "direction": "DSI",
    "operationnel": "Admin Systèmes",
    "refRisque": "Risk-DSI-04-2025",
    "risque": "Sauvegardes corrompues ou inexploitables après incident majeur",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Appliquer la règle 3-2-1 avec copie immuable hors ligne",
    "controleNiveau1": "Contrôle quotidien du succès des jobs de sauvegarde",
    "controleNiveau2": "Test semestriel de restauration réelle de bases critiques",
    "controleNiveau3": "Audit des sauvegardes et tests de restauration",
    "causes": "Absence de tests réels et stockage sur même réseau",
    "consequences": "Perte définitive de données comptables et clients",
    "facteursRisque": "Vulnérabilité des sauvegardes en ligne aux ransomwares",
    "facteurDeclencheur": "Panne disque majeure ou attaque cryptolocker",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Dysfonctionnement de l'activité et systèmes",
    "sousCategorieBale": "Systèmes",
    "natureRisque": "Risque IT et continuité"
  },
  {
    "no": 82,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Disponibilité réseau et infrastructures",
    "direction": "DSI",
    "operationnel": "Resp. Infrastructures",
    "refRisque": "Risk-DSI-05-2025",
    "risque": "Coupure réseau paralysant les agences et services clients",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Redonder les liaisons télécoms (fibre + VSAT/4G)",
    "controleNiveau1": "Monitoring temps réel des liens et bascule automatique",
    "controleNiveau2": "Suivi mensuel des taux de disponibilité (SLA)",
    "controleNiveau3": "Audit de résilience et redondance des infrastructures",
    "causes": "Travaux urbains coupant la fibre et opérateur unique",
    "consequences": "Arrêt du service en agence et perte de chiffre",
    "facteursRisque": "Qualité instable des réseaux télécoms hors capitales",
    "facteurDeclencheur": "Coupure de fibre optique ou panne de cœur de réseau",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Dysfonctionnement de l'activité et systèmes",
    "sousCategorieBale": "Systèmes",
    "natureRisque": "Risque continuité d'activité"
  },
  {
    "no": 83,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Sécurité API et passerelles paiement",
    "direction": "DSI",
    "operationnel": "Architecte SI",
    "refRisque": "Risk-DSI-06-2025",
    "risque": "Interception ou injection sur API exposées aux partenaires",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Sécuriser les API via passerelle WAF, OAuth2 et TLS",
    "controleNiveau1": "Revue de code sécurisée et chiffrement des flux",
    "controleNiveau2": "Scan trimestriel de vulnérabilités sur interfaces API",
    "controleNiveau3": "Audit annuel de sécurité des API et passerelles",
    "causes": "Développement rapide sans revue sécurité applicative",
    "consequences": "Transactions frauduleuses et fuite de données",
    "facteursRisque": "Multiplication des intégrations Fintech et télécoms",
    "facteurDeclencheur": "Déploiement d'une nouvelle API partenaire non auditée",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Sécurité des systèmes",
    "natureRisque": "Risque cyber"
  },
  {
    "no": 84,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Sécurité monétique (PCI-DSS)",
    "direction": "DSI",
    "operationnel": "Resp. Sécurité Monétique",
    "refRisque": "Risk-DSI-07-2025",
    "risque": "Compromission de données cartes et non-conformité PCI-DSS",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Isoler le périmètre monétique (CDE) et chiffrer les PAN",
    "controleNiveau1": "Surveillance des accès au HSM et serveurs monétiques",
    "controleNiveau2": "Auto-évaluation et scans trimestriels ASV PCI-DSS",
    "controleNiveau3": "Certification annuelle QSA et audit monétique",
    "causes": "Stockage en clair de numéros de cartes ou clés HSM",
    "consequences": "Amende Visa/Mastercard et fraude massive par clonage",
    "facteursRisque": "Évolution constante des standards de sécurité cartes",
    "facteurDeclencheur": "Fuite de logs applicatifs contenant des PAN en clair",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Paiement et règlement",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Sécurité des systèmes",
    "natureRisque": "Risque cyber et conformité"
  },
  {
    "no": 85,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "PCA / PRA et site de repli",
    "direction": "DSI",
    "operationnel": "Responsable PCA",
    "refRisque": "Risk-DSI-08-2025",
    "risque": "Échec de bascule sur le site de repli lors d'un sinistre",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Maintenir un PRA répliqué en temps réel à distance (>30km)",
    "controleNiveau1": "Maintenance mensuelle des équipements du site de repli",
    "controleNiveau2": "Exercice annuel complet de bascule PCA/PRA réel",
    "controleNiveau3": "Audit du PCA/PRA et analyse des comptes-rendus tests",
    "causes": "Site de repli trop proche ou données non synchronisées",
    "consequences": "Arrêt prolongé de la banque au-delà du DMIA",
    "facteursRisque": "Risques d'inondations, incendies ou troubles civils",
    "facteurDeclencheur": "Sinistre majeur au siège ou panne totale datacenter",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Dysfonctionnement de l'activité et systèmes",
    "sousCategorieBale": "Systèmes",
    "natureRisque": "Risque continuité d'activité"
  },
  {
    "no": 86,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Logs et pistes d'audit SI",
    "direction": "DSI",
    "operationnel": "Admin Sécurité SI",
    "refRisque": "Risk-DSI-09-2025",
    "risque": "Absence ou altération des logs empêchant l'investigation",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Centraliser les logs sur serveur SIEM immuable (12 mois+)",
    "controleNiveau1": "Contrôle quotidien de la collecte et espace de stockage",
    "controleNiveau2": "Revue mensuelle des logs d'opérations sensibles (SIEM)",
    "controleNiveau3": "Audit de l'intégrité et conservation des pistes d'audit",
    "causes": "Désactivation des logs pour performance ou purge courte",
    "consequences": "Impossibilité de tracer une fraude ou erreur en audit",
    "facteursRisque": "Volume massif de journaux générés par les systèmes",
    "facteurDeclencheur": "Demande d'investigation suite à un incident ou fraude",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque informatique et audit"
  },
  {
    "no": 87,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Prestataires IT et cloud",
    "direction": "DSI",
    "operationnel": "Resp. Gouvernance IT",
    "refRisque": "Risk-DSI-10-2025",
    "risque": "Défaillance critique d'un éditeur ou perte de maîtrise cloud",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Intégrer clauses d'audit, SLA, réversibilité et entente escrow",
    "controleNiveau1": "Suivi mensuel des SLA et incidents des prestataires IT",
    "controleNiveau2": "Évaluation annuelle des risques tiers critiques (TPRM)",
    "controleNiveau3": "Audit des contrats d'externalisation IT et conformité",
    "causes": "Dépendance absolue à un prestataire sans plan B",
    "consequences": "Indisponibilité prolongée et perte de souveraineté données",
    "facteursRisque": "Rareté des compétences locales sur certains progiciels",
    "facteurDeclencheur": "Faillite ou arrêt brutal de support d'un éditeur",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Vendeurs et fournisseurs",
    "natureRisque": "Risque tiers et IT"
  },
  {
    "no": 88,
    "cycle": "Cycle SI et Cybersécurité",
    "processus": "Obsolescence et patchs de sécurité",
    "direction": "DSI",
    "operationnel": "Resp. Infrastructures",
    "refRisque": "Risk-DSI-11-2025",
    "risque": "Exploitation de vulnérabilités sur systèmes obsolètes",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Planifier le renouvellement matériel et patch management",
    "controleNiveau1": "Application mensuelle des correctifs critiques",
    "controleNiveau2": "Contrôle trimestriel des niveaux de patch et versions",
    "controleNiveau3": "Audit de l'obsolescence parc matériel et logiciel",
    "causes": "Contraintes budgétaires retardant le renouvellement",
    "consequences": "Intrusions cyber faciles et pannes matérielles",
    "facteursRisque": "Parc d'agences étendu et coûts de licences élevés",
    "facteurDeclencheur": "Publication d'une faille critique (Zero-Day)",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Dysfonctionnement de l'activité et systèmes",
    "sousCategorieBale": "Systèmes",
    "natureRisque": "Risque informatique et cyber"
  },
  {
    "no": 89,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Appels d'offres et achats",
    "direction": "DMG",
    "operationnel": "Responsable Achats",
    "refRisque": "Risk-DMG-01-2025",
    "risque": "Favoritisme, surfacturation ou entente lors des appels d'offres",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Imposer comité d'achats collégial et mise en concurrence",
    "controleNiveau1": "Vérification 3 devis minimum et déclaration non-conflit",
    "controleNiveau2": "Contrôle semestriel des marchés gré à gré > seuil",
    "controleNiveau3": "Audit annuel des appels d'offres et panel fournisseurs",
    "causes": "Fractionnement des achats et liens cachés acheteurs",
    "consequences": "Surcoûts majeurs et fraude interne sur marchés",
    "facteursRisque": "Tissu fournisseur restreint et demandes urgentes",
    "facteurDeclencheur": "Attribution répétée de marchés à un fournisseur unique",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Fraude interne",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de fraude et achats"
  },
  {
    "no": 90,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Réception biens et service fait",
    "direction": "DMG",
    "operationnel": "Gestionnaire Stocks",
    "refRisque": "Risk-DMG-02-2025",
    "risque": "Paiement de biens non livrés ou prestations inachevées",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Exiger PV de réception signé du demandeur et magasinier",
    "controleNiveau1": "Contrôle physique quantitatif et qualitatif à livraison",
    "controleNiveau2": "Contrôle trimestriel des réceptions vs paiements",
    "controleNiveau3": "Audit de matérialité des prestations et inventaires",
    "causes": "Validation complaisante sans vérification sur site",
    "consequences": "Perte financière directe et stock fictif",
    "facteursRisque": "Multiplicité des chantiers de rénovation d'agences",
    "facteurDeclencheur": "Facture transmise sans bon de livraison contresigné",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Vendeurs et fournisseurs",
    "natureRisque": "Risque opérationnel"
  },
  {
    "no": 91,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Sûreté physique et gardiennage",
    "direction": "DMG",
    "operationnel": "Responsable Sûreté",
    "refRisque": "Risk-DMG-03-2025",
    "risque": "Intrusion, braquage ou vol par défaillance du gardiennage",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Installer télésurveillance, sas sécurité et boutons alarme",
    "controleNiveau1": "Ronde quotidienne, test alarmes et contrôle vigiles",
    "controleNiveau2": "Visite semestrielle de sûreté des agences sensibles",
    "controleNiveau3": "Audit du dispositif de sûreté physique et vidéosurveillance",
    "causes": "Panne caméras, vigiles non formés ou sas défectueux",
    "consequences": "Perte de vies humaines, vol d'encaisses et trauma",
    "facteursRisque": "Zones isolées ou contexte sécuritaire dégradé",
    "facteurDeclencheur": "Défaillance du système d'alarme ou porte blindée",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Banque de détail",
    "categorieBale": "Fraude externe",
    "sousCategorieBale": "Vol et fraude",
    "natureRisque": "Risque de sécurité physique"
  },
  {
    "no": 92,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Énergie et maintenance locaux",
    "direction": "DMG",
    "operationnel": "Resp. Maintenance",
    "refRisque": "Risk-DMG-04-2025",
    "risque": "Arrêt d'activité par coupure électrique ou panne onduleurs",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Doter chaque site de groupes électrogènes et contrats SLA",
    "controleNiveau1": "Contrôle hebdomadaire niveaux carburant et tests charge",
    "controleNiveau2": "Revue trimestrielle des coûts et pannes énergétiques",
    "controleNiveau3": "Audit des contrats de maintenance et continuité",
    "causes": "Retards d'approvisionnement gasoil et manque d'entretien",
    "consequences": "Fermeture d'agences et endommagement des serveurs",
    "facteursRisque": "Instabilité du réseau électrique national et chaleur",
    "facteurDeclencheur": "Délestage prolongé couplé à une panne groupe",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Dommages aux actifs physiques",
    "sousCategorieBale": "Catastrophes et sinistres",
    "natureRisque": "Risque infrastructure"
  },
  {
    "no": 93,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Archivage physique et légal",
    "direction": "DMG",
    "operationnel": "Archiviste Principal",
    "refRisque": "Risk-DMG-05-2025",
    "risque": "Perte ou destruction de pièces comptables/crédits (< 10 ans)",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Numériser dès réception et sécuriser le local d'archives",
    "controleNiveau1": "Indexation des boîtes et registre strict de consultation",
    "controleNiveau2": "Contrôle semestriel des conditions de conservation",
    "controleNiveau3": "Audit de disponibilité des pièces justificatives (OHADA)",
    "causes": "Humidité, incendie ou conservation dispersée en agence",
    "consequences": "Impossibilité de preuve en justice ou contrôle fiscal",
    "facteursRisque": "Volume papier important et manque d'espace en agence",
    "facteurDeclencheur": "Réquisition judiciaire ou litige sur vieux dossier",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Admission et documentation clients",
    "natureRisque": "Risque juridique et opérationnel"
  },
  {
    "no": 94,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Couverture assurantielle",
    "direction": "DMG",
    "operationnel": "Resp. Moyens Généraux",
    "refRisque": "Risk-DMG-06-2025",
    "risque": "Défaut de couverture ou sous-assurance lors d'un sinistre grave",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Réviser annuellement les polices selon les encaisses réelles",
    "controleNiveau1": "Vérification du paiement à temps des primes d'assurance",
    "controleNiveau2": "Revue annuelle d'adéquation des garanties (Risques)",
    "controleNiveau3": "Audit de couverture des risques (fraude, cyber, incendie)",
    "causes": "Oubli de déclaration de nouvelles agences ou plafonds",
    "consequences": "Sinistre à la charge intégrale de la banque",
    "facteursRisque": "Évolution rapide du parc d'agences et actifs",
    "facteurDeclencheur": "Incendie, vol ou fraude majeure sur site non déclaré",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Gestion des assureurs",
    "natureRisque": "Risque financier"
  },
  {
    "no": 95,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Contrats commerciaux et conventions",
    "direction": "DJ",
    "operationnel": "Directeur Juridique",
    "refRisque": "Risk-DJ-01-2025",
    "risque": "Clauses abusives ou invalides fragilisant les recours banque",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Imposer le visa juridique préalable sur tout contrat type",
    "controleNiveau1": "Check-list clauses obligatoires avant signature client",
    "controleNiveau2": "Revue annuelle des contrats types (Conformité/Juridique)",
    "controleNiveau3": "Audit de conformité des conventions de compte et prêts",
    "causes": "Utilisation de modèles anciens non mis à jour",
    "consequences": "Nullité de clauses, perte de droits et litiges",
    "facteursRisque": "Évolution des actes uniformes OHADA et lois locales",
    "facteurDeclencheur": "Signature d'un contrat négocié hors modèle standard",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Pratiques commerciales incorrectes",
    "natureRisque": "Risque juridique"
  },
  {
    "no": 96,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Litiges, saisies-attributions et ATD",
    "direction": "DJ",
    "operationnel": "Juriste Contentieux",
    "refRisque": "Risk-DJ-02-2025",
    "risque": "Traitement tardif d'une saisie-attribution ou d'un ATD",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Centraliser le dépôt des actes d'huissier et bloquer sous 2h",
    "controleNiveau1": "Horodatage immédiat et blocage SI du compte saisi",
    "controleNiveau2": "Contrôle mensuel des délais d'exécution et réponses",
    "controleNiveau3": "Audit annuel de traitement des saisies et ATD fiscaux",
    "causes": "Réception d'actes en agence non transmis au Juridique",
    "consequences": "Condamnation de la banque aux causes de la saisie",
    "facteursRisque": "Multiplication des actes d'huissiers en agences",
    "facteurDeclencheur": "Client débiteur retirant ses fonds avant blocage",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Saisie et suivi des opérations",
    "natureRisque": "Risque juridique et financier"
  },
  {
    "no": 97,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Veille juridique et réglementaire",
    "direction": "DJ",
    "operationnel": "Juriste Veille",
    "refRisque": "Risk-DJ-03-2025",
    "risque": "Défaut de transposition d'une nouvelle norme BCEAO/OHADA",
    "probabilite": "Moyen",
    "impact": "Moyen",
    "evaluationRisque": "Moyen",
    "planAction": "Tenir un registre de veille mensuel diffusé aux métiers",
    "controleNiveau1": "Diffusion des notes d'impact réglementaire aux directions",
    "controleNiveau2": "Suivi trimestriel des plans de mise en conformité",
    "controleNiveau3": "Audit de l'effectivité du dispositif de veille",
    "causes": "Absence d'outil structuré de suivi des textes UEMOA",
    "consequences": "Non-conformité généralisée et sanctions administratives",
    "facteursRisque": "Production réglementaire soutenue de la BCEAO",
    "facteurDeclencheur": "Entrée en vigueur d'une nouvelle instruction BCEAO",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Clients, produits et pratiques commerciales",
    "sousCategorieBale": "Conformité et devoir fiduciaire",
    "natureRisque": "Risque réglementaire"
  },
  {
    "no": 98,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Collecte des incidents opérationnels",
    "direction": "DR",
    "operationnel": "Risk Manager Opé.",
    "refRisque": "Risk-DR-04-2025",
    "risque": "Sous-déclaration des incidents et pertes opérationnelles",
    "probabilite": "Élevé",
    "impact": "Moyen",
    "evaluationRisque": "Élevé",
    "planAction": "Instaurer une culture non punitive et rapprocher de la compta",
    "controleNiveau1": "Déclaration obligatoire sous 48h par les correspondants",
    "controleNiveau2": "Rapprochement trimestriel base incidents vs comptes pertes",
    "controleNiveau3": "Audit d'exhaustivité de la base des incidents",
    "causes": "Peur de sanctions disciplinaires par les agents d'agence",
    "consequences": "Cartographie biaisée et sous-capitalisation opérationnelle",
    "facteursRisque": "Culture hiérarchique forte et manque de maturité risque",
    "facteurDeclencheur": "Découverte d'une perte comptable non déclarée",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque de pilotage"
  },
  {
    "no": 99,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Pilotage du Contrôle Permanent",
    "direction": "DR",
    "operationnel": "Resp. Contrôle Permanent",
    "refRisque": "Risk-DR-05-2025",
    "risque": "Inefficacité du contrôle permanent laissant perdurer des failles",
    "probabilite": "Moyen",
    "impact": "Élevé",
    "evaluationRisque": "Élevé",
    "planAction": "Déployer un plan de contrôle basé sur les risques critiques",
    "controleNiveau1": "Supervision hiérarchique formalisée dans les métiers",
    "controleNiveau2": "Exécution mensuelle des plans de test de 2e niveau",
    "controleNiveau3": "Évaluation annuelle d'efficacité du 2e niveau (Audit)",
    "causes": "Manque d'indépendance ou sous-effectif du contrôle",
    "consequences": "Survenance de fraudes répétées et sanctions UMOA",
    "facteursRisque": "Approche purement administrative sans tests probants",
    "facteurDeclencheur": "Rapport annuel contrôle interne jugé insuffisant",
    "familleBale": "Risque Opérationnel",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Exécution, livraison et gestion des processus",
    "sousCategorieBale": "Surveillance et reporting",
    "natureRisque": "Risque de gouvernance et contrôle"
  },
  {
    "no": 100,
    "cycle": "Cycle Moyens Généraux et Contrôle",
    "processus": "Audit Interne (3e ligne de défense)",
    "direction": "DAI",
    "operationnel": "Directeur Audit Interne",
    "refRisque": "Risk-DAI-01-2025",
    "risque": "Couverture insuffisante des risques majeurs ou perte d'indépendance",
    "probabilite": "Faible",
    "impact": "Élevé",
    "evaluationRisque": "Moyen",
    "planAction": "Élaborer un plan d'audit pluriannuel rattaché au Comité d'Audit",
    "controleNiveau1": "Revue qualité des dossiers de travail par chef de mission",
    "controleNiveau2": "Auto-évaluation annuelle selon les normes CRIPP",
    "controleNiveau3": "Évaluation externe indépendante (EQA) tous les 5 ans",
    "causes": "Rattachement hiérarchique inadéquat ou manque de moyens",
    "consequences": "Zones à haut risque non auditées et non-conformité CRIPP",
    "facteursRisque": "Budget limité ou pénurie d'auditeurs IT/crédit seniors",
    "facteurDeclencheur": "Remise en cause de l'indépendance lors d'une mission",
    "familleBale": "Risque de Non-Conformité",
    "ligneMetierBale": "Transverse",
    "categorieBale": "Gouvernance et pilotage",
    "sousCategorieBale": "Conformité normes audit (CRIPP)",
    "natureRisque": "Risque de gouvernance"
  }
];

export function normalizeDirectionCode(direction?: string): string {
  const cleaned = (direction || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');
  return cleaned || 'GEN';
}

export function extractIdentificationYear(
  refRisque?: string,
  fallbackYear = '2026'
): string {
  const match = (refRisque || '').trim().match(/-(\d{4})(?:-|$)/);
  return match ? match[1] : fallbackYear;
}

export function formatRiskReference(
  direction: string,
  sequenceNumber: number,
  year = '2026'
): string {
  const dir = normalizeDirectionCode(direction);
  const seq = String(Math.max(1, Math.round(sequenceNumber))).padStart(2, '0');
  const yr = /^\d{4}$/.test(year.trim()) ? year.trim() : '2026';
  return `Risk-${dir}-${seq}-${yr}`;
}

export function formatRiskNodeTitle(
  record: Pick<RiskManagementMetadata, 'refRisque' | 'risque'> & {
    no?: number;
    direction?: string;
  }
): string {
  const explicitRef = record.refRisque.trim();
  const label = record.risque.trim();
  const synthesizedRef =
    !explicitRef && record.direction?.trim()
      ? formatRiskReference(record.direction, record.no || 1, '2026')
      : explicitRef;
  if (synthesizedRef && label) return `${synthesizedRef} · ${label}`;
  if (synthesizedRef || label) return synthesizedRef || label;
  return record.no
    ? `Nouveau risque #${record.no} (à compléter)`
    : 'Nouveau risque (à compléter)';
}

function mapRiskEvaluationToStatus(evalValue: string): WorkflowTreeNode['status'] {
  const clean = evalValue.trim().toLowerCase();
  if (!clean) return 'todo';
  if (clean.includes('critique') || clean.includes('élevé') || clean.includes('eleve')) {
    return 'in-review';
  }
  if (clean.includes('moyen')) return 'in-progress';
  return 'validated';
}

function slugifySegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
}

const DIRECTION_SIGNATURES: Record<string, string> = {
  DG: 'OHA',
  DRH: 'TAK',
  DCOM: 'JFK',
  DOP: 'SEK',
  DC: 'JFK',
  DR: 'OHA',
  DREC: 'TAK',
  DT: 'SEK',
  DFC: 'OHA',
  DCONF: 'SEK',
  DSI: 'JFK',
  DMG: 'TAK',
  DJ: 'OHA',
  DAI: 'SEK',
};

export function buildRiskManagement2026Children(prefix: 'user' | 'team'): WorkflowTreeNode[] {
  const cycleOrder: string[] = [];
  const byCycle = new Map<string, Map<string, Map<string, RiskManagementMetadata[]>>>();

  for (const row of RISK_MANAGEMENT_2026_DATA) {
    if (!byCycle.has(row.cycle)) {
      cycleOrder.push(row.cycle);
      byCycle.set(row.cycle, new Map());
    }
    const byProc = byCycle.get(row.cycle)!;
    if (!byProc.has(row.processus)) {
      byProc.set(row.processus, new Map());
    }
    const byDir = byProc.get(row.processus)!;
    if (!byDir.has(row.direction)) {
      byDir.set(row.direction, []);
    }
    byDir.get(row.direction)!.push(row);
  }

  const cycleNodes: WorkflowTreeNode[] = cycleOrder.map((cycleName, cIdx) => {
    const byProc = byCycle.get(cycleName)!;
    const cycleSlug = slugifySegment(cycleName);
    const procNodes: WorkflowTreeNode[] = Array.from(byProc.entries()).map(([procName, byDir], pIdx) => {
      const procSlug = slugifySegment(procName);
      const dirNodes: WorkflowTreeNode[] = Array.from(byDir.entries()).map(([dirName, risks], dIdx) => {
        const dirSlug = slugifySegment(dirName);
        const riskDocs: WorkflowTreeNode[] = risks.map((risk) => ({
          id: `${prefix}-2026-rm-risk-${risk.no}`,
          label: formatRiskNodeTitle(risk),
          nodeType: 'document',
          natureId: 'risk-management',
          signature: DIRECTION_SIGNATURES[risk.direction] || 'OHA',
          owner: risk.operationnel,
          status: mapRiskEvaluationToStatus(risk.evaluationRisque),
          riskMeta: risk,
        }));

        return {
          id: `${prefix}-2026-rm-dir-${cIdx + 1}-${pIdx + 1}-${dIdx + 1}-${dirSlug}`,
          label: dirName,
          nodeType: 'sous-section',
          natureId: 'risk-management',
          children: riskDocs,
        };
      });

      return {
        id: `${prefix}-2026-rm-proc-${cIdx + 1}-${pIdx + 1}-${procSlug}`,
        label: procName,
        nodeType: 'sous-section',
        natureId: 'risk-management',
        children: dirNodes,
      };
    });

    return {
      id: `${prefix}-2026-rm-cycle-${cIdx + 1}-${cycleSlug}`,
      label: cycleName,
      nodeType: 'activite',
      natureId: 'risk-management',
      children: procNodes,
    };
  });

  return [
    {
      id: `${prefix}-2026-rm-carto`,
      label: 'Travaux - cartographie des risques',
      nodeType: 'section',
      natureId: 'risk-management',
      children: cycleNodes,
    },
  ];
}

export interface LiveRiskEntry {
  node: WorkflowTreeNode;
  record: RiskManagementMetadata;
  cycleLabel: string;
  processusLabel: string;
  directionLabel: string;
}

export interface RiskDirectionDestination {
  id: string;
  rootLabel: string;
  cycle: string;
  processus: string;
  direction: string;
  riskCount: number;
}

export function findRiskRecordByRefOrLabel(label: string): RiskManagementMetadata | undefined {
  const clean = label.trim().toLowerCase();
  if (!clean) return undefined;
  return RISK_MANAGEMENT_2026_DATA.find(
    (r) =>
      clean.startsWith(r.refRisque.toLowerCase()) ||
      clean.includes(r.refRisque.toLowerCase()) ||
      clean === formatRiskNodeTitle(r).toLowerCase()
  );
}

export function extractRisksFromTrees(
  trees: WorkflowTreeNode[],
  scopeNodeId?: string
): LiveRiskEntry[] {
  const results: LiveRiskEntry[] = [];
  const seenIds = new Set<string>();

  const collect = (
    node: WorkflowTreeNode,
    cycleLabel: string,
    processusLabel: string,
    directionLabel: string,
    insideRisk: boolean
  ) => {
    const isRisk = insideRisk || node.natureId === 'risk-management' || Boolean(node.riskMeta);
    let nextCycle = cycleLabel;
    let nextProcessus = processusLabel;
    let nextDirection = directionLabel;

    if (isRisk && node.nodeType === 'activite') {
      nextCycle = node.label;
    } else if (isRisk && node.nodeType === 'sous-section') {
      const hasLeafChild = node.children?.some((c) => Boolean(c.riskMeta));
      if (hasLeafChild) {
        nextDirection = node.label;
      } else {
        nextProcessus = node.label;
      }
    }

    const resolvedMeta =
      node.riskMeta ??
      (isRisk && node.nodeType === 'document' ? findRiskRecordByRefOrLabel(node.label) : undefined);

    if (resolvedMeta && !seenIds.has(node.id)) {
      seenIds.add(node.id);
      results.push({
        node,
        record: resolvedMeta,
        cycleLabel: resolvedMeta.cycle || nextCycle,
        processusLabel: resolvedMeta.processus || nextProcessus,
        directionLabel: resolvedMeta.direction || nextDirection,
      });
      return;
    }

    if (node.children?.length) {
      for (const child of node.children) {
        collect(child, nextCycle, nextProcessus, nextDirection, isRisk);
      }
    }
  };

  if (scopeNodeId) {
    const scopeNode = findNodeById(trees, scopeNodeId);
    if (scopeNode) {
      collect(
        scopeNode,
        scopeNode.riskMeta?.cycle || '',
        scopeNode.riskMeta?.processus || '',
        scopeNode.riskMeta?.direction || '',
        scopeNode.natureId === 'risk-management' || Boolean(scopeNode.riskMeta)
      );
      if (results.length > 0) return results;
    }
  }

  for (const root of trees) {
    collect(root, '', '', '', false);
  }
  return results;
}

export function collectDirectionContainersFromTrees(
  trees: WorkflowTreeNode[]
): RiskDirectionDestination[] {
  const destinations: RiskDirectionDestination[] = [];
  const seen = new Set<string>();

  const walk = (
    node: WorkflowTreeNode,
    rootLabel: string,
    cycle: string,
    processus: string,
    inRiskNature: boolean
  ) => {
    const isRisk = inRiskNature || node.natureId === 'risk-management';
    const nextRoot = node.nodeType === 'root' ? node.label : rootLabel;
    const nextCycle = isRisk && node.nodeType === 'activite' ? node.label : cycle;

    if (isRisk && node.nodeType === 'sous-section') {
      const isDirection =
        Boolean(node.id.includes('-rm-dir-')) ||
        Boolean(node.children?.some((c) => Boolean(c.riskMeta)));

      if (isDirection && !seen.has(node.id)) {
        seen.add(node.id);
        destinations.push({
          id: node.id,
          rootLabel: nextRoot || 'Workflow',
          cycle: nextCycle || node.children?.[0]?.riskMeta?.cycle || 'Cycle',
          processus: processus || node.children?.[0]?.riskMeta?.processus || 'Processus',
          direction: node.label,
          riskCount: node.children?.filter((c) => Boolean(c.riskMeta)).length ?? 0,
        });
        return;
      }

      if (node.children?.length) {
        for (const child of node.children) {
          walk(child, nextRoot, nextCycle, node.label, isRisk);
        }
      }
      return;
    }

    if (node.children?.length) {
      for (const child of node.children) {
        walk(child, nextRoot, nextCycle, processus, isRisk);
      }
    }
  };

  for (const root of trees) {
    walk(root, root.label, '', '', false);
  }
  return destinations;
}

export function getNextRiskNumber(trees: WorkflowTreeNode[]): number {
  const all = extractRisksFromTrees(trees);
  const maxTreeNo = all.reduce((acc, item) => Math.max(acc, Number(item.record.no) || 0), 0);
  const maxSeedNo = RISK_MANAGEMENT_2026_DATA.reduce(
    (acc, item) => Math.max(acc, Number(item.no) || 0),
    0
  );
  return Math.max(maxTreeNo, maxSeedNo) + 1;
}

export function getNextRiskSequenceForDirection(
  trees: WorkflowTreeNode[],
  direction: string
): number {
  const dir = normalizeDirectionCode(direction);
  let maxSeq = 0;
  const regex = new RegExp(`^Risk-${dir}-(\\d+)(?:-|$)`, 'i');

  for (const item of extractRisksFromTrees(trees)) {
    const m = item.record.refRisque.trim().match(regex);
    if (m) {
      maxSeq = Math.max(maxSeq, Number.parseInt(m[1], 10) || 0);
    }
  }
  for (const row of RISK_MANAGEMENT_2026_DATA) {
    const m = row.refRisque.trim().match(regex);
    if (m) {
      maxSeq = Math.max(maxSeq, Number.parseInt(m[1], 10) || 0);
    }
  }
  return maxSeq + 1;
}

export function buildFormattedRiskRefForNode(
  trees: WorkflowTreeNode[],
  direction: string,
  existingRef?: string,
  fallbackYear = '2026'
): string {
  const nextSeq = getNextRiskSequenceForDirection(trees, direction);
  const year = extractIdentificationYear(existingRef, fallbackYear);
  return formatRiskReference(direction, nextSeq, year);
}

export function createBlankRiskMetadata(no: number): RiskManagementMetadata {
  return {
    no,
    cycle: '',
    processus: '',
    direction: '',
    operationnel: '',
    refRisque: '',
    risque: '',
    probabilite: '',
    impact: '',
    evaluationRisque: '',
    planAction: '',
    controleNiveau1: '',
    controleNiveau2: '',
    controleNiveau3: '',
    causes: '',
    consequences: '',
    facteursRisque: '',
    facteurDeclencheur: '',
    familleBale: '',
    ligneMetierBale: '',
    categorieBale: '',
    sousCategorieBale: '',
    natureRisque: '',
    customFields: {},
  };
}

function resolveTargetDirectionIdForInsert(
  trees: WorkflowTreeNode[],
  targetNodeId?: string
): { directionId: string | null; afterLeafId?: string } {
  const destinations = collectDirectionContainersFromTrees(trees);
  if (destinations.length === 0) return { directionId: null };

  if (!targetNodeId) {
    return { directionId: destinations[0].id };
  }

  const targetNode = findNodeById(trees, targetNodeId);
  if (!targetNode) return { directionId: destinations[0].id };

  const path = findNodePath(trees, targetNodeId) || [];

  // Si on est sur un risque feuille, insérer dans sa Direction parente juste après ce risque
  if (targetNode.riskMeta || (targetNode.nodeType === 'document' && targetNode.natureId === 'risk-management')) {
    const parentDir = [...path]
      .reverse()
      .find((n) => n.id !== targetNode.id && destinations.some((d) => d.id === n.id));
    if (parentDir) {
      return { directionId: parentDir.id, afterLeafId: targetNode.id };
    }
  }

  // Si on est sur une Direction directement
  if (destinations.some((d) => d.id === targetNode.id)) {
    return { directionId: targetNode.id };
  }

  // Si on est sur un Cycle, Processus, Travaux ou Workflow Risk management -> prendre la première Direction dessous
  const firstChildRisk = extractRisksFromTrees(trees, targetNode.id)[0];
  if (firstChildRisk) {
    const leafPath = findNodePath(trees, firstChildRisk.node.id) || [];
    const parentDir = [...leafPath]
      .reverse()
      .find((n) => destinations.some((d) => d.id === n.id));
    if (parentDir) {
      return { directionId: parentDir.id };
    }
  }

  // Fallback dans la même racine (Workflow vs Team Workflow)
  const rootId = path[0]?.id;
  if (rootId === 'root-team-workflow') {
    const teamDest = destinations.find((d) => d.id.startsWith('team-'));
    if (teamDest) return { directionId: teamDest.id };
  }

  return { directionId: destinations[0].id };
}

export function addBlankRiskInTree(
  trees: WorkflowTreeNode[],
  targetNodeId: string | undefined,
  actor: string
): { trees: WorkflowTreeNode[]; createdNodeId: string | null } {
  const { directionId, afterLeafId } = resolveTargetDirectionIdForInsert(trees, targetNodeId);
  if (!directionId) return { trees, createdNodeId: null };

  const nextNo = getNextRiskNumber(trees);
  const blankMeta = createBlankRiskMetadata(nextNo);
  const prefix = directionId.startsWith('team-') ? 'team' : 'user';
  const createdId = `${prefix}-2026-rm-risk-new-${nextNo}-${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();

  const newRiskNode: WorkflowTreeNode = {
    id: createdId,
    label: formatRiskNodeTitle(blankMeta),
    nodeType: 'document',
    natureId: 'risk-management',
    signature: actor || 'OHA',
    owner: '',
    status: 'todo',
    riskMeta: blankMeta,
    auditTrail: [
      {
        id: `at-risk-add-${Date.now()}`,
        timestamp: nowIso,
        actor: actor || 'OHA',
        action: 'Ajout d’un nouveau risque (fiche vierge)',
        detail: `Risque #${nextNo}`,
      },
    ],
  };

  const walk = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((node) => {
      if (node.id === directionId) {
        const currentChildren = node.children || [];
        if (afterLeafId) {
          const idx = currentChildren.findIndex((c) => c.id === afterLeafId);
          if (idx >= 0) {
            const nextChildren = [
              ...currentChildren.slice(0, idx + 1),
              newRiskNode,
              ...currentChildren.slice(idx + 1),
            ];
            return { ...node, children: nextChildren };
          }
        }
        return { ...node, children: [...currentChildren, newRiskNode] };
      }
      if (node.children?.length) {
        const nextChildren = walk(node.children);
        if (nextChildren !== node.children) {
          return { ...node, children: nextChildren };
        }
      }
      return node;
    });

  return { trees: walk(trees), createdNodeId: createdId };
}

export function deleteRiskInTree(
  trees: WorkflowTreeNode[],
  riskNodeId: string
): { trees: WorkflowTreeNode[]; deletedLabel?: string; nextRiskNodeId: string | null } {
  const ordered = extractRisksFromTrees(trees);
  const idx = ordered.findIndex((item) => item.node.id === riskNodeId);
  if (idx < 0) {
    return { trees, nextRiskNodeId: ordered[0]?.node.id ?? null };
  }

  const deletedLabel = ordered[idx].node.label;
  const nextEntry = ordered[idx + 1] ?? ordered[idx - 1] ?? null;

  const removeFromList = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] => {
    let changed = false;
    const mapped: WorkflowTreeNode[] = [];
    for (const node of nodes) {
      if (node.id === riskNodeId) {
        changed = true;
        continue;
      }
      if (node.children?.length) {
        const nextChildren = removeFromList(node.children);
        if (nextChildren !== node.children) {
          changed = true;
          mapped.push({ ...node, children: nextChildren });
          continue;
        }
      }
      mapped.push(node);
    }
    return changed ? mapped : nodes;
  };

  return {
    trees: removeFromList(trees),
    deletedLabel,
    nextRiskNodeId: nextEntry?.node.id ?? null,
  };
}

export function duplicateRiskInTree(
  trees: WorkflowTreeNode[],
  riskNodeId: string,
  actor: string
): { trees: WorkflowTreeNode[]; duplicatedNodeId: string | null } {
  const sourceNode = findNodeById(trees, riskNodeId);
  const sourceMeta =
    sourceNode?.riskMeta ??
    (sourceNode ? findRiskRecordByRefOrLabel(sourceNode.label) : undefined);

  if (!sourceNode || !sourceMeta) {
    return { trees, duplicatedNodeId: null };
  }

  const nextNo = getNextRiskNumber(trees);
  const prefix = riskNodeId.startsWith('team-') ? 'team' : 'user';
  const duplicatedId = `${prefix}-2026-rm-risk-dup-${nextNo}-${Date.now().toString(36)}`;
  const nowIso = new Date().toISOString();

  const hasDirection = Boolean(sourceMeta.direction.trim());
  const nextSeq = hasDirection
    ? getNextRiskSequenceForDirection(trees, sourceMeta.direction)
    : nextNo;
  const year = extractIdentificationYear(sourceMeta.refRisque, '2026');
  const nextRef = formatRiskReference(
    hasDirection ? sourceMeta.direction : 'GEN',
    nextSeq,
    year
  );
  const nextTitle = sourceMeta.risque.trim()
    ? `${sourceMeta.risque.trim()} (Copie)`
    : '';

  const clonedMeta: RiskManagementMetadata = {
    ...sourceMeta,
    no: nextNo,
    refRisque: nextRef,
    risque: nextTitle,
    customFields: sourceMeta.customFields ? { ...sourceMeta.customFields } : undefined,
  };

  const clonedNode: WorkflowTreeNode = {
    ...sourceNode,
    id: duplicatedId,
    label: formatRiskNodeTitle(clonedMeta),
    riskMeta: clonedMeta,
    auditTrail: [
      ...(sourceNode.auditTrail || []),
      {
        id: `at-risk-dup-${Date.now()}`,
        timestamp: nowIso,
        actor: actor || 'OHA',
        action: 'Duplication fiche Risk management',
        detail: `Copie depuis ${formatRiskNodeTitle(sourceMeta)}`,
      },
    ],
  };

  const walk = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] => {
    const idx = nodes.findIndex((n) => n.id === riskNodeId);
    if (idx >= 0) {
      return [...nodes.slice(0, idx + 1), clonedNode, ...nodes.slice(idx + 1)];
    }
    let changed = false;
    const next = nodes.map((n) => {
      if (n.children?.length) {
        const nextChildren = walk(n.children);
        if (nextChildren !== n.children) {
          changed = true;
          return { ...n, children: nextChildren };
        }
      }
      return n;
    });
    return changed ? next : nodes;
  };

  return { trees: walk(trees), duplicatedNodeId: duplicatedId };
}

export function transferRiskInTree(
  trees: WorkflowTreeNode[],
  riskNodeId: string,
  destinationDirectionNodeId: string,
  actor: string
): { trees: WorkflowTreeNode[]; transferred: boolean } {
  const destinations = collectDirectionContainersFromTrees(trees);
  const dest = destinations.find((d) => d.id === destinationDirectionNodeId);
  const sourceNode = findNodeById(trees, riskNodeId);
  if (!dest || !sourceNode) return { trees, transferred: false };

  const currentMeta =
    sourceNode.riskMeta ?? findRiskRecordByRefOrLabel(sourceNode.label);
  if (!currentMeta) return { trees, transferred: false };

  const nowIso = new Date().toISOString();
  const directionChanged =
    normalizeDirectionCode(dest.direction) !== normalizeDirectionCode(currentMeta.direction);
  const year = extractIdentificationYear(currentMeta.refRisque, '2026');
  const nextRef =
    directionChanged || !currentMeta.refRisque.trim()
      ? formatRiskReference(
          dest.direction,
          getNextRiskSequenceForDirection(trees, dest.direction),
          year
        )
      : currentMeta.refRisque;

  const updatedMeta: RiskManagementMetadata = {
    ...currentMeta,
    cycle: dest.cycle,
    processus: dest.processus,
    direction: dest.direction,
    refRisque: nextRef,
  };

  const movedNode: WorkflowTreeNode = {
    ...sourceNode,
    signature: DIRECTION_SIGNATURES[dest.direction] || sourceNode.signature || 'OHA',
    riskMeta: updatedMeta,
    label: formatRiskNodeTitle(updatedMeta),
    auditTrail: [
      ...(sourceNode.auditTrail || []),
      {
        id: `at-risk-transfer-${Date.now()}`,
        timestamp: nowIso,
        actor: actor || 'OHA',
        action: 'Transfert du risque',
        detail: `${nextRef} · ${dest.cycle} → ${dest.processus} → ${dest.direction}`,
      },
    ],
  };

  // Retirer d'abord le nœud de sa position actuelle
  const removeOld = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes
      .filter((n) => n.id !== riskNodeId)
      .map((n) =>
        n.children?.length ? { ...n, children: removeOld(n.children) } : n
      );

  const withoutOld = removeOld(trees);

  // Puis insérer dans la Direction cible
  const insertInDest = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((n) => {
      if (n.id === destinationDirectionNodeId) {
        return {
          ...n,
          children: [...(n.children || []), movedNode],
        };
      }
      if (n.children?.length) {
        return { ...n, children: insertInDest(n.children) };
      }
      return n;
    });

  return { trees: insertInDest(withoutOld), transferred: true };
}

function severityRank(value: string): number {
  const v = value.trim().toLowerCase();
  if (!v) return 0;
  if (v.includes('critique')) return 4;
  if (v.includes('élevé') || v.includes('eleve')) return 3;
  if (v.includes('moyen')) return 2;
  if (v.includes('faible')) return 1;
  return 0;
}

export function compareRiskRecords(
  a: RiskManagementMetadata,
  b: RiskManagementMetadata,
  field: RiskSortField,
  direction: RiskSortDirection
): number {
  let cmp = 0;
  if (field === 'no') {
    cmp = (Number(a.no) || 0) - (Number(b.no) || 0);
  } else if (
    field === 'evaluationRisque' ||
    field === 'probabilite' ||
    field === 'impact'
  ) {
    cmp = severityRank(a[field]) - severityRank(b[field]);
    if (cmp === 0) cmp = (Number(a.no) || 0) - (Number(b.no) || 0);
  } else {
    cmp = String(a[field] || '').localeCompare(String(b[field] || ''), 'fr', {
      sensitivity: 'base',
    });
    if (cmp === 0) cmp = (Number(a.no) || 0) - (Number(b.no) || 0);
  }
  return direction === 'asc' ? cmp : -cmp;
}

export function sortRiskEntries(
  entries: LiveRiskEntry[],
  field: RiskSortField,
  direction: RiskSortDirection
): LiveRiskEntry[] {
  return [...entries].sort((a, b) =>
    compareRiskRecords(a.record, b.record, field, direction)
  );
}

export function sortRisksInTrees(
  trees: WorkflowTreeNode[],
  field: RiskSortField,
  direction: RiskSortDirection,
  scopeNodeId?: string
): WorkflowTreeNode[] {
  const sortNodeChildren = (node: WorkflowTreeNode): WorkflowTreeNode => {
    if (!node.children || node.children.length === 0) return node;
    const sortedChildren = node.children.map(sortNodeChildren);

    const hasRiskLeaves = sortedChildren.some((c) => Boolean(c.riskMeta));
    if (hasRiskLeaves) {
      sortedChildren.sort((a, b) => {
        const ra = a.riskMeta;
        const rb = b.riskMeta;
        if (!ra || !rb) return 0;
        return compareRiskRecords(ra, rb, field, direction);
      });
    } else if (node.natureId === 'risk-management') {
      if (field === 'cycle' || field === 'direction') {
        sortedChildren.sort((a, b) => {
          const c = a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
          return direction === 'asc' ? c : -c;
        });
      }
    }

    return { ...node, children: sortedChildren };
  };

  if (!scopeNodeId) {
    return trees.map(sortNodeChildren);
  }

  const walkScope = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((node) => {
      if (node.id === scopeNodeId) {
        return sortNodeChildren(node);
      }
      if (node.children?.length) {
        return { ...node, children: walkScope(node.children) };
      }
      return node;
    });

  return walkScope(trees);
}

export function updateRiskMetaInTree(
  trees: WorkflowTreeNode[],
  riskNodeId: string,
  patch: Partial<RiskManagementMetadata>,
  actor: string
): WorkflowTreeNode[] {
  const nowIso = new Date().toISOString();

  const walk = (nodes: WorkflowTreeNode[]): WorkflowTreeNode[] =>
    nodes.map((node) => {
      if (node.id === riskNodeId) {
        const currentMeta = node.riskMeta ?? findRiskRecordByRefOrLabel(node.label);
        if (!currentMeta) return node;

        const nextMeta: RiskManagementMetadata = {
          ...currentMeta,
          ...patch,
          no:
            patch.no !== undefined && Number.isFinite(Number(patch.no))
              ? Math.max(1, Math.round(Number(patch.no)))
              : currentMeta.no,
          customFields: {
            ...(currentMeta.customFields || {}),
            ...(patch.customFields || {}),
          },
        };

        // Si la Direction change ou si refRisque est vide alors qu'une Direction est définie,
        // synchroniser le libellé Risk-<Direction>-<Numéro>-<Année>.
        const directionChanged =
          patch.direction !== undefined &&
          normalizeDirectionCode(patch.direction) !== normalizeDirectionCode(currentMeta.direction);
        if (
          patch.refRisque === undefined &&
          nextMeta.direction.trim() &&
          (directionChanged || !nextMeta.refRisque.trim())
        ) {
          const yr = extractIdentificationYear(currentMeta.refRisque, '2026');
          nextMeta.refRisque = formatRiskReference(
            nextMeta.direction,
            getNextRiskSequenceForDirection(trees, nextMeta.direction),
            yr
          );
        }

        const nextLabel = formatRiskNodeTitle(nextMeta);
        return {
          ...node,
          label: nextLabel,
          owner: nextMeta.operationnel,
          status: mapRiskEvaluationToStatus(nextMeta.evaluationRisque),
          riskMeta: nextMeta,
          auditTrail: [
            ...(node.auditTrail || []),
            {
              id: `at-risk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              timestamp: nowIso,
              actor,
              action: 'Modification fiche Risk management',
              detail: `${nextMeta.refRisque || `#${nextMeta.no}`} (${nextMeta.evaluationRisque || 'À qualifier'})`,
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
