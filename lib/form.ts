import type { IntakeFormState, FormGroup } from '../types';

const STORAGE_KEY = 'raksa_intake_form';

export function createDefaultForm(): IntakeFormState {
  const groups: FormGroup[] = [
    {
      id: 'personal',
      label: 'Personal Details',
      fields: [
        { id: 'full_name', label: 'Full Name', value: '', status: 'unanswered' },
        { id: 'date_of_birth', label: 'Date of Birth', value: '', status: 'unanswered' },
        { id: 'age', label: 'Age', value: '', status: 'unanswered' },
        { id: 'gender', label: 'Gender', value: '', status: 'unanswered' },
        { id: 'nationality', label: 'Nationality', value: '', status: 'unanswered' },
        { id: 'phone', label: 'Phone Number', value: '', status: 'unanswered' },
        { id: 'address', label: 'Address', value: '', status: 'unanswered' },
      ],
    },
    {
      id: 'incident',
      label: 'Incident Details',
      fields: [
        { id: 'incident_type', label: 'Type of Incident', value: '', status: 'unanswered' },
        { id: 'incident_description', label: 'What Happened', value: '', status: 'unanswered' },
        { id: 'incident_date', label: 'When It Happened', value: '', status: 'unanswered' },
        { id: 'incident_location', label: 'Location', value: '', status: 'unanswered' },
        { id: 'incident_victims', label: 'Who Was Affected', value: '', status: 'unanswered' },
        { id: 'incident_suspects', label: 'Suspect Description', value: '', status: 'unanswered' },
        { id: 'incident_evidence', label: 'Evidence / Notes', value: '', status: 'unanswered' },
      ],
    },
  ];

  return {
    step: 'photo',
    activeFieldId: null,
    groups,
    receiptCode: null,
    userPhoto: null,
    lang: 'th',
  };
}

export function generateReceiptCode(): string {
  const prefix = 'RTP';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Find the next unconfirmed field, prioritizing the current step's group.
 * Only crosses to the next group if the current group is fully confirmed.
 */
export function findNextField(
  form: IntakeFormState
): { groupId: string; fieldId: string } | null {
  // 1. Look within the current step's group first
  const currentGroup = form.groups.find((g) => g.id === form.step);
  if (currentGroup) {
    for (const field of currentGroup.fields) {
      if (field.status !== 'confirmed') {
        return { groupId: currentGroup.id, fieldId: field.id };
      }
    }
  }

  // 2. Current group fully confirmed — look in subsequent groups
  for (const group of form.groups) {
    if (group.id === form.step) continue; // already checked
    for (const field of group.fields) {
      if (field.status !== 'confirmed') {
        return { groupId: group.id, fieldId: field.id };
      }
    }
  }
  return null;
}

/**
 * Check if all fields in a specific group are confirmed.
 */
export function groupFullyConfirmed(form: IntakeFormState, groupId: string): boolean {
  const group = form.groups.find((g) => g.id === groupId);
  if (!group) return true;
  return group.fields.every((f) => f.status === 'confirmed');
}

/**
 * Get the names of unconfirmed fields in a group.
 */
export function unconfirmedFieldsInGroup(form: IntakeFormState, groupId: string): string[] {
  const group = form.groups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.fields.filter((f) => f.status !== 'confirmed').map((f) => `${f.label} (${f.id})`);
}

export function allFieldsConfirmed(form: IntakeFormState): boolean {
  return form.groups.every((g) => g.fields.every((f) => f.status === 'confirmed'));
}

// ─── LocalStorage persistence ───

export function saveFormToStorage(form: IntakeFormState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  } catch {
    // quota exceeded or SSR — ignore
  }
}

export function loadFormFromStorage(): IntakeFormState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IntakeFormState;
  } catch {
    return null;
  }
}

export function clearFormStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Returns true when a saved form exists AND is not fully completed (no receipt).
 */
export function hasSavedInProgressForm(): boolean {
  const saved = loadFormFromStorage();
  if (!saved) return false;
  // If the receipt was already generated, the form is done
  return saved.receiptCode === null;
}
