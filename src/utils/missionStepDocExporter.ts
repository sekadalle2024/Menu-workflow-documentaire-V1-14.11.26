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

export interface ExportMissionStepDocOptions {
  node: WorkflowTreeNode;
  tables: ParsedBaseTable[];
  session: Pick<ClientSessionConfig, 'client' | 'userSignature'>;
  themeId?: WorkflowThemeId;
}

export interface ExportMissionStepDocResult {
  filename: string;
  tableCount: number;
  html: string;
}

function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCellHtml(value: string): string {
  const clean = (value ?? '').trim();
  if (!clean) return '&#8212;';
  return escapeHtml(clean).replace(/\r?\n/g, '<br/>');
}

function computeColumnWidths(headers: string[], isRubriqueDescTable: boolean): string[] {
  if (isRubriqueDescTable && headers.length === 2) {
    return ['28%', '72%'];
  }
  const count = headers.length;
  if (count <= 0) return [];
  if (count === 1) return ['100%'];

  const firstNormalized = headers[0].trim().toLowerCase();
  const hasNarrowIndexCol =
    firstNormalized === 'no' ||
    firstNormalized === 'n°' ||
    firstNormalized === '#' ||
    firstNormalized === 'code';

  if (hasNarrowIndexCol && count >= 3) {
    const firstWidth = count >= 6 ? 6 : 8;
    const restWidth = Math.floor((100 - firstWidth) / (count - 1));
    const remainder = 100 - firstWidth - restWidth * (count - 1);
    return headers.map((_, idx) => {
      if (idx === 0) return `${firstWidth}%`;
      if (idx === count - 1) return `${restWidth + remainder}%`;
      return `${restWidth}%`;
    });
  }

  const base = Math.floor(100 / count);
  const rem = 100 - base * count;
  return headers.map((_, idx) => `${idx === count - 1 ? base + rem : base}%`);
}

/**
 * Génère un document Word (.doc) HTML/Office contenant uniquement les tables de l'étape,
 * espacées entre elles et fidèles à la charte graphique E-audit (#8B0000, #FFFFFF, #CBD5E1, #E2E8F0, ombres portées).
 */
export function buildMissionStepDocHtml({
  node,
  tables,
  session,
  themeId,
}: ExportMissionStepDocOptions): string {
  const theme = getWorkflowTheme(themeId ?? loadSavedWorkflowTheme());
  const headBg = theme.tableHeadBg;
  const headText = theme.tableHeadText;
  const headDivider = theme.tableHeadDivider;
  const normalizedTables = normalizeWorkflowBaseTables(tables);
  const formatPayload = buildFormatageDataForNode(node, session.client, '2026');
  const maxCols = normalizedTables.reduce(
    (max, tbl) => Math.max(max, tbl.headers.length),
    0
  );
  const isLandscape = maxCols >= 5;
  const pageSizeCss = isLandscape ? '29.7cm 21cm' : '21cm 29.7cm';

  const tableBlocks = normalizedTables.map((table) => {
    const headers = table.headers.length > 0 ? table.headers : ['Information'];
    const isRubriqueDescTable =
      headers.length === 2 &&
      headers[0].trim().toLowerCase() === 'rubrique' &&
      headers[1].trim().toLowerCase() === 'description';

    const colWidths = computeColumnWidths(headers, isRubriqueDescTable);

    const headerCells = headers
      .map((h, hIdx) => {
        const width = colWidths[hIdx] || 'auto';
        return `<th bgcolor="${headBg}" width="${width}" style="width:${width}; background-color:${headBg}; color:${headText}; font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:9.5pt; font-weight:700; text-align:left; vertical-align:middle; padding:8pt 10pt; border-top:1pt solid ${headDivider}; border-bottom:1.5pt solid ${headDivider}; border-left:1pt solid ${headDivider}; border-right:1pt solid ${headDivider};">${escapeHtml(h)}</th>`;
      })
      .join('');

    const rows = table.rows.length > 0 ? table.rows : [headers.map(() => '—')];

    const bodyRows = rows
      .map((row) => {
        const tds = headers
          .map((_, cIdx) => {
            const cellValue = row[cIdx] ?? '';
            const isRubriqueCol = isRubriqueDescTable && cIdx === 0;
            const isIndexCol =
              !isRubriqueDescTable &&
              cIdx === 0 &&
              (headers[0].trim().toLowerCase() === 'no' ||
                headers[0].trim().toLowerCase() === 'n°' ||
                headers[0].trim().toLowerCase() === '#');
            const color = isRubriqueCol
              ? '#334155'
              : isIndexCol
              ? '#475569'
              : '#1E293B';
            const fontWeight = isRubriqueCol ? '600' : '400';
            const width = colWidths[cIdx] || 'auto';
            return `<td bgcolor="#FFFFFF" width="${width}" style="width:${width}; background-color:#FFFFFF; color:${color}; font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:9pt; font-weight:${fontWeight}; line-height:1.45; text-align:left; vertical-align:top; padding:7pt 10pt; border:1pt solid #E2E8F0; mso-border-alt:solid #E2E8F0 .75pt;">${formatCellHtml(cellValue)}</td>`;
          })
          .join('');
        return `<tr bgcolor="#FFFFFF" style="background-color:#FFFFFF; page-break-inside:avoid;">${tds}</tr>`;
      })
      .join('');

    return `<div class="eaudit-table-card" style="background-color:#FFFFFF; border:1px solid #CBD5E1; border-right:2px solid #94A3B8; border-bottom:3px solid #94A3B8; border-radius:8px; box-shadow:0 6px 18px -3px rgba(15,23,42,0.22), 0 3px 8px -2px rgba(15,23,42,0.14); overflow:hidden; page-break-inside:avoid;">
  <table cellpadding="0" cellspacing="0" border="1" width="100%" style="width:100%; border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; background-color:#FFFFFF; border-color:#CBD5E1;">
    <thead>
      <tr bgcolor="${headBg}" style="background-color:${headBg}; color:${headText};">${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</div>`;
  });

  // Paragraphe séparateur explicite requis par Microsoft Word pour ne jamais coller ni fusionner deux <table> consécutives.
  const tableSpacerHtml =
    '<p class="eaudit-table-spacer" style="margin:0; padding:0; font-size:16pt; line-height:18pt; mso-line-height-rule:exactly; mso-margin-top-alt:6pt; mso-margin-bottom-alt:6pt;">&nbsp;</p>';

  const tablesHtml = tableBlocks.join(`\n${tableSpacerHtml}\n`);

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(node.label)} — ${escapeHtml(formatPayload.reference)}</title>
<!--[if gte mso 9]>
<xml>
  <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
</xml>
<![endif]-->
<style>
  @page Section1 {
    size: ${pageSizeCss};
    margin: 1.5cm 1.5cm 1.5cm 1.5cm;
    mso-header-margin: 0.8cm;
    mso-footer-margin: 0.8cm;
    mso-paper-source: 0;
  }
  div.Section1 {
    page: Section1;
  }
  body {
    margin: 0;
    padding: 16pt;
    background-color: #FFFFFF;
    color: #1E293B;
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 9.5pt;
  }
</style>
</head>
<body bgcolor="#FFFFFF">
<div class="Section1">
${tablesHtml}
</div>
</body>
</html>`;
}

export function exportMissionStepToDoc(
  options: ExportMissionStepDocOptions
): ExportMissionStepDocResult {
  const normalizedTables = normalizeWorkflowBaseTables(options.tables);
  const formatPayload = buildFormatageDataForNode(
    options.node,
    options.session.client,
    '2026'
  );
  const html = buildMissionStepDocHtml({
    ...options,
    tables: normalizedTables,
  });

  const datePart = new Date().toISOString().slice(0, 10);
  const labelPart = sanitizeFilenameSegment(options.node.label);
  const refPart = sanitizeFilenameSegment(formatPayload.reference);
  const filename = `${labelPart}_${refPart}_${datePart}.doc`;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
  downloadBlob(blob, filename);

  return {
    filename,
    tableCount: normalizedTables.length,
    html,
  };
}
