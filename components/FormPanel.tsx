import React from 'react';
import type { IntakeFormState, FieldStatus } from '../types';
import { cn } from '../lib/utils';

interface FormPanelProps {
  form: IntakeFormState;
}

const statusBadge: Record<FieldStatus, { label: string; className: string }> = {
  unanswered: { label: 'Waiting', className: 'bg-gray-100 text-gray-500' },
  inferred_from_speech: { label: 'Heard', className: 'bg-amber-50 text-amber-600' },
  inferred_from_image: { label: 'From Image', className: 'bg-purple-50 text-purple-600' },
  confirmed: { label: 'Confirmed', className: 'bg-green-50 text-green-600' },
};

const FormPanel: React.FC<FormPanelProps> = ({ form }) => {
  const activeGroup = form.groups.find((g) => g.id === form.step);

  if (!activeGroup) return null;

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      {/* Group title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{activeGroup.label}</h2>
        <p className="text-sm text-gray-400 mt-1">
          The assistant will guide you through each field.
        </p>
      </div>

      {/* Fields */}
      <div className="flex flex-col gap-3">
        {activeGroup.fields.map((field) => {
          const isActive = form.activeFieldId === field.id;
          const badge = statusBadge[field.status];

          return (
            <div
              key={field.id}
              className={cn(
                'rounded-xl border px-4 py-3 transition-all duration-200',
                isActive && 'border-blue-400 bg-blue-50/50 shadow-sm ring-1 ring-blue-200',
                !isActive && field.status === 'confirmed' && 'border-green-200 bg-green-50/30',
                !isActive && field.status !== 'confirmed' && 'border-gray-100 bg-white'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {field.label}
                </label>
                <span
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-full',
                    badge.className
                  )}
                >
                  {badge.label}
                </span>
              </div>

              <div
                className={cn(
                  'text-sm min-h-[28px] flex items-center',
                  field.value ? 'text-gray-900' : 'text-gray-300 italic'
                )}
              >
                {field.value || (isActive ? 'Listening...' : 'Pending')}
              </div>

              {isActive && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                  <span className="text-[10px] text-blue-500 font-medium">
                    Currently asking...
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FormPanel;
