import {
  SharedWorkspaceRoom,
  ShareTargetType,
} from '../types/share';

const LOCAL_SHARES_KEY = 'eaudit_share_rooms_v1';
const CHANNEL_NAME = 'eaudit-share-sync';

function loadLocalSharesMap(): Record<string, SharedWorkspaceRoom> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_SHARES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, SharedWorkspaceRoom>;
  } catch {
    return {};
  }
}

function saveLocalShareRoom(room: SharedWorkspaceRoom): void {
  if (typeof window === 'undefined') return;
  try {
    const map = loadLocalSharesMap();
    map[room.token] = room;
    window.localStorage.setItem(LOCAL_SHARES_KEY, JSON.stringify(map));
  } catch {
    // ignore quota issues
  }
}

export function broadcastShareUpdate(room: SharedWorkspaceRoom): void {
  saveLocalShareRoom(room);
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ type: 'room-updated', token: room.token, room });
      ch.close();
    } catch {
      // ignore
    }
  }
}

export function subscribeShareBroadcast(
  onUpdate: (room: SharedWorkspaceRoom) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  let ch: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    try {
      ch = new BroadcastChannel(CHANNEL_NAME);
      ch.onmessage = (ev) => {
        if (ev.data?.type === 'room-updated' && ev.data?.room) {
          onUpdate(ev.data.room as SharedWorkspaceRoom);
        }
      };
    } catch {
      ch = null;
    }
  }
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_SHARES_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as Record<string, SharedWorkspaceRoom>;
        Object.values(parsed).forEach((room) => onUpdate(room));
      } catch {
        // ignore
      }
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    ch?.close();
    window.removeEventListener('storage', onStorage);
  };
}

export function buildShareUrl(token: string): string {
  if (typeof window === 'undefined') return `?share=${token}`;
  const url = new URL(window.location.href);
  url.searchParams.set('share', token);
  url.hash = '';
  return url.toString();
}

export function deterministicTokenForTarget(
  shareType: ShareTargetType,
  ownerSignature: string,
  targetId?: string
): string {
  const cleanSig = (ownerSignature || 'oha').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanTarget = (targetId || shareType)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(-28);
  return `shr_${cleanSig}_${shareType.slice(0, 4)}_${cleanTarget}`;
}

export async function createOrSyncShareRoom(
  input: Omit<SharedWorkspaceRoom, 'createdAt' | 'updatedAt' | 'changeLog'> & {
    createdAt?: number;
    updatedAt?: number;
    changeLog?: SharedWorkspaceRoom['changeLog'];
  }
): Promise<SharedWorkspaceRoom> {
  const now = Date.now();
  const localExisting = loadLocalSharesMap()[input.token];
  const fallbackRoom: SharedWorkspaceRoom = {
    ...input,
    includeMissionWorkflow:
      input.includeMissionWorkflow ?? localExisting?.includeMissionWorkflow,
    missionRootNodeId: input.missionRootNodeId ?? localExisting?.missionRootNodeId,
    missionTree: input.missionTree ?? localExisting?.missionTree,
    allowedPhases: input.allowedPhases ?? localExisting?.allowedPhases,
    phasesValidatedAt: input.phasesValidatedAt ?? localExisting?.phasesValidatedAt,
    wordBodies: {
      ...(localExisting?.wordBodies || {}),
      ...(input.wordBodies || {}),
    },
    createdAt: localExisting?.createdAt ?? input.createdAt ?? now,
    updatedAt: Math.max(now, (localExisting?.updatedAt ?? 0) + 1),
    changeLog: localExisting?.changeLog ?? input.changeLog ?? [],
    tablesByNodeId: {
      ...(localExisting?.tablesByNodeId || {}),
      ...input.tablesByNodeId,
    },
    recoUpdatesByNodeId: {
      ...(localExisting?.recoUpdatesByNodeId || {}),
      ...input.recoUpdatesByNodeId,
    },
  };

  try {
    const res = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fallbackRoom),
    });
    if (res.ok) {
      const data = (await res.json()) as { share: SharedWorkspaceRoom };
      if (data.share) {
        broadcastShareUpdate(data.share);
        return data.share;
      }
    }
  } catch {
    // Fallback offline/static
  }

  broadcastShareUpdate(fallbackRoom);
  return fallbackRoom;
}

export async function fetchShareRoom(token: string): Promise<SharedWorkspaceRoom | null> {
  try {
    const res = await fetch(`/api/shares/${encodeURIComponent(token)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as { share: SharedWorkspaceRoom };
      if (data.share) {
        saveLocalShareRoom(data.share);
        return data.share;
      }
    }
  } catch {
    // Fallback to localStorage
  }

  return loadLocalSharesMap()[token] ?? null;
}

export async function fetchOwnerShareRooms(
  ownerEmail: string
): Promise<SharedWorkspaceRoom[]> {
  try {
    const res = await fetch(
      `/api/shares?ownerEmail=${encodeURIComponent(ownerEmail)}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = (await res.json()) as { shares: SharedWorkspaceRoom[] };
      if (Array.isArray(data.shares)) {
        data.shares.forEach((s) => saveLocalShareRoom(s));
        return data.shares;
      }
    }
  } catch {
    // Fallback to localStorage
  }
  return Object.values(loadLocalSharesMap()).filter(
    (r) => r.ownerEmail.toLowerCase() === ownerEmail.toLowerCase()
  );
}

export async function patchShareRoom(
  token: string,
  patch: Omit<Partial<SharedWorkspaceRoom>, 'missionTree'> & {
    missionTree?: SharedWorkspaceRoom['missionTree'] | null;
    actor?: string;
    changeSummary?: string;
    isOwnerUpdate?: boolean;
  }
): Promise<SharedWorkspaceRoom | null> {
  try {
    const res = await fetch(`/api/shares/${encodeURIComponent(token)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = (await res.json()) as { share: SharedWorkspaceRoom };
      if (data.share) {
        broadcastShareUpdate(data.share);
        return data.share;
      }
    }
  } catch {
    // Fallback offline/static
  }

  const local = loadLocalSharesMap()[token];
  if (!local) return null;
  if (!patch.isOwnerUpdate && (!local.active || !local.allowEdit)) {
    return local;
  }
  const now = Date.now();
  const resolvedMissionTree =
    patch.missionTree === null
      ? undefined
      : patch.missionTree !== undefined
      ? patch.missionTree
      : local.missionTree;
  const updated: SharedWorkspaceRoom = {
    ...local,
    ...patch,
    missionTree: resolvedMissionTree,
    includeMissionWorkflow: patch.isOwnerUpdate
      ? patch.includeMissionWorkflow ?? local.includeMissionWorkflow
      : local.includeMissionWorkflow,
    missionRootNodeId: patch.isOwnerUpdate
      ? patch.missionRootNodeId ?? local.missionRootNodeId
      : local.missionRootNodeId,
    allowedPhases: patch.isOwnerUpdate
      ? patch.allowedPhases ?? local.allowedPhases
      : local.allowedPhases,
    phasesValidatedAt: patch.isOwnerUpdate
      ? patch.phasesValidatedAt ?? local.phasesValidatedAt
      : local.phasesValidatedAt,
    wordBodies: {
      ...(local.wordBodies || {}),
      ...(patch.wordBodies || {}),
    },
    tablesByNodeId: {
      ...local.tablesByNodeId,
      ...(patch.tablesByNodeId || {}),
    },
    recoUpdatesByNodeId: {
      ...local.recoUpdatesByNodeId,
      ...(patch.recoUpdatesByNodeId || {}),
    },
    updatedAt: Math.max(now, local.updatedAt + 1),
    lastModifiedBy: patch.actor || local.lastModifiedBy,
    changeLog: patch.changeSummary
      ? [
          {
            id: `chg_${now}_${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date(now).toISOString(),
            actor: patch.actor || 'Collaborateur invité',
            summary: patch.changeSummary,
          },
          ...local.changeLog,
        ].slice(0, 50)
      : local.changeLog,
  };
  broadcastShareUpdate(updated);
  return updated;
}
