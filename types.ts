export interface StreamConfig {
  sampleRate: number;
}

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export interface ToolExecution {
  name: string;
  args: Record<string, unknown>;
  id: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface PoliceStation {
  name: string;
  distance: string;
  isOpen: boolean;
}

// ─── Form Schema ───

export type FieldStatus =
  | 'unanswered'
  | 'inferred_from_speech'
  | 'inferred_from_image'
  | 'confirmed';

export interface FormField {
  id: string;
  label: string;
  value: string;
  status: FieldStatus;
}

export interface FormGroup {
  id: string;
  label: string;
  fields: FormField[];
}

export type IntakeStep = 'photo' | 'personal' | 'incident' | 'receipt';
export type AppLang = 'th' | 'en';

export interface IntakeFormState {
  step: IntakeStep;
  activeFieldId: string | null;
  groups: FormGroup[];
  receiptCode: string | null;
  userPhoto: string | null; // base64 jpeg
  lang: AppLang;
}
