import {
  MissionPhaseName,
  MissionStepFormatType,
  SourceDocFormat,
  WorkflowTreeNode,
} from '../types/workflow';
import {
  FEUILLE_COUVERTURE_JSON_TEMPLATES,
  FeuilleCouvertureDocument,
} from './feuilleCouvertureTemplates';

export interface ParsedBaseTable {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
}

export interface MissionStepFormatPayload {
  formatType: MissionStepFormatType;
  formatLabel: string;
  stepKey: string;
  stepTitle: string;
  phase: MissionPhaseName | 'Document source';
  norme: string;
  reference: string;
  sourceDocFormat?: SourceDocFormat;
  sourceSummary?: string;
  /** Indique une étape de mission sans données en base (affiche juste 2 tables vides) */
  isEmptyPlaceholder?: boolean;
  /** Structure brute [Formatage data] fidèle au JSON n8n */
  rawFormatageJson: Record<string, unknown>;
  /** Tables normalisées prêtes pour l'affichage en forme de base dans le chat & SQLite */
  baseTables: ParsedBaseTable[];
}

function objectArrayToTable(
  id: string,
  title: string,
  items: Array<Record<string, string | number>>
): ParsedBaseTable {
  if (!items || items.length === 0) {
    return { id, title, headers: ['Information'], rows: [['Aucune donnée']] };
  }
  const headers = Object.keys(items[0]);
  const rows = items.map((obj) => headers.map((h) => String(obj[h] ?? '')));
  return { id, title, headers, rows };
}

function kvObjectToTable(
  id: string,
  title: string,
  obj: Record<string, string | number>
): ParsedBaseTable {
  const entries = Object.entries(obj);
  if (entries.length >= 2) {
    return {
      id,
      title,
      headers: ['Rubrique', 'Description'],
      rows: entries.map(([k, v]) => [k, String(v ?? '')]),
    };
  }
  const headers = Object.keys(obj);
  const rows = [headers.map((h) => String(obj[h] ?? ''))];
  return { id, title, headers, rows };
}

function buildStepMetaRubriqueTable(
  id: string,
  title: string,
  meta: { etape: string; reference: string; norme: string; methode: string }
): ParsedBaseTable {
  return {
    id,
    title,
    headers: ['Rubrique', 'Description'],
    rows: [
      ['Etape de mission', meta.etape],
      ['Norme', meta.norme],
      ['Méthode', meta.methode],
      ['Reference', meta.reference],
    ],
  };
}

/**
 * Normalise automatiquement d'anciennes tables horizontales (table 0 / table 1 uniquement)
 * déjà persistées dans SQLite ou un partage collaboratif vers la structure verticale Rubrique | Description.
 * Ne transforme JAMAIS table 2 (ou >= 2) qui doit conserver ses rubriques en colonnes.
 */
export function normalizeWorkflowBaseTables(tables: ParsedBaseTable[]): ParsedBaseTable[] {
  if (!Array.isArray(tables)) return [];
  return tables.map((tbl, idx) => {
    const headers = Array.isArray(tbl.headers) ? tbl.headers : [];
    const rows = Array.isArray(tbl.rows) ? tbl.rows : [];
    const lowerTitle = (tbl.title || '').trim().toLowerCase();
    const alreadyRubrique =
      headers.length === 2 &&
      headers[0].trim().toLowerCase() === 'rubrique' &&
      headers[1].trim().toLowerCase() === 'description';

    const isExplicitTable0Or1 =
      /^table\s*0(\b|$)/i.test(lowerTitle) ||
      /^table\s*1(\b|$)/i.test(lowerTitle);
    const isExplicitLaterTable =
      /^table\s*[2-9]/i.test(lowerTitle) ||
      lowerTitle.includes('table 2') ||
      lowerTitle.includes('table 3') ||
      lowerTitle.includes('table 4') ||
      lowerTitle.includes('table 5') ||
      lowerTitle.includes('table 6') ||
      lowerTitle.includes('table 7') ||
      lowerTitle.includes('table 8');

    // Auto-réparation si une table 2 a été convertie par erreur en Rubrique | Description
    if (isExplicitLaterTable && alreadyRubrique && rows.length >= 2) {
      const colNames = rows.map((r) => String(r[0] ?? '').trim());
      if (colNames.some((c) => c.toLowerCase() === 'no' || c.toLowerCase() === 'n°' || c.toLowerCase().includes('champ'))) {
        return {
          ...tbl,
          headers: colNames,
          rows: [rows.map((r) => String(r[1] ?? ''))],
        };
      }
    }

    if (isExplicitLaterTable) {
      return tbl;
    }

    // Harmoniser table 1 déjà au format Rubrique | Description si anciens libellés abrégés
    if (alreadyRubrique && (isExplicitTable0Or1 || idx === 0)) {
      const lowerKeys = rows.map((r) => String(r[0] ?? '').trim().toLowerCase());
      const hasAbbrevType1 =
        lowerKeys.includes('etape') &&
        (lowerKeys.includes('normes') || lowerKeys.includes('methode'));
      if (hasAbbrevType1) {
        const valByKey = new Map<string, string>();
        rows.forEach((r) => {
          valByKey.set(String(r[0] ?? '').trim().toLowerCase(), String(r[1] ?? ''));
        });
        return buildStepMetaRubriqueTable(tbl.id, tbl.title, {
          etape: valByKey.get('etape de mission') ?? valByKey.get('etape') ?? '',
          norme: valByKey.get('norme') ?? valByKey.get('normes') ?? '',
          methode: valByKey.get('méthode') ?? valByKey.get('methode') ?? '',
          reference: valByKey.get('reference') ?? '',
        });
      }
      return tbl;
    }

    const isMetaTableCandidate = isExplicitTable0Or1 || idx === 0;
    if (isMetaTableCandidate && headers.length >= 2) {
      const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
      const hasLegacyType1 =
        (lowerHeaders.includes('etape de mission') || lowerHeaders.includes('etape')) &&
        (lowerHeaders.includes('norme') ||
          lowerHeaders.includes('normes') ||
          lowerHeaders.includes('méthode') ||
          lowerHeaders.includes('methode'));
      const hasLegacyType2Signature =
        lowerHeaders.includes('client') &&
        lowerHeaders.includes('exercice') &&
        (lowerHeaders.includes('preparer') || lowerHeaders.includes('reviewer'));
      const hasLegacyType2Step =
        (lowerHeaders.includes('etape de mission') || lowerHeaders.includes('etape')) &&
        lowerHeaders.includes('test') &&
        lowerHeaders.includes('nature de test');

      const pickColValue = (colIdx: number): string => {
        const vals = rows
          .map((r) => String(r?.[colIdx] ?? '').trim())
          .filter((v) => v !== '' && v !== '—' && v !== '-');
        return vals.join(' / ');
      };

      if (hasLegacyType1) {
        const valByHeader = new Map<string, string>();
        headers.forEach((h, i) => {
          valByHeader.set(h.trim().toLowerCase(), pickColValue(i));
        });
        return buildStepMetaRubriqueTable(tbl.id, tbl.title, {
          etape:
            valByHeader.get('etape de mission') ??
            valByHeader.get('etape') ??
            '',
          norme:
            valByHeader.get('norme') ?? valByHeader.get('normes') ?? '',
          methode:
            valByHeader.get('méthode') ?? valByHeader.get('methode') ?? '',
          reference: valByHeader.get('reference') ?? '',
        });
      }

      if (hasLegacyType2Signature || hasLegacyType2Step || rows.length === 1) {
        return {
          ...tbl,
          headers: ['Rubrique', 'Description'],
          rows: headers.map((h, i) => [h, pickColValue(i)]),
        };
      }
    }

    return tbl;
  });
}

/** Détecte si un nœud TreeView correspond à une Étape de mission ([Phase et etapes de mission]) */
export function resolveMissionStepClassification(node: WorkflowTreeNode): {
  isStep: boolean;
  formatType: MissionStepFormatType;
  stepKey: string;
  phase: MissionPhaseName | 'Document source';
} {
  if (node.missionStepFormatType === 4 || (node.isMissionStep === false && node.sourceDocFormat)) {
    return {
      isStep: false,
      formatType: 4,
      stepKey: node.missionStepKey || 'doc-source',
      phase: 'Document source',
    };
  }

  if (node.isMissionStep && node.missionStepFormatType && node.missionStepKey) {
    return {
      isStep: true,
      formatType: node.missionStepFormatType,
      stepKey: node.missionStepKey,
      phase: node.missionPhase || 'Phase de préparation',
    };
  }

  const lower = node.label.toLowerCase();

  // Type 3 : FRAP / Recos contrôle des comptes / Recos contrôle interne comptable
  if (lower.includes('recos contrôle des comptes') || lower.includes('recos revision')) {
    return {
      isStep: true,
      formatType: 3,
      stepKey: 'recos-comptes',
      phase: 'Phase de conclusion',
    };
  }
  if (lower.includes('recos contrôle interne')) {
    return {
      isStep: true,
      formatType: 3,
      stepKey: 'recos-ci',
      phase: 'Phase de conclusion',
    };
  }
  if (lower.includes('la frap') || lower.startsWith('frap') || /\bfrap\b/.test(lower)) {
    return {
      isStep: true,
      formatType: 3,
      stepKey: 'frap',
      phase: 'Phase de conclusion',
    };
  }

  // Type 2 : Feuille couverture / Feuille révision / Terrain-test
  if (
    lower.includes('feuille couverture') ||
    lower.includes('feuille de couverture') ||
    lower.includes('feuille revision') ||
    lower.includes('feuille de révision') ||
    lower.includes('phase de terrain-test') ||
    lower.includes('inventaire caisse inopiné')
  ) {
    return {
      isStep: true,
      formatType: 2,
      stepKey: lower.includes('revision') || lower.includes('révision')
        ? 'feuille-revision'
        : 'feuille-couverture',
      phase: 'Phase de réalisation',
    };
  }

  // Type 1 : Autres étapes de mission [Phase et etapes de mission]
  const type1Rules: Array<{ match: RegExp; key: string; phase: MissionPhaseName }> = [
    { match: /planification de la mission/i, key: 'planification', phase: 'Phase de préparation' },
    { match: /lettre de mission/i, key: 'lettre-mission', phase: 'Phase de préparation' },
    { match: /rencontre avec la direction/i, key: 'rencontre-direction', phase: 'Phase de préparation' },
    { match: /compte rendu de la r[ée]union/i, key: 'compte-rendu', phase: 'Phase de préparation' },
    { match: /r[ée]union d['’]ouverture/i, key: 'reunion-ouverture', phase: 'Phase de préparation' },
    { match: /collecte documentaire|prise de connaissance/i, key: 'collecte-documentaire', phase: 'Phase de préparation' },
    { match: /plan d['’]approche|r[ée]f[ée]rentiel de contr[ôo]le interne/i, key: 'plan-approche', phase: 'Phase de préparation' },
    { match: /questionnaire de contr[ôo]le interne|\bqci\b/i, key: 'qci', phase: 'Phase de préparation' },
    { match: /forces et faiblesses|\btffa\b/i, key: 'tffa', phase: 'Phase de préparation' },
    { match: /rapport d['’]orientation/i, key: 'rapport-orientation', phase: 'Phase de préparation' },
    { match: /programme de travail/i, key: 'programme-travail', phase: 'Phase de préparation' },
    { match: /synth[èe]se des frap/i, key: 'synthese-frap', phase: 'Phase de conclusion' },
    { match: /rapport provisoire/i, key: 'rapport-provisoire', phase: 'Phase de conclusion' },
    { match: /r[ée]union de cl[ôo]ture/i, key: 'reunion-cloture', phase: 'Phase de conclusion' },
    { match: /rapport final/i, key: 'rapport-final', phase: 'Phase de conclusion' },
  ];

  for (const rule of type1Rules) {
    if (rule.match.test(node.label)) {
      return {
        isStep: true,
        formatType: 1,
        stepKey: rule.key,
        phase: rule.phase,
      };
    }
  }

  return {
    isStep: false,
    formatType: 4,
    stepKey: 'doc-source',
    phase: 'Document source',
  };
}

/** Construit les données [Formatage data] Type 1 / Type 2 / Type 3 / Type 4 pour un nœud donné */
export function buildFormatageDataForNode(
  node: WorkflowTreeNode,
  clientName = 'Banque Atlantique UMOA',
  exercice = '2026'
): MissionStepFormatPayload {
  const cls = resolveMissionStepClassification(node);

  // ---------------------------------------------------------------------------
  // ÉTAPES DE MISSION SANS DONNÉES DANS LA BASE : JUSTE LES 2 TABLES VIDES
  // ---------------------------------------------------------------------------
  if (cls.isStep && node.sqliteHasData === false) {
    const emptyTable2Headers = [
      'no',
      'Champ / Tâche',
      'Point de contrôle / Description',
      'Observation',
    ];
    const emptyRawJson = {
      [`Etape mission - ${node.label}`]: [
        {
          'table 1': {
            'Etape de mission': '',
            Norme: '',
            Méthode: '',
            Reference: '',
          },
        },
        { 'table 2': [] },
      ],
    };

    return {
      formatType: 1,
      formatLabel: 'Étape sans données · 2 tables vides',
      stepKey: cls.stepKey,
      stepTitle: node.label,
      phase: cls.phase === 'Document source' ? 'Phase de préparation' : cls.phase,
      norme: 'Non renseignée (étape vierge)',
      reference: '—',
      isEmptyPlaceholder: true,
      rawFormatageJson: emptyRawJson,
      baseTables: [
        buildStepMetaRubriqueTable(`${node.id}-t1`, 'table 1', {
          etape: '',
          reference: '',
          norme: '',
          methode: '',
        }),
        {
          id: `${node.id}-t2`,
          title: 'table 2',
          headers: emptyTable2Headers,
          rows: [['', '', '', '']],
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // TYPE 2 : Feuille couverture / Feuille de révision (7-8 tables)
  // ---------------------------------------------------------------------------
  if (cls.formatType === 2) {
    const isRevision = cls.stepKey === 'feuille-revision';
    const refDoc: FeuilleCouvertureDocument = structuredClone(
      isRevision
        ? FEUILLE_COUVERTURE_JSON_TEMPLATES[1]
        : {
            'Etape mission - Feuille couverture': [
              {
                'table 0 - Signature worksheet': [
                  {
                    Client: clientName,
                    Exercice: exercice,
                    Preparer: `${node.owner || 'OHA'} (Auditeur Senior)`,
                    Reviewer: 'M. SEK (Directeur Audit Interne)',
                  },
                ],
              },
              {
                'table 1': [
                  {
                    'Etape de mission': isRevision
                      ? 'Feuille de révision Trésorerie'
                      : 'Phase de terrain-test (Feuille de couverture)',
                    Test: 'AA200',
                    Reference: 'AA200-Caisse & Banque 2026',
                    'Nature de test': 'Rapprochement & Inventaire physique',
                  },
                ],
              },
              {
                'table 2': [
                  {
                    OBJECTIFS:
                      "S'assurer de la réalité physique des fonds en caisse (compte 571), du respect du plafond d'encaisse UMOA et de l'exactitude des états de rapprochement bancaire BCEAO/Correspondants (compte 521) au cours de l'exercice 2026.",
                  },
                ],
              },
              {
                'table 3': [
                  {
                    no: '1',
                    'travaux a effectuer':
                      "Sélectionner un échantillon de 5 PV d'inventaire inopiné de caisse (Siège Plateau, Agences Treichville, Bouaké, San-Pédro, Vridi) sur l'exercice 2026.",
                  },
                  {
                    no: '2',
                    'travaux a effectuer':
                      "Rapprocher le montant du 'Solde Physique' inventorié avec le 'Solde Théorique' issu du brouillard de caisse Core Banking.",
                  },
                  {
                    no: '3',
                    'travaux a effectuer':
                      "Recalculer l'écart (Physique − Théorique), vérifier les justifications et contrôler les signatures conjointes (caissier + superviseur).",
                  },
                  {
                    no: '4',
                    'travaux a effectuer':
                      'Contrôler le respect du délai de remise en banque (J+1) des excédents au-delà du plafond d’encaisse autorisé.',
                  },
                  {
                    no: '5',
                    'travaux a effectuer':
                      'Tester les suspens bancaires > 30 jours sur les états de rapprochement BCEAO au 31/03/2026.',
                  },
                ],
              },
              {
                'table 4': [
                  {
                    'Résultats des tests':
                      "Sur un échantillon de 5 PV d'inventaire inopiné de caisse 2026 représentant un solde théorique cumulé de 8 450 000 FCFA : (i) Trois caisses sont rigoureusement conformes sans écart (Siège Plateau, Vridi, Korhogo), (ii) Un écart défavorable non justifié de 75 000 FCFA a été constaté à l'agence de Treichville avec absence de double visa superviseur, (iii) Un dépassement de plafond de 1 850 000 FCFA non remis en banque sous 24h a été relevé à Bouaké. Une FRAP (FRAP-TRES-001) et une recommandation comptable ont été émises.",
                  },
                ],
              },
              {
                'table 5': [
                  {
                    'N°': '1',
                    'Date inventaire': '15/01/2026',
                    'Réf. PV': 'PV-INV-2026-001',
                    Caissier: 'Jean KOUASSI (Caisse Siège Plateau)',
                    'Solde Théorique (FCFA)': '1 200 000',
                    'Solde Physique (FCFA)': '1 200 000',
                    Ecart: '0',
                    'Sig. conformes': 'Oui',
                    Assertion: '',
                    'CTR 1': '+',
                    'CTR 2': '+',
                    'CTR 3': '+',
                    'X-Ref': '[T01-01]',
                    Description:
                      'Concordance exacte entre la billetterie physique et le brouillard de caisse Core Banking. Double signature présente.',
                    Conclusion: 'Satisfaisant',
                  },
                  {
                    'N°': '2',
                    'Date inventaire': '12/02/2026',
                    'Réf. PV': 'PV-INV-2026-014',
                    Caissier: 'Aminata DIALLO (Agence Vridi)',
                    'Solde Théorique (FCFA)': '950 000',
                    'Solde Physique (FCFA)': '950 000',
                    Ecart: '0',
                    'Sig. conformes': 'Oui',
                    Assertion: '',
                    'CTR 1': '+',
                    'CTR 2': '+',
                    'CTR 3': '+',
                    'X-Ref': '[T01-02]',
                    Description:
                      'Respect du plafond d’encaisse de 1 000 000 FCFA et PV contresigné par le chef d’agence.',
                    Conclusion: 'Satisfaisant',
                  },
                  {
                    'N°': '3',
                    'Date inventaire': '03/03/2026',
                    'Réf. PV': 'PV-INV-2026-028',
                    Caissier: 'Moussa DIOP (Agence Bouaké)',
                    'Solde Théorique (FCFA)': '2 850 000',
                    'Solde Physique (FCFA)': '2 850 000',
                    Ecart: '0',
                    'Sig. conformes': 'Oui',
                    Assertion: 'Sécurité',
                    'CTR 1': '+',
                    'CTR 2': '+',
                    'CTR 3': '-',
                    'X-Ref': '[T01-03]',
                    Description:
                      'Dépassement récurrent du plafond autorisé (1 000 000 FCFA) conservé 4 jours en coffre sans remise BCEAO.',
                    Conclusion: 'Non-satisfaisant',
                  },
                  {
                    'N°': '4',
                    'Date inventaire': '19/03/2026',
                    'Réf. PV': 'PV-INV-2026-042',
                    Caissier: 'Sophie NGUEMA (Agence Treichville)',
                    'Solde Théorique (FCFA)': '2 650 000',
                    'Solde Physique (FCFA)': '2 575 000',
                    Ecart: '-75 000',
                    'Sig. conformes': 'Non',
                    Assertion: 'Validité',
                    'CTR 1': '+',
                    'CTR 2': '-',
                    'CTR 3': '-',
                    'X-Ref': '[T01-04]',
                    Description:
                      'Manquant de caisse de 75 000 FCFA sans bon provisoire approuvé ni visa du superviseur sur le PV.',
                    Conclusion: 'Non-satisfaisant',
                  },
                  {
                    'N°': '5',
                    'Date inventaire': '31/03/2026',
                    'Réf. PV': 'PV-INV-2026-059',
                    Caissier: 'Ibrahim TRAORÉ (Agence Korhogo)',
                    'Solde Théorique (FCFA)': '800 000',
                    'Solde Physique (FCFA)': '800 000',
                    Ecart: '0',
                    'Sig. conformes': 'Oui',
                    Assertion: '',
                    'CTR 1': '+',
                    'CTR 2': '+',
                    'CTR 3': '+',
                    'X-Ref': '[T01-05]',
                    Description:
                      'Inventaire physique trimestriel régulier, arrêté de caisse conforme et archivé sous 24h.',
                    Conclusion: 'Satisfaisant',
                  },
                ],
              },
              {
                'table 6 - Cross references documentaire': [
                  {
                    no: '1',
                    'Cross references': '[T01]',
                    Document: 'Brouillard de caisse Core Banking — Compte 571 (T1 2026)',
                    Client: clientName,
                    Exercice: exercice,
                  },
                  {
                    no: '2',
                    'Cross references': '[T02]',
                    Document: "Procès-verbaux d'inventaire physique inopiné de caisse 2026",
                    Client: clientName,
                    Exercice: exercice,
                  },
                  {
                    no: '3',
                    'Cross references': '[T03]',
                    Document: 'États de rapprochement bancaire BCEAO & Relevés T1 2026',
                    Client: clientName,
                    Exercice: exercice,
                  },
                ],
              },
              {
                'table 7 - Legendes': [
                  { Légende: 'Contrôle positif (sans anomalie)', Symboles: '+' },
                  { Légende: 'Contrôle négatif (anomalie relevée)', Symboles: '-' },
                  { Légende: 'Non applicable', Symboles: 'x / N/A' },
                ],
              },
              {
                'table 8 - Revue manager': [
                  {
                    no: '1',
                    Superviseur:
                      "Confirmer la mise en débet du manquant de 75 000 FCFA relevé à Treichville (PV-INV-2026-042).",
                    Preparer:
                      'Constat formalisé dans FRAP-TRES-001 et notification transmise à la DRH et au DAF pour retenue.',
                  },
                  {
                    no: '2',
                    Superviseur:
                      "Vérifier l'alignement des écritures de régularisation au compte 571 Caisse avant arrêté semestriel.",
                    Preparer:
                      'Proposition d’écriture intégrée dans REC-CPT-001 (Recos contrôle des comptes).',
                  },
                ],
              },
            ],
          }
    );

    const arr = refDoc['Etape mission - Feuille couverture'];
    const baseTables: ParsedBaseTable[] = arr.map((tableObj, idx) => {
      const [tableName, rows] = Object.entries(tableObj)[0] || [`table ${idx}`, []];
      const safeRows = Array.isArray(rows) ? rows : [];
      if (idx <= 1 && safeRows.length === 1 && Object.keys(safeRows[0]).length >= 2) {
        return kvObjectToTable(`${node.id}-t${idx}`, tableName, safeRows[0]);
      }
      return objectArrayToTable(`${node.id}-t${idx}`, tableName, safeRows);
    });

    return {
      formatType: 2,
      formatLabel: isRevision
        ? 'Type 2 · Feuille de révision (8 tables)'
        : 'Type 2 · Feuille couverture (8 tables)',
      stepKey: cls.stepKey,
      stepTitle: node.label,
      phase: cls.phase,
      norme: 'Normes CRIPP 13.6 & 14.1 · PCB UMOA',
      reference: isRevision ? 'FR-TRES-571' : 'AA200-Caisse-2026',
      rawFormatageJson: refDoc as unknown as Record<string, unknown>,
      baseTables,
    };
  }

  // ---------------------------------------------------------------------------
  // TYPE 3 : FRAP / Recos contrôle des comptes / Recos contrôle interne comptable (6 tables)
  // ---------------------------------------------------------------------------
  if (cls.formatType === 3) {
    if (cls.stepKey === 'recos-comptes') {
      const raw = {
        'Etape mission - Recos revision des comptes': [
          {
            'table 1': {
              'Etape de mission': 'Recommendations comptables',
              Norme: 'Norme ISA 330 / PCB UMOA',
              Méthode: 'Méthode des régularisations des comptes par les assertions',
              Reference: 'Recos revision-TRES-2026-001',
            },
          },
          {
            'table 2': {
              Intitule:
                'Dépenses de caisse et écart d’inventaire non appuyés par des pièces justificatives probantes (Compte 571)',
            },
          },
          {
            'table 3': {
              Description:
                "Nous avons mis en œuvre une procédure de rapprochement des pièces justificatives de caisse (réf. feuille de travail AA200-Caisse), consistant à rapprocher chaque décaissement enregistré au journal de caisse avec sa pièce justificative originale visée et les PV d'inventaire physique inopiné de l'exercice 2026.",
            },
          },
          {
            'table 4': {
              Observation:
                "Le rapprochement effectué entre les soldes comptables du compte 571 — Caisse et les existants physiques inventoriés au T1 2026 fait ressortir un écart défavorable de 75 000 FCFA à l'agence de Treichville ainsi que 525 000 FCFA de sorties de caisse sans factures ni reçus originaux (total 600 000 FCFA).",
            },
          },
          {
            'table 5': {
              'Ajustement/Reclassement':
                "Ajustement proposé pour surévaluation de charges et redressement d'encaisse d'un montant total de 600 000 FCFA : extourne des dépenses non justifiées et constatation d'une créance sur le caissier défaillant (compte 421/471) à hauteur de 75 000 FCFA.",
            },
          },
          {
            'table 6': {
              'Regularisation comptable':
                'Débit compte 571 000 — Caisse (525 000 FCFA) et Débit compte 471 100 — Débiteurs divers / Mise en débet (75 000 FCFA) par le Crédit du compte 605 800 — Achats non stockés / Menues dépenses (600 000 FCFA) au titre du T1 2026.',
            },
          },
        ],
      };
      const entries = raw['Etape mission - Recos revision des comptes'];
      const baseTables = entries.map((entry, idx) => {
        const [tName, obj] = Object.entries(entry)[0];
        if (idx === 0) {
          const rec = obj as Record<string, string>;
          return buildStepMetaRubriqueTable(`${node.id}-t0`, tName, {
            etape: rec['Etape de mission'] || '',
            reference: rec.Reference || '',
            norme: rec.Norme || '',
            methode: rec['Méthode'] || '',
          });
        }
        return kvObjectToTable(`${node.id}-t${idx}`, tName, obj as Record<string, string>);
      });
      return {
        formatType: 3,
        formatLabel: 'Type 3 · Recos contrôle des comptes (6 tables)',
        stepKey: cls.stepKey,
        stepTitle: node.label,
        phase: 'Phase de conclusion',
        norme: 'Norme ISA 330 / PCB UMOA',
        reference: 'Recos revision-TRES-2026-001',
        rawFormatageJson: raw,
        baseTables,
      };
    }

    if (cls.stepKey === 'recos-ci') {
      const raw = {
        'Etape mission - Recos contrôle interne comptable': [
          {
            'table 1': {
              'Etape de mission': 'Recos contrôle interne comptable',
              Norme: 'CRIPP 14.3 & Règlement COBAC/UMOA',
              Méthode: 'Méthode des constats de contrôle interne par cycle comptable',
              Reference: 'Recos-CI-TRES-2026-001',
            },
          },
          {
            'table 2': {
              Intitule:
                'Cumul de fonctions entre tenue du brouillard de caisse et validation des remises bancaires BCEAO',
            },
          },
          {
            'table 3': {
              Observation:
                "La procédure de trésorerie UMOA impose une stricte séparation des tâches entre l'agent chargé de la caisse, le comptable enregistrant les bordereaux et le superviseur contrôlant les rapprochements bancaires quotidiens.",
            },
          },
          {
            'table 4': {
              Constat:
                "- L'agent de caisse de l'agence Bouaké dispose également du profil de saisie des écritures de rapprochement dans le module comptable.\n- Les dépassements du plafond d'encaisse (2 850 000 FCFA vs 1 000 000 FCFA autorisé) n'ont pas généré d'alerte bloquante ni de remise J+1.",
            },
          },
          {
            'table 5': {
              Risque:
                '- Risque de dissimulation de manquants de caisse par cavalerie ou décalage comptable.\n- Risque de fraude interne et de sinistre sur encaisse excédentaire non assurée.',
            },
          },
          {
            'table 6': {
              Recommendation:
                "- Retirer immédiatement les droits d'imputation comptable du caissier dans le Core Banking (matrice SoD).\n- Paramétrer une alerte automatique de dépassement de plafond d'encaisse envoyée chaque soir à 17h30 au Contrôle Permanent et à la Trésorerie Siège.",
            },
          },
        ],
      };
      const entries = raw['Etape mission - Recos contrôle interne comptable'];
      const baseTables = entries.map((entry, idx) => {
        const [tName, obj] = Object.entries(entry)[0];
        if (idx === 0) {
          const rec = obj as Record<string, string>;
          return buildStepMetaRubriqueTable(`${node.id}-t0`, tName, {
            etape: rec['Etape de mission'] || '',
            reference: rec.Reference || '',
            norme: rec.Norme || '',
            methode: rec['Méthode'] || '',
          });
        }
        return kvObjectToTable(`${node.id}-t${idx}`, tName, obj as Record<string, string>);
      });
      return {
        formatType: 3,
        formatLabel: 'Type 3 · Recos contrôle interne comptable (6 tables)',
        stepKey: cls.stepKey,
        stepTitle: node.label,
        phase: 'Phase de conclusion',
        norme: 'CRIPP 14.3 & Règlement COBAC/UMOA',
        reference: 'Recos-CI-TRES-2026-001',
        rawFormatageJson: raw,
        baseTables,
      };
    }

    // Par défaut Type 3 : FRAP (6 tables exactes selon [Formatage data])
    const rawFrap = {
      'Etape mission - Frap': [
        {
          'table 1': {
            'Etape de mission': 'Frap',
            Norme: '14.3 Évaluation des constats',
            Méthode: 'Méthode des constats d’audit par les risques critiques',
            Reference: 'Frap-TRES-2026-001',
          },
        },
        {
          'table 2': {
            Intitule:
              "Écart de caisse injustifié de 75 000 FCFA et absence de visa contradictoire lors des arrêtés d'agence",
          },
        },
        {
          'table 3': {
            Observation:
              "La procédure de gestion des disponibilités impose un arrêté de caisse quotidien matérialisé par une double signature (caissier et chef d'agence ou superviseur) et un versement sous 24h de tout excédent dépassant le plafond de 1 000 000 FCFA.\n\nNos travaux sur le T1 2026 ont porté sur le contrôle de 5 inventaires physiques inopinés et sur l'analyse des soldes quotidiens de caisse du réseau.",
          },
        },
        {
          'table 4': {
            Constat:
              "- Un manquant physique de 75 000 FCFA non justifié par une pièce comptable a été relevé à l'agence de Treichville (PV-INV-2026-042).\n- L'arrêté quotidien ne comportait pas la contre-signature du superviseur habilité sur 12 journées ouvrées de février 2026.\n- À l'agence de Bouaké, le plafond d'encaisse de 1 000 000 FCFA a été dépassé à 2 850 000 FCFA pendant 4 jours consécutifs sans remise en banque.",
          },
        },
        {
          'table 5': {
            Risque:
              '- Risque élevé de détournement d’espèces et de fraude par cavalerie entre caisses secondaires.\n- Risque de perte financière non couverte par la police d’assurance en cas de dépassement du plafond coffre.\n- Non-fiabilité du solde comptable du compte 571 dans les situations mensuelles UMOA.',
          },
        },
        {
          'table 6': {
            Recommendation:
              "- Appliquer la procédure disciplinaire et de mise en débet pour le déficit de 75 000 FCFA à Treichville.\n- Instaurer la saisie obligatoire d'un blocage informatique journalier si la validation du superviseur n'est pas enregistrée avant 18h30.\n- Exiger la remise systématique en banque à J+1 dès franchissement de 80 % du plafond d'encaisse.",
          },
        },
      ],
    };
    const frapEntries = rawFrap['Etape mission - Frap'];
    const baseTables = frapEntries.map((entry, idx) => {
      const [tName, obj] = Object.entries(entry)[0];
      if (idx === 0) {
        const rec = obj as Record<string, string>;
        return buildStepMetaRubriqueTable(`${node.id}-t0`, tName, {
          etape: rec['Etape de mission'] || '',
          reference: rec.Reference || '',
          norme: rec.Norme || '',
          methode: rec['Méthode'] || '',
        });
      }
      return kvObjectToTable(`${node.id}-t${idx}`, tName, obj as Record<string, string>);
    });
    return {
      formatType: 3,
      formatLabel: 'Type 3 · FRAP (6 tables)',
      stepKey: 'frap',
      stepTitle: node.label,
      phase: 'Phase de conclusion',
      norme: '14.3 Évaluation des constats',
      reference: 'Frap-TRES-2026-001',
      rawFormatageJson: rawFrap,
      baseTables,
    };
  }

  // ---------------------------------------------------------------------------
  // TYPE 4 : Document source / Pièce jointe (non-étape de mission)
  // ---------------------------------------------------------------------------
  if (cls.formatType === 4) {
    const ext: SourceDocFormat =
      node.sourceDocFormat ||
      (node.label.toLowerCase().includes('.xlsx') || node.label.toLowerCase().includes('brouillard') || node.label.toLowerCase().includes('rapprochement')
        ? 'xlsx'
        : node.label.toLowerCase().includes('.pdf') || node.label.toLowerCase().includes('pv')
        ? 'pdf'
        : 'docx');

    return {
      formatType: 4,
      formatLabel: `Type 4 · Document source (.${ext})`,
      stepKey: 'doc-source',
      stepTitle: node.label,
      phase: 'Document source',
      norme: 'Pièce justificative / Document de référence',
      reference: node.driveId || node.id,
      sourceDocFormat: ext,
      sourceSummary: `Document source non classé comme étape de mission. Ouverture directe dans sa forme source (.${ext}) pour consultation, annotation ou rattachement en cross-référence.`,
      rawFormatageJson: {
        documentSource: node.label,
        format: ext,
        driveId: node.driveId || '',
        client: clientName,
        exercice,
        owner: node.owner || 'OHA',
      },
      baseTables: [],
    };
  }

  // ---------------------------------------------------------------------------
  // TYPE 1 : Étape de mission standard (2 tables : table 1 méta + table 2 contenu)
  // ---------------------------------------------------------------------------
  if (cls.stepKey === 'programme-travail') {
    const rawProgramme = {
      'Etape mission - Programme': [
        {
          'table 1': {
            'Etape de mission': 'Programme de travail',
            Norme: '13.6 Programme de travail',
            Méthode: 'Méthode des contrôles clés par les risques',
            Reference: 'Programme-001',
          },
        },
        {
          'table 2': [
            {
              no: 1,
              'tâches clés': "Effectuer l'arrêté de caisse quotidien",
              'Point de controle':
                "Conformité du solde physique avec le solde théorique du brouillard de caisse. Existence d'un comptage contradictoire.",
              Risque:
                "Détournement d'espèces, erreur de comptage non détectée, dissimulation d'écarts.",
              'contrôle audit':
                "1. Sélectionner un échantillon d'arrêtés de caisse sur la période. 2. Vérifier la présence d'une double signature (caissier et superviseur). 3. Recalculer l'arrêté et le rapprocher du brouillard de caisse et des pièces justificatives.",
              Document: "Procès-verbal d'arrêté de caisse, Brouillard de caisse.",
            },
            {
              no: 2,
              'tâches clés': "Surveiller le niveau de l'encaisse",
              'Point de controle': "Respect du plafond d'encaisse autorisé en fin de journée.",
              Risque: "Vol ou perte aggravée en cas de sinistre. Coût d'opportunité (fonds oisifs).",
              'contrôle audit':
                "1. Obtenir la procédure de trésorerie fixant le plafond. 2. Analyser les soldes de caisse de fin de journée sur un mois. 3. Identifier les dépassements et vérifier s'ils ont été justifiés et suivis d'une remise en banque rapide.",
              Document: 'Procédure de trésorerie, Journal de caisse.',
            },
            {
              no: 3,
              'tâches clés': 'Effectuer les remises en banque',
              'Point de controle':
                'Respect du délai de remise en banque des espèces et chèques (ex: J+1). Conformité des bordereaux.',
              Risque:
                "Perte ou vol des moyens de paiement, retard dans la disponibilité des fonds, risque d'impayé accru sur les chèques.",
              'contrôle audit':
                '1. Suivre un échantillon de recettes (chèques, espèces) de leur réception à leur remise en banque. 2. Calculer le délai de remise. 3. Rapprocher les bordereaux de remise avec les souches et les relevés bancaires.',
              Document: 'Bordereaux de remise en banque, Relevés bancaires.',
            },
            {
              no: 4,
              'tâches clés': 'Justifier les dépenses de caisse',
              'Point de controle':
                "Existence d'une pièce justificative originale, conforme et approuvée pour chaque sortie de caisse.",
              Risque:
                'Dépenses non autorisées, non professionnelles ou fictives. Risque fiscal (rejet de charges).',
              'contrôle audit':
                "1. Sélectionner un échantillon de dépenses de caisse. 2. Pour chaque dépense, vérifier la présence d'une pièce justificative valide. 3. S'assurer que la pièce a été approuvée par un responsable autorisé avant le paiement.",
              Document: 'Pièces justificatives (factures, reçus), Brouillard de caisse.',
            },
            {
              no: 5,
              'tâches clés': 'Assurer la sécurité physique des fonds',
              'Point de controle':
                'Fonds conservés dans un coffre-fort fermé. Accès restreint aux seules personnes habilitées.',
              Risque: 'Vol interne ou externe très élevé.',
              'contrôle audit':
                '1. Inspection physique des installations (coffre-fort, serrures). 2. Entretien sur les pratiques de gestion de la clé/code. 3. Vérifier la liste des personnes habilitées et sa mise à jour.',
              Document: 'Procédure de gestion de caisse, Liste des personnes habilitées.',
            },
          ],
        },
      ],
    };

    const t1Meta = rawProgramme['Etape mission - Programme'][0]['table 1'] as Record<string, string>;
    const t1 = buildStepMetaRubriqueTable(`${node.id}-t1`, 'table 1', {
      etape: t1Meta['Etape de mission'] || '',
      reference: t1Meta.Reference || '',
      norme: t1Meta.Norme || '',
      methode: t1Meta['Méthode'] || '',
    });
    const t2 = objectArrayToTable(
      `${node.id}-t2`,
      'table 2',
      rawProgramme['Etape mission - Programme'][1]['table 2'] as Array<Record<string, string | number>>
    );

    return {
      formatType: 1,
      formatLabel: 'Type 1 · Étape de mission (2 tables)',
      stepKey: 'programme-travail',
      stepTitle: node.label,
      phase: 'Phase de préparation',
      norme: '13.6 Programme de travail',
      reference: 'Programme-001',
      rawFormatageJson: rawProgramme,
      baseTables: [t1, t2],
    };
  }

  // Presets riches pour toutes les autres étapes Type 1 de la mission Audit Trésorerie 2026
  const TYPE1_CATALOG: Record<
    string,
    {
      etape: string;
      norme: string;
      methode: string;
      reference: string;
      phase: MissionPhaseName;
      rows: Array<Record<string, string | number>>;
    }
  > = {
    planification: {
      etape: 'Planification de la mission',
      norme: 'Norme 13.1 & 13.5 Ressources',
      methode: 'Cadrage budgétaire, jalons et allocation équipe Trésorerie',
      reference: 'PLANIF-TRES-2026-01',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Jalon: 'Cadrage & Lettre de mission',
          Phase: 'Phase de préparation',
          Responsable: 'M. SEK (Chef de mission)',
          'Date début': '05/01/2026',
          'Date fin': '16/01/2026',
          'Charge (h)': 40,
        },
        {
          no: 2,
          Jalon: 'Tests terrain caisses & rapprochements BCEAO',
          Phase: 'Phase de réalisation',
          Responsable: 'JFK / OHA',
          'Date début': '19/01/2026',
          'Date fin': '20/02/2026',
          'Charge (h)': 96,
        },
        {
          no: 3,
          Jalon: 'Rédaction FRAP, Recos & Rapport final',
          Phase: 'Phase de conclusion',
          Responsable: 'TAK / SEK',
          'Date début': '23/02/2026',
          'Date fin': '13/03/2026',
          'Charge (h)': 48,
        },
      ],
    },
    'lettre-mission': {
      etape: 'Lettre de mission',
      norme: 'Norme 13.1 — Mandat et communication',
      methode: 'Formalisation du périmètre, objectifs et calendrier Trésorerie',
      reference: 'LM-TRES-2026-001',
      phase: 'Phase de préparation',
      rows: [
        {
          Champ: 'Entité auditée',
          Valeur: `${clientName} — Direction Trésorerie & Caisses Agences`,
        },
        {
          Champ: 'Objectif principal',
          Valeur:
            'Évaluer la sécurité physique des encaisses, la fiabilité des rapprochements bancaires BCEAO et le respect des plafonds UMOA.',
        },
        {
          Champ: 'Périmètre temporel',
          Valeur: 'Opérations du 01/01/2026 au 31/03/2026 et soldes d’ouverture 2026.',
        },
        {
          Champ: 'Mandataire / Signataire',
          Valeur: 'Directeur Général & Directeur de l’Audit Interne (DAI)',
        },
      ],
    },
    'rencontre-direction': {
      etape: '1 Rencontre avec la Direction de l’entité auditée',
      norme: 'Norme 11.1 & 13.2 — Coordination',
      methode: 'Entretien exploratoire préliminaire avec le DAF & Trésorier',
      reference: 'RENC-TRES-2026-01',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Interlocuteur: 'Directeur Financier & Trésorier Central',
          Sujet: 'Présentation du calendrier et des points de vigilance BCEAO 2026',
          Constat: 'Signalement de retards de remise en banque sur 2 agences régionales',
          Action: 'Inclusion prioritaire de Treichville et Bouaké dans l’échantillon',
        },
      ],
    },
    'compte-rendu': {
      etape: '2 Compte rendu de la réunion',
      norme: 'Norme 14.2 — Documentation des entretiens',
      methode: 'Validation contradictoire des points abordés et demandes de pièces',
      reference: 'CR-TRES-2026-02',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Décision: 'Transmission sous 48h des brouillards de caisse T1 2026',
          Responsable: 'Chef Service Trésorerie',
          Échéance: '12/01/2026',
          Statut: 'Reçu',
        },
        {
          no: 2,
          Décision: 'Désignation des correspondants d’audit en agences',
          Responsable: 'Direction Exploitation Réseau',
          Échéance: '14/01/2026',
          Statut: 'Validé',
        },
      ],
    },
    'reunion-ouverture': {
      etape: '3 Réunion d’ouverture',
      norme: 'Norme 13.1 — Lancement officiel',
      methode: 'Présentation de la démarche méthodologique et charte d’audit',
      reference: 'ROUV-TRES-2026-03',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Participant: 'DAF, Responsable Trésorerie, Contrôle Permanent, Équipe Audit',
          'Date séance': '15/01/2026',
          'Points validés':
            'Périmètre comptes 521/571, inventaires physiques inopinés, point hebdomadaire',
          Visa: 'Validé par les parties',
        },
      ],
    },
    'collecte-documentaire': {
      etape: 'Collecte documentaire (prise de connaissance du Domaine audité)',
      norme: 'Norme 13.2 — Compréhension du domaine',
      methode: 'Inventaire des procédures, habilitations Core Banking et relevés',
      reference: 'COLL-TRES-2026-04',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Document: 'Manuel de procédures Trésorerie & Gestion des caisses (V2025)',
          Source: 'Direction Financière',
          Format: 'PDF',
          Statut: 'Collecté',
        },
        {
          no: 2,
          Document: 'Balance générale & Grand-Livre comptes 521 / 571 / 585',
          Source: 'Core Banking',
          Format: 'XLSX',
          Statut: 'Collecté',
        },
        {
          no: 3,
          Document: 'Matrice des délégations de signature bancaire & plafonds coffre',
          Source: 'Direction Conformité',
          Format: 'PDF',
          Statut: 'Collecté',
        },
      ],
    },
    'plan-approche': {
      etape: 'Plan d’approche – référentiel de contrôle interne',
      norme: 'Norme 13.2 & 13.4 — Évaluation des risques',
      methode: 'Décomposition du cycle Trésorerie en sous-processus et risques clés',
      reference: 'PA-TRES-2026-05',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          'Sous-processus': 'Tenue des caisses agences (Compte 571)',
          'Objectif de contrôle': 'Exhaustivité et réalité des encaisses',
          'Risque inhérent': 'Critique',
          'Contrôle clé attendu': 'Inventaire inopiné mensuel + double visa quotidien',
        },
        {
          no: 2,
          'Sous-processus': 'Rapprochements bancaires BCEAO & Correspondants (Compte 521)',
          'Objectif de contrôle': 'Apurement mensuel des suspens',
          'Risque inhérent': 'Élevé',
          'Contrôle clé attendu': 'Rapprochement visé avant J+5 par chef comptable',
        },
        {
          no: 3,
          'Sous-processus': 'Ordres de virements & chèques certifiés',
          'Objectif de contrôle': 'Autorisation et séparation des tâches',
          'Risque inhérent': 'Critique',
          'Contrôle clé attendu': 'Double signature Maker-Checker Core Banking',
        },
      ],
    },
    qci: {
      etape: 'Questionnaire de contrôle interne',
      norme: 'Norme 13.4 — Critères d’évaluation',
      methode: 'Évaluation de la conception du dispositif de contrôle Trésorerie',
      reference: 'QCI-TRES-2026-06',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Question: 'Les arrêtés de caisse quotidiens font-ils l’objet d’une double signature ?',
          Réponse: 'Partiel (défaut relevé en agences)',
          Risque: 'Élevé',
          'Test prévu': 'AA200-Caisse',
        },
        {
          no: 2,
          Question: 'Le rapprochement bancaire BCEAO est-il réalisé et revu indépendamment ?',
          Réponse: 'Oui (siège), Non (2 caisses régionales)',
          Risque: 'Élevé',
          'Test prévu': 'ERB-2026',
        },
        {
          no: 3,
          Question: 'L’accès au coffre-fort respecte-t-il le principe de double clé ?',
          Réponse: 'Oui au Siège, à tester à Bouaké',
          Risque: 'Critique',
          'Test prévu': 'Inspection physique',
        },
      ],
    },
    tffa: {
      etape: 'Tableau des forces et faiblesses apparentes',
      norme: 'Norme 13.3 — Analyse préliminaire',
      methode: 'Synthèse des points forts confirmés et faiblesses à tester',
      reference: 'TFFA-TRES-2026-07',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Domaine: 'Rapprochements Siège BCEAO',
          Nature: 'Force apparente',
          Constat: 'Rapprochements automatisés J+1 avec traçabilité Core Banking',
          Conséquence: 'Réduction du risque d’erreur de cut-off siège',
        },
        {
          no: 2,
          Domaine: 'Caisses secondaires agences',
          Nature: 'Faiblesse apparente',
          Constat: 'Absence d’alerte système lors de dépassement du plafond de caisse',
          Conséquence: 'Exposition aux pertes d’espèces non assurées et fraude',
        },
      ],
    },
    'rapport-orientation': {
      etape: 'Le rapport d’orientation',
      norme: 'Norme 13.3 — Objectifs de la mission',
      methode: 'Définition des axes prioritaires de test et exclusion de périmètre',
      reference: 'RO-TRES-2026-08',
      phase: 'Phase de préparation',
      rows: [
        {
          no: 1,
          Axe: 'Axe 1 — Sécurité physique et comptable des caisses (Compte 571)',
          Priorité: 'Critique',
          Approche: 'Inventaires physiques inopinés sur 5 sites + revue pièces',
        },
        {
          no: 2,
          Axe: 'Axe 2 — Apurement des suspens bancaires BCEAO (Compte 521)',
          Priorité: 'Élevée',
          Approche: 'Revue exhaustive des suspens > 30 jours au T1 2026',
        },
      ],
    },
    'synthese-frap': {
      etape: 'La synthèse des FRAP',
      norme: 'Norme 14.3 & 14.4 — Structuration des conclusions',
      methode: 'Consolidation hiérarchisée des constats par niveau de criticité',
      reference: 'SYN-FRAP-TRES-2026',
      phase: 'Phase de conclusion',
      rows: [
        {
          no: 1,
          Réf: 'FRAP-TRES-2026-001',
          Intitulé: 'Manquant de caisse de 75 000 FCFA & défaut double visa (Treichville)',
          Criticité: 'Critique',
          Impact: '75 000 FCFA + faille séparation fonctions',
        },
        {
          no: 2,
          Réf: 'REC-CPT-2026-001',
          Intitulé: 'Régularisation dépenses de caisse sans justificatif probant',
          Criticité: 'Élevée',
          Impact: '600 000 FCFA à extourner au 571',
        },
        {
          no: 3,
          Réf: 'REC-CI-2026-001',
          Intitulé: 'Cumul de fonctions caissier / saisie comptable & plafonds non bloquants',
          Criticité: 'Élevée',
          Impact: 'Correction matrice SoD Core Banking requise',
        },
      ],
    },
    'rapport-provisoire': {
      etape: 'Le rapport provisoire',
      norme: 'Norme 14.5 & 15.1 — Validation contradictoire',
      methode: 'Transmission du projet de rapport pour recueil des plans d’action',
      reference: 'RP-TRES-2026-V1',
      phase: 'Phase de conclusion',
      rows: [
        {
          no: 1,
          Section: 'Synthèse exécutive Trésorerie 2026',
          Statut: 'Transmis au DAF le 04/03/2026',
          Observation: '3 constats majeurs soumis à réponse managériale',
        },
        {
          no: 2,
          Section: 'Matrice des recommandations & échéances',
          Statut: 'En attente de visa clôture',
          Observation: 'Échéances proposées entre 30 et 60 jours',
        },
      ],
    },
    'reunion-cloture': {
      etape: 'La réunion de clôture',
      norme: 'Norme 14.5 — Communication des résultats',
      methode: 'Arbitrage contradictoire des recommandations et délais',
      reference: 'RCLOT-TRES-2026',
      phase: 'Phase de conclusion',
      rows: [
        {
          no: 1,
          Point: 'Validation du plan de remédiation caisse & plafonds Bouaké',
          'Décision prise': 'Paramétrage blocage plafond validé pour le 31/03/2026',
          Responsable: 'DSI & Trésorerie',
        },
        {
          no: 2,
          Point: 'Mise en débet manquant Treichville (75 000 FCFA)',
          'Décision prise': 'Ordre de recette accepté sans réserve par le DAF',
          Responsable: 'DAF & DRH',
        },
      ],
    },
    'rapport-final': {
      etape: 'Le rapport final',
      norme: 'Norme 15.1 — Diffusion finale et suivi',
      methode: 'Publication officielle au Comité d’Audit et versement au suivi recos',
      reference: 'RF-TRES-2026-FIN',
      phase: 'Phase de conclusion',
      rows: [
        {
          no: 1,
          Livrable: 'Rapport final d’audit — Trésorerie & Caisses Exercice 2026',
          Destinataires: 'Direction Générale, Comité d’Audit, DAF, DAI',
          'Date diffusion': '13/03/2026',
          'Nb Recos': 3,
        },
      ],
    },
  };

  const selected = TYPE1_CATALOG[cls.stepKey] || {
    etape: node.label,
    norme: 'Norme CRIPP 13.6 / 14.1',
    methode: 'Méthode structurée par les risques',
    reference: `ETP-${node.id.slice(-6).toUpperCase()}`,
    phase: cls.phase === 'Document source' ? 'Phase de préparation' : cls.phase,
    rows: [
      {
        no: 1,
        'Tâche clé': `Exécution de l'étape « ${node.label} »`,
        'Point de contrôle': 'Conformité méthodologique et traçabilité des preuves',
        Statut: 'Documenté',
      },
    ],
  };

  const table1Obj = {
    'Etape de mission': selected.etape,
    Norme: selected.norme,
    Méthode: selected.methode,
    Reference: selected.reference,
  };

  const rawJson = {
    [`Etape mission - ${selected.etape}`]: [
      { 'table 1': table1Obj },
      { 'table 2': selected.rows },
    ],
  };

  return {
    formatType: 1,
    formatLabel: 'Type 1 · Étape de mission (2 tables)',
    stepKey: cls.stepKey,
    stepTitle: node.label,
    phase: selected.phase,
    norme: selected.norme,
    reference: selected.reference,
    rawFormatageJson: rawJson,
    baseTables: [
      buildStepMetaRubriqueTable(`${node.id}-t1`, 'table 1', {
        etape: selected.etape,
        reference: selected.reference,
        norme: selected.norme,
        methode: selected.methode,
      }),
      objectArrayToTable(`${node.id}-t2`, 'table 2', selected.rows),
    ],
  };
}

/** Construit l'arborescence complète 2026 « Audit trésorerie » avec les 3 phases et toutes les étapes */
export function buildAuditTresorerie2026Children(
  prefix: 'user' | 'team'
): WorkflowTreeNode[] {
  const isTeam = prefix === 'team';
  const makeStepNode = (
    id: string,
    label: string,
    stepKey: string,
    phase: MissionPhaseName,
    formatType: 1 | 2 | 3,
    sig: string,
    status: 'todo' | 'in-progress' | 'in-review' | 'validated',
    dueDate: string
  ): WorkflowTreeNode => ({
    id: `${prefix}-tres26-${id}`,
    label,
    nodeType: 'document',
    natureId: 'ex-audit',
    signature: isTeam ? sig : undefined,
    driveId: `1drv_tres26_${id}_${prefix}`,
    owner: isTeam ? sig : 'OHA',
    ownerEmail: 'ohada.finance@gmail.com',
    status,
    assignee: sig,
    dueDate,
    managerReviewed: status === 'validated',
    isMissionStep: true,
    missionStepFormatType: formatType,
    missionStepKey: stepKey,
    missionPhase: phase,
    sqliteConversationId: 'conv_tres_2026_mission',
    sqliteMessageId: `msg_tres26_${id}`,
    sqliteHasData: true,
  });

  const makeSourceDocNode = (
    id: string,
    label: string,
    sourceDocFormat: SourceDocFormat,
    sig: string,
    dueDate: string
  ): WorkflowTreeNode => ({
    id: `${prefix}-tres26-src-${id}`,
    label,
    nodeType: 'document',
    natureId: 'ex-audit',
    signature: isTeam ? sig : undefined,
    driveId: `1drv_tres26_src_${id}_${prefix}`,
    owner: isTeam ? sig : 'OHA',
    ownerEmail: 'ohada.finance@gmail.com',
    status: 'validated',
    assignee: sig,
    dueDate,
    isMissionStep: false,
    missionStepFormatType: 4,
    missionStepKey: 'doc-source',
    sourceDocFormat,
  });

  const wrapIfTeam = (
    baseId: string,
    nodes: WorkflowTreeNode[]
  ): WorkflowTreeNode[] => {
    if (!isTeam) return nodes;
    const bySig = new Map<string, WorkflowTreeNode[]>();
    nodes.forEach((n) => {
      const s = n.signature || 'OHA';
      const list = bySig.get(s) || [];
      list.push(n);
      bySig.set(s, list);
    });
    return Array.from(bySig.entries()).map(([sig, children]) => ({
      id: `${prefix}-${baseId}-sig-${sig}`,
      label: sig,
      nodeType: 'signature',
      signature: sig,
      natureId: 'ex-audit',
      children,
    }));
  };

  const prepSteps: WorkflowTreeNode[] = [
    makeStepNode('planif', 'Planification de la mission', 'planification', 'Phase de préparation', 1, 'SEK', 'validated', '2026-01-09'),
    makeStepNode('lm', 'Lettre de mission', 'lettre-mission', 'Phase de préparation', 1, 'SEK', 'validated', '2026-01-12'),
    makeStepNode('renc', '1 Rencontre avec la Direction de l’entité auditée', 'rencontre-direction', 'Phase de préparation', 1, 'OHA', 'validated', '2026-01-13'),
    makeStepNode('cr', '2 Compte rendu de la réunion', 'compte-rendu', 'Phase de préparation', 1, 'JFK', 'validated', '2026-01-14'),
    makeStepNode('rouv', '3 Réunion d’ouverture', 'reunion-ouverture', 'Phase de préparation', 1, 'SEK', 'validated', '2026-01-15'),
    makeStepNode('coll', 'Collecte documentaire (prise de connaissance du Domaine audité)', 'collecte-documentaire', 'Phase de préparation', 1, 'TAK', 'validated', '2026-01-16'),
    makeStepNode('pa', 'Plan d’approche – référentiel de contrôle interne', 'plan-approche', 'Phase de préparation', 1, 'JFK', 'validated', '2026-01-17'),
    makeStepNode('qci', 'Questionnaire de contrôle interne', 'qci', 'Phase de préparation', 1, 'OHA', 'validated', '2026-01-18'),
    makeStepNode('tffa', 'Tableau des forces et faiblesses apparentes', 'tffa', 'Phase de préparation', 1, 'TAK', 'validated', '2026-01-19'),
    makeStepNode('ro', 'Le rapport d’orientation', 'rapport-orientation', 'Phase de préparation', 1, 'SEK', 'validated', '2026-01-20'),
    makeStepNode('pt', 'Le programme de travail (Programme-001)', 'programme-travail', 'Phase de préparation', 1, 'OHA', 'validated', '2026-01-21'),
    makeSourceDocNode('proc-caisse', 'Procédure de gestion de caisse & plafonds UMOA 2026.pdf', 'pdf', 'OHA', '2026-01-15'),
  ];

  const realSteps: WorkflowTreeNode[] = [
    makeStepNode('fc', 'La phase de terrain-test (Feuille de couverture · AA200-Caisse)', 'feuille-couverture', 'Phase de réalisation', 2, 'OHA', 'in-review', '2026-02-14'),
    makeStepNode('frev', 'Feuille de révision — Contrôle des comptes Trésorerie (FR-TRES-571)', 'feuille-revision', 'Phase de réalisation', 2, 'JFK', 'in-review', '2026-02-20'),
    makeSourceDocNode('brouillard', 'Brouillard de caisse Siège & Agences T1 2026.xlsx', 'xlsx', 'TAK', '2026-02-05'),
    makeSourceDocNode('pv-arr', "Procès-verbaux d'arrêté inopiné de caisse T1 2026.pdf", 'pdf', 'OHA', '2026-02-12'),
    makeSourceDocNode('erb-bceao', 'États de rapprochement bancaire BCEAO 2026.xlsx', 'xlsx', 'JFK', '2026-02-18'),
  ];

  const concSteps: WorkflowTreeNode[] = [
    makeStepNode('frap', 'LA FRAP — Manquant de caisse & défaut double visa (FRAP-TRES-2026-001)', 'frap', 'Phase de conclusion', 3, 'OHA', 'in-review', '2026-02-26'),
    makeStepNode('reco-cpt', 'Recos contrôle des comptes — Régularisation compte 571 (REC-CPT-001)', 'recos-comptes', 'Phase de conclusion', 3, 'JFK', 'in-progress', '2026-02-28'),
    makeStepNode('reco-ci', 'Recos contrôle interne comptable — Séparation des tâches (REC-CI-001)', 'recos-ci', 'Phase de conclusion', 3, 'TAK', 'in-progress', '2026-03-02'),
    makeStepNode('syn-frap', 'La synthèse des FRAP', 'synthese-frap', 'Phase de conclusion', 1, 'SEK', 'in-review', '2026-03-04'),
    makeStepNode('rp', 'Le rapport provisoire', 'rapport-provisoire', 'Phase de conclusion', 1, 'OHA', 'in-progress', '2026-03-07'),
    makeStepNode('clot', 'La réunion de clôture', 'reunion-cloture', 'Phase de conclusion', 1, 'SEK', 'todo', '2026-03-10'),
    makeStepNode('rf', 'Le rapport final', 'rapport-final', 'Phase de conclusion', 1, 'SEK', 'todo', '2026-03-13'),
    makeSourceDocNode('annexe-lettre', 'Lettre d’affirmation Direction Trésorerie 2026.docx', 'docx', 'SEK', '2026-03-12'),
  ];

  return [
    {
      id: `${prefix}-2026-ex-audit-tres-prep`,
      label: 'Phase de préparation',
      nodeType: 'sous-section',
      natureId: 'ex-audit',
      missionPhase: 'Phase de préparation',
      children: wrapIfTeam('26-tres-prep', prepSteps),
    },
    {
      id: `${prefix}-2026-ex-audit-tres-real`,
      label: 'Phase de réalisation',
      nodeType: 'sous-section',
      natureId: 'ex-audit',
      missionPhase: 'Phase de réalisation',
      children: wrapIfTeam('26-tres-real', realSteps),
    },
    {
      id: `${prefix}-2026-ex-audit-tres-conc`,
      label: 'Phase de conclusion',
      nodeType: 'sous-section',
      natureId: 'ex-audit',
      missionPhase: 'Phase de conclusion',
      children: wrapIfTeam('26-tres-conc', concSteps),
    },
  ];
}

export interface MissionSourceDocSpec {
  id: string;
  label: string;
  sig?: string;
  sourceDocFormat?: SourceDocFormat;
}

/**
 * Construit les 3 phases et toutes les étapes de mission [Phase et etapes de mission]
 * pour n'importe quel Dossier de mission de type « Workflow Dossier exercice - Audit ».
 * Par défaut (`sqliteHasData: false`), les étapes sans données affichent 2 tables vides.
 */
export function buildMissionDossierStandardChildren(
  prefix: 'user' | 'team',
  missionSlug: string,
  options?: {
    exerciceYear?: string;
    sqliteHasData?: boolean;
    prepDocs?: MissionSourceDocSpec[];
    realDocs?: MissionSourceDocSpec[];
    concDocs?: MissionSourceDocSpec[];
  }
): WorkflowTreeNode[] {
  const isTeam = prefix === 'team';
  const year = options?.exerciceYear || '2026';
  const hasData = options?.sqliteHasData ?? false;
  const convId = hasData ? 'conv_tres_2026_mission' : `conv_${missionSlug}`;

  const makeStepNode = (
    id: string,
    label: string,
    stepKey: string,
    phase: MissionPhaseName,
    formatType: 1 | 2 | 3,
    sig: string
  ): WorkflowTreeNode => ({
    id: `${prefix}-${missionSlug}-${id}`,
    label,
    nodeType: 'document',
    natureId: 'ex-audit',
    signature: isTeam ? sig : undefined,
    driveId: `1drv_${missionSlug}_${id}_${prefix}`,
    owner: isTeam ? sig : 'OHA',
    ownerEmail: 'ohada.finance@gmail.com',
    status: hasData ? 'validated' : 'todo',
    assignee: sig,
    dueDate: `${year}-06-30`,
    isMissionStep: true,
    missionStepFormatType: formatType,
    missionStepKey: stepKey,
    missionPhase: phase,
    sqliteConversationId: convId,
    sqliteMessageId: `msg_${missionSlug}_${id}`,
    sqliteHasData: hasData,
  });

  const makeSourceDoc = (spec: MissionSourceDocSpec, fallbackSig = 'OHA'): WorkflowTreeNode => {
    const lower = spec.label.toLowerCase();
    const inferred: SourceDocFormat =
      spec.sourceDocFormat ||
      (lower.endsWith('.xlsx') ? 'xlsx' : lower.endsWith('.pdf') ? 'pdf' : 'docx');
    const sig = spec.sig || fallbackSig;
    return {
      id: `${prefix}-${missionSlug}-src-${spec.id}`,
      label: spec.label,
      nodeType: 'document',
      natureId: 'ex-audit',
      signature: isTeam ? sig : undefined,
      driveId: `1drv_${missionSlug}_src_${spec.id}_${prefix}`,
      owner: isTeam ? sig : 'OHA',
      ownerEmail: 'ohada.finance@gmail.com',
      status: 'validated',
      assignee: sig,
      dueDate: `${year}-06-30`,
      isMissionStep: false,
      missionStepFormatType: 4,
      missionStepKey: 'doc-source',
      sourceDocFormat: inferred,
    };
  };

  const wrapIfTeam = (
    baseId: string,
    nodes: WorkflowTreeNode[]
  ): WorkflowTreeNode[] => {
    if (!isTeam) return nodes;
    const bySig = new Map<string, WorkflowTreeNode[]>();
    nodes.forEach((n) => {
      const s = n.signature || 'OHA';
      const list = bySig.get(s) || [];
      list.push(n);
      bySig.set(s, list);
    });
    return Array.from(bySig.entries()).map(([sig, children]) => ({
      id: `${prefix}-${missionSlug}-${baseId}-sig-${sig}`,
      label: sig,
      nodeType: 'signature',
      signature: sig,
      natureId: 'ex-audit',
      children,
    }));
  };

  const prepNodes: WorkflowTreeNode[] = [
    makeStepNode('planif', 'Planification de la mission', 'planification', 'Phase de préparation', 1, 'SEK'),
    makeStepNode('lm', 'Lettre de mission', 'lettre-mission', 'Phase de préparation', 1, 'SEK'),
    makeStepNode('renc', '1 Rencontre avec la Direction de l’entité auditée', 'rencontre-direction', 'Phase de préparation', 1, 'OHA'),
    makeStepNode('cr', '2 Compte rendu de la réunion', 'compte-rendu', 'Phase de préparation', 1, 'JFK'),
    makeStepNode('rouv', '3 Réunion d’ouverture', 'reunion-ouverture', 'Phase de préparation', 1, 'SEK'),
    makeStepNode('coll', 'Collecte documentaire (prise de connaissance du Domaine audité)', 'collecte-documentaire', 'Phase de préparation', 1, 'TAK'),
    makeStepNode('pa', 'Plan d’approche – référentiel de contrôle interne', 'plan-approche', 'Phase de préparation', 1, 'JFK'),
    makeStepNode('qci', 'Questionnaire de contrôle interne', 'qci', 'Phase de préparation', 1, 'OHA'),
    makeStepNode('tffa', 'Tableau des forces et faiblesses apparentes', 'tffa', 'Phase de préparation', 1, 'TAK'),
    makeStepNode('ro', 'Le rapport d’orientation', 'rapport-orientation', 'Phase de préparation', 1, 'SEK'),
    makeStepNode('pt', 'Le programme de travail', 'programme-travail', 'Phase de préparation', 1, 'OHA'),
    ...(options?.prepDocs || []).map((d) => makeSourceDoc(d, 'TAK')),
  ];

  const realNodes: WorkflowTreeNode[] = [
    makeStepNode('fc', 'La phase de terrain-test (feuille de couverture)', 'feuille-couverture', 'Phase de réalisation', 2, 'OHA'),
    ...(options?.realDocs || []).map((d) => makeSourceDoc(d, 'JFK')),
  ];

  const concNodes: WorkflowTreeNode[] = [
    makeStepNode('frap', 'LA FRAP', 'frap', 'Phase de conclusion', 3, 'OHA'),
    makeStepNode('syn-frap', 'La synthèse des FRAP', 'synthese-frap', 'Phase de conclusion', 1, 'SEK'),
    makeStepNode('rp', 'Le rapport provisoire', 'rapport-provisoire', 'Phase de conclusion', 1, 'OHA'),
    makeStepNode('clot', 'La réunion de clôture', 'reunion-cloture', 'Phase de conclusion', 1, 'SEK'),
    makeStepNode('rf', 'Le rapport final', 'rapport-final', 'Phase de conclusion', 1, 'SEK'),
    ...(options?.concDocs || []).map((d) => makeSourceDoc(d, 'SEK')),
  ];

  return [
    {
      id: `${prefix}-${missionSlug}-prep`,
      label: 'Phase de préparation',
      nodeType: 'sous-section',
      natureId: 'ex-audit',
      missionPhase: 'Phase de préparation',
      children: wrapIfTeam('prep', prepNodes),
    },
    {
      id: `${prefix}-${missionSlug}-real`,
      label: 'Phase de réalisation',
      nodeType: 'sous-section',
      natureId: 'ex-audit',
      missionPhase: 'Phase de réalisation',
      children: wrapIfTeam('real', realNodes),
    },
    {
      id: `${prefix}-${missionSlug}-conc`,
      label: 'Phase de conclusion',
      nodeType: 'sous-section',
      natureId: 'ex-audit',
      missionPhase: 'Phase de conclusion',
      children: wrapIfTeam('conc', concNodes),
    },
  ];
}
