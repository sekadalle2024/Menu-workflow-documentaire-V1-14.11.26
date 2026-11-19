import {
  buildAuditTresorerie2026Children,
  buildFormatageDataForNode,
  normalizeWorkflowBaseTables,
  ParsedBaseTable,
} from '../data/missionStepsFormatData';
import { ClientSessionConfig, MissionStepFormatType, WorkflowTreeNode } from '../types/workflow';
import type { MissionStepDocumentData } from '../types/missionStepDocument';

export interface SqliteUserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  avatar_path: string | null;
  jwt_secret: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'blocked' | 'suspended';
  blocked_at: number | null;
  blocked_by: string | null;
  blocked_reason: string | null;
  created_at: number;
  updated_at: number;
  last_login: number | null;
}

export interface SqliteConversationRow {
  id: string;
  user_id: string;
  name: string;
  type: 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'nanobot' | 'n8n';
  extra: string; // JSON
  model: string | null;
  status: 'pending' | 'running' | 'finished';
  source: string | null;
  channel_chat_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface SqliteMessageContentPayload {
  content: string; // Markdown (y compris tableaux Markdown)
  type: 'text' | 'image' | 'system';
  n8nData?: {
    workflowId: string;
    executionId: string;
    webhook?: string;
    stepKey?: string;
    formatType?: MissionStepFormatType;
    reference?: string;
    nodeId?: string;
    documentData?: MissionStepDocumentData;
  };
}

export interface SqliteMessageRow {
  id: string;
  conversation_id: string;
  msg_id: string | null;
  type: 'text' | 'image' | 'file' | 'system';
  content: string; // JSON sérialisé de SqliteMessageContentPayload
  position: 'left' | 'right' | 'center' | 'pop';
  status: 'finish' | 'pending' | 'error' | 'work';
  created_at: number;
}

export interface SqliteAuditLogRow {
  id: string;
  user_id: string;
  target_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: string | null; // JSON
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}

export interface EAuditSqliteDatabase {
  schemaVersion: 17;
  dbFile: 'aionui.db';
  journalMode: 'WAL';
  foreignKeys: true;
  users: SqliteUserRow[];
  conversations: SqliteConversationRow[];
  messages: SqliteMessageRow[];
  audit_log: SqliteAuditLogRow[];
}

const STORAGE_KEY = 'eaudit_aionui_sqlite_v17_v1';

/** Convertit une liste de ParsedBaseTable en un bloc Markdown fidèle au format E-audit / n8n */
export function tablesToMarkdown(tables: ParsedBaseTable[]): string {
  return tables
    .map((tbl) => {
      const headers = tbl.headers.length > 0 ? tbl.headers : ['Information'];
      const cleanCell = (v: string) =>
        String(v ?? '')
          .replace(/\|/g, '\\|')
          .replace(/\r?\n/g, ' <br/> ')
          .trim();

      const headerLine = `| ${headers.map(cleanCell).join(' | ')} |`;
      const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
      const rowLines = tbl.rows.map(
        (r) => `| ${headers.map((_, idx) => cleanCell(r[idx] ?? '')).join(' | ')} |`
      );
      return `### ${tbl.title}\n\n${[headerLine, sepLine, ...rowLines].join('\n')}`;
    })
    .join('\n\n');
}

/** Parse une chaîne Markdown stockée dans messages.content en tableaux structurés */
export function markdownToParsedTables(markdown: string, prefixId = 'tbl'): ParsedBaseTable[] {
  const lines = markdown.split(/\r?\n/);
  const result: ParsedBaseTable[] = [];

  let currentTitle = 'table 1';
  let tableLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length < 2) {
      tableLines = [];
      return;
    }
    const splitRow = (line: string): string[] => {
      const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
      const cells: string[] = [];
      let cur = '';
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '\\' && trimmed[i + 1] === '|') {
          cur += '|';
          i++;
        } else if (trimmed[i] === '|') {
          cells.push(cur.replace(/ <br\/> /g, '\n').trim());
          cur = '';
        } else {
          cur += trimmed[i];
        }
      }
      cells.push(cur.replace(/ <br\/> /g, '\n').trim());
      return cells;
    };

    const headers = splitRow(tableLines[0]);
    const isSep = /^\|?\s*:?-{2,}:?/.test(tableLines[1].trim());
    const dataStart = isSep ? 2 : 1;
    const rows = tableLines.slice(dataStart).map(splitRow);

    result.push({
      id: `${prefixId}-${result.length}`,
      title: currentTitle,
      headers,
      rows,
    });
    tableLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('### ')) {
      flushTable();
      currentTitle = line.slice(4).trim() || `table ${result.length + 1}`;
    } else if (line.startsWith('|') && line.endsWith('|')) {
      tableLines.push(line);
    } else if (line === '' && tableLines.length > 0) {
      flushTable();
    }
  }
  flushTable();

  return result;
}

/** Convertit un HTMLTableElement DOM (comme tableToMarkdown de 02_SYSTEME_SAUVEGARDE_TABLES.md) */
export function htmlTableToMarkdown(table: HTMLTableElement): string {
  const rows: string[] = [];
  const thead = table.querySelector('thead');
  if (thead) {
    const headerRow = thead.querySelector('tr');
    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll('th, td')).map(
        (cell) => cell.textContent?.trim().replace(/\|/g, '\\|') || ''
      );
      rows.push(`| ${headers.join(' | ')} |`);
      rows.push(`| ${headers.map(() => '---').join(' | ')} |`);
    }
  }
  const tbody = table.querySelector('tbody');
  const bodyRows = tbody ? tbody.querySelectorAll('tr') : table.querySelectorAll('tr');
  bodyRows.forEach((row) => {
    if (thead && thead.contains(row)) return;
    const cells = Array.from(row.querySelectorAll('td, th')).map(
      (cell) => cell.textContent?.trim().replace(/\|/g, '\\|') || ''
    );
    rows.push(`| ${cells.join(' | ')} |`);
  });
  return '\n' + rows.join('\n') + '\n';
}

function collectLeafDocs(nodes: WorkflowTreeNode[]): WorkflowTreeNode[] {
  const out: WorkflowTreeNode[] = [];
  for (const n of nodes) {
    if (n.nodeType === 'document') out.push(n);
    if (n.children) out.push(...collectLeafDocs(n.children));
  }
  return out;
}

/** Crée la base SQLite v17 initiale avec les données Admin (Banque Atlantique UMOA / OHA) & Mission Audit Trésorerie 2026 */
export function createSeededEAuditSqliteDb(
  session?: ClientSessionConfig
): EAuditSqliteDatabase {
  const baseTs = 1794873600000; // 17 Nov 2026 baseline
  const adminEmail = session?.email || 'ohada.finance@gmail.com';
  const adminClient = session?.client || 'Banque Atlantique UMOA';
  const adminSig = session?.userSignature || 'OHA';

  const users: SqliteUserRow[] = [
    {
      id: 'user_admin_oha',
      username: adminEmail,
      email: adminEmail,
      password_hash: '$2b$10$eAuditAdminOhaBanqueAtlantiqueUMOA2026Hash',
      avatar_path: '/avatars/admin_oha.png',
      jwt_secret: `jwt_v17_${adminSig.toLowerCase()}_94a2f7`,
      role: 'admin',
      status: 'active',
      blocked_at: null,
      blocked_by: null,
      blocked_reason: null,
      created_at: baseTs - 86400000 * 30,
      updated_at: baseTs,
      last_login: baseTs,
    },
    {
      id: 'user_auditor_sek',
      username: 'sek.dai@banqueatlantique.umoa',
      email: 'sek.dai@banqueatlantique.umoa',
      password_hash: '$2b$10$eAuditAuditorSekHash2026',
      avatar_path: null,
      jwt_secret: 'jwt_v17_sek_38c1e9',
      role: 'user',
      status: 'active',
      blocked_at: null,
      blocked_by: null,
      blocked_reason: null,
      created_at: baseTs - 86400000 * 25,
      updated_at: baseTs - 3600000,
      last_login: baseTs - 3600000,
    },
    {
      id: 'system_default_user',
      username: 'system_default_user',
      email: null,
      password_hash: '$2b$10$SystemDefaultDesktopModeNoLogin',
      avatar_path: null,
      jwt_secret: 'jwt_v17_system_default',
      role: 'user',
      status: 'active',
      blocked_at: null,
      blocked_by: null,
      blocked_reason: null,
      created_at: baseTs - 86400000 * 30,
      updated_at: baseTs - 86400000 * 30,
      last_login: null,
    },
  ];

  const conversations: SqliteConversationRow[] = [
    {
      id: 'conv_tres_2026_mission',
      user_id: 'user_admin_oha',
      name: 'Audit trésorerie — Exercice 2026 (Workflow Mission)',
      type: 'n8n',
      extra: JSON.stringify({
        n8nData: {
          workflowId: 'wf_audit_tresorerie_2026',
          executionId: 'exec_tres_2026_001',
          webhook: 'http://localhost:3458/webhook/e-audit-mission-steps',
        },
        client: adminClient,
        exercice: '2026',
        mission: 'Audit trésorerie',
      }),
      model: null,
      status: 'finished',
      source: 'aionui',
      channel_chat_id: `user:user_admin_oha`,
      created_at: baseTs - 7200000,
      updated_at: baseTs,
    },
    {
      id: 'conv_achats_2026_chat',
      user_id: 'user_admin_oha',
      name: 'Console Audit Achats & Cadrage CRIPP (nod n8n)',
      type: 'gemini',
      extra: JSON.stringify({
        systemInstruction: 'Assistant Mission Audit E-audit CRIPP / SYSCOHADA',
        tools: ['formatage-data-type-1', 'formatage-data-type-2', 'formatage-data-type-3'],
        modelId: 'gemini-2.5-flash',
      }),
      model: JSON.stringify({ modelId: 'gemini-2.5-flash', temperature: 0.2 }),
      status: 'finished',
      source: 'aionui',
      channel_chat_id: `user:user_admin_oha`,
      created_at: baseTs - 14400000,
      updated_at: baseTs - 3600000,
    },
  ];

  // Générer un message SQLite par étape de la mission 2026 Audit Trésorerie (user scope)
  const tresoreriePhases = buildAuditTresorerie2026Children('user');
  const tresorerieDocs = collectLeafDocs(tresoreriePhases);

  const messages: SqliteMessageRow[] = [];
  tresorerieDocs.forEach((docNode, idx) => {
    if (!docNode.isMissionStep) return;
    const payload = buildFormatageDataForNode(docNode, adminClient, '2026');
    const md = tablesToMarkdown(payload.baseTables);
    const msgId = docNode.sqliteMessageId || `msg_tres26_${idx}`;
    const contentObj: SqliteMessageContentPayload = {
      content: md,
      type: 'text',
      n8nData: {
        workflowId: 'wf_audit_tresorerie_2026',
        executionId: `exec_tres_2026_${String(idx + 1).padStart(3, '0')}`,
        webhook: 'http://localhost:3458/webhook/e-audit-mission-steps',
        stepKey: payload.stepKey,
        formatType: payload.formatType,
        reference: payload.reference,
        nodeId: docNode.id,
      },
    };

    messages.push({
      id: msgId,
      conversation_id: 'conv_tres_2026_mission',
      msg_id: `n8n_${payload.stepKey}_${idx + 1}`,
      type: 'text',
      content: JSON.stringify(contentObj),
      position: 'left',
      status: 'finish',
      created_at: baseTs - (tresorerieDocs.length - idx) * 60000,
    });
  });

  // Ajouter aussi un message initial de chat Achats pour démontrer la table SQLite du chat
  const achatsSampleContent: SqliteMessageContentPayload = {
    content:
      '| Rubrique | Description |\n| --- | --- |\n| Etape de mission | Programme de travail |\n| Norme | Norme 13.6 Programme de travail |\n| Méthode | Méthode des contrôles clés par les risques |\n| Reference | Programme-001 |',
    type: 'text',
    n8nData: {
      workflowId: 'wf_cadrage_achats',
      executionId: 'exec_achats_004',
      stepKey: 'programme-travail',
      formatType: 1,
      reference: 'Programme-001',
    },
  };
  messages.push({
    id: 'msg_achats_2026_prg001',
    conversation_id: 'conv_achats_2026_chat',
    msg_id: 'gemini-msg-prg-001',
    type: 'text',
    content: JSON.stringify(achatsSampleContent),
    position: 'left',
    status: 'finish',
    created_at: baseTs - 3600000,
  });

  const audit_log: SqliteAuditLogRow[] = [
    {
      id: 'audit_seed_001',
      user_id: 'user_admin_oha',
      target_user_id: null,
      action: 'login',
      resource_type: 'user',
      resource_id: 'user_admin_oha',
      details: JSON.stringify({
        client: adminClient,
        signature: adminSig,
        role: 'admin',
        mode: 'E-audit SQLite v17',
      }),
      ip_address: '127.0.0.1',
      user_agent: 'E-audit / AionUI Client Desktop v17',
      created_at: baseTs - 7200000,
    },
    {
      id: 'audit_seed_002',
      user_id: 'user_admin_oha',
      target_user_id: null,
      action: 'create_conversation',
      resource_type: 'conversation',
      resource_id: 'conv_tres_2026_mission',
      details: JSON.stringify({
        mission: 'Audit trésorerie',
        exercice: '2026',
        stepsSeeded: messages.length - 1,
      }),
      ip_address: '127.0.0.1',
      user_agent: 'E-audit / N8nAgentManager',
      created_at: baseTs - 7100000,
    },
  ];

  return {
    schemaVersion: 17,
    dbFile: 'aionui.db',
    journalMode: 'WAL',
    foreignKeys: true,
    users,
    conversations,
    messages,
    audit_log,
  };
}

export function loadEAuditSqliteDb(session?: ClientSessionConfig): EAuditSqliteDatabase {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EAuditSqliteDatabase;
        if (parsed && parsed.schemaVersion === 17 && Array.isArray(parsed.messages)) {
          return parsed;
        }
      }
    } catch {
      // Fallback to seeded DB
    }
  }
  const seeded = createSeededEAuditSqliteDb(session);
  saveEAuditSqliteDb(seeded);
  return seeded;
}

export function saveEAuditSqliteDb(db: EAuditSqliteDatabase): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // ignore storage quota errors
    }
  }
}

export function resetEAuditSqliteDb(session?: ClientSessionConfig): EAuditSqliteDatabase {
  const seeded = createSeededEAuditSqliteDb(session);
  saveEAuditSqliteDb(seeded);
  return seeded;
}

/** Récupère les tables d'un message SQLite (ou seed à la volée si étape issue d'un autre exercice) */
export function getStepTablesFromSqlite(
  db: EAuditSqliteDatabase,
  node: WorkflowTreeNode,
  clientName: string
): {
  conversationId: string;
  messageRow: SqliteMessageRow | null;
  tables: ParsedBaseTable[];
} {
  const payload = buildFormatageDataForNode(node, clientName, '2026');
  const candidateIds = [
    node.sqliteMessageId,
    `msg_${node.id.replace(/^(user|team)-/, '')}`,
  ].filter(Boolean) as string[];

  const allowStepKeyFallback = node.sqliteHasData !== false;
  const found =
    db.messages.find((m) => candidateIds.includes(m.id)) ||
    (allowStepKeyFallback
      ? db.messages.find((m) => {
          try {
            const parsed = JSON.parse(m.content) as SqliteMessageContentPayload;
            return (
              parsed.n8nData?.stepKey === payload.stepKey &&
              parsed.n8nData?.reference === payload.reference
            );
          } catch {
            return false;
          }
        })
      : null) ||
    null;

  if (found) {
    try {
      const parsed = JSON.parse(found.content) as SqliteMessageContentPayload;
      const parsedTables = markdownToParsedTables(parsed.content || '', node.id);
      if (parsedTables.length > 0) {
        return {
          conversationId: found.conversation_id,
          messageRow: found,
          tables: normalizeWorkflowBaseTables(parsedTables),
        };
      }
    } catch {
      // fall through
    }
  }

  return {
    conversationId: node.sqliteConversationId || 'conv_tres_2026_mission',
    messageRow: found,
    tables: normalizeWorkflowBaseTables(payload.baseTables),
  };
}

/** Récupère la structure document Word paginée (titres, sections, paragraphes, tables) depuis aionui.db si disponible */
export function getStepDocumentFromSqlite(
  db: EAuditSqliteDatabase,
  node: WorkflowTreeNode
): MissionStepDocumentData | null {
  const candidateIds = [
    node.sqliteMessageId,
    `msg_${node.id.replace(/^(user|team)-/, '')}`,
    `msg_${node.id}`,
  ].filter(Boolean) as string[];

  const found = db.messages.find((m) => candidateIds.includes(m.id)) || null;
  if (!found) return null;

  try {
    const parsed = JSON.parse(found.content) as SqliteMessageContentPayload;
    const doc = parsed.n8nData?.documentData;
    if (doc && Array.isArray(doc.blocks)) {
      return doc;
    }
  } catch {
    // ignore invalid json
  }
  return null;
}

/** Persiste conjointement les tables et le document Word structuré dans SQLite client + serveur */
export function updateStepDocumentInSqlite(
  node: WorkflowTreeNode,
  tables: ParsedBaseTable[],
  documentData: MissionStepDocumentData | null,
  userId = 'user_admin_oha',
  actionDetail = 'Mise à jour document rapport Word (.doc) dans SQLite',
  clientName = 'Banque Atlantique UMOA'
): { db: EAuditSqliteDatabase; messageRow: SqliteMessageRow } {
  const db = loadEAuditSqliteDb();
  const markdown = tablesToMarkdown(tables);
  const now = Date.now();
  const payload = buildFormatageDataForNode(node, clientName, '2026');

  const msgId = node.sqliteMessageId || `msg_${node.id.replace(/^(user|team)-/, '')}`;
  const convId = node.sqliteConversationId || 'conv_tres_2026_mission';

  const existingIdx = db.messages.findIndex((m) => m.id === msgId);
  let prevContent: SqliteMessageContentPayload = { content: markdown, type: 'text' };
  if (existingIdx >= 0) {
    try {
      prevContent = JSON.parse(db.messages[existingIdx].content) as SqliteMessageContentPayload;
    } catch {
      // ignore fallback
    }
  }

  const nextContent: SqliteMessageContentPayload = {
    ...prevContent,
    content: markdown,
    type: 'text',
    n8nData: {
      workflowId: prevContent.n8nData?.workflowId || convId,
      executionId: `exec_${now}`,
      stepKey: prevContent.n8nData?.stepKey || payload.stepKey,
      formatType: prevContent.n8nData?.formatType || payload.formatType,
      reference: prevContent.n8nData?.reference || payload.reference,
      nodeId: node.id,
      ...(documentData ? { documentData } : {}),
    },
  };

  const updatedRow: SqliteMessageRow =
    existingIdx >= 0
      ? {
          ...db.messages[existingIdx],
          content: JSON.stringify(nextContent),
        }
      : {
          id: msgId,
          conversation_id: convId,
          msg_id: msgId,
          type: 'text',
          content: JSON.stringify(nextContent),
          position: 'left',
          status: 'finish',
          created_at: now,
        };

  if (existingIdx >= 0) {
    db.messages[existingIdx] = updatedRow;
  } else {
    db.messages.push(updatedRow);
  }

  const convIdx = db.conversations.findIndex((c) => c.id === updatedRow.conversation_id);
  if (convIdx >= 0) {
    db.conversations[convIdx] = {
      ...db.conversations[convIdx],
      updated_at: now,
    };
  } else {
    db.conversations.push({
      id: updatedRow.conversation_id,
      user_id: userId,
      name: `Workflow Mission — ${updatedRow.conversation_id}`,
      type: 'n8n',
      extra: JSON.stringify({
        n8nData: {
          workflowId: updatedRow.conversation_id,
          executionId: `exec_${now}`,
        },
        client: clientName,
      }),
      model: null,
      status: 'finished',
      source: 'aionui',
      channel_chat_id: `user:${userId}`,
      created_at: now,
      updated_at: now,
    });
  }

  db.audit_log.unshift({
    id: `audit_${now}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    target_user_id: null,
    action: 'update_message',
    resource_type: 'message',
    resource_id: updatedRow.id,
    details: JSON.stringify({
      detail: actionDetail,
      stepTitle: node.label,
      stepKey: payload.stepKey,
      tablesCount: tables.length,
      blocksCount: documentData?.blocks.length ?? 0,
    }),
    ip_address: '127.0.0.1',
    user_agent: 'E-audit / DocumentViewer',
    created_at: now,
  });

  saveEAuditSqliteDb(db);

  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    void fetch(`/api/mission-steps/sqlite/${encodeURIComponent(node.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepLabel: node.label,
        conversationId: updatedRow.conversation_id,
        messageId: updatedRow.id,
        tables,
        document: documentData ?? undefined,
        updatedBy: userId,
        action: actionDetail,
      }),
    }).catch(() => {
      // ignore offline error
    });
  }

  return { db, messageRow: updatedRow };
}

/** Équivalent IPC `database.updateMessageContent` : convertit tables modifiées -> Markdown -> JSON dans messages.content + audit_log */
export function updateStepTablesInSqlite(
  node: WorkflowTreeNode,
  tables: ParsedBaseTable[],
  userId = 'user_admin_oha',
  actionDetail = 'Modification table étape de mission (Menu contextuel / Édition inline)',
  clientName = 'Banque Atlantique UMOA'
): { db: EAuditSqliteDatabase; messageRow: SqliteMessageRow } {
  const db = loadEAuditSqliteDb();
  const markdown = tablesToMarkdown(tables);
  const now = Date.now();
  const payload = buildFormatageDataForNode(node, clientName, '2026');

  const msgId = node.sqliteMessageId || `msg_${node.id.replace(/^(user|team)-/, '')}`;
  const convId = node.sqliteConversationId || 'conv_tres_2026_mission';

  let existingIdx = db.messages.findIndex((m) => m.id === msgId);
  if (existingIdx === -1 && node.sqliteHasData !== false) {
    existingIdx = db.messages.findIndex((m) => {
      try {
        const p = JSON.parse(m.content) as SqliteMessageContentPayload;
        return (
          p.n8nData?.stepKey === payload.stepKey &&
          p.n8nData?.reference === payload.reference
        );
      } catch {
        return false;
      }
    });
  }

  let updatedRow: SqliteMessageRow;
  if (existingIdx >= 0) {
    const prevRow = db.messages[existingIdx];
    let prevContent: SqliteMessageContentPayload = { content: markdown, type: 'text' };
    try {
      prevContent = JSON.parse(prevRow.content) as SqliteMessageContentPayload;
    } catch {
      // keep fallback
    }
    const nextContent: SqliteMessageContentPayload = {
      ...prevContent,
      content: markdown,
      type: 'text',
    };
    updatedRow = {
      ...prevRow,
      content: JSON.stringify(nextContent),
    };
    db.messages[existingIdx] = updatedRow;
  } else {
    const contentPayload: SqliteMessageContentPayload = {
      content: markdown,
      type: 'text',
      n8nData: {
        workflowId: convId,
        executionId: `exec_${now}`,
        stepKey: payload.stepKey,
        formatType: payload.formatType,
        reference: payload.reference,
        nodeId: node.id,
      },
    };
    updatedRow = {
      id: msgId,
      conversation_id: convId,
      msg_id: msgId,
      type: 'text',
      content: JSON.stringify(contentPayload),
      position: 'left',
      status: 'finish',
      created_at: now,
    };
    db.messages.push(updatedRow);
  }

  // Mettre à jour ou créer la conversation cible pour garantir l'intégrité FOREIGN KEY
  const convIdx = db.conversations.findIndex((c) => c.id === updatedRow.conversation_id);
  if (convIdx >= 0) {
    db.conversations[convIdx] = {
      ...db.conversations[convIdx],
      updated_at: now,
    };
  } else {
    db.conversations.push({
      id: updatedRow.conversation_id,
      user_id: userId,
      name: `Workflow Mission — ${updatedRow.conversation_id}`,
      type: 'n8n',
      extra: JSON.stringify({
        n8nData: {
          workflowId: updatedRow.conversation_id,
          executionId: `exec_${now}`,
        },
        client: clientName,
      }),
      model: null,
      status: 'finished',
      source: 'aionui',
      channel_chat_id: `user:${userId}`,
      created_at: now,
      updated_at: now,
    });
  }

  // Tracer dans audit_log (v17+)
  db.audit_log.unshift({
    id: `audit_${now}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    target_user_id: null,
    action: 'update_message',
    resource_type: 'message',
    resource_id: updatedRow.id,
    details: JSON.stringify({
      detail: actionDetail,
      stepTitle: node.label,
      stepKey: payload.stepKey,
      formatType: payload.formatType,
      tablesCount: tables.length,
    }),
    ip_address: '127.0.0.1',
    user_agent: 'E-audit / TableContextMenu',
    created_at: now,
  });

  saveEAuditSqliteDb(db);

  // Synchroniser en arrière-plan vers la base SQLite serveur (aionui.db)
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    void fetch(`/api/mission-steps/sqlite/${encodeURIComponent(node.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stepLabel: node.label,
        conversationId: updatedRow.conversation_id,
        messageId: updatedRow.id,
        tables,
        updatedBy: userId,
        action: actionDetail,
      }),
    }).catch(() => {
      // ignore offline error; local SQLite v17 remains persisted
    });
  }

  return { db, messageRow: updatedRow };
}

export interface DocMissionStepImportResult {
  tables: ParsedBaseTable[];
  document?: MissionStepDocumentData | null;
  parserEngine: string;
  detectedFormat: string;
  warnings: string[];
  messageRow: SqliteMessageRow;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',').pop() || '' : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Impossible de lire le fichier .doc sélectionné.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Importe une étape de mission (2 à 10 tables à colonnes variables) depuis un fichier .doc/.docx,
 * écrase les données par défaut de l'étape et persiste dans la base SQLite (client v17 + serveur aionui.db).
 */
export async function importMissionStepFromDocFile(
  file: File,
  node: WorkflowTreeNode,
  clientName = 'Banque Atlantique UMOA',
  userId = 'user_admin_oha'
): Promise<DocMissionStepImportResult> {
  const fileBase64 = await readFileAsBase64(file);
  const msgId = node.sqliteMessageId || `msg_${node.id.replace(/^(user|team)-/, '')}`;
  const convId = node.sqliteConversationId || 'conv_tres_2026_mission';

  const res = await fetch('/api/mission-steps/import-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileBase64,
      nodeId: node.id,
      stepLabel: node.label,
      conversationId: convId,
      messageId: msgId,
      updatedBy: userId,
    }),
  });

  const payload = (await res.json()) as {
    error?: string;
    tables?: ParsedBaseTable[];
    parserEngine?: string;
    detectedFormat?: string;
    warnings?: string[];
  };

  if (!res.ok || !Array.isArray(payload.tables) || payload.tables.length === 0) {
    throw new Error(
      payload.error ||
        `Impossible d'extraire des tableaux depuis « ${file.name} ».`
    );
  }

  const normalizedTables = normalizeWorkflowBaseTables(payload.tables);
  const { messageRow } = updateStepTablesInSqlite(
    node,
    normalizedTables,
    userId,
    `Import étape .doc (${file.name} · ${normalizedTables.length} table(s))`,
    clientName
  );

  return {
    tables: normalizedTables,
    parserEngine: payload.parserEngine || 'doc-parser',
    detectedFormat: payload.detectedFormat || 'doc',
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    messageRow,
  };
}

/**
 * Importe un document Word rapport complet (.doc/.docx contenant titres, sections, paragraphes et tableaux)
 * et persiste la structure complète + les tables dans SQLite (client v17 + serveur aionui.db).
 */
export async function importMissionStepFromDocReportFile(
  file: File,
  node: WorkflowTreeNode,
  clientName = 'Banque Atlantique UMOA',
  userId = 'user_admin_oha'
): Promise<DocMissionStepImportResult> {
  const fileBase64 = await readFileAsBase64(file);
  const msgId = node.sqliteMessageId || `msg_${node.id.replace(/^(user|team)-/, '')}`;
  const convId = node.sqliteConversationId || 'conv_tres_2026_mission';

  const res = await fetch('/api/mission-steps/import-doc-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileBase64,
      nodeId: node.id,
      stepLabel: node.label,
      conversationId: convId,
      messageId: msgId,
      updatedBy: userId,
    }),
  });

  const payload = (await res.json()) as {
    error?: string;
    tables?: ParsedBaseTable[];
    document?: MissionStepDocumentData;
    parserEngine?: string;
    detectedFormat?: string;
    warnings?: string[];
  };

  if (!res.ok || !payload.document || !Array.isArray(payload.document.blocks)) {
    throw new Error(
      payload.error ||
        `Impossible d'extraire le rapport Word depuis « ${file.name} ».`
    );
  }

  const normalizedTables = normalizeWorkflowBaseTables(payload.tables || []);
  const { messageRow } = updateStepDocumentInSqlite(
    node,
    normalizedTables,
    payload.document,
    userId,
    `Import rapport Word (${file.name} · ${normalizedTables.length} table(s) · ${payload.document.blocks.length} bloc(s))`,
    clientName
  );

  return {
    tables: normalizedTables,
    document: payload.document,
    parserEngine: payload.parserEngine || 'doc-report-parser',
    detectedFormat: payload.detectedFormat || 'doc-report',
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    messageRow,
  };
}

/**
 * Importe une étape de mission (2 à 10 tables à colonnes variables) depuis un fichier Excel (.xlsx/.xls/.ods/.csv),
 * écrase les données par défaut de l'étape et persiste dans la base SQLite (client v17 + serveur aionui.db).
 */
export async function importMissionStepFromExcelFile(
  file: File,
  node: WorkflowTreeNode,
  clientName = 'Banque Atlantique UMOA',
  userId = 'user_admin_oha'
): Promise<DocMissionStepImportResult> {
  const fileBase64 = await readFileAsBase64(file);
  const msgId = node.sqliteMessageId || `msg_${node.id.replace(/^(user|team)-/, '')}`;
  const convId = node.sqliteConversationId || 'conv_tres_2026_mission';

  const res = await fetch('/api/mission-steps/import-excel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: file.name,
      fileBase64,
      nodeId: node.id,
      stepLabel: node.label,
      conversationId: convId,
      messageId: msgId,
      updatedBy: userId,
    }),
  });

  const payload = (await res.json()) as {
    error?: string;
    tables?: ParsedBaseTable[];
    parserEngine?: string;
    detectedFormat?: string;
    warnings?: string[];
  };

  if (!res.ok || !Array.isArray(payload.tables) || payload.tables.length === 0) {
    throw new Error(
      payload.error ||
        `Impossible d'extraire des tableaux depuis « ${file.name} ».`
    );
  }

  const normalizedTables = normalizeWorkflowBaseTables(payload.tables);
  const { messageRow } = updateStepTablesInSqlite(
    node,
    normalizedTables,
    userId,
    `Import étape Excel (${file.name} · ${normalizedTables.length} table(s))`,
    clientName
  );

  return {
    tables: normalizedTables,
    parserEngine: payload.parserEngine || 'excel-parser',
    detectedFormat: payload.detectedFormat || 'xlsx',
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    messageRow,
  };
}

/**
 * Hydrate la base SQLite client (aionui.db v17) avec les étapes importées/sauvegardées sur le serveur SQLite.
 * Garantit la persistance complète même après actualisation ou réouverture du navigateur.
 */
export async function hydrateClientSqliteFromServer(
  session?: ClientSessionConfig
): Promise<string[]> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return [];
  try {
    const res = await fetch('/api/mission-steps/sqlite');
    if (!res.ok) return [];
    const data = (await res.json()) as {
      records?: Array<{
        nodeId: string;
        stepLabel: string;
        conversationId: string;
        messageId: string;
        tables: ParsedBaseTable[];
        document?: MissionStepDocumentData | null;
        markdown: string;
        sourceFile?: string | null;
        updatedAt: number;
      }>;
    };
    const records = data.records || [];
    if (records.length === 0) return [];

    const db = loadEAuditSqliteDb(session);
    const hydratedNodeIds: string[] = [];

    for (const rec of records) {
      if (!rec.nodeId || (!Array.isArray(rec.tables) && !rec.document)) continue;
      if (Array.isArray(rec.tables) && rec.tables.length === 0 && !rec.document) continue;
      hydratedNodeIds.push(rec.nodeId);

      const convId = rec.conversationId || 'conv_tres_2026_mission';
      const msgId = rec.messageId || `msg_${rec.nodeId.replace(/^(user|team)-/, '')}`;
      const md = rec.markdown || tablesToMarkdown(rec.tables || []);
      const contentPayload: SqliteMessageContentPayload = {
        content: md,
        type: 'text',
        n8nData: {
          workflowId: convId,
          executionId: `exec_sqlite_${rec.updatedAt}`,
          nodeId: rec.nodeId,
          ...(rec.document ? { documentData: rec.document } : {}),
        },
      };

      const existingIdx = db.messages.findIndex((m) => m.id === msgId);
      const row: SqliteMessageRow = {
        id: msgId,
        conversation_id: convId,
        msg_id: msgId,
        type: 'text',
        content: JSON.stringify(contentPayload),
        position: 'left',
        status: 'finish',
        created_at: rec.updatedAt || Date.now(),
      };
      if (existingIdx >= 0) {
        db.messages[existingIdx] = row;
      } else {
        db.messages.push(row);
      }

      if (!db.conversations.some((c) => c.id === convId)) {
        db.conversations.push({
          id: convId,
          user_id: 'user_admin_oha',
          name: `Workflow Mission — ${convId}`,
          type: 'n8n',
          extra: JSON.stringify({ client: session?.client || 'Banque Atlantique UMOA' }),
          model: null,
          status: 'finished',
          source: 'aionui',
          channel_chat_id: 'user:user_admin_oha',
          created_at: rec.updatedAt || Date.now(),
          updated_at: rec.updatedAt || Date.now(),
        });
      }
    }

    saveEAuditSqliteDb(db);
    return hydratedNodeIds;
  } catch {
    return [];
  }
}

/** Ajoute un message avec table(s) envoyé depuis une étape ou le chat dans SQLite v17 */
export function appendMessageToSqliteChat(
  conversationId: string,
  userId: string,
  title: string,
  tables: ParsedBaseTable[],
  n8nMeta?: SqliteMessageContentPayload['n8nData']
): EAuditSqliteDatabase {
  const db = loadEAuditSqliteDb();
  const now = Date.now();
  const markdown = `${title}\n\n${tablesToMarkdown(tables)}`;
  const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 9)}`;

  const payload: SqliteMessageContentPayload = {
    content: markdown,
    type: 'text',
    n8nData: n8nMeta,
  };

  db.messages.push({
    id: msgId,
    conversation_id: conversationId,
    msg_id: msgId,
    type: 'text',
    content: JSON.stringify(payload),
    position: 'left',
    status: 'finish',
    created_at: now,
  });

  const convIdx = db.conversations.findIndex((c) => c.id === conversationId);
  if (convIdx >= 0) {
    db.conversations[convIdx] = { ...db.conversations[convIdx], updated_at: now };
  }

  db.audit_log.unshift({
    id: `audit_${now}_${Math.random().toString(36).slice(2, 8)}`,
    user_id: userId,
    target_user_id: null,
    action: 'add_message',
    resource_type: 'message',
    resource_id: msgId,
    details: JSON.stringify({ title, tablesCount: tables.length }),
    ip_address: '127.0.0.1',
    user_agent: 'E-audit / MissionStepViewer',
    created_at: now,
  });

  saveEAuditSqliteDb(db);
  return db;
}

function sqlVal(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Génère le script SQL complet (DDL v17 + INSERT des données Admin et des messages) prêt pour aionui.db */
export function exportEAuditSqliteSqlDump(db: EAuditSqliteDatabase): string {
  const lines: string[] = [
    '-- ============================================================================',
    '-- E-audit / AionUI SQLite Database Dump (Schema v17)',
    `-- Fichier cible : ${db.dbFile} | Mode : ${db.journalMode}`,
    `-- Généré le : ${new Date().toISOString()}`,
    '-- ============================================================================',
    '',
    'PRAGMA journal_mode = WAL;',
    'PRAGMA foreign_keys = ON;',
    'PRAGMA user_version = 17;',
    '',
    'BEGIN TRANSACTION;',
    '',
    'CREATE TABLE IF NOT EXISTS users (',
    '  id TEXT PRIMARY KEY,',
    '  username TEXT UNIQUE NOT NULL,',
    '  email TEXT UNIQUE,',
    '  password_hash TEXT NOT NULL,',
    '  avatar_path TEXT,',
    '  jwt_secret TEXT,',
    "  role TEXT NOT NULL DEFAULT 'user',",
    "  status TEXT NOT NULL DEFAULT 'active',",
    '  blocked_at INTEGER,',
    '  blocked_by TEXT,',
    '  blocked_reason TEXT,',
    '  created_at INTEGER NOT NULL,',
    '  updated_at INTEGER NOT NULL,',
    '  last_login INTEGER',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS conversations (',
    '  id TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL,',
    '  name TEXT NOT NULL,',
    "  type TEXT NOT NULL CHECK(type IN ('gemini','acp','codex','openclaw-gateway','nanobot','n8n')),",
    '  extra TEXT NOT NULL,',
    '  model TEXT,',
    "  status TEXT CHECK(status IN ('pending','running','finished')),",
    '  source TEXT,',
    '  channel_chat_id TEXT,',
    '  created_at INTEGER NOT NULL,',
    '  updated_at INTEGER NOT NULL,',
    '  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS messages (',
    '  id TEXT PRIMARY KEY,',
    '  conversation_id TEXT NOT NULL,',
    '  msg_id TEXT,',
    '  type TEXT NOT NULL,',
    '  content TEXT NOT NULL,',
    "  position TEXT CHECK(position IN ('left','right','center','pop')),",
    "  status TEXT CHECK(status IN ('finish','pending','error','work')),",
    '  created_at INTEGER NOT NULL,',
    '  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE',
    ');',
    '',
    'CREATE TABLE IF NOT EXISTS audit_log (',
    '  id TEXT PRIMARY KEY,',
    '  user_id TEXT NOT NULL,',
    '  target_user_id TEXT,',
    '  action TEXT NOT NULL,',
    '  resource_type TEXT,',
    '  resource_id TEXT,',
    '  details TEXT,',
    '  ip_address TEXT,',
    '  user_agent TEXT,',
    '  created_at INTEGER NOT NULL,',
    '  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,',
    '  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL',
    ');',
    '',
    '-- Données : users',
    ...db.users.map(
      (u) =>
        `INSERT OR REPLACE INTO users (id, username, email, password_hash, avatar_path, jwt_secret, role, status, blocked_at, blocked_by, blocked_reason, created_at, updated_at, last_login) VALUES (${[
          sqlVal(u.id),
          sqlVal(u.username),
          sqlVal(u.email),
          sqlVal(u.password_hash),
          sqlVal(u.avatar_path),
          sqlVal(u.jwt_secret),
          sqlVal(u.role),
          sqlVal(u.status),
          sqlVal(u.blocked_at),
          sqlVal(u.blocked_by),
          sqlVal(u.blocked_reason),
          sqlVal(u.created_at),
          sqlVal(u.updated_at),
          sqlVal(u.last_login),
        ].join(', ')});`
    ),
    '',
    '-- Données : conversations',
    ...db.conversations.map(
      (c) =>
        `INSERT OR REPLACE INTO conversations (id, user_id, name, type, extra, model, status, source, channel_chat_id, created_at, updated_at) VALUES (${[
          sqlVal(c.id),
          sqlVal(c.user_id),
          sqlVal(c.name),
          sqlVal(c.type),
          sqlVal(c.extra),
          sqlVal(c.model),
          sqlVal(c.status),
          sqlVal(c.source),
          sqlVal(c.channel_chat_id),
          sqlVal(c.created_at),
          sqlVal(c.updated_at),
        ].join(', ')});`
    ),
    '',
    '-- Données : messages (tables Markdown sérialisées en JSON dans content)',
    ...db.messages.map(
      (m) =>
        `INSERT OR REPLACE INTO messages (id, conversation_id, msg_id, type, content, position, status, created_at) VALUES (${[
          sqlVal(m.id),
          sqlVal(m.conversation_id),
          sqlVal(m.msg_id),
          sqlVal(m.type),
          sqlVal(m.content),
          sqlVal(m.position),
          sqlVal(m.status),
          sqlVal(m.created_at),
        ].join(', ')});`
    ),
    '',
    '-- Données : audit_log',
    ...db.audit_log.map(
      (a) =>
        `INSERT OR REPLACE INTO audit_log (id, user_id, target_user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at) VALUES (${[
          sqlVal(a.id),
          sqlVal(a.user_id),
          sqlVal(a.target_user_id),
          sqlVal(a.action),
          sqlVal(a.resource_type),
          sqlVal(a.resource_id),
          sqlVal(a.details),
          sqlVal(a.ip_address),
          sqlVal(a.user_agent),
          sqlVal(a.created_at),
        ].join(', ')});`
    ),
    '',
    'COMMIT;',
  ];

  return lines.join('\n');
}
