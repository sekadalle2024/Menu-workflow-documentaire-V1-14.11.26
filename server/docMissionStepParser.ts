import { createRequire } from 'node:module';
import * as CFB from 'cfb';
import JSZip from 'jszip';
import * as mammoth from 'mammoth';
import type { ParsedBaseTable } from '../src/data/missionStepsFormatData';

const require = createRequire(import.meta.url);
// word-extractor est un module CommonJS sans types officiels
const WordExtractor = require('word-extractor') as new () => {
  extract: (input: Buffer | string) => Promise<{
    getBody: (options?: { includeFootnotes?: boolean; includeEndnotes?: boolean }) => string;
    getHeaders: (options?: { includeFootnotes?: boolean }) => string;
  }>;
};

export interface DocParseResult {
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

function stripHtmlCell(rawHtml: string): string {
  const withBreaks = rawHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withoutTags)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function finalizeMatrixToTable(
  matrix: string[][],
  index: number,
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

  const title = explicitTitle?.trim() || `table ${index + 1}`;
  const id = `doc-import-tbl-${index + 1}-${Date.now().toString(36)}`;

  // Si c'est la première table à 2 colonnes et que la 1re ligne est déjà un champ métier sans en-tête Rubrique/Description
  if (index === 0 && maxCols === 2 && normalizedRows.length >= 2) {
    const c0 = normalizedRows[0][0].toLowerCase();
    const c1 = normalizedRows[0][1].toLowerCase();
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

function parseHtmlTables(html: string): ParsedBaseTable[] {
  const tables: ParsedBaseTable[] = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  let lastEndIndex = 0;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    // Chercher un éventuel titre (dernier paragraphe/heading non vide avant <table>)
    const precedingChunk = html.slice(lastEndIndex, tableMatch.index);
    const headingMatch = precedingChunk.match(
      /<(?:h[1-6]|p|strong|caption)[^>]*>([\s\S]*?)<\/(?:h[1-6]|p|strong|caption)>\s*$/i
    );
    const candidateTitle = headingMatch ? stripHtmlCell(headingMatch[1]) : undefined;
    const usableTitle =
      candidateTitle && candidateTitle.length > 0 && candidateTitle.length <= 80
        ? candidateTitle
        : undefined;

    lastEndIndex = tableMatch.index + tableMatch[0].length;

    const tableHtml = tableMatch[1];
    const matrix: string[][] = [];
    const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      const rowHtml = rowMatch[1];
      const cells: string[] = [];
      const cellRegex = /<(t[hd])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
        const attrs = cellMatch[2] || '';
        const text = stripHtmlCell(cellMatch[3]);
        const colspanMatch = attrs.match(/colspan\s*=\s*["']?(\d+)/i);
        const colspan = colspanMatch
          ? Math.min(20, Math.max(1, Number.parseInt(colspanMatch[1], 10) || 1))
          : 1;
        cells.push(text);
        for (let k = 1; k < colspan; k++) {
          cells.push('');
        }
      }

      if (cells.length > 0) {
        matrix.push(cells);
      }
    }

    const finalized = finalizeMatrixToTable(matrix, tables.length, usableTitle);
    if (finalized) {
      tables.push(finalized);
    }
  }

  return tables;
}

function parseWordXmlTables(xml: string): ParsedBaseTable[] {
  const tables: ParsedBaseTable[] = [];
  const tblRegex = /<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/gi;
  let tblMatch: RegExpExecArray | null;

  while ((tblMatch = tblRegex.exec(xml)) !== null) {
    const tblXml = tblMatch[1];
    const matrix: string[][] = [];
    const trRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/gi;
    let trMatch: RegExpExecArray | null;

    while ((trMatch = trRegex.exec(tblXml)) !== null) {
      const trXml = trMatch[1];
      const cells: string[] = [];
      const tcRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/gi;
      let tcMatch: RegExpExecArray | null;

      while ((tcMatch = tcRegex.exec(trXml)) !== null) {
        const tcXml = tcMatch[1];
        const paragraphs: string[] = [];
        const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
        let pMatch: RegExpExecArray | null;

        while ((pMatch = pRegex.exec(tcXml)) !== null) {
          const tParts: string[] = [];
          const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi;
          let tMatch: RegExpExecArray | null;
          while ((tMatch = tRegex.exec(pMatch[1])) !== null) {
            tParts.push(decodeHtmlEntities(tMatch[1]));
          }
          paragraphs.push(tParts.join(''));
        }

        const cellText = paragraphs.join('\n').trim();
        const spanMatch = tcXml.match(/<w:gridSpan[^>]*w:val="(\d+)"/i);
        const gridSpan = spanMatch
          ? Math.min(20, Math.max(1, Number.parseInt(spanMatch[1], 10) || 1))
          : 1;
        cells.push(cellText);
        for (let k = 1; k < gridSpan; k++) {
          cells.push('');
        }
      }

      if (cells.length > 0) {
        matrix.push(cells);
      }
    }

    const finalized = finalizeMatrixToTable(matrix, tables.length);
    if (finalized) {
      tables.push(finalized);
    }
  }

  return tables;
}

function parseRtfTables(rtf: string): ParsedBaseTable[] {
  // Décode les séquences hexadécimales \'xx et unicode \uN dans les cellules RTF
  const decodeRtfChunk = (chunk: string): string => {
    let out = chunk
      .replace(/\\par\b/g, '\n')
      .replace(/\\line\b/g, '\n')
      .replace(/\\tab\b/g, ' ')
      .replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) =>
        Buffer.from(hex, 'hex').toString('latin1')
      )
      .replace(/\\u(-?\d+)\??/g, (_m, codeStr) => {
        const code = Number.parseInt(codeStr, 10);
        return code >= 0 ? String.fromCharCode(code) : String.fromCharCode(65536 + code);
      });
    out = out.replace(/\\[a-zA-Z]+-?\d* ?/g, '').replace(/[{}]/g, '');
    return out.trim();
  };

  const tables: ParsedBaseTable[] = [];
  let currentMatrix: string[][] = [];
  let currentColCount = 0;

  const rowBlocks = rtf.split(/\\row\b/);
  for (const block of rowBlocks) {
    if (!block.includes('\\cell')) continue;
    const rawCells = block.split(/\\cell\b/);
    // La dernière tranche après le dernier \cell d'une ligne est vide ou contient des commandes de fin de ligne
    const cellTokens = rawCells.slice(0, -1).map(decodeRtfChunk);
    if (cellTokens.length === 0) continue;

    if (
      currentMatrix.length > 0 &&
      currentColCount > 0 &&
      cellTokens.length !== currentColCount
    ) {
      const finalized = finalizeMatrixToTable(currentMatrix, tables.length);
      if (finalized) tables.push(finalized);
      currentMatrix = [];
    }
    currentColCount = cellTokens.length;
    currentMatrix.push(cellTokens);
  }

  if (currentMatrix.length > 0) {
    const finalized = finalizeMatrixToTable(currentMatrix, tables.length);
    if (finalized) tables.push(finalized);
  }
  return tables;
}

function parseWordExtractorBodyToTables(body: string): ParsedBaseTable[] {
  const lines = body.replace(/\r/g, '').split('\n');
  const tables: ParsedBaseTable[] = [];

  let currentMatrix: string[][] = [];
  let currentColCount = 0;
  let pendingHeading: string | undefined;

  const flushCurrent = () => {
    if (currentMatrix.length === 0) return;
    const finalized = finalizeMatrixToTable(currentMatrix, tables.length, pendingHeading);
    if (finalized) tables.push(finalized);
    currentMatrix = [];
    currentColCount = 0;
    pendingHeading = undefined;
  };

  for (const rawLine of lines) {
    if (!rawLine.includes('\t')) {
      const cleanLine = rawLine.trim();
      if (currentMatrix.length > 0) {
        flushCurrent();
      }
      if (cleanLine && cleanLine.length <= 80 && !/^\|?\s*-{3,}/.test(cleanLine)) {
        pendingHeading = cleanLine;
      }
      continue;
    }

    // Dans word-extractor, 0x07 (marqueur de cellule ET de fin de ligne) devient '\t'
    const normalizedLine = rawLine.endsWith('\t') ? rawLine.slice(0, -1) : rawLine;
    const cells = normalizedLine.split('\t').map((c) => c.trim());
    if (cells.length < 2) {
      if (currentMatrix.length > 0) flushCurrent();
      continue;
    }

    // Si le nombre de colonnes change d'une table à la suivante sans ligne vide entre elles
    if (
      currentMatrix.length >= 2 &&
      currentColCount >= 2 &&
      cells.length !== currentColCount
    ) {
      flushCurrent();
    }

    if (currentMatrix.length === 0) {
      currentColCount = cells.length;
    }
    currentMatrix.push(cells);
  }

  flushCurrent();

  // Fallback si le fichier contenait des tableaux pipe Markdown
  if (tables.length === 0 && body.includes('|')) {
    const mdLines = lines.map((l) => l.trim());
    let mdMatrix: string[][] = [];
    for (const l of mdLines) {
      if (l.startsWith('|') && l.endsWith('|')) {
        if (/^\|[\s:|-]+\|$/.test(l)) continue;
        const cells = l
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        mdMatrix.push(cells);
      } else if (mdMatrix.length > 0) {
        const finalized = finalizeMatrixToTable(mdMatrix, tables.length);
        if (finalized) tables.push(finalized);
        mdMatrix = [];
      }
    }
    if (mdMatrix.length > 0) {
      const finalized = finalizeMatrixToTable(mdMatrix, tables.length);
      if (finalized) tables.push(finalized);
    }
  }

  return tables;
}

export async function parseDocFileToMissionTables(
  buffer: Buffer,
  fileName: string
): Promise<DocParseResult> {
  const warnings: string[] = [];
  const headAscii = buffer.subarray(0, 4096).toString('utf8');
  const isZipPk =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;
  const isOle2 =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0;

  // 1. Format OOXML (.docx ou .doc renommé en OOXML zip)
  if (isZipPk) {
    try {
      const mammothResult = await mammoth.convertToHtml({ buffer });
      if (mammothResult.messages?.length) {
        warnings.push(...mammothResult.messages.map((m) => m.message));
      }
      const htmlTables = parseHtmlTables(mammothResult.value);
      if (htmlTables.length > 0) {
        return {
          tables: htmlTables.slice(0, 10),
          parserEngine: 'mammoth + HTML table extractor',
          detectedFormat: 'docx',
          warnings,
        };
      }
    } catch (err) {
      warnings.push(
        `Mammoth fallback vers JSZip XML : ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Fallback direct word/document.xml via JSZip
    const zip = await JSZip.loadAsync(buffer);
    const docXmlFile = zip.file('word/document.xml');
    if (docXmlFile) {
      const docXml = await docXmlFile.async('string');
      const xmlTables = parseWordXmlTables(docXml);
      if (xmlTables.length > 0) {
        return {
          tables: xmlTables.slice(0, 10),
          parserEngine: 'jszip (word/document.xml)',
          detectedFormat: 'docx',
          warnings,
        };
      }
    }
  }

  // 2. Format binaire Word 97-2003 OLE2 (.doc) -> cfb + word-extractor
  if (isOle2) {
    const cfbContainer = CFB.read(buffer, { type: 'buffer' });
    const hasWordDocumentStream = Boolean(CFB.find(cfbContainer, 'WordDocument'));
    if (!hasWordDocumentStream) {
      warnings.push(`Flux OLE2 WordDocument absent dans ${fileName}, tentative word-extractor.`);
    }

    const extractor = new WordExtractor();
    const extracted = await extractor.extract(buffer);
    const bodyText = extracted.getBody({ includeFootnotes: false, includeEndnotes: false });
    const tables = parseWordExtractorBodyToTables(bodyText);
    if (tables.length > 0) {
      return {
        tables: tables.slice(0, 10),
        parserEngine: 'word-extractor + cfb (OLE2 Word .doc)',
        detectedFormat: 'doc-ole2',
        warnings,
      };
    }
  }

  // 3. Format HTML / MHTML sauvegardé avec extension .doc
  const fullUtf8 = buffer.toString('utf8');
  const trimmedLower = headAscii.trim().toLowerCase();
  if (
    trimmedLower.includes('<html') ||
    trimmedLower.includes('<!doctype') ||
    fullUtf8.toLowerCase().includes('<table')
  ) {
    // Gérer MHTML quoted-printable si présent
    let htmlContent = fullUtf8;
    if (
      headAscii.toLowerCase().includes('mime-version') &&
      headAscii.toLowerCase().includes('quoted-printable')
    ) {
      htmlContent = fullUtf8.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_m, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      );
    }
    const htmlTables = parseHtmlTables(htmlContent);
    if (htmlTables.length > 0) {
      return {
        tables: htmlTables.slice(0, 10),
        parserEngine: 'HTML/MHTML .doc table parser',
        detectedFormat: 'doc-html',
        warnings,
      };
    }
  }

  // 4. Format Word 2003 XML (.doc XML)
  if (fullUtf8.includes('<w:tbl')) {
    const xmlTables = parseWordXmlTables(fullUtf8);
    if (xmlTables.length > 0) {
      return {
        tables: xmlTables.slice(0, 10),
        parserEngine: 'Word 2003 XML (<w:tbl>) parser',
        detectedFormat: 'doc-wordxml',
        warnings,
      };
    }
  }

  // 5. Format RTF sauvegardé avec extension .doc
  if (trimmedLower.startsWith('{\\rtf')) {
    const rtfTables = parseRtfTables(fullUtf8);
    if (rtfTables.length > 0) {
      return {
        tables: rtfTables.slice(0, 10),
        parserEngine: 'RTF .doc table parser',
        detectedFormat: 'doc-rtf',
        warnings,
      };
    }
  }

  // 6. Dernier recours : texte tabulé ou Markdown
  const textTables = parseWordExtractorBodyToTables(fullUtf8);
  if (textTables.length > 0) {
    return {
      tables: textTables.slice(0, 10),
      parserEngine: 'Tab/Markdown text fallback',
      detectedFormat: 'text',
      warnings,
    };
  }

  throw new Error(
    `Aucune table n'a pu être extraite du fichier « ${fileName} ». Vérifiez qu'il s'agit bien d'un fichier Word (.doc ou .docx) contenant 2 à 10 tableaux.`
  );
}
