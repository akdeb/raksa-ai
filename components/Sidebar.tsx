import React from 'react';
import type { IntakeFormState, IntakeStep } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  form: IntakeFormState;
}

const stepOrder: IntakeStep[] = ['personal', 'incident', 'receipt'];

const stepLabels: Record<IntakeStep, string> = {
  personal: 'Personal Details',
  incident: 'Incident Details',
  receipt: 'Get Receipt',
};

const Sidebar: React.FC<SidebarProps> = ({ form }) => {
  const currentStepIdx = stepOrder.indexOf(form.step);

  return (
    <div className="h-full flex flex-col bg-[#F2F2F7]/60 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-1">Intake Form</h2>
      <p className="text-xs text-gray-400 mb-6">Police Report Assistant</p>

      <nav className="flex flex-col gap-1">
        {stepOrder.map((stepId, idx) => {
          const isActive = form.step === stepId;
          const isDone = idx < currentStepIdx || (stepId === 'receipt' && form.receiptCode !== null);
          const group = form.groups.find((g) => g.id === stepId);

          return (
            <div key={stepId}>
              {/* Step header */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive && 'bg-white shadow-sm text-black',
                  isDone && !isActive && 'text-green-600',
                  !isActive && !isDone && 'text-gray-400'
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                    isActive && 'bg-black text-white',
                    isDone && !isActive && 'bg-green-500 text-white',
                    !isActive && !isDone && 'bg-gray-200 text-gray-500'
                  )}
                >
                  {isDone && !isActive ? '✓' : idx + 1}
                </span>
                <span className="truncate">{stepLabels[stepId]}</span>
              </div>

              {/* Sub-fields (only for active step with a group) */}
              {isActive && group && (
                <div className="ml-6 mt-1 mb-2 flex flex-col gap-0.5">
                  {group.fields.map((field) => {
                    const isActiveField = form.activeFieldId === field.id;
                    const isConfirmed = field.status === 'confirmed';
                    const isInferred =
                      field.status === 'inferred_from_speech' ||
                      field.status === 'inferred_from_image';

                    return (
                      <div
                        key={field.id}
                        className={cn(
                          'flex items-center gap-2 px-2 py-1 rounded text-xs',
                          isActiveField && 'bg-blue-50 text-blue-700 font-medium',
                          isConfirmed && !isActiveField && 'text-green-600',
                          isInferred && !isActiveField && 'text-amber-600',
                          !isActiveField && !isConfirmed && !isInferred && 'text-gray-400'
                        )}
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            isConfirmed && 'bg-green-500',
                            isInferred && 'bg-amber-400',
                            isActiveField && !isConfirmed && !isInferred && 'bg-blue-500',
                            !isActiveField && !isConfirmed && !isInferred && 'bg-gray-300'
                          )}
                        />
                        <span className="truncate">{field.label}</span>
                        {isConfirmed && <span className="ml-auto text-green-500">✓</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
