import {
  buildFormatageDataForNode,
  normalizeWorkflowBaseTables,
  ParsedBaseTable,
} from '../data/missionStepsFormatData';
import type { MissionStepDocumentData } from '../types/missionStepDocument';
import { ClientSessionConfig, WorkflowTreeNode } from '../types/workflow';
import {
  downloadBlob,
  sanitizeFilenameSegment,
} from './etatExportEngine';
import { buildDefaultMissionStepReportDocument } from './missionStepDocumentModel';
import {
  getWorkflowTheme,
  loadSavedWorkflowTheme,
  WorkflowThemeId,
} from './workflowTheme';

export interface ExportMissionStepDocReportOptions {
  node: WorkflowTreeNode;
  tables: ParsedBaseTable[];
  document?: MissionStepDocumentData | null;
  session: Pick<ClientSessionConfig, 'client' | 'userSignature'>;
  themeId?: WorkflowThemeId;
}

export interface ExportMissionStepDocReportResult {
  filename: string;
  tableCount: number;
  blockCount: number;
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

function renderReportTableHtml(
  table: ParsedBaseTable,
  brandRed: string,
  brandDivider: string,
  tintColBg: string
): string {
  const headers = table.headers.length > 0 ? table.headers : ['Information'];
  const isRubriqueDescTable =
    headers.length === 2 &&
    headers[0].trim().toLowerCase() === 'rubrique' &&
    headers[1].trim().toLowerCase() === 'description';

  const colWidths = computeColumnWidths(headers, isRubriqueDescTable);

  const headerCells = headers
    .map((h, hIdx) => {
      const width = colWidths[hIdx] || 'auto';
      const align = isRubriqueDescTable ? 'center' : 'left';
      return `<th bgcolor="${brandRed}" width="${width}" style="width:${width}; background-color:${brandRed}; color:#FFFFFF; font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:9.5pt; font-weight:700; text-align:${align}; vertical-align:middle; padding:6pt 9pt; border:1pt solid ${brandDivider};">${escapeHtml(h)}</th>`;
    })
    .join('');

  const rows = table.rows.length > 0 ? table.rows : [headers.map(() => '—')];
  const bodyRows = rows
    .map((row) => {
      const tds = headers
        .map((_, cIdx) => {
          const cellValue = row[cIdx] ?? '';
          const isRubriqueCol = isRubriqueDescTable && cIdx === 0;
          const cellBg = isRubriqueCol ? tintColBg : '#FFFFFF';
          const fontWeight = isRubriqueCol ? '700' : '400';
          const color = isRubriqueCol ? '#1E293B' : '#1E293B';
          const width = colWidths[cIdx] || 'auto';
          return `<td bgcolor="${cellBg}" width="${width}" style="width:${width}; background-color:${cellBg}; color:${color}; font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:9.5pt; font-weight:${fontWeight}; line-height:1.4; text-align:left; vertical-align:top; padding:5.5pt 9pt; border:1pt solid #CBD5E1; mso-border-alt:solid #CBD5E1 .5pt;">${formatCellHtml(cellValue)}</td>`;
        })
        .join('');
      return `<tr style="page-break-inside:avoid;">${tds}</tr>`;
    })
    .join('');

  return `<table cellpadding="0" cellspacing="0" border="1" width="100%" style="width:100%; border-collapse:collapse; margin-top:6pt; margin-bottom:10pt; border-color:#CBD5E1;">
  <thead>
    <tr bgcolor="${brandRed}" style="background-color:${brandRed}; color:#FFFFFF;">${headerCells}</tr>
  </thead>
  <tbody>
    ${bodyRows}
  </tbody>
</table>
<p style="margin:0; padding:0; font-size:6pt; line-height:6pt;">&nbsp;</p>`;
}

/**
 * Construit un fichier Word (.doc) structuré en pages A4 normales avec marges, en-tête,
 * pied de page numéroté, titres rouges soulignés, sous-titres, paragraphes et tableaux E-audit.
 */
export function buildMissionStepDocReportHtml({
  node,
  tables,
  document: providedDocument,
  session,
  themeId,
}: ExportMissionStepDocReportOptions): string {
  const theme = getWorkflowTheme(themeId ?? loadSavedWorkflowTheme());
  // Le rapport conserve toujours le branding rouge/crimson sur blanc même si le thème UI est Blanc
  const brandRed = theme.isLight ? '#8B0000' : theme.tableHeadBg;
  const brandDivider = theme.isLight ? '#5C0A0A' : theme.tableHeadDivider;
  const tintColBg =
    theme.id === 'orange'
      ? '#FFF2E8'
      : theme.id === 'rose'
      ? '#FDF0F6'
      : theme.id === 'marron'
      ? '#F6EFEA'
      : '#F5E6EA';

  const normalizedTables = normalizeWorkflowBaseTables(tables);
  const reportDoc =
    providedDocument && providedDocument.blocks.length > 0
      ? providedDocument
      : buildDefaultMissionStepReportDocument(node, normalizedTables, session.client);

  const tableById = new Map<string, ParsedBaseTable>();
  normalizedTables.forEach((t) => tableById.set(t.id, t));

  const formatPayload = buildFormatageDataForNode(node, session.client, '2026');
  const maxCols = normalizedTables.reduce(
    (max, tbl) => Math.max(max, tbl.headers.length),
    0
  );
  const pageSizeCss = maxCols >= 7 ? '29.7cm 21cm' : '21cm 29.7cm';

  const renderedBlocks = reportDoc.blocks
    .map((block) => {
      if (block.type === 'page-break') {
        return '<p style="page-break-before:always; margin:0; padding:0; font-size:1pt; line-height:1pt;">&nbsp;</p>';
      }
      if (block.type === 'heading') {
        if (block.level === 1) {
          return `<h1 style="font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:15pt; font-weight:700; color:${brandRed}; margin:14pt 0 10pt 0; padding-bottom:4pt; border-bottom:1.5pt solid ${brandRed}; page-break-after:avoid;">${escapeHtml(block.text)}</h1>`;
        }
        if (block.level === 2) {
          return `<h2 style="font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:12pt; font-weight:700; color:#1E293B; margin:12pt 0 6pt 0; page-break-after:avoid;">${escapeHtml(block.text)}</h2>`;
        }
        return `<h3 style="font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:10.5pt; font-weight:700; color:${brandRed}; margin:9pt 0 4pt 0; page-break-after:avoid;">${escapeHtml(block.text)}</h3>`;
      }
      if (block.type === 'paragraph') {
        if (block.listType === 'bullet') {
          return `<p style="font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:10pt; color:#1E293B; line-height:1.45; margin:0 0 5pt 18pt; text-indent:-10pt;">&#8226;&nbsp; ${escapeHtml(block.text)}</p>`;
        }
        return `<p style="font-family:'Calibri','Segoe UI',Arial,sans-serif; font-size:10pt; color:#1E293B; line-height:1.48; margin:0 0 7pt 0; text-align:justify;">${escapeHtml(block.text)}</p>`;
      }
      if (block.type === 'table') {
        const tbl =
          tableById.get(block.tableId) ??
          (typeof block.tableIndex === 'number'
            ? normalizedTables[block.tableIndex]
            : undefined);
        if (!tbl) return '';
        return renderReportTableHtml(tbl, brandRed, brandDivider, tintColBg);
      }
      return '';
    })
    .join('\n');

  const safeHeaderText = escapeHtml(
    reportDoc.headerText || `Logiciel E-audit Pro – ${node.label}`
  );
  const safeFooterText = escapeHtml(
    reportDoc.footerText ||
      `Automatisez vos activités d'audit, risques et contrôles · ${session.client}`
  );

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(node.label)} — Rapport ${escapeHtml(formatPayload.reference)}</title>
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
    margin: 2.2cm 2cm 2.2cm 2cm;
    mso-header-margin: 1cm;
    mso-footer-margin: 1cm;
    mso-header: h1;
    mso-footer: f1;
    mso-paper-source: 0;
  }
  div.Section1 {
    page: Section1;
  }
  p.MsoHeader, div.MsoHeader {
    margin: 0;
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 8.5pt;
    color: #9B3B4E;
  }
  p.MsoFooter, div.MsoFooter {
    margin: 0;
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 8.5pt;
    color: #94A3B8;
    text-align: center;
  }
  body {
    margin: 0;
    padding: 0;
    background-color: #FFFFFF;
    color: #1E293B;
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
  }
</style>
</head>
<body bgcolor="#FFFFFF">
<div class="Section1">
${renderedBlocks}
</div>

<div style="mso-element:header" id="h1">
  <p class="MsoHeader" style="border-bottom:1pt solid ${brandRed}; padding-bottom:3pt; color:${brandRed}; font-size:8.5pt;">
    ${safeHeaderText}
  </p>
</div>

<div style="mso-element:footer" id="f1">
  <p class="MsoFooter" style="font-size:8.5pt; color:#94A3B8; text-align:center;">
    ${safeFooterText} &#8212; Page <span style="mso-field-code:'PAGE'">1</span> / <span style="mso-field-code:'NUMPAGES'">1</span>
  </p>
</div>
</body>
</html>`;
}

export function exportMissionStepReportToDoc(
  options: ExportMissionStepDocReportOptions
): ExportMissionStepDocReportResult {
  const normalizedTables = normalizeWorkflowBaseTables(options.tables);
  const formatPayload = buildFormatageDataForNode(
    options.node,
    options.session.client,
    '2026'
  );
  const html = buildMissionStepDocReportHtml({
    ...options,
    tables: normalizedTables,
  });

  const datePart = new Date().toISOString().slice(0, 10);
  const labelPart = sanitizeFilenameSegment(options.node.label);
  const refPart = sanitizeFilenameSegment(formatPayload.reference);
  const filename = `${labelPart}_Rapport_${refPart}_${datePart}.doc`;

  const blob = new Blob(['\ufeff', html], {
    type: 'application/msword;charset=utf-8',
  });
  downloadBlob(blob, filename);

  return {
    filename,
    tableCount: normalizedTables.length,
    blockCount: options.document?.blocks.length ?? normalizedTables.length,
    html,
  };
}
