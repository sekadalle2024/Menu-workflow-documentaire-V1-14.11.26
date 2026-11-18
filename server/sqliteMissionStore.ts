import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ParsedBaseTable } from '../src/data/missionStepsFormatData';

export interface PersistedMissionStepRecord {
  nodeId: string;
  stepLabel: string;
  conversationId: string;
  messageId: string;
  tables: ParsedBaseTable[];
  markdown: string;
  sourceFile: string | null;
  parserEngine: string | null;
  updatedAt: number;
  updatedBy: string;
}

const DB_PATH = path.resolve(process.cwd(), 'aionui.db');

let dbInstance: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = 17;

    CREATE TABLE IF NOT EXISTS mission_step_tables (
      node_id TEXT PRIMARY KEY,
      step_label TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      tables_json TEXT NOT NULL,
      markdown TEXT NOT NULL,
      source_file TEXT,
      parser_engine TEXT,
      updated_at INTEGER NOT NULL,
      updated_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      msg_id TEXT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      position TEXT,
      status TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      details TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  dbInstance = db;
  return db;
}

export function tablesToMarkdownServer(tables: ParsedBaseTable[]): string {
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

export function saveStepTablesToServerSqlite(input: {
  nodeId: string;
  stepLabel: string;
  conversationId?: string;
  messageId?: string;
  tables: ParsedBaseTable[];
  sourceFile?: string | null;
  parserEngine?: string | null;
  updatedBy?: string;
  action?: string;
}): PersistedMissionStepRecord {
  const db = getDb();
  const now = Date.now();
  const convId = input.conversationId || 'conv_tres_2026_mission';
  const msgId =
    input.messageId || `msg_${input.nodeId.replace(/^(user|team)-/, '')}`;
  const updatedBy = input.updatedBy || 'user_admin_oha';
  const markdown = tablesToMarkdownServer(input.tables);
  const tablesJson = JSON.stringify(input.tables);

  const upsertStep = db.prepare(`
    INSERT INTO mission_step_tables (
      node_id, step_label, conversation_id, message_id,
      tables_json, markdown, source_file, parser_engine,
      updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(node_id) DO UPDATE SET
      step_label = excluded.step_label,
      conversation_id = excluded.conversation_id,
      message_id = excluded.message_id,
      tables_json = excluded.tables_json,
      markdown = excluded.markdown,
      source_file = COALESCE(excluded.source_file, mission_step_tables.source_file),
      parser_engine = COALESCE(excluded.parser_engine, mission_step_tables.parser_engine),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `);

  upsertStep.run(
    input.nodeId,
    input.stepLabel,
    convId,
    msgId,
    tablesJson,
    markdown,
    input.sourceFile ?? null,
    input.parserEngine ?? null,
    now,
    updatedBy
  );

  const messagePayload = JSON.stringify({
    content: markdown,
    type: 'text',
    n8nData: {
      workflowId: convId,
      executionId: `exec_sqlite_${now}`,
      nodeId: input.nodeId,
      sourceFile: input.sourceFile ?? undefined,
    },
  });

  const upsertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, msg_id, type, content, position, status, created_at)
    VALUES (?, ?, ?, 'text', ?, 'left', 'finish', ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      created_at = excluded.created_at
  `);
  upsertMsg.run(msgId, convId, msgId, messagePayload, now);

  const insertAudit = db.prepare(`
    INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, details, created_at)
    VALUES (?, ?, ?, 'mission_step', ?, ?, ?)
  `);
  insertAudit.run(
    `audit_${now}_${Math.random().toString(36).slice(2, 8)}`,
    updatedBy,
    input.action || 'import_mission_step_doc',
    input.nodeId,
    JSON.stringify({
      stepLabel: input.stepLabel,
      tablesCount: input.tables.length,
      sourceFile: input.sourceFile ?? null,
      parserEngine: input.parserEngine ?? null,
    }),
    now
  );

  return {
    nodeId: input.nodeId,
    stepLabel: input.stepLabel,
    conversationId: convId,
    messageId: msgId,
    tables: input.tables,
    markdown,
    sourceFile: input.sourceFile ?? null,
    parserEngine: input.parserEngine ?? null,
    updatedAt: now,
    updatedBy,
  };
}

export function listPersistedStepTablesFromServerSqlite(): PersistedMissionStepRecord[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT node_id, step_label, conversation_id, message_id, tables_json,
           markdown, source_file, parser_engine, updated_at, updated_by
    FROM mission_step_tables
    ORDER BY updated_at DESC
  `);
  const rows = stmt.all() as Array<{
    node_id: string;
    step_label: string;
    conversation_id: string;
    message_id: string;
    tables_json: string;
    markdown: string;
    source_file: string | null;
    parser_engine: string | null;
    updated_at: number;
    updated_by: string;
  }>;

  const out: PersistedMissionStepRecord[] = [];
  for (const r of rows) {
    try {
      const tables = JSON.parse(r.tables_json) as ParsedBaseTable[];
      if (Array.isArray(tables) && tables.length > 0) {
        out.push({
          nodeId: r.node_id,
          stepLabel: r.step_label,
          conversationId: r.conversation_id,
          messageId: r.message_id,
          tables,
          markdown: r.markdown,
          sourceFile: r.source_file,
          parserEngine: r.parser_engine,
          updatedAt: r.updated_at,
          updatedBy: r.updated_by,
        });
      }
    } catch {
      // ignore malformed JSON row
    }
  }
  return out;
}
