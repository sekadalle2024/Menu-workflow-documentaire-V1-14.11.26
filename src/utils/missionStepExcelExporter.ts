import ExcelJS from 'exceljs';
import {
  buildFormatageDataForNode,
  normalizeWorkflowBaseTables,
  ParsedBaseTable,
} from '../data/missionStepsFormatData';
import { ClientSessionConfig, WorkflowTreeNode } from '../types/workflow';
import {
  downloadBlob,
  sanitizeFilenameSegment,
} from './etatExportEngine';
import {
  getWorkflowTheme,
  loadSavedWorkflowTheme,
  WorkflowThemeId,
} from './workflowTheme';

export interface ExportMissionStepExcelOptions {
  node: WorkflowTreeNode;
  tables: ParsedBaseTable[];
  session: Pick<ClientSessionConfig, 'client' | 'userSignature'>;
  themeId?: WorkflowThemeId;
}

export interface ExportMissionStepExcelResult {
  filename: string;
  tableCount: number;
  byteLength: number;
}

function toArgb(hex: string, fallback = 'FF8B0000'): string {
  const clean = (hex || '').replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `FF${clean.toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{8}$/.test(clean)) {
    return clean.toUpperCase();
  }
  return fallback;
}

function sanitizeWorksheetName(raw: string): string {
  const cleaned = (raw || 'Etape Mission')
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Etape Mission').slice(0, 31);
}

/**
 * Construit le classeur Excel (.xlsx) contenant uniquement les tables de l'étape,
 * séparées par une ligne vide et stylisées selon le thème workflow actif.
 */
export async function buildMissionStepExcelBuffer({
  node,
  tables,
  themeId,
}: ExportMissionStepExcelOptions): Promise<{
  buffer: Uint8Array;
  tableCount: number;
}> {
  const theme = getWorkflowTheme(themeId ?? loadSavedWorkflowTheme());
  const headBgArgb = toArgb(theme.tableHeadBg, 'FF8B0000');
  const headTextArgb = toArgb(theme.tableHeadText, 'FFFFFFFF');
  const headDividerArgb = toArgb(theme.tableHeadDivider, 'FF5C0A0A');

  const normalizedTables = normalizeWorkflowBaseTables(tables);
  const maxCols = normalizedTables.reduce(
    (max, tbl) => Math.max(max, tbl.headers.length),
    1
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'E-audit Pro';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sanitizeWorksheetName(node.label), {
    views: [{ showGridLines: true }],
    pageSetup: {
      paperSize: 9,
      orientation: maxCols >= 5 ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });

  const colWidths = Array.from({ length: maxCols }, () => 18);
  let currentRowIdx = 1;

  normalizedTables.forEach((table, tIdx) => {
    const headers = table.headers.length > 0 ? table.headers : ['Information'];
    const isRubriqueDescTable =
      headers.length === 2 &&
      headers[0].trim().toLowerCase() === 'rubrique' &&
      headers[1].trim().toLowerCase() === 'description';

    // Ligne d'en-tête aux couleurs du thème actif
    const headerRow = worksheet.getRow(currentRowIdx);
    headerRow.height = 24;
    headers.forEach((h, cIdx) => {
      const cell = headerRow.getCell(cIdx + 1);
      cell.value = h;
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: headTextArgb },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: headBgArgb },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: headDividerArgb } },
        bottom: { style: 'medium', color: { argb: headDividerArgb } },
        left: { style: 'thin', color: { argb: headDividerArgb } },
        right: { style: 'thin', color: { argb: headDividerArgb } },
      };
      colWidths[cIdx] = Math.max(
        colWidths[cIdx] ?? 18,
        Math.min(46, Math.max(12, h.length + 4))
      );
    });
    currentRowIdx += 1;

    const bodyRows = table.rows.length > 0 ? table.rows : [headers.map(() => '—')];
    for (const row of bodyRows) {
      const excelRow = worksheet.getRow(currentRowIdx);
      let maxLines = 1;

      headers.forEach((_, cIdx) => {
        const val = (row[cIdx] ?? '').trim() || '—';
        const isRubriqueCol = isRubriqueDescTable && cIdx === 0;
        const isIndexCol =
          !isRubriqueDescTable &&
          cIdx === 0 &&
          ['no', 'n°', '#', 'code'].includes(headers[0].trim().toLowerCase());

        const cell = excelRow.getCell(cIdx + 1);
        cell.value = val;
        cell.font = {
          name: 'Calibri',
          size: 9.5,
          bold: isRubriqueCol,
          color: {
            argb: isRubriqueCol
              ? 'FF334155'
              : isIndexCol
              ? 'FF475569'
              : 'FF1E293B',
          },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' },
        };
        cell.alignment = {
          vertical: 'top',
          horizontal: 'left',
          wrapText: true,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        const suggestedWidth = isIndexCol
          ? 10
          : isRubriqueCol
          ? 28
          : Math.min(48, Math.max(16, val.length + 3));
        colWidths[cIdx] = Math.max(colWidths[cIdx] ?? 16, suggestedWidth);

        const wrappedLines = Math.max(
          val.split(/\r?\n/).length,
          Math.ceil(val.length / Math.max(20, colWidths[cIdx]))
        );
        if (wrappedLines > maxLines) maxLines = wrappedLines;
      });

      excelRow.height = Math.max(20, Math.min(110, maxLines * 14 + 6));
      currentRowIdx += 1;
    }

    // Espace explicite entre les tables (ligne vierge séparatrice)
    if (tIdx < normalizedTables.length - 1) {
      const spacerRow = worksheet.getRow(currentRowIdx);
      spacerRow.height = 14;
      currentRowIdx += 1;
    }
  });

  colWidths.forEach((width, idx) => {
    worksheet.getColumn(idx + 1).width = width;
  });

  const rawBuffer = await workbook.xlsx.writeBuffer();
  const bytes =
    rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer);

  return {
    buffer: bytes,
    tableCount: normalizedTables.length,
  };
}

export async function exportMissionStepToExcel(
  options: ExportMissionStepExcelOptions
): Promise<ExportMissionStepExcelResult> {
  const formatPayload = buildFormatageDataForNode(
    options.node,
    options.session.client,
    '2026'
  );
  const { buffer, tableCount } = await buildMissionStepExcelBuffer(options);

  const datePart = new Date().toISOString().slice(0, 10);
  const labelPart = sanitizeFilenameSegment(options.node.label);
  const refPart = sanitizeFilenameSegment(formatPayload.reference);
  const filename = `${labelPart}_${refPart}_${datePart}.xlsx`;

  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, filename);

  return {
    filename,
    tableCount,
    byteLength: buffer.byteLength,
  };
}
