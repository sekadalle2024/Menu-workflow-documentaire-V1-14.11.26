import React, { useState } from 'react';
import { FileText, Plus, RotateCcw, Send, X } from 'lucide-react';
import { SAMPLE_AUDIT_TEMPLATES } from '../data/dossierStructure';
import { AuditChatMessage } from '../types/dossier';
import { WorkflowTreeNode } from '../types/workflow';

interface AuditChatWorkspaceProps {
  messages: AuditChatMessage[];
  onAppendTemplate: (templateId: string) => void;
  onSendChatPrompt: (promptText: string, attachedDoc: WorkflowTreeNode | null) => void;
  onResetMessages: () => void;
  chatContainerRef: React.RefObject<HTMLDivElement | null>;
  attachedDoc: WorkflowTreeNode | null;
  onClearAttachedDoc: () => void;
}

export const AuditChatWorkspace: React.FC<AuditChatWorkspaceProps> = ({
  messages,
  onAppendTemplate,
  onSendChatPrompt,
  onResetMessages,
  chatContainerRef,
  attachedDoc,
  onClearAttachedDoc,
}) => {
  const [promptInput, setPromptInput] = useState('');

  const handleSubmitPrompt = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = promptInput.trim();
    if (!trimmed && !attachedDoc) return;
    onSendChatPrompt(
      trimmed || `Analyser et structurer le document « ${attachedDoc?.label} »`,
      attachedDoc
    );
    setPromptInput('');
  };

  return (
    <section
      id="mission-workspace"
      aria-label="Conversation nod n8n et tableaux d'audit"
      className="flex flex-col rounded-xl border border-slate-200 bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Console conversationnelle d&apos;audit · nod n8n
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Intégrez des documents depuis les workflows pour automatiser vos étapes de mission.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetMessages}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Réinitialiser</span>
        </button>
      </div>

      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <div className="mb-2 text-xs font-medium text-slate-600">
          Générer rapidement une table d&apos;étape de mission :
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_AUDIT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onAppendTemplate(tpl.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tpl.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        ref={chatContainerRef}
        className="max-h-[540px] space-y-4 overflow-y-auto px-5 py-5"
      >
        {messages.map((msg) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <article
              key={msg.id}
              data-role={msg.role}
              data-message-id={msg.id}
              className={`rounded-lg border p-4 ${
                isAssistant ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-900">{msg.author}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{msg.timestamp}</span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-slate-700">{msg.content}</p>

              {msg.table && (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-300/90 bg-white shadow-[0_6px_18px_-3px_rgba(15,23,42,0.22),0_3px_8px_-2px_rgba(15,23,42,0.14)]">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="wf-table-head-row divide-x text-[12px] font-semibold">
                          {msg.table.headers.map((header, i) => (
                            <th key={i} className="px-3.5 py-2.5 whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                        {msg.table.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="divide-x divide-slate-200 bg-white">
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className={`px-3.5 py-2.5 transition-colors hover:bg-[#EAF4FF] hover:ring-1 hover:ring-inset hover:ring-sky-500 ${
                                  cIdx === row.length - 1
                                    ? 'font-mono text-[11px] font-medium text-slate-900 tabular-nums whitespace-nowrap'
                                    : ''
                                }`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <form
        onSubmit={handleSubmitPrompt}
        className="space-y-2.5 border-t border-slate-200 bg-slate-50/60 px-5 py-4"
      >
        {attachedDoc && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" />
              <span className="truncate font-medium">
                Contexte intégré : {attachedDoc.label}
              </span>
              {attachedDoc.driveId && (
                <span className="shrink-0 font-mono text-[11px] text-blue-700">
                  {attachedDoc.driveId}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClearAttachedDoc}
              aria-label="Retirer le document du contexte"
              className="shrink-0 rounded p-0.5 text-blue-700 hover:bg-blue-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Saisissez une instruction d'audit (ex: Générer FRAP ou Programme de travail)..."
            aria-label="Zone de saisie du chat audit"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-2 focus:outline-blue-600"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>Envoyer</span>
          </button>
        </div>
      </form>
    </section>
  );
};
