import type { Reco, Risque, Statut } from './types';

const RAW = `Absence de note de cadrage|C|R|0|31/03|
Arrêté de caisse sans visa superviseur|J|R|1|15/04|
Excédents de caisse non comptabilisés|O|A|2|30/05|
Dépassement du plafond d’encaisse|C|P|2|30/04|30/06
Dépenses de caisse sans justificatifs|C|N|2|15/05|
Suspens anciens du compte 581|J|A|2|31/05|
Retards des rapprochements bancaires|J|R|2|31/03|
Accès au coffre-fort non séparés|C|R|2|28/02|
Chèques non endossés et remis hors délai|J|P|2|30/06|30/09
Fractionnement de commandes|C|N|3|30/04|
Réception sans bon de réception signé|J|R|3|31/03|
Doublons dans la base fournisseurs|J|A|3|15/05|
Mentions fiscales des factures non contrôlées|J|R|2|31/03|
Doubles paiements sur factures proforma|C|R|2|28/02|
Avances fournisseurs anciennes (4091)|J|N|2|30/04|
Contrats de sous-traitance sans mise en concurrence|O|P|3|31/05|30/08
Retenue à la source omise (non-résidents)|C|R|2|31/03|
Factures non parvenues sous-évaluées|J|R|2|30/04|
Expéditions non facturées et ruptures de BL|C|A|4|30/05|
Livraisons au-delà des plafonds de crédit|C|R|4|31/03|
Avoirs commerciaux sans validation|C|N|4|15/04|
Créances anciennes non provisionnées|J|R|2|31/03|
Remises exceptionnelles non encadrées|J|P|4|30/04|30/06
Ventes comptabilisées avant transfert de propriété|J|R|2|28/02|
Écart entre encaissements caisse et ventes|C|A|2|15/05|
Lettrage insuffisant du compte 411|O|R|2|31/03|
Absence de circularisation des grands comptes|O|N|2|30/04|
Salaires maintenus après départ|C|R|5|31/03|
Virement de paie sans contrôle indépendant|C|R|5|28/02|
Heures supplémentaires sans pointage|J|P|5|30/04|31/07
Dossiers du personnel incomplets|O|A|5|31/05|
Avances au personnel non récupérées|O|R|5|31/03|
Erreurs d’assiette ITS et CNPS|J|N|5|30/04|
Rapprochement paie / comptabilité absent|J|A|2|15/05|
Congés payés non provisionnés|O|R|5|28/02|
Salaires journaliers payés en espèces|C|A|5|30/05|
Pas d’inventaire physique des immobilisations|J|R|6|31/03|
Cessions et rebuts non sortis du bilan|J|R|2|28/02|
Approche par composants non appliquée|O|P|11|30/04|31/07
Charges d’entretien immobilisées à tort|J|N|2|15/04|
Immobilisations en cours dormantes|C|A|2|15/05|
Actifs critiques sans couverture d’assurance|C|R|6|28/02|
Titres fonciers non sécurisés|J|R|7|31/03|
Écart fichier immobilisations / balance|O|R|2|31/03|
Dépassement du budget d’investissement|J|N|2|30/04|
Écarts à l’inventaire physique des stocks|C|A|3|30/05|
Accès libre aux entrepôts|J|R|3|31/03|
Stocks obsolètes non dépréciés|J|P|3|30/04|31/07
Erreur de valorisation des stocks (CUMP)|C|R|2|31/03|
Sorties internes de stock non documentées|J|N|3|15/04|
Inventaire sans séparation des tâches|J|A|2|31/05|
Stock en transit non justifié (38)|C|R|2|28/02|
Pas de contrôle qualité à la réception|J|R|11|31/03|
Ruptures sur pièces de rechange critiques|J|A|11|15/05|
Soldes non justifiés du compte 471|C|A|2|15/05|
Opérations diverses sans justificatif|C|R|2|31/03|
Écarts entre déclarations TVA et chiffre d’affaires|C|R|2|31/03|
Manuel de procédures obsolète|J|N|2|30/04|
Retard dans l’arrêté des comptes mensuels|O|A|2|31/05|
Charges constatées d’avance non rattachées|O|R|2|28/02|
Dettes fiscales (44) non justifiées|J|R|2|31/03|
Notes annexes SYSCOHADA incomplètes|J|P|2|30/04|30/05
Archives comptables non sécurisées|J|N|2|15/04|
Crédits octroyés sans dossier complet|C|A|10|15/05|
Garanties hypothécaires non inscrites|C|A|10|31/05|
Créances impayées non déclassées (BCEAO)|C|R|9|31/03|
Levée de blocage irrégulière de comptes dormants|C|R|12|28/02|
Concentration excessive sur un groupe|C|P|9|30/04|31/07
Expertises de garanties obsolètes|J|A|9|30/06|
Forçages manuels de découverts|J|N|1|15/04|
Suivi post-financement des crédits PME|O|A|4|31/05|
Dossiers contentieux sans rapprochement|J|R|7|31/03|
Droits incompatibles dans l’ERP (SoD)|C|R|8|28/02|
Comptes d’anciens employés actifs|C|P|8|30/04|30/06
Pas de test de restauration des sauvegardes|C|R|8|31/03|
Mots de passe faibles et comptes partagés|C|A|8|15/05|
Journalisation ERP désactivée|C|N|8|15/04|
Accès physique à la salle serveurs|J|R|8|31/03|
Gestion des changements IT non formalisée|J|A|8|31/05|
Licences logicielles non conformes|O|A|8|15/05|
Plan de continuité d’activité absent|C|P|8|30/05|30/09
Vigilance LBC-FT et KYC défaillante|C|R|13|31/03|
Plan d’audit sans cartographie des risques|C|R|0|28/02|
Surveillance permanente non structurée|J|A|14|30/05|
Délégations de signatures bancaires obsolètes|C|R|2|28/02|
Suivi des recommandations d’audit absent|J|R|0|31/03|
Coordination Audit / Contrôle permanent|J|R|0|31/03|
Litiges majeurs non provisionnés|J|N|7|15/04|
Non-conformité ARTCI (données personnelles)|O|P|7|30/04|30/07
Pas de dispositif d’alerte éthique|J|A|0|30/06|`;

function toIsoDate(ddMm: string, year = 2025): string {
  const [dayStr, monthStr] = ddMm.split('/');
  const day = dayStr.padStart(2, '0');
  const month = monthStr.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const RECOS_DEMO: Reco[] = RAW.split('\n').map((line, index) => {
  const [titre, risqueRaw, statutRaw, dirRaw, echeanceRaw, reportRaw] =
    line.split('|');
  const reportTrimmed = (reportRaw ?? '').trim();

  return {
    n: index + 1,
    titre,
    risque: risqueRaw as Risque,
    statut: statutRaw as Statut,
    direction: Number(dirRaw),
    cycle: Math.floor(index / 9),
    echeance: toIsoDate(echeanceRaw),
    ...(reportTrimmed ? { report: toIsoDate(reportTrimmed) } : {}),
  };
});
