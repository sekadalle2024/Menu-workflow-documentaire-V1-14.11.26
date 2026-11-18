import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FolderCheck,
  History,
  Lock,
  Share2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { SharedPhasesConfig, SharedWorkspaceRoom } from '../types/share';
import {
  EMPTY_SHARED_PHASES,
  SHARED_PHASE_OPTIONS,
  detectNodePhaseKey,
  detectPhaseKeyFromText,
  getEnabledPhaseLabels,
  hasAnyAllowedPhase,
  suggestDraftPhasesForNode,
} from '../utils/sharePhaseTree';
import { buildShareUrl, patchShareRoom } from '../utils/shareSyncClient';

interface ShareCollabModalProps {
  room: SharedWorkspaceRoom | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateRoom: (next: SharedWorkspaceRoom) => void;
  onValidatePhases?: (
    room: SharedWorkspaceRoom,
    nextPhases: SharedPhasesConfig,
    includeWorkflow: boolean
  ) => Promise<SharedWorkspaceRoom | null>;
  onPreviewGuest?: (token: string) => void;
}

const SHARE_TYPE_LABELS: Record<SharedWorkspaceRoom['shareType'], string> = {
  'mission-step': 'Étape de mission (Tables liées)',
  'workflow-dossier': 'Workflow · Dossier de mission',
  'suivi-recos': 'Suivi des Recommandations',
  'audit-plan': "Plan annuel d'audit",
};

export const ShareCollabModal: React.FC<ShareCollabModalProps> = ({
  room,
  isOpen,
  onClose,
  onUpdateRoom,
  onValidatePhases,
  onPreviewGuest,
}) => {
  const [copied, setCopied] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);
  const [savingPhases, setSavingPhases] = useState(false);
  const [phaseSavedToast, setPhaseSavedToast] = useState<string | null>(null);
  const [draftIncludeWorkflow, setDraftIncludeWorkflow] = useState<boolean>(true);
  const [draftPhases, setDraftPhases] = useState<SharedPhasesConfig>(EMPTY_SHARED_PHASES);
  const syncedContextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !room) {
      syncedContextRef.current = null;
      return;
    }

    const nextContextKey = `${room.token}::${room.phasesValidatedAt ?? 'pending'}`;
    if (syncedContextRef.current === nextContextKey) {
      return;
    }
    syncedContextRef.current = nextContextKey;

    setCopied(false);
    setPhaseSavedToast(null);

    if (room.shareType === 'mission-step') {
      setDraftIncludeWorkflow(
        room.phasesValidatedAt
          ? Boolean(room.includeMissionWorkflow)
          : typeof room.includeMissionWorkflow === 'boolean'
          ? room.includeMissionWorkflow
          : true
      );
    } else {
      setDraftIncludeWorkflow(true);
    }

    if (room.allowedPhases && hasAnyAllowedPhase(room.allowedPhases)) {
      setDraftPhases({ ...room.allowedPhases });
    } else if (room.phasesValidatedAt && room.shareType === 'workflow-dossier') {
      setDraftPhases({ ...EMPTY_SHARED_PHASES });
    } else if (room.node) {
      setDraftPhases(suggestDraftPhasesForNode(room.node, room.subtitle));
    } else {
      setDraftPhases({ preparation: false, realisation: false, conclusion: true });
    }
  }, [
    isOpen,
    room?.token,
    room?.phasesValidatedAt,
    room?.includeMissionWorkflow,
    room?.allowedPhases,
    room?.shareType,
    room?.node,
    room?.subtitle,
  ]);

  if (!isOpen || !room) return null;

  const shareUrl = buildShareUrl(room.token);
  const ownerActor = `${room.ownerName} [${room.ownerSignature}]`;
  const validatedPhases = room.allowedPhases ?? EMPTY_SHARED_PHASES;
  const validatedLabels = getEnabledPhaseLabels(validatedPhases);
  const isMissionStepShare = room.shareType === 'mission-step';
  const showWorkflowPhaseControls =
    room.shareType === 'workflow-dossier' || isMissionStepShare;
  const stepOwnPhaseKey =
    (room.node ? detectNodePhaseKey(room.node) : null) ??
    detectPhaseKeyFromText(room.subtitle);
  const isPhaseDirty =
    draftPhases.preparation !== validatedPhases.preparation ||
    draftPhases.realisation !== validatedPhases.realisation ||
    draftPhases.conclusion !== validatedPhases.conclusion ||
    (isMissionStepShare &&
      draftIncludeWorkflow !== Boolean(room.includeMissionWorkflow)) ||
    !room.phasesValidatedAt;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const handleToggleActive = async () => {
    setSavingFlag(true);
    const nextActive = !room.active;
    const updated = await patchShareRoom(room.token, {
      active: nextActive,
      isOwnerUpdate: true,
      actor: ownerActor,
      changeSummary: nextActive
        ? 'Lien de partage réactivé par le propriétaire'
        : 'Lien de partage désactivé par le propriétaire',
    });
    if (updated) onUpdateRoom(updated);
    setSavingFlag(false);
  };

  const handleToggleAllowEdit = async () => {
    setSavingFlag(true);
    const nextAllowEdit = !room.allowEdit;
    const updated = await patchShareRoom(room.token, {
      allowEdit: nextAllowEdit,
      isOwnerUpdate: true,
      actor: ownerActor,
      changeSummary: nextAllowEdit
        ? 'Édition des tables autorisée pour les invités sans compte'
        : 'Accès basculé en lecture seule pour les invités',
    });
    if (updated) onUpdateRoom(updated);
    setSavingFlag(false);
  };

  const handleConfirmValidatePhases = async () => {
    setSavingPhases(true);
    setPhaseSavedToast(null);
    const effectiveIncludeWorkflow = isMissionStepShare ? draftIncludeWorkflow : true;
    const effectivePhases = effectiveIncludeWorkflow
      ? { ...draftPhases }
      : { ...EMPTY_SHARED_PHASES };
    let updated: SharedWorkspaceRoom | null = null;
    if (onValidatePhases) {
      updated = await onValidatePhases(room, effectivePhases, effectiveIncludeWorkflow);
    } else {
      const enabledNames = getEnabledPhaseLabels(effectivePhases);
      updated = await patchShareRoom(room.token, {
        includeMissionWorkflow: effectiveIncludeWorkflow,
        allowedPhases: effectivePhases,
        phasesValidatedAt: Date.now(),
        isOwnerUpdate: true,
        actor: ownerActor,
        changeSummary: !effectiveIncludeWorkflow
          ? 'Accès au workflow lié désactivé (tables de l’étape uniquement)'
          : enabledNames.length > 0
          ? `Workflow & phases validés pour le partage : ${enabledNames.join(', ')}`
          : 'Toutes les phases ont été retirées du partage invité',
      });
    }
    if (updated) {
      syncedContextRef.current = `${updated.token}::${updated.phasesValidatedAt ?? 'pending'}`;
      if (updated.shareType === 'mission-step') {
        setDraftIncludeWorkflow(Boolean(updated.includeMissionWorkflow));
      }
      if (updated.allowedPhases) {
        setDraftPhases({ ...updated.allowedPhases });
      }
      onUpdateRoom(updated);
      const labels = getEnabledPhaseLabels(updated.allowedPhases);
      setPhaseSavedToast(
        isMissionStepShare && !updated.includeMissionWorkflow
          ? 'Validation enregistrée : tables de l’étape uniquement (workflow masqué).'
          : labels.length > 0
          ? `Validation enregistrée : ${labels.join(' · ')}`
          : isMissionStepShare
          ? 'Workflow lié activé (étape partagée seule).'
          : 'Accès aux phases suspendu (aucune phase cochée).'
      );
      window.setTimeout(() => setPhaseSavedToast(null), 3200);
    }
    setSavingPhases(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Partager : ${room.title}`}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400">
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display text-sm font-semibold text-white">
                  Partage collaboratif · {room.title}
                </h2>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {SHARE_TYPE_LABELS[room.shareType]} · {room.clientName} · Sans compte requis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la fenêtre de partage"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          {/* Statut activation & droits */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={savingFlag}
              onClick={handleToggleActive}
              className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                room.active
                  ? 'border-emerald-700/80 bg-emerald-950/35 text-emerald-100'
                  : 'border-slate-700 bg-slate-950/50 text-slate-400'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold">
                  <Users className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>{room.active ? 'Partage activé' : 'Partage suspendu'}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {room.active
                    ? "Toute personne disposant de l'URL accède directement à cette vue."
                    : "L'URL est temporairement bloquée pour les invités."}
                </p>
              </div>
              <span
                className={`mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                  room.active
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {room.active ? 'ACTIF' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              disabled={savingFlag}
              onClick={handleToggleAllowEdit}
              className={`flex items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                room.allowEdit
                  ? 'border-sky-700/80 bg-sky-950/35 text-sky-100'
                  : 'border-amber-700/70 bg-amber-950/25 text-amber-100'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5 font-semibold">
                  {room.allowEdit ? (
                    <ShieldCheck className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  )}
                  <span>
                    {room.allowEdit ? 'Modification autorisée' : 'Lecture seule'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {room.allowEdit
                    ? 'Les modifications des tables sont intégrées dans votre base.'
                    : 'Les invités consultent les tables sans pouvoir les éditer.'}
                </p>
              </div>
              <span
                className={`mt-0.5 shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                  room.allowEdit
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {room.allowEdit ? 'ÉDITION' : 'LECTURE'}
              </span>
            </button>
          </div>

          {/* Accès workflow lié & Validation des phases partagées par le propriétaire */}
          {showWorkflowPhaseControls && (
            <div className="space-y-3 rounded-lg border border-indigo-700/60 bg-indigo-950/20 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FolderCheck className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                  <div>
                    <h3 className="text-xs font-semibold text-white">
                      {isMissionStepShare
                        ? 'Accès au workflow lié à la mission & Validation des phases'
                        : 'Validation des phases partagées (TreeView & Collections)'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {isMissionStepShare
                        ? "Autorisez l'accès à la TreeView documentaire de la mission et cochez chaque phase à ouvrir. L'invité pourra y agir par clic droit (menu contextuel)."
                        : "Seules les phases validées sont visibles dans la TreeView de l'invité. Ses ajouts (collections, pièces) modifient uniquement ces phases autorisées."}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                    isMissionStepShare && room.phasesValidatedAt && !room.includeMissionWorkflow
                      ? 'bg-slate-800 text-slate-300 border border-slate-700'
                      : validatedLabels.length > 0 && room.phasesValidatedAt
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-700/60'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-700/60'
                  }`}
                >
                  {isMissionStepShare && room.phasesValidatedAt && !room.includeMissionWorkflow
                    ? 'TABLES SEULES'
                    : validatedLabels.length > 0 && room.phasesValidatedAt
                    ? `${validatedLabels.length} PHASE(S) VALIDÉE(S)`
                    : 'EN ATTENTE DE VALIDATION'}
                </span>
              </div>

              {isMissionStepShare && (
                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                    draftIncludeWorkflow
                      ? 'border-emerald-600/70 bg-emerald-950/30 text-emerald-50'
                      : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={draftIncludeWorkflow}
                    onChange={(e) => setDraftIncludeWorkflow(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-600 accent-emerald-500 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold text-white">
                        Donner accès au workflow documentaire lié à la mission
                      </span>
                      {room.missionTree?.label && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                          {room.missionTree.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Affiche la TreeView des documents pour cette étape et les phases autorisées ci-dessous dans la fenêtre partagée, avec menu contextuel complet.
                    </p>
                  </div>
                </label>
              )}

              <div
                className={`grid grid-cols-1 gap-2 sm:grid-cols-3 transition-opacity ${
                  isMissionStepShare && !draftIncludeWorkflow
                    ? 'pointer-events-none opacity-45'
                    : ''
                }`}
              >
                {SHARED_PHASE_OPTIONS.map((opt) => {
                  const checked = draftPhases[opt.key];
                  const isCurrentlyValidated =
                    Boolean(room.phasesValidatedAt) &&
                    (!isMissionStepShare || Boolean(room.includeMissionWorkflow)) &&
                    validatedPhases[opt.key];
                  const isStepPhase = isMissionStepShare && stepOwnPhaseKey === opt.key;
                  return (
                    <label
                      key={opt.key}
                      className={`flex cursor-pointer flex-col justify-between gap-1.5 rounded-lg border p-2.5 transition-colors ${
                        checked
                          ? 'border-indigo-500/80 bg-indigo-950/50 text-white'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled={isMissionStepShare && !draftIncludeWorkflow}
                            checked={checked}
                            onChange={(e) =>
                              setDraftPhases((prev) => ({
                                ...prev,
                                [opt.key]: e.target.checked,
                              }))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-600 accent-indigo-500 cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-slate-100">
                            {opt.label}
                          </span>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          {isCurrentlyValidated && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-300">
                              ACTIVE
                            </span>
                          )}
                          {isStepPhase && (
                            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sky-300">
                              ÉTAPE
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="pl-5 text-[10px] leading-snug text-slate-400">
                        {opt.description}
                      </p>
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="text-[11px] text-slate-300">
                  {phaseSavedToast ? (
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      {phaseSavedToast}
                    </span>
                  ) : isMissionStepShare &&
                    room.phasesValidatedAt &&
                    !room.includeMissionWorkflow ? (
                    <span className="text-slate-300">
                      Actuellement partagé :{' '}
                      <strong className="text-sky-300">Tables de l&apos;étape uniquement</strong>
                    </span>
                  ) : validatedLabels.length > 0 && room.phasesValidatedAt ? (
                    <span>
                      Actuellement partagé :{' '}
                      <strong className="text-emerald-300">
                        {validatedLabels.join(' · ')}
                      </strong>
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      {isMissionStepShare
                        ? "Cliquez sur « Valider l'accès & les phases » pour activer la TreeView du workflow dans la fenêtre partagée."
                        : "Cliquez sur « Valider les phases partagées » pour ouvrir la TreeView correspondante à l'invité."}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={savingPhases}
                  onClick={() => void handleConfirmValidatePhases()}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-60 ${
                    isPhaseDirty
                      ? 'bg-indigo-600 hover:bg-indigo-500'
                      : 'border border-emerald-600/80 bg-emerald-700/80 hover:bg-emerald-600'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {savingPhases
                      ? 'Validation...'
                      : isMissionStepShare
                      ? room.phasesValidatedAt
                        ? "Mettre à jour workflow & phases"
                        : "Valider l'accès & les phases"
                      : room.phasesValidatedAt
                      ? 'Valider / Mettre à jour les phases'
                      : 'Valider les phases partagées'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* URL collaborative */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span>URL d&apos;accès direct (sans compte requis)</span>
              <span className="font-mono text-[10px] text-slate-500">Token : {room.token}</span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-[11px] text-emerald-300 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>URL copiée</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copier le lien</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-400">
                Les membres de l&apos;équipe ou opérationnels modifient directement les tables et leurs saisies remontent automatiquement dans votre SQLite v17 &amp; vos workflows.
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                >
                  <ExternalLink className="h-3 w-3 text-sky-400" aria-hidden="true" />
                  <span>Ouvrir dans un nouvel onglet</span>
                </a>
                {onPreviewGuest && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onPreviewGuest(room.token);
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-sky-700/80 bg-sky-950/60 px-2.5 py-1 text-[11px] font-medium text-sky-200 hover:bg-sky-900/70 cursor-pointer"
                  >
                    <Eye className="h-3 w-3 text-sky-400" aria-hidden="true" />
                    <span>Tester vue invité</span>
                  </button>
                )}
              </div>
            </div>

            {showWorkflowPhaseControls && isPhaseDirty && (
              <p className="rounded border border-amber-700/50 bg-amber-950/30 px-2.5 py-1.5 text-[11px] text-amber-200">
                Des modifications d&apos;accès workflow/phases ne sont pas encore enregistrées. Cliquez sur{' '}
                <strong>
                  «{' '}
                  {isMissionStepShare
                    ? room.phasesValidatedAt
                      ? 'Mettre à jour workflow & phases'
                      : "Valider l'accès & les phases"
                    : 'Valider / Mettre à jour les phases'}{' '}
                  »
                </strong>{' '}
                ci-dessus pour les appliquer à la vue partagée.
              </p>
            )}
          </div>

          {/* Journal de synchronisation collaborative */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <History className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
                <span>Historique des modifications intégrées ({room.changeLog.length})</span>
              </div>
              {room.lastModifiedBy && (
                <span className="text-[10px] text-emerald-400">
                  Dernier intervenant : {room.lastModifiedBy}
                </span>
              )}
            </div>

            <div className="max-h-44 divide-y divide-slate-800/80 overflow-y-auto px-3.5 py-1">
              {room.changeLog.length === 0 ? (
                <div className="py-5 text-center text-[11px] text-slate-500">
                  Aucune modification externe enregistrée pour le moment. Partagez l&apos;URL pour commencer la collaboration en direct.
                </div>
              ) : (
                room.changeLog.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 py-2 text-[11px]"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-200">{entry.actor}</span>
                      <span className="text-slate-400"> — {entry.summary}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500 tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-3 text-[11px] text-slate-400">
          <span>
            Propriétaire : <strong className="text-slate-200">{room.ownerName}</strong> ({room.ownerEmail})
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 font-medium text-white hover:bg-slate-700 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
