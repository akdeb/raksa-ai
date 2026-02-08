'use client';

import React, { useState } from 'react';
import type { IntakeFormState, IntakeStep } from '../types';
import { t, fieldLabelKey, type Lang } from '../lib/i18n';
import { cn } from '../lib/utils';
import {
  Camera,
  User,
  FileText,
  Receipt,
  Check,
  ChevronDown,
  ChevronUp,
  Mic,
  Image as ImageIcon,
} from 'lucide-react';

interface SidebarProps {
  form: IntakeFormState;
}

const stepOrder: IntakeStep[] = ['photo', 'personal', 'incident', 'receipt'];

const stepLabelKey: Record<
  IntakeStep,
  'stepPhoto' | 'stepPersonal' | 'stepIncident' | 'stepReceipt'
> = {
  photo: 'stepPhoto',
  personal: 'stepPersonal',
  incident: 'stepIncident',
  receipt: 'stepReceipt',
};

const StepIcon: Record<IntakeStep, React.FC<{ className?: string }>> = {
  photo: Camera,
  personal: User,
  incident: FileText,
  receipt: Receipt,
};

// ─── Shared sub-field list ───

function SubFieldList({
  form,
  group,
  lang,
}: {
  form: IntakeFormState;
  group: IntakeFormState['groups'][number];
  lang: Lang;
}) {
  const alt = t(lang === 'th' ? 'en' : 'th');
  return (
    <div className="flex flex-col gap-0.5">
      {group.fields.map((field) => {
        const isActiveField = form.activeFieldId === field.id;
        const isConfirmed = field.status === 'confirmed';
        const isInferred =
          field.status === 'inferred_from_speech' ||
          field.status === 'inferred_from_image';
        const fKey = fieldLabelKey[field.id];
        const thLabel = fKey ? t('th')[fKey] : field.label;
        const enLabel = fKey ? t('en')[fKey] : field.label;

        return (
          <div
            key={field.id}
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded-md text-[11px] transition-colors',
              isActiveField && 'bg-blue-50 text-blue-700 font-medium',
              isConfirmed && !isActiveField && 'text-green-600',
              isInferred && !isActiveField && 'text-amber-600',
              !isActiveField && !isConfirmed && !isInferred && 'text-gray-400'
            )}
          >
            {isConfirmed ? (
              <Check className="w-3 h-3 text-green-500 shrink-0" />
            ) : isInferred ? (
              field.status === 'inferred_from_speech' ? (
                <Mic className="w-3 h-3 text-amber-400 shrink-0" />
              ) : (
                <ImageIcon className="w-3 h-3 text-purple-400 shrink-0" />
              )
            ) : (
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  isActiveField && 'bg-blue-500',
                  !isActiveField && 'bg-gray-300'
                )}
              />
            )}
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="truncate">{lang === 'th' ? thLabel : enLabel}</span>
              <span className="text-[8px] text-gray-400 truncate">
                {lang === 'th' ? enLabel : thLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Desktop Sidebar ───

function DesktopSidebar({ form }: SidebarProps) {
  const lang = (form.lang ?? 'th') as Lang;
  const l = t(lang);
  const alt = t(lang === 'th' ? 'en' : 'th');
  const currentStepIdx = stepOrder.indexOf(form.step);

  return (
    <div className="h-full flex-col bg-[#F7F7FA] p-5 overflow-y-auto hidden md:flex">
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight">{l.appName}</h2>
        <p className="text-[10px] text-gray-400 mt-0.5">{alt.appSubtitle}</p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {stepOrder.map((stepId, idx) => {
          const isActive = form.step === stepId;
          const isDone =
            idx < currentStepIdx ||
            (stepId === 'photo' &&
              form.userPhoto !== null &&
              form.step !== 'photo') ||
            (stepId === 'receipt' && form.receiptCode !== null);
          const group = form.groups.find((g) => g.id === stepId);
          const Icon = StepIcon[stepId];
          const key = stepLabelKey[stepId];

          return (
            <div key={stepId}>
              <div
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                  isActive && 'bg-white shadow-sm text-gray-900',
                  isDone && !isActive && 'text-green-600',
                  !isActive && !isDone && 'text-gray-400'
                )}
              >
                <span
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                    isActive && 'bg-blue-600 text-white',
                    isDone && !isActive && 'bg-green-500 text-white',
                    !isActive && !isDone && 'bg-gray-200 text-gray-400'
                  )}
                >
                  {isDone && !isActive ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Icon className="w-3 h-3" />
                  )}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="truncate leading-tight">{l[key]}</span>
                  <span className="text-[9px] text-gray-400 leading-tight truncate">
                    {alt[key]}
                  </span>
                </div>
                {isActive && group && (
                  <ChevronDown className="w-3.5 h-3.5 ml-auto text-gray-300 shrink-0" />
                )}
              </div>

              {(isActive || isDone) && group && (
                <div className="ml-5 mt-0.5 mb-2 pl-3.5 border-l-2 border-gray-100">
                  <SubFieldList form={form} group={group} lang={lang} />
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Mobile Top Bar ───

function MobileTopBar({ form }: SidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const lang = (form.lang ?? 'th') as Lang;
  const l = t(lang);
  const currentStepIdx = stepOrder.indexOf(form.step);
  const activeGroup = form.groups.find((g) => g.id === form.step);

  return (
    <div className="md:hidden bg-[#F7F7FA] border-b border-gray-100">
      {/* Step breadcrumbs */}
      <div className="flex items-center gap-1 px-3 py-2.5 overflow-x-auto no-scrollbar">
        {stepOrder.map((stepId, idx) => {
          const isActive = form.step === stepId;
          const isDone =
            idx < currentStepIdx ||
            (stepId === 'photo' &&
              form.userPhoto !== null &&
              form.step !== 'photo') ||
            (stepId === 'receipt' && form.receiptCode !== null);
          const Icon = StepIcon[stepId];
          const key = stepLabelKey[stepId];

          return (
            <React.Fragment key={stepId}>
              {idx > 0 && (
                <div
                  className={cn(
                    'w-4 h-px shrink-0',
                    idx <= currentStepIdx ? 'bg-green-400' : 'bg-gray-200'
                  )}
                />
              )}
              <button
                onClick={() => isActive && activeGroup && setExpanded(!expanded)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
                  isActive && 'bg-white shadow-sm text-gray-900',
                  isDone && !isActive && 'text-green-600',
                  !isActive && !isDone && 'text-gray-400'
                )}
              >
                <span
                  className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center shrink-0',
                    isActive && 'bg-blue-600 text-white',
                    isDone && !isActive && 'bg-green-500 text-white',
                    !isActive && !isDone && 'bg-gray-200 text-gray-400'
                  )}
                >
                  {isDone && !isActive ? (
                    <Check className="w-2.5 h-2.5" />
                  ) : (
                    <Icon className="w-2.5 h-2.5" />
                  )}
                </span>
                <span>{l[key]}</span>
                {isActive && activeGroup && (
                  expanded ? (
                    <ChevronUp className="w-3 h-3 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  )
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Accordion: sub-fields for active step */}
      {expanded && activeGroup && (
        <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-white animate-in slide-in-from-top-2 duration-200">
          <SubFieldList form={form} group={activeGroup} lang={lang} />
        </div>
      )}
    </div>
  );
}

// ─── Exported Sidebar (renders both, CSS handles visibility) ───

const Sidebar: React.FC<SidebarProps> = ({ form }) => {
  return (
    <>
      <DesktopSidebar form={form} />
      <MobileTopBar form={form} />
    </>
  );
};

export default Sidebar;
