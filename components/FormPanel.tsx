import React, { useState, useEffect } from 'react';
import type { IntakeFormState, FieldStatus, FormField } from '../types';
import { cn } from '../lib/utils';

interface FormPanelProps {
  form: IntakeFormState;
  onConfirmField: (fieldId: string) => void;
  onEditField: (fieldId: string, value: string) => void;
}

const statusBadge: Record<FieldStatus, { label: string; color: string }> = {
  unanswered: { label: 'Waiting', color: 'text-gray-400 bg-gray-50' },
  inferred_from_speech: { label: 'Heard', color: 'text-amber-600 bg-amber-50' },
  inferred_from_image: { label: 'From Photo', color: 'text-purple-600 bg-purple-50' },
  confirmed: { label: 'Confirmed', color: 'text-green-600 bg-green-50' },
};

const FormPanel: React.FC<FormPanelProps> = ({ form, onConfirmField, onEditField }) => {
  const activeGroup = form.groups.find((g) => g.id === form.step);
  if (!activeGroup) return null;

  const activeField = activeGroup.fields.find((f) => f.id === form.activeFieldId) ?? null;

  // Progress for this group
  const confirmed = activeGroup.fields.filter((f) => f.status === 'confirmed').length;
  const total = activeGroup.fields.length;
  const pct = Math.round((confirmed / total) * 100);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
      {/* Group header */}
      <div className="w-full max-w-lg mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{activeGroup.label}</h2>
        <p className="text-sm text-gray-400 mt-1">
          {confirmed} of {total} fields confirmed
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Active field card */}
      {activeField ? (
        <ActiveFieldCard
          field={activeField}
          onConfirm={() => onConfirmField(activeField.id)}
          onEdit={(v) => onEditField(activeField.id, v)}
        />
      ) : (
        <div className="text-center text-gray-400 text-sm">
          All fields in this section are confirmed.
        </div>
      )}

      {/* Completed fields summary (small chips below) */}
      <div className="w-full max-w-lg mt-10">
        <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest mb-2">
          Completed
        </p>
        <div className="flex flex-wrap gap-2">
          {activeGroup.fields
            .filter((f) => f.status === 'confirmed')
            .map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-1.5 bg-green-50 border border-green-100 text-green-700 rounded-lg px-2.5 py-1 text-xs"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">{f.label}:</span>
                <span className="truncate max-w-[120px]">{f.value}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

// ─── Active field card ───

interface ActiveFieldCardProps {
  field: FormField;
  onConfirm: () => void;
  onEdit: (value: string) => void;
}

const ActiveFieldCard: React.FC<ActiveFieldCardProps> = ({ field, onConfirm, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);
  const badge = statusBadge[field.status];

  // Sync draft when field value changes externally (from AI)
  useEffect(() => {
    setDraft(field.value);
    setEditing(false);
  }, [field.value, field.id]);

  const handleSaveEdit = () => {
    onEdit(draft);
    setEditing(false);
  };

  const canConfirm = field.value.trim().length > 0 || draft.trim().length > 0;

  return (
    <div className="w-full max-w-lg rounded-2xl border-2 border-blue-200 bg-white shadow-lg p-6 transition-all">
      {/* Label + badge */}
      <div className="flex items-center justify-between mb-4">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {field.label}
        </label>
        <span className={cn('text-[10px] font-semibold px-2.5 py-0.5 rounded-full', badge.color)}>
          {badge.label}
        </span>
      </div>

      {/* Value / Input */}
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') {
                setDraft(field.value);
                setEditing(false);
              }
            }}
            className="flex-1 text-lg border-b-2 border-blue-400 bg-transparent outline-none py-1 text-gray-900 placeholder-gray-300"
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
          <button
            onClick={handleSaveEdit}
            className="text-blue-600 text-sm font-medium hover:text-blue-800"
          >
            Save
          </button>
        </div>
      ) : (
        <div
          onClick={() => setEditing(true)}
          className={cn(
            'text-xl min-h-[40px] flex items-center cursor-text rounded-lg px-3 py-2 -mx-3 transition-colors hover:bg-gray-50',
            field.value ? 'text-gray-900 font-medium' : 'text-gray-300 italic'
          )}
        >
          {field.value || 'Listening...'}
        </div>
      )}

      {/* Listening indicator */}
      {!editing && !field.value && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="text-xs text-blue-500">Waiting for response...</span>
        </div>
      )}

      {/* Action row */}
      <div className="mt-6 flex items-center gap-3">
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={() => {
            if (editing && draft !== field.value) {
              handleSaveEdit();
            }
            onConfirm();
          }}
          disabled={!canConfirm}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
            canConfirm
              ? 'bg-green-500 text-white hover:bg-green-600 shadow-md shadow-green-500/20 active:scale-95'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          )}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Confirm
        </button>
      </div>
    </div>
  );
};

export default FormPanel;
