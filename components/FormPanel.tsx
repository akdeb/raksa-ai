import React, { useState, useEffect } from 'react';
import type { IntakeFormState, FieldStatus, FormField } from '../types';
import { t, fieldLabelKey, type Lang } from '../lib/i18n';
import { cn } from '../lib/utils';
import { Check, Pencil, Mic, ImageIcon, Clock } from 'lucide-react';

interface FormPanelProps {
  form: IntakeFormState;
  onConfirmField: (fieldId: string) => void;
  onEditField: (fieldId: string, value: string) => void;
}

const FormPanel: React.FC<FormPanelProps> = ({ form, onConfirmField, onEditField }) => {
  const lang = (form.lang ?? 'th') as Lang;
  const l = t(lang);
  const alt = t(lang === 'th' ? 'en' : 'th');
  const activeGroup = form.groups.find((g) => g.id === form.step);
  if (!activeGroup) return null;

  const activeField = activeGroup.fields.find((f) => f.id === form.activeFieldId) ?? null;
  const confirmed = activeGroup.fields.filter((f) => f.status === 'confirmed').length;
  const total = activeGroup.fields.length;
  const pct = Math.round((confirmed / total) * 100);

  const groupKey = form.step === 'personal' ? 'stepPersonal' : 'stepIncident';

  return (
    <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-lg mb-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">{l[groupKey]}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{alt[groupKey]}</p>
        <p className="text-sm text-gray-400 mt-2">
          {confirmed} / {total} {l.fieldsConfirmed}
        </p>
        <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {activeField ? (
        <ActiveFieldCard field={activeField} lang={lang} onConfirm={() => onConfirmField(activeField.id)} onEdit={(v) => onEditField(activeField.id, v)} />
      ) : (
        <div className="text-center text-gray-400 text-sm">{l.allConfirmed}</div>
      )}

      <div className="w-full max-w-lg mt-10">
        <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">{l.completed}</p>
        <div className="flex flex-wrap gap-2">
          {activeGroup.fields.filter((f) => f.status === 'confirmed').map((f) => {
            const fKey = fieldLabelKey[f.id];
            const label = fKey ? l[fKey] : f.label;
            return (
              <div key={f.id} className="flex items-center gap-1.5 bg-green-50 border border-green-100 text-green-700 rounded-lg px-2.5 py-1 text-xs">
                <Check className="w-3 h-3" />
                <span className="font-medium">{label}:</span>
                <span className="truncate max-w-[120px]">{f.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Active field card ───

interface ActiveFieldCardProps {
  field: FormField;
  lang: Lang;
  onConfirm: () => void;
  onEdit: (value: string) => void;
}

const statusIcon: Record<FieldStatus, React.FC<{ className?: string }>> = {
  unanswered: Clock,
  inferred_from_speech: Mic,
  inferred_from_image: ImageIcon,
  confirmed: Check,
};

const statusColor: Record<FieldStatus, string> = {
  unanswered: 'text-gray-400 bg-gray-50',
  inferred_from_speech: 'text-amber-600 bg-amber-50',
  inferred_from_image: 'text-purple-600 bg-purple-50',
  confirmed: 'text-green-600 bg-green-50',
};

const ActiveFieldCard: React.FC<ActiveFieldCardProps> = ({ field, lang, onConfirm, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const [userEdited, setUserEdited] = useState(false);
  const l = t(lang);
  const alt = t(lang === 'th' ? 'en' : 'th');
  const fKey = fieldLabelKey[field.id];
  const label = fKey ? l[fKey] : field.label;
  const altLabel = fKey ? alt[fKey] : field.label;
  const StatusIcon = statusIcon[field.status];
  const statusKey: Record<FieldStatus, string> = {
    unanswered: l.statusWaiting,
    inferred_from_speech: l.statusHeard,
    inferred_from_image: l.statusFromPhoto,
    confirmed: l.statusConfirmed,
  };

  useEffect(() => {
    setDraft(field.value);
    setEditing(false);
    setUserEdited(false); // Reset when AI updates the field or field changes
  }, [field.value, field.id]);

  const handleSaveEdit = () => { onEdit(draft); setEditing(false); setUserEdited(true); };
  const canConfirm = field.value.trim().length > 0 || draft.trim().length > 0;

  // Only pulse when the USER manually edited the field and hasn't confirmed yet
  const shouldPulse = userEdited && canConfirm && !editing;

  return (
    <div className="w-full max-w-lg rounded-2xl border-2 border-blue-200 bg-white shadow-lg p-4 md:p-6 transition-all">
      <div className="flex items-center justify-between mb-1">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
          <p className="text-[10px] text-gray-400">{altLabel}</p>
        </div>
        <span className={cn('flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full', statusColor[field.status])}>
          <StatusIcon className="w-3 h-3" />
          {statusKey[field.status]}
        </span>
      </div>

      {editing ? (
        <div className="flex items-center gap-2 mt-3">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') { setDraft(field.value); setEditing(false); }
            }}
            className="flex-1 text-lg border-b-2 border-blue-400 bg-transparent outline-none py-1 text-gray-900 placeholder-gray-300"
            placeholder={`${label}...`}
          />
          <button onClick={handleSaveEdit} className="text-blue-600 text-sm font-medium hover:text-blue-800">{l.save}</button>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className={cn(
            'text-lg md:text-xl min-h-[40px] flex items-center cursor-text rounded-lg px-3 py-2 -mx-3 mt-2 transition-colors hover:bg-gray-50',
            field.value ? 'text-gray-900 font-medium' : 'text-gray-300 italic'
          )}
        >
          {field.value || l.listening}
        </div>
      )}

      {!editing && !field.value && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-xs text-blue-500">{l.waitingForResponse}</span>
        </div>
      )}

      <div className="mt-5 md:mt-6 flex items-center gap-3">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {l.edit}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => {
            if (editing && draft !== field.value) handleSaveEdit();
            onConfirm();
          }}
          disabled={!canConfirm}
          className={cn(
            'relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
            canConfirm
              ? 'bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-500/20 active:scale-95'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed',
          )}
        >
          {/* Pulsing ring when field needs confirmation */}
          {shouldPulse && (
            <span className="absolute inset-0 rounded-xl animate-ping bg-green-400 opacity-30 pointer-events-none" />
          )}
          <Check className="w-4 h-4 relative" />
          <span className="relative">{l.confirm}</span>
        </button>
      </div>

      {/* Nudge text when field has value but needs confirmation */}
      {shouldPulse && !editing && (
        <p className="mt-3 text-center text-xs text-green-600 animate-pulse">
          {lang === 'th' ? 'กดยืนยันเพื่อดำเนินการต่อ' : 'Press confirm to proceed'}
        </p>
      )}
    </div>
  );
};

export default FormPanel;
