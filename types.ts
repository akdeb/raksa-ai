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
  args: Record<string, any>;
  id: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface PoliceStation {
  name: string;
  distance: string;
  isOpen: boolean;
}
