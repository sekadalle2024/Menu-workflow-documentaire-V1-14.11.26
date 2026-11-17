import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable, { RowInput, Styles } from 'jspdf-autotable';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {
  AuditPlanMissionMeta,
  RecoSourceMetadata,
} from '../types/workflow';
import { LiveAuditPlanMission } from '../data/auditPlanWorkflowData';
import { LiveSuiviRecoEntry } from '../data/suiviRecosSimulation';

export type ExportActivityType =
  | 'suivi-recos'
  | 'plan-audit'
  | 'document'
  | 'etape-mission';
export type ExportFormatKind = 'table' | 'dashboard' | 'docx' | 'pdf';

export interface ExportColumnDef<RowT> {
  key: string;
  label: string;
  width?: number;
  align?: 'left' | 'right' | 'center';
  isDefaultKey?: boolean;
  getValue: (row: RowT) => string | number;
}

export interface PdfKpiBox {
  label: string;
  value: string;
  sublabel?: string;
  accentHex?: string;
}

export interface PdfBarItem {
  label: string;
  value: number;
  displayValue: string;
  pct: number;
  colorHex?: string;
}

export interface PdfTableBlock {
  headers: string[];
  colWeights: number[];
  alignments?: Array<'left' | 'right' | 'center'>;
  rows: string[][];
}

export type PdfSectionBlock =
  | {
      kind: 'kpis';
      id: string;
      title: string;
      subtitle?: string;
      items: PdfKpiBox[];
    }
  | {
      kind: 'bars';
      id: string;
      title: string;
      subtitle?: string;
      items: PdfBarItem[];
    }
  | {
      kind: 'table';
      id: string;
      title: string;
      subtitle?: string;
      table: PdfTableBlock;
    };

export interface PdfDashboardExportPayload {
  filename: string;
  title: string;
  subtitle: string;
  filterLines: string[];
  signature: string;
  client: string;
  orientation?: 'landscape' | 'portrait';
  sections: PdfSectionBlock[];
}

export function inferCycleForReco(record: RecoSourceMetadata): string {
  const ref = (record.refRecos || '').toUpperCase();
  const mission = (record.mission || '').toLowerCase();
  const proc = (record.processus || '').toLowerCase();

  if (ref.includes('-TRE-') || mission.includes('trésorerie') || mission.includes('caisse')) {
    return 'Trésorerie, Caisse & Banques';
  }
  if (ref.includes('-ACH-') || mission.includes('achats') || mission.includes('marchés')) {
    return 'Achats, Marchés & Fournisseurs';
  }
  if (ref.includes('-REV-') || ref.includes('-VNT-') || mission.includes('revenus') || mission.includes('ventes')) {
    return 'Revenus, Ventes & Facturation';
  }
  if (ref.includes('-PAIE-') || ref.includes('-RH-') || mission.includes('paie') || mission.includes('social')) {
    return 'Paie & Conformité Sociale';
  }
  if (ref.includes('-STK-') || ref.includes('-IMM-') || mission.includes('stocks') || mission.includes('immobilisation')) {
    return 'Stocks & Immobilisations';
  }
  if (ref.includes('-CPT-') || ref.includes('-FISC-') || mission.includes('comptable') || mission.includes('fiscale')) {
    return 'Comptabilité & Clôture Fiscale';
  }
  if (ref.includes('-CRD-') || ref.includes('-ENG-') || mission.includes('crédits') || mission.includes('engagements')) {
    return 'Crédits & Engagements';
  }
  if (ref.includes('-SI-') || mission.includes('système') || mission.includes('cyber') || proc.includes('informat')) {
    return 'Systèmes d’Information & Cyber';
  }
  if (ref.includes('-CONF-') || ref.includes('-GOV-') || mission.includes('conformité') || mission.includes('gouvernance')) {
    return 'Conformité & Gouvernance';
  }
  return record.processus || 'Autre cycle';
}

export function inferCycleForPlanMission(
  meta: AuditPlanMissionMeta,
  label: string
): string {
  const hay = `${meta.direction} ${label} ${meta.perimetre}`.toLowerCase();

  if (hay.includes('maintenance') || hay.includes('énerg') || hay.includes('gmao')) {
    return 'Maintenance & Énergie';
  }
  if (hay.includes('supply chain') || hay.includes('stocks') || hay.includes('wms') || hay.includes('douanes') || hay.includes('logistique')) {
    return 'Stocks, Supply Chain & Douanes';
  }
  if (hay.includes('qualité') || hay.includes('hse') || hay.includes('environnement') || hay.includes('production') || hay.includes('mrp')) {
    return 'Production, Qualité & HSE';
  }
  if (hay.includes('achats') || hay.includes('capex') || hay.includes('sous-traitance')) {
    return 'Achats Industriels & CAPEX';
  }
  if (hay.includes('cyber') || hay.includes('scada') || hay.includes('systèmes d’information') || hay.includes('ot /')) {
    return 'SI Industriels & Cybersécurité OT';
  }
  if (hay.includes('financi') || hay.includes('trésorerie') || hay.includes('commerciale') || hay.includes('ventes')) {
    return 'Finance, Ventes & Trésorerie';
  }
  if (hay.includes('ressources humaines') || hay.includes('paie')) {
    return 'Ressources Humaines & Paie';
  }
  if (hay.includes('continuité') || hay.includes('pca') || hay.includes('assurances') || hay.includes('générale')) {
    return 'Gouvernance & Continuité (PCA)';
  }
  return meta.secteur || 'Cycle Industriel';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sanitizeFilenameSegment(raw: string): string {
  return (
    raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'export'
  );
}

// ---------- EXPORT EXCEL (.xlsx) VIA SHEETJS (xlsx) ----------

export interface ExcelTableExportInput {
  filename: string;
  sheetName: string;
  title: string;
  headers: string[];
  rows: Array<Array<string | number>>;
  preferredWidths?: number[];
  metadataPairs: Array<[string, string | number]>;
}

export async function exportTableToExcelXlsx(
  input: ExcelTableExportInput
): Promise<void> {
  const wb = XLSX.utils.book_new();
  const safeSheetName =
    input.sheetName.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Donnees';

  const sanitizedRows = input.rows.map((row) =>
    row.map((val) => {
      if (typeof val === 'number') return Number.isFinite(val) ? val : '';
      return val ?? '';
    })
  );

  const dataAoa: Array<Array<string | number>> = [input.headers, ...sanitizedRows];
  const dataWs = XLSX.utils.aoa_to_sheet(dataAoa);

  const computedWidths = input.headers.map((header, colIdx) => {
    const pref = input.preferredWidths?.[colIdx] ?? 16;
    const maxCell = sanitizedRows.reduce((max, row) => {
      const len = String(row[colIdx] ?? '').length;
      return Math.min(48, Math.max(max, len + 3));
    }, Math.max(pref, header.length + 4));
    return Math.min(54, Math.max(10, maxCell));
  });

  dataWs['!cols'] = computedWidths.map((wch) => ({ wch }));
  dataWs['!rows'] = [
    { hpt: 24 },
    ...sanitizedRows.map(() => ({ hpt: 20 })),
  ];
  if (input.headers.length > 0) {
    dataWs['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: {
          r: Math.max(0, sanitizedRows.length),
          c: Math.max(0, input.headers.length - 1),
        },
      }),
    };
  }

  XLSX.utils.book_append_sheet(wb, dataWs, safeSheetName);

  const metaAoa: Array<Array<string | number>> = [
    ['Paramètre / Information', 'Valeur appliquée'],
    ['État exporté', input.title],
    ['Nombre de lignes exportées', sanitizedRows.length],
    ['Nombre de colonnes exportées', input.headers.length],
    ...input.metadataPairs,
  ];
  const metaWs = XLSX.utils.aoa_to_sheet(metaAoa);
  metaWs['!cols'] = [{ wch: 34 }, { wch: 64 }];
  metaWs['!rows'] = [{ hpt: 24 }, ...metaAoa.slice(1).map(() => ({ hpt: 20 }))];
  XLSX.utils.book_append_sheet(wb, metaWs, 'Parametres');

  const arrayBuffer = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  }) as ArrayBuffer;

  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  downloadBlob(
    blob,
    input.filename.endsWith('.xlsx') ? input.filename : `${input.filename}.xlsx`
  );
}

// ---------- EXPORT DASHBOARD PDF (.pdf) VIA jsPDF + jspdf-autotable ----------

function normalizePdfText(text: string): string {
  return (text || '')
    .replace(/\r?\n/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2192/g, '->')
    .replace(/\u2026/g, '...')
    .replace(/\u0153/g, 'oe')
    .replace(/\u0152/g, 'OE')
    .replace(/\u20AC/g, 'EUR')
    .replace(/[\u202f\u00a0]/g, ' ');
}

function hexToRgbTuple(hex?: string): [number, number, number] {
  const clean = (hex || '#0F172A').replace('#', '');
  if (clean.length !== 6) return [15, 23, 42];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [
    Number.isFinite(r) ? r : 15,
    Number.isFinite(g) ? g : 23,
    Number.isFinite(b) ? b : 42,
  ];
}

function clipTextToWidth(doc: jsPDF, text: string, maxWidthPt: number): string {
  const clean = normalizePdfText(text);
  if (maxWidthPt <= 8) return '';
  if (doc.getTextWidth(clean) <= maxWidthPt) return clean;
  let lo = 0;
  let hi = clean.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${clean.slice(0, mid)}...`;
    if (doc.getTextWidth(candidate) <= maxWidthPt) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo <= 0 ? clean.slice(0, 1) : `${clean.slice(0, lo)}...`;
}

export function exportDashboardToPdf(payload: PdfDashboardExportPayload): void {
  const isLandscape = (payload.orientation ?? 'landscape') === 'landscape';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 32;
  const marginTop = 28;
  const marginBottom = 34;
  const contentW = pageW - marginX * 2;
  let cursorY = marginTop;

  const headerDrawnPages = new Set<number>([1]);

  const drawContinuationHeader = (pageNumber: number) => {
    if (headerDrawnPages.has(pageNumber)) return;
    headerDrawnPages.add(pageNumber);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.rect(marginX, marginTop, contentW, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      clipTextToWidth(doc, payload.title, contentW * 0.58),
      marginX + 10,
      marginTop + 15.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(71, 85, 105);
    const sub = clipTextToWidth(doc, payload.subtitle, contentW * 0.36);
    doc.text(sub, pageW - marginX - 10, marginTop + 15.5, { align: 'right' });
  };

  const startNewPage = () => {
    doc.addPage();
    const pageNum = doc.getNumberOfPages();
    drawContinuationHeader(pageNum);
    cursorY = marginTop + 34;
  };

  const ensureSpace = (neededPt: number) => {
    if (cursorY + neededPt > pageH - marginBottom) {
      startNewPage();
    }
  };

  // En-tête de page 1 (Bannière exécutive)
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, cursorY, contentW, 46, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(255, 255, 255);
  doc.text(
    clipTextToWidth(doc, payload.title, contentW - 185),
    marginX + 14,
    cursorY + 20
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    clipTextToWidth(doc, payload.subtitle, contentW - 185),
    marginX + 14,
    cursorY + 35
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(250, 204, 21);
  doc.text(
    clipTextToWidth(doc, `${payload.client} · ${payload.signature}`, 160),
    pageW - marginX - 14,
    cursorY + 20,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(203, 213, 225);
  doc.text(
    new Date().toLocaleDateString('fr-FR'),
    pageW - marginX - 14,
    cursorY + 35,
    { align: 'right' }
  );

  cursorY += 52;

  if (payload.filterLines.length > 0) {
    const filterBarH = 18 + payload.filterLines.length * 12;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.rect(marginX, cursorY, contentW, filterBarH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(15, 23, 42);
    doc.text('Périmètre & Paramètres appliqués :', marginX + 10, cursorY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    payload.filterLines.forEach((line, idx) => {
      doc.text(
        clipTextToWidth(doc, line, contentW - 20),
        marginX + 10,
        cursorY + 25.5 + idx * 12
      );
    });
    cursorY += filterBarH + 10;
  } else {
    cursorY += 6;
  }

  for (const section of payload.sections) {
    if (section.kind === 'kpis') {
      const cols = Math.min(5, Math.max(1, section.items.length));
      const rowsNeeded = Math.ceil(section.items.length / cols);
      const blockH = 24 + rowsNeeded * 54;
      ensureSpace(blockH);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(normalizePdfText(section.title), marginX, cursorY + 11);

      if (section.subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(100, 116, 139);
        doc.text(
          normalizePdfText(section.subtitle),
          pageW - marginX,
          cursorY + 11,
          { align: 'right' }
        );
      }
      cursorY += 18;

      const gap = 8;
      const cardW = (contentW - gap * (cols - 1)) / cols;
      section.items.forEach((item, idx) => {
        const colIdx = idx % cols;
        const rowIdx = Math.floor(idx / cols);
        const cx = marginX + colIdx * (cardW + gap);
        const cy = cursorY + rowIdx * 54;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.6);
        doc.rect(cx, cy, cardW, 48, 'FD');

        const [ar, ag, ab] = hexToRgbTuple(item.accentHex || '#0284C7');
        doc.setFillColor(ar, ag, ab);
        doc.rect(cx, cy, cardW, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(71, 85, 105);
        doc.text(clipTextToWidth(doc, item.label, cardW - 14), cx + 8, cy + 15);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13.5);
        doc.setTextColor(15, 23, 42);
        doc.text(clipTextToWidth(doc, item.value, cardW - 14), cx + 8, cy + 31);

        if (item.sublabel) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.2);
          doc.setTextColor(100, 116, 139);
          doc.text(clipTextToWidth(doc, item.sublabel, cardW - 14), cx + 8, cy + 42.5);
        }
      });

      cursorY += rowsNeeded * 54 + 8;
    } else if (section.kind === 'bars') {
      const visibleItems = section.items.slice(0, 16);
      const barRowH = 18;
      const boxH = 30 + Math.max(1, visibleItems.length) * barRowH + 8;
      ensureSpace(boxH);

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.6);
      doc.rect(marginX, cursorY, contentW, boxH, 'FD');

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(marginX, cursorY, contentW, 24, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.8);
      doc.setTextColor(15, 23, 42);
      doc.text(
        clipTextToWidth(doc, section.title, contentW * 0.65),
        marginX + 10,
        cursorY + 15.5
      );

      if (section.subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          clipTextToWidth(doc, section.subtitle, contentW * 0.3),
          pageW - marginX - 10,
          cursorY + 15.5,
          { align: 'right' }
        );
      }

      const labelW = Math.min(230, contentW * 0.34);
      const valW = 96;
      const trackX = marginX + 10 + labelW + 8;
      const trackW = contentW - labelW - valW - 32;

      if (visibleItems.length === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        doc.text(
          'Aucune donnée correspondant aux paramètres sélectionnés.',
          marginX + 12,
          cursorY + 42
        );
      } else {
        visibleItems.forEach((b, idx) => {
          const ry = cursorY + 32 + idx * barRowH;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.2);
          doc.setTextColor(30, 41, 59);
          doc.text(clipTextToWidth(doc, b.label, labelW), marginX + 10, ry + 9.5);

          doc.setFillColor(241, 245, 249);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.4);
          doc.rect(trackX, ry + 2, trackW, 9, 'FD');

          const fillW = Math.max(2, (Math.min(100, Math.max(0, b.pct)) / 100) * trackW);
          const [fr, fg, fb] = hexToRgbTuple(b.colorHex || '#0284C7');
          doc.setFillColor(fr, fg, fb);
          doc.rect(trackX, ry + 2, fillW, 9, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.1);
          doc.setTextColor(15, 23, 42);
          doc.text(
            clipTextToWidth(doc, b.displayValue, valW),
            pageW - marginX - 10,
            ry + 9.5,
            { align: 'right' }
          );
        });
      }

      cursorY += boxH + 10;
    } else if (section.kind === 'table') {
      const { headers, colWeights, alignments, rows } = section.table;
      ensureSpace(70);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.6);
      doc.rect(marginX, cursorY, contentW, 22, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        clipTextToWidth(doc, section.title, contentW - 16),
        marginX + 8,
        cursorY + 14.5
      );
      cursorY += 22;

      const totalWeight = colWeights.reduce((s, w) => s + w, 0) || 1;
      const columnStyles: Record<number, Partial<Styles>> = {};
      headers.forEach((_, idx) => {
        const w = ((colWeights[idx] ?? 1) / totalWeight) * contentW;
        const align = alignments?.[idx] ?? 'left';
        columnStyles[idx] = {
          cellWidth: w,
          halign: align,
          fontStyle: idx === 0 ? 'bold' : 'normal',
        };
      });

      const bodyData: RowInput[] =
        rows.length > 0
          ? rows.map((row) => row.map((cell) => normalizePdfText(cell ?? '')))
          : [
              [
                {
                  content: 'Aucune ligne pour les filtres actuels.',
                  colSpan: Math.max(1, headers.length),
                  styles: {
                    textColor: [100, 116, 139] as [number, number, number],
                    fontStyle: 'italic',
                  },
                },
              ],
            ];

      autoTable(doc, {
        startY: cursorY,
        margin: {
          top: marginTop + 34,
          right: marginX,
          bottom: marginBottom,
          left: marginX,
        },
        head: [headers.map((h) => normalizePdfText(h))],
        body: bodyData,
        theme: 'grid',
        tableWidth: contentW,
        showHead: 'everyPage',
        styles: {
          font: 'helvetica',
          fontSize: 7.8,
          cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.4,
          valign: 'middle',
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top: 4.5, right: 5, bottom: 4.5, left: 5 },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles,
        willDrawPage: () => {
          const p = doc.getNumberOfPages();
          drawContinuationHeader(p);
        },
      });

      const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
      cursorY = (finalY ?? cursorY + 24) + 12;
    }
  }

  // Pieds de page numérotés sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  const generatedStamp = normalizePdfText(
    `Exportation États · ${payload.client} · Généré le ${new Date().toLocaleString('fr-FR')}`
  );
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    const footerY = pageH - 16;
    doc.setDrawColor(224, 230, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, footerY - 11, pageW - marginX, footerY - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(generatedStamp, marginX, footerY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${p} / ${totalPages}`, pageW - marginX, footerY, {
      align: 'right',
    });
  }

  const blob = doc.output('blob');
  downloadBlob(
    blob,
    payload.filename.endsWith('.pdf') ? payload.filename : `${payload.filename}.pdf`
  );
}

// ---------- EXPORT DOCUMENT & ÉTAPE DE MISSION (.docx VIA docx & .pdf VIA jsPDF) ----------

export interface DocExportKeyValue {
  label: string;
  value: string;
}

export interface DocExportSectionBlock {
  heading: string;
  subheading?: string;
  metaPairs?: DocExportKeyValue[];
  paragraphs?: string[];
  table?: {
    headers: string[];
    colWeights?: number[];
    rows: string[][];
  };
}

export interface DocExportItem {
  title: string;
  badge?: string;
  pathSubtitle: string;
  metaPairs: DocExportKeyValue[];
  blocks: DocExportSectionBlock[];
}

export interface StructuredReportExportPayload {
  filename: string;
  docTitle: string;
  docSubtitle: string;
  categoryLabel: string;
  client: string;
  signature: string;
  orientation?: 'portrait' | 'landscape';
  filterLines: string[];
  summaryTable?: {
    title: string;
    headers: string[];
    colWeights?: number[];
    rows: string[][];
  };
  items: DocExportItem[];
}

const DOCX_TABLE_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
} as const;

function buildDocxKeyValueTable(pairs: DocExportKeyValue[]): Table {
  const rows: TableRow[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const left = pairs[i];
    const right = pairs[i + 1];
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' },
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: left.label,
                    bold: true,
                    size: 18,
                    color: '334155',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: left.value || '—',
                    size: 18,
                    color: '0F172A',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' },
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: right ? right.label : '',
                    bold: true,
                    size: 18,
                    color: '334155',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: right ? right.value || '—' : '',
                    size: 18,
                    color: '0F172A',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: DOCX_TABLE_BORDER,
    rows,
  });
}

function buildDocxDataTable(
  headers: string[],
  rows: string[][],
  colWeights?: number[]
): Table {
  const weights = colWeights && colWeights.length === headers.length
    ? colWeights
    : headers.map(() => 1);
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1;

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h, idx) =>
        new TableCell({
          width: {
            size: Math.round((weights[idx] / weightSum) * 100),
            type: WidthType.PERCENTAGE,
          },
          shading: { type: ShadingType.CLEAR, fill: '0F172A', color: 'auto' },
          children: [
            new Paragraph({
              spacing: { before: 50, after: 50 },
              children: [
                new TextRun({
                  text: h,
                  bold: true,
                  size: 18,
                  color: 'FFFFFF',
                  font: 'Calibri',
                }),
              ],
            }),
          ],
        })
    ),
  });

  const bodyRows: TableRow[] =
    rows.length > 0
      ? rows.map(
          (r, rIdx) =>
            new TableRow({
              children: headers.map((_, cIdx) => (
                new TableCell({
                  width: {
                    size: Math.round((weights[cIdx] / weightSum) * 100),
                    type: WidthType.PERCENTAGE,
                  },
                  shading:
                    rIdx % 2 === 1
                      ? { type: ShadingType.CLEAR, fill: 'F8FAFC', color: 'auto' }
                      : undefined,
                  children: [
                    new Paragraph({
                      spacing: { before: 40, after: 40 },
                      children: [
                        new TextRun({
                          text: r[cIdx] ?? '',
                          bold: cIdx === 0,
                          size: 18,
                          color: '1E293B',
                          font: 'Calibri',
                        }),
                      ],
                    }),
                  ],
                })
              )),
            })
        )
      : [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: Math.max(1, headers.length),
                children: [
                  new Paragraph({
                    spacing: { before: 40, after: 40 },
                    children: [
                      new TextRun({
                        text: 'Aucune donnée pour ce bloc.',
                        italics: true,
                        size: 18,
                        color: '64748B',
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: DOCX_TABLE_BORDER,
    rows: [headerRow, ...bodyRows],
  });
}

export async function exportStructuredReportToDocx(
  payload: StructuredReportExportPayload
): Promise<void> {
  const isLandscape = payload.orientation === 'landscape';
  const children: Array<Paragraph | Table> = [];

  // Bannière d'en-tête Word structurée
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: '0F172A' },
        bottom: { style: BorderStyle.SINGLE, size: 12, color: '0284C7' },
        left: { style: BorderStyle.NONE, size: 0, color: '0F172A' },
        right: { style: BorderStyle.NONE, size: 0, color: '0F172A' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: '0F172A', color: 'auto' },
              margins: { top: 140, bottom: 140, left: 180, right: 180 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 40 },
                  children: [
                    new TextRun({
                      text: payload.categoryLabel.toUpperCase(),
                      bold: true,
                      size: 16,
                      color: 'FACC15',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 40 },
                  children: [
                    new TextRun({
                      text: payload.docTitle,
                      bold: true,
                      size: 28,
                      color: 'FFFFFF',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: `${payload.docSubtitle}  ·  ${payload.client}  ·  Auteur : ${payload.signature}`,
                      size: 18,
                      color: 'CBD5E1',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: '', spacing: { before: 60, after: 60 } }));

  if (payload.filterLines.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: 'Périmètre & Paramètres appliqués :',
            bold: true,
            size: 20,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      })
    );
    payload.filterLines.forEach((line) => {
      children.push(
        new Paragraph({
          spacing: { before: 10, after: 20 },
          children: [
            new TextRun({
              text: `• ${line}`,
              size: 18,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        })
      );
    });
    children.push(new Paragraph({ text: '', spacing: { before: 40, after: 40 } }));
  }

  if (payload.summaryTable) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: payload.summaryTable.title,
            bold: true,
            size: 23,
            color: '0F172A',
            font: 'Calibri',
          }),
        ],
      })
    );
    children.push(
      buildDocxDataTable(
        payload.summaryTable.headers,
        payload.summaryTable.rows,
        payload.summaryTable.colWeights
      )
    );
    children.push(new Paragraph({ text: '', spacing: { before: 80, after: 80 } }));
  }

  payload.items.forEach((item, idx) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: idx > 0 && payload.items.length > 1,
        spacing: { before: 160, after: 40 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
        },
        children: [
          new TextRun({
            text: `${idx + 1}. ${item.title}`,
            bold: true,
            size: 26,
            color: '0F172A',
            font: 'Calibri',
          }),
          ...(item.badge
            ? [
                new TextRun({
                  text: `   [${item.badge}]`,
                  bold: true,
                  size: 18,
                  color: '0284C7',
                  font: 'Calibri',
                }),
              ]
            : []),
        ],
      })
    );

    children.push(
      new Paragraph({
        spacing: { before: 20, after: 80 },
        children: [
          new TextRun({
            text: item.pathSubtitle,
            italics: true,
            size: 18,
            color: '64748B',
            font: 'Calibri',
          }),
        ],
      })
    );

    if (item.metaPairs.length > 0) {
      children.push(buildDocxKeyValueTable(item.metaPairs));
      children.push(new Paragraph({ text: '', spacing: { before: 40, after: 40 } }));
    }

    item.blocks.forEach((block) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({
              text: block.heading,
              bold: true,
              size: 22,
              color: '1E293B',
              font: 'Calibri',
            }),
          ],
        })
      );

      if (block.subheading) {
        children.push(
          new Paragraph({
            spacing: { before: 0, after: 40 },
            children: [
              new TextRun({
                text: block.subheading,
                italics: true,
                size: 18,
                color: '64748B',
                font: 'Calibri',
              }),
            ],
          })
        );
      }

      if (block.metaPairs && block.metaPairs.length > 0) {
        children.push(buildDocxKeyValueTable(block.metaPairs));
        children.push(new Paragraph({ text: '', spacing: { before: 30, after: 30 } }));
      }

      if (block.paragraphs && block.paragraphs.length > 0) {
        block.paragraphs.forEach((pText) => {
          const lines = (pText || '').split(/\r?\n/);
          lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
              children.push(new Paragraph({ text: '', spacing: { before: 10, after: 10 } }));
              return;
            }
            const isSectionLine =
              /^([0-9]+[.)]|#+|\*\*|Objet|Constat|Risque|Recommandation|Synthèse|Observation)/i.test(
                trimmed
              );
            children.push(
              new Paragraph({
                spacing: { before: 20, after: 40 },
                children: [
                  new TextRun({
                    text: trimmed.replace(/^#+\s*/, ''),
                    bold: isSectionLine && trimmed.length < 95,
                    size: 20,
                    color: '1E293B',
                    font: 'Calibri',
                  }),
                ],
              })
            );
          });
        });
      }

      if (block.table) {
        children.push(
          buildDocxDataTable(
            block.table.headers,
            block.table.rows,
            block.table.colWeights
          )
        );
        children.push(new Paragraph({ text: '', spacing: { before: 40, after: 40 } }));
      }
    });
  });

  const stampDate = new Date().toLocaleString('fr-FR');
  const wordDoc = new Document({
    creator: payload.signature,
    title: payload.docTitle,
    description: payload.docSubtitle,
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: isLandscape
                ? PageOrientation.LANDSCAPE
                : PageOrientation.PORTRAIT,
            },
            margin: { top: 850, bottom: 850, left: 900, right: 900 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${payload.categoryLabel}  ·  ${payload.client}`,
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Exportation États · Généré le ${stampDate}   |   Page `,
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    bold: true,
                    color: '334155',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' / ',
                    size: 16,
                    color: '64748B',
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    bold: true,
                    color: '334155',
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDoc);
  downloadBlob(
    blob,
    payload.filename.endsWith('.docx') ? payload.filename : `${payload.filename}.docx`
  );
}

export function exportStructuredReportToPdf(
  payload: StructuredReportExportPayload
): void {
  const isLandscape = payload.orientation === 'landscape';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 34;
  const marginTop = 28;
  const marginBottom = 36;
  const contentW = pageW - marginX * 2;
  let cursorY = marginTop;
  const headerDrawnPages = new Set<number>([1]);

  const drawContinuationHeader = (pageNum: number) => {
    if (headerDrawnPages.has(pageNum)) return;
    headerDrawnPages.add(pageNum);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.rect(marginX, marginTop, contentW, 24, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(
      clipTextToWidth(doc, payload.docTitle, contentW * 0.62),
      marginX + 10,
      marginTop + 15.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      clipTextToWidth(doc, payload.categoryLabel, contentW * 0.34),
      pageW - marginX - 10,
      marginTop + 15.5,
      { align: 'right' }
    );
  };

  const startNewPage = () => {
    doc.addPage();
    drawContinuationHeader(doc.getNumberOfPages());
    cursorY = marginTop + 34;
  };

  const ensureSpace = (neededPt: number) => {
    if (cursorY + neededPt > pageH - marginBottom) {
      startNewPage();
    }
  };

  // En-tête exécutif page 1
  doc.setFillColor(15, 23, 42);
  doc.rect(marginX, cursorY, contentW, 52, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(250, 204, 21);
  doc.text(normalizePdfText(payload.categoryLabel.toUpperCase()), marginX + 14, cursorY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(
    clipTextToWidth(doc, payload.docTitle, contentW - 170),
    marginX + 14,
    cursorY + 30
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(203, 213, 225);
  doc.text(
    clipTextToWidth(doc, payload.docSubtitle, contentW - 170),
    marginX + 14,
    cursorY + 44
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(250, 204, 21);
  doc.text(
    clipTextToWidth(doc, `${payload.client} · ${payload.signature}`, 145),
    pageW - marginX - 14,
    cursorY + 24,
    { align: 'right' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    new Date().toLocaleDateString('fr-FR'),
    pageW - marginX - 14,
    cursorY + 40,
    { align: 'right' }
  );

  cursorY += 58;

  if (payload.filterLines.length > 0) {
    const filterH = 18 + payload.filterLines.length * 12;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.6);
    doc.rect(marginX, cursorY, contentW, filterH, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(15, 23, 42);
    doc.text('Périmètre & Paramètres appliqués :', marginX + 10, cursorY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.9);
    doc.setTextColor(51, 65, 85);
    payload.filterLines.forEach((line, idx) => {
      doc.text(
        clipTextToWidth(doc, line, contentW - 20),
        marginX + 10,
        cursorY + 25 + idx * 12
      );
    });
    cursorY += filterH + 10;
  }

  const renderAutoTable = (
    headers: string[],
    rows: string[][],
    colWeights?: number[]
  ) => {
    const weights =
      colWeights && colWeights.length === headers.length
        ? colWeights
        : headers.map(() => 1);
    const totalW = weights.reduce((s, w) => s + w, 0) || 1;
    const columnStyles: Record<number, Partial<Styles>> = {};
    headers.forEach((_, idx) => {
      columnStyles[idx] = {
        cellWidth: (weights[idx] / totalW) * contentW,
        fontStyle: idx === 0 ? 'bold' : 'normal',
      };
    });

    const bodyData: RowInput[] =
      rows.length > 0
        ? rows.map((row) => row.map((c) => normalizePdfText(c ?? '')))
        : [
            [
              {
                content: 'Aucune ligne disponible.',
                colSpan: Math.max(1, headers.length),
                styles: {
                  textColor: [100, 116, 139] as [number, number, number],
                  fontStyle: 'italic',
                },
              },
            ],
          ];

    autoTable(doc, {
      startY: cursorY,
      margin: {
        top: marginTop + 34,
        right: marginX,
        bottom: marginBottom,
        left: marginX,
      },
      head: [headers.map(normalizePdfText)],
      body: bodyData,
      theme: 'grid',
      tableWidth: contentW,
      showHead: 'everyPage',
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.4,
        valign: 'middle',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles,
      willDrawPage: () => {
        drawContinuationHeader(doc.getNumberOfPages());
      },
    });

    const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    cursorY = (finalY ?? cursorY + 24) + 10;
  };

  if (payload.summaryTable) {
    ensureSpace(58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(normalizePdfText(payload.summaryTable.title), marginX, cursorY + 11);
    cursorY += 16;
    renderAutoTable(
      payload.summaryTable.headers,
      payload.summaryTable.rows,
      payload.summaryTable.colWeights
    );
  }

  payload.items.forEach((item, idx) => {
    ensureSpace(72);

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.7);
    doc.rect(marginX, cursorY, contentW, 28, 'FD');

    doc.setFillColor(2, 132, 199);
    doc.rect(marginX, cursorY, 4, 28, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(
      clipTextToWidth(doc, `${idx + 1}. ${item.title}`, contentW - 110),
      marginX + 10,
      cursorY + 12.5
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.setTextColor(100, 116, 139);
    doc.text(
      clipTextToWidth(doc, item.pathSubtitle, contentW - 110),
      marginX + 10,
      cursorY + 23
    );

    if (item.badge) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(2, 132, 199);
      doc.text(
        clipTextToWidth(doc, item.badge, 90),
        pageW - marginX - 8,
        cursorY + 16,
        { align: 'right' }
      );
    }

    cursorY += 32;

    if (item.metaPairs.length > 0) {
      const kvRows: string[][] = [];
      for (let i = 0; i < item.metaPairs.length; i += 2) {
        const l = item.metaPairs[i];
        const r = item.metaPairs[i + 1];
        kvRows.push([
          l.label,
          l.value || '—',
          r ? r.label : '',
          r ? r.value || '—' : '',
        ]);
      }
      autoTable(doc, {
        startY: cursorY,
        margin: {
          top: marginTop + 34,
          right: marginX,
          bottom: marginBottom,
          left: marginX,
        },
        body: kvRows.map((r) => r.map(normalizePdfText)),
        theme: 'grid',
        tableWidth: contentW,
        styles: {
          font: 'helvetica',
          fontSize: 7.6,
          cellPadding: { top: 3.5, right: 5, bottom: 3.5, left: 5 },
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.4,
          overflow: 'linebreak',
        },
        columnStyles: {
          0: {
            cellWidth: contentW * 0.2,
            fillColor: [248, 250, 252],
            fontStyle: 'bold',
            textColor: [71, 85, 105],
          },
          1: { cellWidth: contentW * 0.3 },
          2: {
            cellWidth: contentW * 0.2,
            fillColor: [248, 250, 252],
            fontStyle: 'bold',
            textColor: [71, 85, 105],
          },
          3: { cellWidth: contentW * 0.3 },
        },
        willDrawPage: () => {
          drawContinuationHeader(doc.getNumberOfPages());
        },
      });
      const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
      cursorY = (finalY ?? cursorY + 20) + 8;
    }

    item.blocks.forEach((block) => {
      ensureSpace(34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.4);
      doc.setTextColor(15, 23, 42);
      doc.text(normalizePdfText(block.heading), marginX, cursorY + 10);
      cursorY += 15;

      if (block.subheading) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.8);
        doc.setTextColor(100, 116, 139);
        doc.text(clipTextToWidth(doc, block.subheading, contentW), marginX, cursorY + 7);
        cursorY += 12;
      }

      if (block.paragraphs && block.paragraphs.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.4);
        doc.setTextColor(30, 41, 59);

        block.paragraphs.forEach((pText) => {
          const rawLines = (pText || '').split(/\r?\n/);
          rawLines.forEach((rawLine) => {
            const cleanLine = normalizePdfText(rawLine.trim());
            if (!cleanLine) {
              cursorY += 6;
              return;
            }
            const wrapped = doc.splitTextToSize(cleanLine, contentW - 8) as string[];
            wrapped.forEach((wLine) => {
              ensureSpace(14);
              doc.text(wLine, marginX + 4, cursorY + 8);
              cursorY += 11.5;
            });
          });
          cursorY += 3;
        });
      }

      if (block.table) {
        ensureSpace(46);
        renderAutoTable(
          block.table.headers,
          block.table.rows,
          block.table.colWeights
        );
      }

      cursorY += 4;
    });

    cursorY += 6;
  });

  // Pieds de page numérotés sur toutes les pages
  const totalPages = doc.getNumberOfPages();
  const generatedStamp = normalizePdfText(
    `Exportation États · ${payload.client} · Généré le ${new Date().toLocaleString('fr-FR')}`
  );
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    const footerY = pageH - 16;
    doc.setDrawColor(224, 230, 240);
    doc.setLineWidth(0.5);
    doc.line(marginX, footerY - 11, pageW - marginX, footerY - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(generatedStamp, marginX, footerY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${p} / ${totalPages}`, pageW - marginX, footerY, {
      align: 'right',
    });
  }

  const blob = doc.output('blob');
  downloadBlob(
    blob,
    payload.filename.endsWith('.pdf') ? payload.filename : `${payload.filename}.pdf`
  );
}

// Définitions des colonnes exportables
export function getSuiviRecosExportColumns(): Array<ExportColumnDef<LiveSuiviRecoEntry>> {
  return [
    { key: 'no', label: 'no', width: 8, isDefaultKey: true, getValue: (e) => e.record.no },
    { key: 'refRecos', label: 'Ref recos', width: 20, isDefaultKey: true, getValue: (e) => e.record.refRecos },
    { key: 'exercice', label: 'Exercice', width: 14, isDefaultKey: true, getValue: (e) => e.exerciceLabel },
    { key: 'intituleRecos', label: 'Intitule recos', width: 32, isDefaultKey: true, getValue: (e) => e.record.intituleRecos },
    { key: 'intitule', label: 'Intitule', width: 36, isDefaultKey: false, getValue: (e) => e.record.intitule },
    { key: 'mission', label: 'Mission', width: 32, isDefaultKey: true, getValue: (e) => e.record.mission },
    { key: 'cycle', label: 'Cycle', width: 26, isDefaultKey: true, getValue: (e) => inferCycleForReco(e.record) },
    { key: 'direction', label: 'Direction', width: 28, isDefaultKey: true, getValue: (e) => e.record.direction },
    { key: 'processus', label: 'Processus', width: 26, isDefaultKey: false, getValue: (e) => e.record.processus },
    { key: 'evaluationRisque', label: 'Evaluation Risque', width: 16, isDefaultKey: true, getValue: (e) => e.record.evaluationRisque },
    { key: 'statut', label: 'statut', width: 14, isDefaultKey: true, getValue: (e) => e.record.statut },
    { key: 'responsable', label: 'Responsable', width: 24, isDefaultKey: true, getValue: (e) => e.record.responsable },
    { key: 'delai', label: 'Delai', width: 14, isDefaultKey: true, getValue: (e) => e.record.delai },
    { key: 'reportDelai', label: 'Report delai', width: 14, isDefaultKey: false, getValue: (e) => e.record.reportDelai },
    { key: 'observation', label: 'Observation', width: 40, isDefaultKey: false, getValue: (e) => e.record.observation },
    { key: 'constat', label: 'Constat', width: 40, isDefaultKey: false, getValue: (e) => e.record.constat },
    { key: 'risque', label: 'Risque', width: 38, isDefaultKey: false, getValue: (e) => e.record.risque },
    { key: 'recommandation', label: 'Recommandation', width: 42, isDefaultKey: false, getValue: (e) => e.record.recommandation },
    { key: 'planAction', label: 'Plan action', width: 40, isDefaultKey: false, getValue: (e) => e.record.planAction },
    { key: 'commentaireAudite', label: 'Commentaire audite', width: 36, isDefaultKey: false, getValue: (e) => e.record.commentaireAudite },
    { key: 'commentaireAuditeur', label: 'Commentaire auditeur', width: 36, isDefaultKey: false, getValue: (e) => e.record.commentaireAuditeur },
    { key: 'document', label: 'Document', width: 28, isDefaultKey: false, getValue: (e) => e.record.document },
    { key: 'emailAudite', label: 'Email audite', width: 26, isDefaultKey: false, getValue: (e) => e.record.emailAudite },
    { key: 'emailAuditeur', label: 'Email auditeur', width: 26, isDefaultKey: false, getValue: (e) => e.record.emailAuditeur },
  ];
}

export function getPlanAuditExportColumns(): Array<ExportColumnDef<LiveAuditPlanMission>> {
  return [
    { key: 'no', label: 'N°', width: 8, isDefaultKey: true, getValue: (m) => m.meta.no },
    { key: 'code', label: 'Code Mission', width: 14, isDefaultKey: true, getValue: (m) => m.meta.code },
    {
      key: 'titre',
      label: 'Thématique / Mission',
      width: 40,
      isDefaultKey: true,
      getValue: (m) =>
        m.node.label.startsWith(`${m.meta.code} · `)
          ? m.node.label.slice(`${m.meta.code} · `.length)
          : m.node.label,
    },
    { key: 'exercice', label: 'Exercice', width: 12, isDefaultKey: true, getValue: (m) => m.meta.exercice },
    { key: 'direction', label: 'Direction', width: 32, isDefaultKey: true, getValue: (m) => m.meta.direction },
    {
      key: 'cycle',
      label: 'Cycle',
      width: 28,
      isDefaultKey: true,
      getValue: (m) => inferCycleForPlanMission(m.meta, m.node.label),
    },
    { key: 'risque', label: 'Niveau de risque', width: 16, isDefaultKey: true, getValue: (m) => m.meta.risque },
    { key: 'equipe', label: 'Équipe (Auditeurs)', width: 24, isDefaultKey: true, getValue: (m) => m.meta.auditeurs.join(', ') },
    { key: 'chefMission', label: 'Chef de mission', width: 14, isDefaultKey: false, getValue: (m) => m.meta.chefMission },
    { key: 'dateDebut', label: 'Date début', width: 14, isDefaultKey: true, getValue: (m) => m.meta.dateDebut },
    { key: 'dateFinPrevue', label: 'Date fin prévue', width: 14, isDefaultKey: true, getValue: (m) => m.meta.dateFinPrevue },
    { key: 'dateFinReelle', label: 'Date fin réelle', width: 14, isDefaultKey: false, getValue: (m) => m.meta.dateFinReelle || m.meta.dateFinPrevue },
    { key: 'dureeSemaines', label: 'Durée (sem.)', width: 12, isDefaultKey: false, getValue: (m) => m.meta.dureeSemaines },
    { key: 'progressionPct', label: 'Avancement (%)', width: 14, isDefaultKey: true, getValue: (m) => m.meta.progressionPct },
    { key: 'ecartJours', label: 'Écart planning (j)', width: 14, isDefaultKey: false, getValue: (m) => m.meta.ecartJours },
    {
      key: 'statutProgression',
      label: 'Statut planning',
      width: 18,
      isDefaultKey: false,
      getValue: (m) =>
        m.meta.statutProgression === 'en-avance'
          ? 'En avance'
          : m.meta.statutProgression === 'en-retard'
          ? 'En retard'
          : 'Progression normale',
    },
    { key: 'budgetHeures', label: 'Heures planifiées (h)', width: 16, isDefaultKey: false, getValue: (m) => m.plannedTaskHours || m.meta.budgetHeures },
    { key: 'heuresRealisees', label: 'Heures réalisées (h)', width: 16, isDefaultKey: false, getValue: (m) => m.actualTaskHours || m.meta.heuresRealisees },
    { key: 'objectif', label: 'Objectif', width: 44, isDefaultKey: false, getValue: (m) => m.meta.objectif },
    { key: 'perimetre', label: 'Périmètre', width: 40, isDefaultKey: false, getValue: (m) => m.meta.perimetre },
    { key: 'normeCripp', label: 'Norme CRIPP', width: 32, isDefaultKey: false, getValue: (m) => m.meta.normeCripp },
  ];
}

export function extractYearFromExercice(label: string): string {
  const m = (label || '').match(/(20\d{2})/);
  return m ? m[1] : label || '2025';
}
