import * as XLSX from 'xlsx';
import type { ParsedBaseTable } from '../src/data/missionStepsFormatData';

export interface ExcelParseResult {
  tables: ParsedBaseTable[];
  parserEngine: string;
  detectedFormat: 'xlsx' | 'xls' | 'ods' | 'csv';
  warnings: string[];
}

function trimMatrixBlock(rawBlock: string[][]): string[][] {
  let maxCol = 0;
  for (const row of rawBlock) {
    for (let c = row.length - 1; c >= 0; c--) {
      if ((row[c] ?? '').trim().length > 0) {
        if (c + 1 > maxCol) maxCol = c + 1;
        break;
      }
    }
  }
  if (maxCol === 0) return [];
  return rawBlock.map((row) => {
    const out: string[] = [];
    for (let c = 0; c < maxCol; c++) {
      out.push((row[c] ?? '').trim());
    }
    return out;
  });
}

function finalizeExcelMatrixToTable(
  rawBlock: string[][],
  index: number,
  explicitTitle?: string
): ParsedBaseTable | null {
  const nonEmptyRows = trimMatrixBlock(rawBlock).filter((r) =>
    r.some((c) => c.length > 0)
  );
  if (nonEmptyRows.length === 0) return null;

  let workingRows = nonEmptyRows;
  let resolvedTitle = explicitTitle?.trim() || `table ${index + 1}`;

  // Si la première ligne du bloc ne contient qu'une seule cellule non vide juste au-dessus d'un tableau >= 2 colonnes,
  // la traiter comme titre de tableau (sauf si le tableau entier n'a qu'une colonne).
  if (workingRows.length >= 2) {
    const r0NonEmpty = workingRows[0].filter((c) => c.length > 0);
    const r1NonEmpty = workingRows[1].filter((c) => c.length > 0);
    if (r0NonEmpty.length === 1 && r1NonEmpty.length >= 2) {
      if (!explicitTitle) {
        resolvedTitle = r0NonEmpty[0];
      }
      workingRows = trimMatrixBlock(workingRows.slice(1)).filter((r) =>
        r.some((c) => c.length > 0)
      );
    }
  }

  if (workingRows.length === 0) return null;
  const maxCols = workingRows[0].length;
  if (maxCols === 0) return null;

  const id = `excel-import-tbl-${index + 1}-${Date.now().toString(36)}`;

  // Pour la première table à 2 colonnes sans ligne d'en-tête Rubrique/Description, promouvoir proprement
  if (index === 0 && maxCols === 2 && workingRows.length >= 2) {
    const c0 = workingRows[0][0].toLowerCase();
    const c1 = workingRows[0][1].toLowerCase();
    const isAlreadyRubriqueHeader =
      (c0 === 'rubrique' || c0 === 'champ' || c0 === 'élément' || c0 === 'element') &&
      (c1 === 'description' || c1 === 'valeur' || c1 === 'détail' || c1 === 'detail');

    const looksLikeKeyValueData =
      !isAlreadyRubriqueHeader &&
      (c0.includes('etape') ||
        c0.includes('étape') ||
        c0.includes('norme') ||
        c0.includes('méthode') ||
        c0.includes('methode') ||
        c0.includes('reference') ||
        c0.includes('référence') ||
        c0.includes('client') ||
        c0.includes('exercice') ||
        c0.includes('objectif'));

    if (looksLikeKeyValueData) {
      return {
        id,
        title: resolvedTitle,
        headers: ['Rubrique', 'Description'],
        rows: workingRows,
      };
    }
  }

  const headers = workingRows[0].map((h, ci) => h || `Colonne ${ci + 1}`);
  const dataRows = workingRows.slice(1);

  return {
    id,
    title: resolvedTitle,
    headers,
    rows: dataRows.length > 0 ? dataRows : [headers.map(() => '—')],
  };
}

function splitSheetRowsIntoBlocks(sheetRows: string[][]): string[][][] {
  const blocks: string[][][] = [];
  let current: string[][] = [];

  for (const row of sheetRows) {
    const hasContent = row.some((c) => c.trim().length > 0);
    if (hasContent) {
      current.push(row);
    } else if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    blocks.push(current);
  }
  return blocks;
}

export async function parseExcelFileToMissionTables(
  buffer: Buffer,
  fileName: string
): Promise<ExcelParseResult> {
  const lower = fileName.toLowerCase();
  const warnings: string[] = [];
  const detectedFormat: ExcelParseResult['detectedFormat'] = lower.endsWith('.xls')
    ? 'xls'
    : lower.endsWith('.ods')
    ? 'ods'
    : lower.endsWith('.csv')
    ? 'csv'
    : 'xlsx';

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  } catch (err) {
    throw new Error(
      `Impossible de lire le classeur Excel « ${fileName} » : ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const tables: ParsedBaseTable[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (tables.length >= 10) break;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const stringRows = rawRows.map((row) =>
      Array.isArray(row) ? row.map((cell) => String(cell ?? '').trim()) : []
    );

    const blocks = splitSheetRowsIntoBlocks(stringRows);
    for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
      if (tables.length >= 10) break;
      const defaultTitle =
        workbook.SheetNames.length > 1 && blocks.length === 1
          ? sheetName
          : undefined;
      const tbl = finalizeExcelMatrixToTable(
        blocks[bIdx],
        tables.length,
        defaultTitle
      );
      if (tbl) {
        tables.push(tbl);
      }
    }
  }

  if (tables.length === 0) {
    throw new Error(
      `Aucune table n'a pu être extraite du fichier Excel « ${fileName} ». Vérifiez que les feuilles contiennent des tableaux séparés par une ligne vide.`
    );
  }

  if (tables.length === 10) {
    warnings.push('Nombre maximal de 10 tables atteint pour l’import.');
  }

  return {
    tables: tables.slice(0, 10),
    parserEngine: `xlsx (SheetJS · ${workbook.SheetNames.length} feuille(s))`,
    detectedFormat,
    warnings,
  };
}
