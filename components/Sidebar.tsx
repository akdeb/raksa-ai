import React from 'react';
import type { IntakeFormState, IntakeStep } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  form: IntakeFormState;
}

const stepOrder: IntakeStep[] = ['photo', 'personal', 'incident', 'receipt'];

const stepLabels: Record<IntakeStep, string> = {
  photo: 'Photo ID',
  personal: 'Personal Details',
  incident: 'Incident Details',
  receipt: 'Get Receipt',
};

const stepIcons: Record<IntakeStep, string> = {
  photo: 'camera',
  personal: 'user',
  incident: 'file',
  receipt: 'check',
};

const Sidebar: React.FC<SidebarProps> = ({ form }) => {
  const currentStepIdx = stepOrder.indexOf(form.step);

  return (
    <div className="h-full flex flex-col bg-[#F7F7FA] p-5 overflow-y-auto">
      {/* Brand */}
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight">Raksa AI</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">Police Report Intake</p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {stepOrder.map((stepId, idx) => {
          const isActive = form.step === stepId;
          const isDone =
            idx < currentStepIdx ||
            (stepId === 'photo' && form.userPhoto !== null && form.step !== 'photo') ||
            (stepId === 'receipt' && form.receiptCode !== null);
          const group = form.groups.find((g) => g.id === stepId);

          return (
            <div key={stepId}>
              {/* Step header */}
              <div
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive && 'bg-white shadow-sm text-gray-900',
                  isDone && !isActive && 'text-green-600',
                  !isActive && !isDone && 'text-gray-400'
                )}
              >
                {/* Step indicator */}
                <span
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                    isActive && 'bg-blue-600 text-white',
                    isDone && !isActive && 'bg-green-500 text-white',
                    !isActive && !isDone && 'bg-gray-200 text-gray-400'
                  )}
                >
                  {isDone && !isActive ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className="truncate">{stepLabels[stepId]}</span>

                {/* Expand chevron for active group */}
                {isActive && group && (
                  <svg className="w-3.5 h-3.5 ml-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>

              {/* Sub-fields (only for active or past steps with a group) */}
              {(isActive || isDone) && group && (
                <div className="ml-5 mt-0.5 mb-2 pl-3.5 border-l-2 border-gray-100 flex flex-col gap-0.5">
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
                          'flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors',
                          isActiveField && 'bg-blue-50 text-blue-700 font-medium',
                          isConfirmed && !isActiveField && 'text-green-600',
                          isInferred && !isActiveField && 'text-amber-600',
                          !isActiveField && !isConfirmed && !isInferred && 'text-gray-400'
                        )}
                      >
                        {isConfirmed ? (
                          <svg className="w-3 h-3 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <span
                            className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              isInferred && 'bg-amber-400',
                              isActiveField && !isInferred && 'bg-blue-500',
                              !isActiveField && !isInferred && 'bg-gray-300'
                            )}
                          />
                        )}
                        <span className="truncate">{field.label}</span>
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
