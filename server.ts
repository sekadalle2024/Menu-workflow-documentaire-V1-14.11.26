import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';

interface ShareChangeLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  summary: string;
}

interface SharedPhasesConfig {
  preparation: boolean;
  realisation: boolean;
  conclusion: boolean;
}

interface SharedRoomRecord {
  token: string;
  active: boolean;
  allowEdit: boolean;
  shareType: 'mission-step' | 'suivi-recos' | 'workflow-dossier' | 'audit-plan';
  title: string;
  subtitle?: string;
  ownerName: string;
  ownerEmail: string;
  ownerSignature: string;
  clientName: string;
  nodeId?: string;
  node?: Record<string, unknown>;
  includeMissionWorkflow?: boolean;
  missionRootNodeId?: string;
  missionTree?: Record<string, unknown>;
  allowedPhases?: SharedPhasesConfig;
  phasesValidatedAt?: number;
  wordBodies?: Record<string, string>;
  tablesByNodeId: Record<string, unknown[]>;
  recoUpdatesByNodeId: Record<string, unknown>;
  recoRowsSnapshot?: unknown[];
  createdAt: number;
  updatedAt: number;
  lastModifiedBy?: string;
  changeLog: ShareChangeLogEntry[];
}

const SHARES_STORE_PATH = path.resolve(process.cwd(), '.eaudit-shares.json');

function loadSharesFromDisk(): Map<string, SharedRoomRecord> {
  const map = new Map<string, SharedRoomRecord>();
  try {
    if (fs.existsSync(SHARES_STORE_PATH)) {
      const raw = fs.readFileSync(SHARES_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, SharedRoomRecord>;
      Object.entries(parsed).forEach(([k, v]) => {
        if (v && v.token) {
          map.set(k, v);
        }
      });
    }
  } catch (err) {
    console.warn('[shares] Failed to load .eaudit-shares.json:', err);
  }
  return map;
}

function saveSharesToDisk(map: Map<string, SharedRoomRecord>): void {
  try {
    const obj: Record<string, SharedRoomRecord> = {};
    map.forEach((v, k) => {
      obj[k] = v;
    });
    fs.writeFileSync(SHARES_STORE_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[shares] Failed to persist .eaudit-shares.json:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const shareRooms = loadSharesFromDisk();

  app.use(express.json({ limit: '10mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, sharesCount: shareRooms.size });
  });

  app.get('/api/shares', (req: Request, res: Response) => {
    const ownerEmail =
      typeof req.query.ownerEmail === 'string' ? req.query.ownerEmail.toLowerCase() : null;
    const list = Array.from(shareRooms.values()).filter((r) =>
      ownerEmail ? r.ownerEmail.toLowerCase() === ownerEmail : true
    );
    res.json({ shares: list });
  });

  app.post('/api/shares', (req: Request, res: Response) => {
    const body = req.body as Partial<SharedRoomRecord>;
    if (!body || !body.title || !body.shareType) {
      res.status(400).json({ error: 'Invalid share payload' });
      return;
    }

    const now = Date.now();
    const token =
      body.token && typeof body.token === 'string'
        ? body.token
        : `shr_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

    const existing = shareRooms.get(token);
    const room: SharedRoomRecord = {
      token,
      active: body.active ?? existing?.active ?? true,
      allowEdit: body.allowEdit ?? existing?.allowEdit ?? true,
      shareType: body.shareType,
      title: body.title,
      subtitle: body.subtitle ?? existing?.subtitle,
      ownerName: body.ownerName || existing?.ownerName || 'Propriétaire',
      ownerEmail: body.ownerEmail || existing?.ownerEmail || 'ohada.finance@gmail.com',
      ownerSignature: body.ownerSignature || existing?.ownerSignature || 'OHA',
      clientName: body.clientName || existing?.clientName || 'Banque Atlantique UMOA',
      nodeId: body.nodeId ?? existing?.nodeId,
      node: body.node ?? existing?.node,
      includeMissionWorkflow:
        body.includeMissionWorkflow ?? existing?.includeMissionWorkflow,
      missionRootNodeId: body.missionRootNodeId ?? existing?.missionRootNodeId,
      missionTree: body.missionTree ?? existing?.missionTree,
      allowedPhases: body.allowedPhases ?? existing?.allowedPhases,
      phasesValidatedAt: body.phasesValidatedAt ?? existing?.phasesValidatedAt,
      wordBodies: {
        ...(existing?.wordBodies || {}),
        ...(body.wordBodies || {}),
      },
      tablesByNodeId: {
        ...(existing?.tablesByNodeId || {}),
        ...(body.tablesByNodeId || {}),
      },
      recoUpdatesByNodeId: {
        ...(existing?.recoUpdatesByNodeId || {}),
        ...(body.recoUpdatesByNodeId || {}),
      },
      recoRowsSnapshot: body.recoRowsSnapshot ?? existing?.recoRowsSnapshot,
      createdAt: existing?.createdAt ?? now,
      updatedAt: Math.max(now, (existing?.updatedAt ?? 0) + 1),
      lastModifiedBy: body.lastModifiedBy ?? existing?.lastModifiedBy,
      changeLog: existing?.changeLog ?? [],
    };

    shareRooms.set(token, room);
    saveSharesToDisk(shareRooms);
    res.status(201).json({ share: room });
  });

  app.get('/api/shares/:token', (req: Request, res: Response) => {
    const token = String(req.params.token || '');
    const room = shareRooms.get(token);
    if (!room) {
      res.status(404).json({ error: 'Lien de partage introuvable' });
      return;
    }
    res.json({ share: room });
  });

  app.patch('/api/shares/:token', (req: Request, res: Response) => {
    const token = String(req.params.token || '');
    const room = shareRooms.get(token);
    if (!room) {
      res.status(404).json({ error: 'Lien de partage introuvable' });
      return;
    }

    const patch = req.body as Partial<SharedRoomRecord> & {
      changeSummary?: string;
      actor?: string;
      isOwnerUpdate?: boolean;
    };

    if (!patch.isOwnerUpdate && (!room.active || !room.allowEdit)) {
      res.status(403).json({
        error: !room.active
          ? 'Ce lien de partage a été désactivé par le propriétaire.'
          : 'Ce lien est en mode lecture seule.',
      });
      return;
    }

    const now = Date.now();
    if (patch.isOwnerUpdate) {
      if (typeof patch.active === 'boolean') room.active = patch.active;
      if (typeof patch.allowEdit === 'boolean') room.allowEdit = patch.allowEdit;
      if (typeof patch.includeMissionWorkflow === 'boolean') {
        room.includeMissionWorkflow = patch.includeMissionWorkflow;
      }
      if (typeof patch.missionRootNodeId === 'string') {
        room.missionRootNodeId = patch.missionRootNodeId;
      }
      if (patch.allowedPhases) room.allowedPhases = patch.allowedPhases;
      if (typeof patch.phasesValidatedAt === 'number') {
        room.phasesValidatedAt = patch.phasesValidatedAt;
      }
    }
    if (patch.tablesByNodeId) {
      room.tablesByNodeId = {
        ...room.tablesByNodeId,
        ...patch.tablesByNodeId,
      };
    }
    if (patch.wordBodies) {
      room.wordBodies = {
        ...(room.wordBodies || {}),
        ...patch.wordBodies,
      };
    }
    if (patch.recoUpdatesByNodeId) {
      room.recoUpdatesByNodeId = {
        ...room.recoUpdatesByNodeId,
        ...patch.recoUpdatesByNodeId,
      };
    }
    if (patch.recoRowsSnapshot) {
      room.recoRowsSnapshot = patch.recoRowsSnapshot;
    }
    if (patch.node) {
      room.node = patch.node;
    }
    if (patch.missionTree !== undefined) {
      if (patch.missionTree === null) {
        delete room.missionTree;
      } else {
        room.missionTree = patch.missionTree;
      }
    }

    room.updatedAt = Math.max(now, room.updatedAt + 1);
    if (patch.actor) {
      room.lastModifiedBy = patch.actor;
    }
    if (patch.changeSummary) {
      room.changeLog = [
        {
          id: `chg_${now}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date(now).toISOString(),
          actor: patch.actor || 'Collaborateur invité',
          summary: patch.changeSummary,
        },
        ...room.changeLog,
      ].slice(0, 50);
    }

    shareRooms.set(token, room);
    saveSharesToDisk(shareRooms);
    res.json({ share: room });
  });

  app.delete('/api/shares/:token', (req: Request, res: Response) => {
    const token = String(req.params.token || '');
    shareRooms.delete(token);
    saveSharesToDisk(shareRooms);
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`E-audit Collaborative Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
