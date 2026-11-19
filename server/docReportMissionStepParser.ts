import { createRequire } from 'node:module';
import * as CFB from 'cfb';
import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import type { ParsedBaseTable } from '../src/data/missionStepsFormatData';
import type {
  DocHeadingLevel,
  MissionStepDocBlock,
  MissionStepDocumentData,
} from '../src/types/missionStepDocument';

const require = createRequire(import.meta.url);
const WordExtractor = require('word-extractor') as new () => {
  extract: (input: Buffer | string) => Promise<{
    getBody: (options?: { includeFootnotes?: boolean; includeEndnotes?: boolean }) => string;
    getHeaders: (options?: { includeFootnotes?: boolean }) => string;
    getFooters?: (options?: { includeFootnotes?: boolean }) => string;
  }>;
};

export interface DocReportParseResult {
  document: MissionStepDocumentData;
  tables: ParsedBaseTable[];
  parserEngine: string;
  detectedFormat: 'docx' | 'doc-ole2' | 'doc-html' | 'doc-wordxml' | 'doc-rtf' | 'text';
  warnings: string[];
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;|&lsquo;/gi, '’')
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&ecirc;/gi, 'ê')
    .replace(/&agrave;/gi, 'à')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&ocirc;/gi, 'ô')
    .replace(/&ucirc;/gi, 'û')
    .replace(/&icirc;/gi, 'î')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number.parseInt(dec, 10) || 32))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16) || 32)
    );
}

function stripTags(rawHtml: string, preserveNewlines = false): string {
  const withBreaks = rawHtml
    .replace(/<br\s*\/?>/gi, preserveNewlines ? '\n' : ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, preserveNewlines ? '\n' : ' ');
  const cleaned = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ''))
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ');
  return preserveNewlines
    ? cleaned.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    : cleaned.trim();
}

function detectHeadingLevelFromText(text: string): DocHeadingLevel | null {
  const t = text.trim();
  if (!t || t.length > 150) return null;
  if (/^\d+\.\d+\.\d+\b/.test(t)) return 3;
  if (/^\d+\.\d+\b/.test(t)) return 2;
  if (/^\d+\.\s+[A-ZÀ-ÖØ-Ý0-9]/.test(t)) return 1;
  if (/^(CHAPITRE|SECTION|PARTIE|ANNEXE)\s+[0-9IVX]+/i.test(t)) return 1;
  return null;
}

function finalizeMatrixToTable(
  matrix: string[][],
  tableIndex: number,
  explicitTitle?: string
): ParsedBaseTable | null {
  const nonEmptyRows = matrix
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c.length > 0));

  if (nonEmptyRows.length === 0) return null;
  const maxCols = nonEmptyRows.reduce((acc, r) => Math.max(acc, r.length), 0);
  if (maxCols === 0) return null;

  const normalizedRows = nonEmptyRows.map((r) => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push('');
    return padded;
  });

  const title = explicitTitle?.trim() || `table ${tableIndex + 1}`;
  const id = `doc-report-tbl-${tableIndex + 1}-${Date.now().toString(36)}`;

  if (tableIndex === 0 && maxCols === 2 && normalizedRows.length >= 2) {
    const c0 = normalizedRows[0][0].toLowerCase();
    const c1 = normalizedRows[0][1].toLowerCase();
    const isAlreadyRubriqueHeader =
      (c0 === 'rubrique' || c0 === 'champ' || c0 === 'élément' || c0 === 'element') &&
      (c1 === 'description' || c1 === 'valeur' || c1 === 'détail' || c1 === 'detail');

    const looksLikeKeyValue =
      !isAlreadyRubriqueHeader &&
      (c0.includes('etape') ||
        c0.includes('étape') ||
        c0.includes('processus') ||
        c0.includes('norme') ||
        c0.includes('méthode') ||
        c0.includes('methode') ||
        c0.includes('reference') ||
        c0.includes('référence') ||
        c0.includes('client') ||
        c0.includes('exercice') ||
        c0.includes('objectif'));

    if (looksLikeKeyValue) {
      return {
        id,
        title,
        headers: ['Rubrique', 'Description'],
        rows: normalizedRows,
      };
    }
  }

  const headers = normalizedRows[0].map((h, ci) => h || `Colonne ${ci + 1}`);
  const dataRows = normalizedRows.slice(1);
  return {
    id,
    title,
    headers,
    rows: dataRows.length > 0 ? dataRows : [headers.map(() => '—')],
  };
}

function parseSingleHtmlTable(tableHtml: string, tableIndex: number, hintTitle?: string): ParsedBaseTable | null {
  const rowMatches = tableHtml.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const matrix: string[][] = [];
  for (const rowHtml of rowMatches) {
    const cellMatches = rowHtml.match(/<(th|td)\b[^>]*>[\s\S]*?<\/(th|td)>/gi) || [];
    const rowCells = cellMatches.map((cellHtml) =>
      stripTags(cellHtml.replace(/^<(th|td)\b[^>]*>/i, '').replace(/<\/(th|td)>$/i, ''), true)
    );
    if (rowCells.length > 0) matrix.push(rowCells);
  }
  return finalizeMatrixToTable(matrix, tableIndex, hintTitle);
}

function parseHtmlReportToDocument(
  html: string,
  fileName: string,
  defaultStepLabel: string,
  defaultHeaderText?: string,
  defaultFooterText?: string
): { blocks: MissionStepDocBlock[]; tables: ParsedBaseTable[]; headerText: string; footerText: string } {
  // Extraire en-tête/pied de page Word HTML s'ils existent (mso-element:header / footer)
  let extractedHeader = defaultHeaderText || '';
  let extractedFooter = defaultFooterText || '';

  const hdrMatch = html.match(/<div[^>]*mso-element\s*:\s*header[^>]*>([\s\S]*?)<\/div>/i);
  if (hdrMatch) {
    const hdrText = stripTags(hdrMatch[1]);
    if (hdrText) extractedHeader = hdrText;
  }
  const ftrMatch = html.match(/<div[^>]*mso-element\s*:\s*footer[^>]*>([\s\S]*?)<\/div>/i);
  if (ftrMatch) {
    const ftrText = stripTags(ftrMatch[1]);
    if (ftrText) extractedFooter = ftrText;
  }

  // Isoler la section principale si possible, en retirant les conteneurs mso header/footer du flux principal
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let bodyContent = bodyMatch ? bodyMatch[1] : html;
  bodyContent = bodyContent
    .replace(/<div[^>]*mso-element\s*:\s*(?:header|footer|header-first|footer-first)[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<xml\b[^>]*>[\s\S]*?<\/xml>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const blocks: MissionStepDocBlock[] = [];
  const tables: ParsedBaseTable[] = [];

  // Tokeniser séquentiellement les tableaux, sauts de page, titres, paragraphes et items de liste sans capture imbriquée destructrice
  const tokenRegex =
    /(<table\b[^>]*>[\s\S]*?<\/table>|<hr\b[^>]*\/?>|<br\b[^>]*page-break[^>]*>|<h([1-6])\b[^>]*>[\s\S]*?<\/h\2>|<li\b[^>]*>[\s\S]*?<\/li>|<p\b[^>]*>[\s\S]*?<\/p>)/gi;

  let match: RegExpExecArray | null;
  let blockIdx = 0;
  let lastHeadingText: string | undefined;

  while ((match = tokenRegex.exec(bodyContent)) !== null) {
    const token = match[0];
    const lowerToken = token.toLowerCase();

    if (lowerToken.startsWith('<table')) {
      const tbl = parseSingleHtmlTable(token, tables.length, lastHeadingText);
      if (tbl) {
        tables.push(tbl);
        blocks.push({
          id: `doc-blk-tbl-${blockIdx++}`,
          type: 'table',
          tableId: tbl.id,
          tableIndex: tables.length - 1,
        });
      }
      continue;
    }

    if (
      lowerToken.startsWith('<hr') ||
      (lowerToken.startsWith('<br') && /page-break-(?:before|after)\s*:\s*always/i.test(token))
    ) {
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'page-break') {
        blocks.push({
          id: `doc-blk-pb-${blockIdx++}`,
          type: 'page-break',
        });
      }
      continue;
    }

    if (lowerToken.startsWith('<h')) {
      if (
        /page-break-before\s*:\s*always/i.test(token) &&
        blocks.length > 0 &&
        blocks[blocks.length - 1].type !== 'page-break'
      ) {
        blocks.push({
          id: `doc-blk-pb-${blockIdx++}`,
          type: 'page-break',
        });
      }
      const levelNum = Number.parseInt(match[2] || '1', 10);
      const text = stripTags(token);
      if (!text) continue;
      const inferredNumLevel = detectHeadingLevelFromText(text);
      const level: DocHeadingLevel =
        inferredNumLevel ?? (levelNum <= 1 ? 1 : levelNum === 2 ? 2 : 3);
      lastHeadingText = text;
      blocks.push({
        id: `doc-blk-h-${blockIdx++}`,
        type: 'heading',
        level,
        text,
      });
      continue;
    }

    if (lowerToken.startsWith('<li')) {
      const text = stripTags(token, true);
      if (!text) continue;
      blocks.push({
        id: `doc-blk-li-${blockIdx++}`,
        type: 'paragraph',
        text,
        listType: 'bullet',
      });
      continue;
    }

    if (lowerToken.startsWith('<p')) {
      const hasPageBreakStyle = /page-break-(?:before|after)\s*:\s*always/i.test(token);
      if (hasPageBreakStyle && blocks.length > 0 && blocks[blocks.length - 1].type !== 'page-break') {
        blocks.push({
          id: `doc-blk-pb-${blockIdx++}`,
          type: 'page-break',
        });
      }
      const text = stripTags(token, true);
      if (!text || text === '\u00a0') continue;

      // Vérifier si ce <p> vient d'un style Word MsoTitle / Heading1 / Titre1 / numérotation hiérarchique
      const isHeadingClass = /class\s*=\s*["'][^"']*(MsoTitle|MsoHeading|Heading|Titre)/i.test(
        token
      );
      const numericLevel = detectHeadingLevelFromText(text);
      if (numericLevel || isHeadingClass) {
        const level: DocHeadingLevel =
          numericLevel ??
          (/2/.test(token) ? 2 : /3/.test(token) ? 3 : 1);
        lastHeadingText = text;
        blocks.push({
          id: `doc-blk-h-${blockIdx++}`,
          type: 'heading',
          level,
          text,
        });
      } else {
        blocks.push({
          id: `doc-blk-p-${blockIdx++}`,
          type: 'paragraph',
          text,
        });
      }
    }
  }

  return {
    blocks,
    tables,
    headerText: extractedHeader || `Document Word – ${defaultStepLabel || fileName}`,
    footerText: extractedFooter || `E-audit Pro · ${fileName}`,
  };
}

function decodeXmlEntities(input: string): string {
  return decodeHtmlEntities(input).replace(/\s+/g, ' ').trim();
}

function parseWordXmlParagraphText(pXml: string): {
  text: string;
  headingLevel: DocHeadingLevel | null;
  hasPageBreak: boolean;
  isBullet: boolean;
} {
  const hasPageBreak =
    /<w:br\b[^>]*w:type=["']page["']/i.test(pXml) ||
    /<w:pageBreakBefore\b/i.test(pXml);

  const styleMatch = pXml.match(/<w:pStyle\b[^>]*w:val=["']([^"']+)["']/i);
  const styleVal = (styleMatch?.[1] || '').toLowerCase();

  let headingLevel: DocHeadingLevel | null = null;
  if (/heading1|titre1|title/.test(styleVal)) headingLevel = 1;
  else if (/heading2|titre2|subtitle/.test(styleVal)) headingLevel = 2;
  else if (/heading[3-6]|titre[3-6]/.test(styleVal)) headingLevel = 3;

  const isBullet = /<w:numPr\b/i.test(pXml);

  const chunks: string[] = [];
  const textRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\b[^>]*\/>/gi;
  let m: RegExpExecArray | null;
  while ((m = textRegex.exec(pXml)) !== null) {
    if (m[1] !== undefined) chunks.push(m[1]);
    else if (m[0].toLowerCase().startsWith('<w:tab')) chunks.push(' ');
    else chunks.push('\n');
  }
  const text = decodeXmlEntities(chunks.join(''));
  if (!headingLevel && text) {
    headingLevel = detectHeadingLevelFromText(text);
  }
  return { text, headingLevel, hasPageBreak, isBullet };
}

function parseWordXmlTable(tblXml: string, tableIndex: number, hintTitle?: string): ParsedBaseTable | null {
  const rowMatches = tblXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/gi) || [];
  const matrix: string[][] = [];

  for (const tr of rowMatches) {
    const cellMatches = tr.match(/<w:tc\b[\s\S]*?<\/w:tc>/gi) || [];
    const rowCells = cellMatches.map((tc) => {
      const pMatches = tc.match(/<w:p\b[\s\S]*?<\/w:p>/gi) || [];
      if (pMatches.length === 0) {
        const rawT = (tc.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [])
          .map((t) => t.replace(/<[^>]+>/g, ''))
          .join('');
        return decodeXmlEntities(rawT);
      }
      return pMatches
        .map((p) => parseWordXmlParagraphText(p).text)
        .filter((s) => s.length > 0)
        .join('\n');
    });
    if (rowCells.length > 0) matrix.push(rowCells);
  }

  return finalizeMatrixToTable(matrix, tableIndex, hintTitle);
}

function parseWordXmlReport(
  xml: string,
  fileName: string,
  defaultStepLabel: string,
  headerText?: string,
  footerText?: string
): { blocks: MissionStepDocBlock[]; tables: ParsedBaseTable[]; headerText: string; footerText: string } {
  // Extraire le corps <w:body>...</w:body> et itérer ses enfants directs <w:p> et <w:tbl> dans l'ordre exact
  const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/i);
  const bodyXml = bodyMatch ? bodyMatch[1] : xml;

  const blocks: MissionStepDocBlock[] = [];
  const tables: ParsedBaseTable[] = [];
  let blockIdx = 0;
  let lastHeading: string | undefined;

  // Analyser séquentiellement en cherchant le prochain <w:tbl ou <w:p de premier niveau
  let cursor = 0;
  while (cursor < bodyXml.length) {
    const nextTbl = bodyXml.indexOf('<w:tbl', cursor);
    const nextP = bodyXml.indexOf('<w:p', cursor);

    if (nextTbl === -1 && nextP === -1) break;

    if (nextTbl !== -1 && (nextP === -1 || nextTbl < nextP)) {
      const endTbl = bodyXml.indexOf('</w:tbl>', nextTbl);
      if (endTbl === -1) break;
      const tblXml = bodyXml.slice(nextTbl, endTbl + 8);
      const tbl = parseWordXmlTable(tblXml, tables.length, lastHeading);
      if (tbl) {
        tables.push(tbl);
        blocks.push({
          id: `xml-tbl-${blockIdx++}`,
          type: 'table',
          tableId: tbl.id,
          tableIndex: tables.length - 1,
        });
      }
      cursor = endTbl + 8;
      continue;
    }

    // Assurer qu'on matche bien <w:p> ou <w:p ...> et pas <w:pPr>/<w:pStyle>
    const afterChar = bodyXml[nextP + 4];
    if (afterChar !== '>' && afterChar !== ' ' && afterChar !== '/') {
      cursor = nextP + 4;
      continue;
    }
    const selfClose = bodyXml.slice(nextP, nextP + 30).match(/^<w:p\b[^>]*\/>/);
    if (selfClose) {
      cursor = nextP + selfClose[0].length;
      continue;
    }
    const endP = bodyXml.indexOf('</w:p>', nextP);
    if (endP === -1) break;
    const pXml = bodyXml.slice(nextP, endP + 6);
    cursor = endP + 6;

    const parsedP = parseWordXmlParagraphText(pXml);
    if (parsedP.hasPageBreak && blocks.length > 0 && blocks[blocks.length - 1].type !== 'page-break') {
      blocks.push({ id: `xml-pb-${blockIdx++}`, type: 'page-break' });
    }
    if (!parsedP.text) continue;

    if (parsedP.headingLevel) {
      lastHeading = parsedP.text;
      blocks.push({
        id: `xml-h-${blockIdx++}`,
        type: 'heading',
        level: parsedP.headingLevel,
        text: parsedP.text,
      });
    } else {
      blocks.push({
        id: `xml-p-${blockIdx++}`,
        type: 'paragraph',
        text: parsedP.text,
        listType: parsedP.isBullet ? 'bullet' : undefined,
      });
    }
  }

  return {
    blocks,
    tables,
    headerText: headerText || `Document Word – ${defaultStepLabel || fileName}`,
    footerText: footerText || `E-audit Pro · ${fileName}`,
  };
}

function parsePlainReportText(
  bodyText: string,
  fileName: string,
  defaultStepLabel: string,
  headerText?: string,
  footerText?: string
): { blocks: MissionStepDocBlock[]; tables: ParsedBaseTable[]; headerText: string; footerText: string } {
  const lines = bodyText.replace(/\r/g, '').split('\n');
  const blocks: MissionStepDocBlock[] = [];
  const tables: ParsedBaseTable[] = [];
  let tabRows: string[][] = [];
  let blockIdx = 0;
  let lastHeading: string | undefined;

  const flushTabRows = () => {
    if (tabRows.length >= 2) {
      const tbl = finalizeMatrixToTable(tabRows, tables.length, lastHeading);
      if (tbl) {
        tables.push(tbl);
        blocks.push({
          id: `txt-tbl-${blockIdx++}`,
          type: 'table',
          tableId: tbl.id,
          tableIndex: tables.length - 1,
        });
      }
    } else if (tabRows.length === 1) {
      const joined = tabRows[0].filter(Boolean).join(' — ');
      if (joined) {
        blocks.push({ id: `txt-p-${blockIdx++}`, type: 'paragraph', text: joined });
      }
    }
    tabRows = [];
  };

  for (const rawLine of lines) {
    if (rawLine.includes('\f')) {
      flushTabRows();
      if (blocks.length > 0 && blocks[blocks.length - 1].type !== 'page-break') {
        blocks.push({ id: `txt-pb-${blockIdx++}`, type: 'page-break' });
      }
    }
    const line = rawLine.replace(/\f/g, '').trimEnd();
    if (!line.trim()) {
      flushTabRows();
      continue;
    }

    if (line.includes('\t')) {
      const cells = line.split('\t').map((c) => c.trim());
      if (cells.length >= 2) {
        tabRows.push(cells);
        continue;
      }
    }

    flushTabRows();
    const clean = line.trim();
    const headingLevel = detectHeadingLevelFromText(clean);
    if (headingLevel) {
      lastHeading = clean;
      blocks.push({
        id: `txt-h-${blockIdx++}`,
        type: 'heading',
        level: headingLevel,
        text: clean,
      });
    } else {
      const isBullet = /^[•\-*]\s+/.test(clean);
      blocks.push({
        id: `txt-p-${blockIdx++}`,
        type: 'paragraph',
        text: isBullet ? clean.replace(/^[•\-*]\s+/, '') : clean,
        listType: isBullet ? 'bullet' : undefined,
      });
    }
  }
  flushTabRows();

  return {
    blocks,
    tables,
    headerText: headerText || `Document Word – ${defaultStepLabel || fileName}`,
    footerText: footerText || `E-audit Pro · ${fileName}`,
  };
}

export async function parseDocReportFileToMissionStep(
  buffer: Buffer,
  fileName: string,
  stepLabel = 'Étape de mission'
): Promise<DocReportParseResult> {
  const warnings: string[] = [];
  const headAscii = buffer.subarray(0, 128).toString('utf8');
  const isZipDocx = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle2 =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;

  // 1. DOCX OOXML
  if (isZipDocx) {
    try {
      const zip = await JSZip.loadAsync(buffer);
      let hdrText = '';
      let ftrText = '';

      for (const name of Object.keys(zip.files)) {
        if (/^word\/header\d*\.xml$/i.test(name)) {
          const xml = await zip.files[name].async('string');
          const txt = decodeXmlEntities(
            (xml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [])
              .map((t) => t.replace(/<[^>]+>/g, ''))
              .join(' ')
          );
          if (txt && !hdrText) hdrText = txt;
        }
        if (/^word\/footer\d*\.xml$/i.test(name)) {
          const xml = await zip.files[name].async('string');
          const txt = decodeXmlEntities(
            (xml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [])
              .map((t) => t.replace(/<[^>]+>/g, ''))
              .join(' ')
          );
          if (txt && !ftrText) ftrText = txt;
        }
      }

      // Préférer Mammoth pour un HTML riche avec <h1>/<h2>/<h3>/<p>/<table> dans l'ordre du document
      const mammothRes = await mammoth.convertToHtml({ buffer });
      if (mammothRes.messages?.length) {
        warnings.push(...mammothRes.messages.slice(0, 4).map((m) => m.message));
      }
      const parsedFromHtml = parseHtmlReportToDocument(
        mammothRes.value,
        fileName,
        stepLabel,
        hdrText,
        ftrText
      );
      if (parsedFromHtml.blocks.length > 0) {
        return {
          document: {
            headerText: parsedFromHtml.headerText,
            footerText: parsedFromHtml.footerText,
            blocks: parsedFromHtml.blocks,
            sourceFileName: fileName,
            updatedAt: Date.now(),
          },
          tables: parsedFromHtml.tables.slice(0, 10),
          parserEngine: 'mammoth + jszip (Rapport .docx)',
          detectedFormat: 'docx',
          warnings,
        };
      }

      const docXmlFile = zip.file('word/document.xml');
      if (docXmlFile) {
        const docXml = await docXmlFile.async('string');
        const parsedXml = parseWordXmlReport(docXml, fileName, stepLabel, hdrText, ftrText);
        if (parsedXml.blocks.length > 0) {
          return {
            document: {
              headerText: parsedXml.headerText,
              footerText: parsedXml.footerText,
              blocks: parsedXml.blocks,
              sourceFileName: fileName,
              updatedAt: Date.now(),
            },
            tables: parsedXml.tables.slice(0, 10),
            parserEngine: 'jszip (word/document.xml)',
            detectedFormat: 'docx',
            warnings,
          };
        }
      }
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : String(err));
    }
  }

  // 2. Binaire OLE2 .doc
  if (isOle2) {
    try {
      CFB.read(buffer, { type: 'buffer' });
    } catch {
      // ignorer si CFB ne parvient pas à pré-inspecter
    }
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(buffer);
    const bodyText = extracted.getBody({ includeFootnotes: false, includeEndnotes: false });
    const rawHeader = extracted.getHeaders?.({ includeFootnotes: false })?.trim();
    const rawFooter = extracted.getFooters?.({ includeFootnotes: false })?.trim();
    const parsed = parsePlainReportText(
      bodyText,
      fileName,
      stepLabel,
      rawHeader,
      rawFooter
    );
    if (parsed.blocks.length > 0) {
      return {
        document: {
          headerText: parsed.headerText,
          footerText: parsed.footerText,
          blocks: parsed.blocks,
          sourceFileName: fileName,
          updatedAt: Date.now(),
        },
        tables: parsed.tables.slice(0, 10),
        parserEngine: 'word-extractor + cfb (Rapport OLE2 .doc)',
        detectedFormat: 'doc-ole2',
        warnings,
      };
    }
  }

  // 3. HTML / MHTML .doc
  const fullUtf8 = buffer.toString('utf8');
  const trimmedLower = headAscii.trim().toLowerCase();
  if (
    trimmedLower.includes('<html') ||
    trimmedLower.includes('<!doctype') ||
    fullUtf8.toLowerCase().includes('<table') ||
    fullUtf8.toLowerCase().includes('<p')
  ) {
    let htmlContent = fullUtf8;
    if (
      headAscii.toLowerCase().includes('mime-version') &&
      headAscii.toLowerCase().includes('quoted-printable')
    ) {
      htmlContent = fullUtf8.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      );
    }
    const parsedHtml = parseHtmlReportToDocument(htmlContent, fileName, stepLabel);
    if (parsedHtml.blocks.length > 0) {
      return {
        document: {
          headerText: parsedHtml.headerText,
          footerText: parsedHtml.footerText,
          blocks: parsedHtml.blocks,
          sourceFileName: fileName,
          updatedAt: Date.now(),
        },
        tables: parsedHtml.tables.slice(0, 10),
        parserEngine: 'HTML/Word .doc report parser',
        detectedFormat: 'doc-html',
        warnings,
      };
    }
  }

  // 4. Word 2003 XML
  if (fullUtf8.includes('<w:body') || fullUtf8.includes('<w:tbl')) {
    const parsedXml = parseWordXmlReport(fullUtf8, fileName, stepLabel);
    if (parsedXml.blocks.length > 0) {
      return {
        document: {
          headerText: parsedXml.headerText,
          footerText: parsedXml.footerText,
          blocks: parsedXml.blocks,
          sourceFileName: fileName,
          updatedAt: Date.now(),
        },
        tables: parsedXml.tables.slice(0, 10),
        parserEngine: 'Word 2003 XML report parser',
        detectedFormat: 'doc-wordxml',
        warnings,
      };
    }
  }

  // 5. Fallback texte structuré / RTF nettoyé
  const cleanedText = fullUtf8
    .replace(/\\par\b/g, '\n')
    .replace(/\\tab\b/g, '\t')
    .replace(/\\[a-z]+\d*\s?/gi, ' ')
    .replace(/[{}]/g, '');
  const parsedTxt = parsePlainReportText(cleanedText, fileName, stepLabel);
  if (parsedTxt.blocks.length > 0) {
    return {
      document: {
        headerText: parsedTxt.headerText,
        footerText: parsedTxt.footerText,
        blocks: parsedTxt.blocks,
        sourceFileName: fileName,
        updatedAt: Date.now(),
      },
      tables: parsedTxt.tables.slice(0, 10),
      parserEngine: 'Text/RTF report parser',
      detectedFormat: trimmedLower.startsWith('{\\rtf') ? 'doc-rtf' : 'text',
      warnings,
    };
  }

  throw new Error(
    `Impossible d'extraire des sections, paragraphes ou tableaux du document Word « ${fileName} ».`
  );
}
