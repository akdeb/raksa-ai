import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';

// Audio config constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

// Tool Definitions – intake form tools
const TOOLS: FunctionDeclaration[] = [
  {
    name: 'update_field',
    description:
      'Update a form field with a value inferred from the user\'s speech or an image they sent. ' +
      'Call this whenever you learn or infer a value for ANY form field. ' +
      'You MUST call this for every piece of information the user gives you.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        field_id: {
          type: Type.STRING,
          description:
            'The unique field identifier. One of: full_name, date_of_birth, age, gender, nationality, phone, address, ' +
            'incident_type, incident_description, incident_date, incident_location, incident_victims, incident_suspects, incident_evidence',
        },
        value: { type: Type.STRING, description: 'The value to set for this field' },
        source: {
          type: Type.STRING,
          description: 'How the value was obtained: "speech" or "image"',
        },
      },
      required: ['field_id', 'value', 'source'],
    },
  },
  {
    name: 'confirm_field',
    description:
      'Mark a field as confirmed by the user. Call this ONLY after the user has explicitly agreed ' +
      'that the value is correct (e.g. they said "yes", "correct", "that\'s right").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        field_id: {
          type: Type.STRING,
          description: 'The field identifier to confirm',
        },
      },
      required: ['field_id'],
    },
  },
  {
    name: 'next_step',
    description:
      'Move the form to the next section. Call this when ALL fields in the current section are confirmed. ' +
      'Steps are: personal -> incident -> receipt.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        step: {
          type: Type.STRING,
          description: 'The step to move to: "incident" or "receipt"',
        },
      },
      required: ['step'],
    },
  },
];

// Helper for PCM blob creation
function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  
  return {
    data: base64,
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Helper for decoding audio
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class GeminiLiveModel {
  private ai: GoogleGenAI | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private session: any = null;
  private speechEndTime: number | null = null;
  private isConnected = false;
  private scheduledSources: AudioBufferSourceNode[] = [];
  
  public onStateChange: (state: ConnectionState) => void = () => {};
  public onTranscript: (text: string, role: 'user' | 'model', isFinal: boolean) => void = () => {};
  public onToolCall: (name: string, args: any, id: string) => void = () => {};
  public onAudioData: (frequencyData: Uint8Array) => void = () => {}; 

  constructor() {}

  /** Fetch an ephemeral token from our server, falling back to NEXT_PUBLIC_ key */
  private async getEphemeralToken(): Promise<{ key: string; isEphemeral: boolean }> {
    try {
      const res = await fetch('/api/gemini', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          console.log('[gemini] Using ephemeral token');
          return { key: data.token, isEphemeral: true };
        }
      }
      console.warn('[gemini] Ephemeral token endpoint failed, falling back to env key');
    } catch {
      console.warn('[gemini] Ephemeral token fetch error, falling back to env key');
    }

    // Fallback: client-side key (less secure, for dev only)
    const fallback =
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY;
    if (!fallback) throw new Error('No Gemini API key available.');
    return { key: fallback, isEphemeral: false };
  }

  async connect(lang: 'th' | 'en' = 'th') {
    this.onStateChange(ConnectionState.CONNECTING);

    const langInstruction = lang === 'th'
      ? 'You MUST speak Thai (ภาษาไทย) at all times. Only switch to English if the user clearly speaks English first.'
      : 'You MUST speak English at all times. Only switch to Thai if the user clearly speaks Thai first.';

    try {
      // 0. Get ephemeral token (or fallback key)
      const { key: apiKey, isEphemeral } = await this.getEphemeralToken();
      this.ai = new GoogleGenAI({
        apiKey,
        ...(isEphemeral ? { httpOptions: { apiVersion: 'v1alpha' } } : {}),
      });

      // 1. Setup Audio Input
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: INPUT_SAMPLE_RATE,
      });
      
      this.source = this.inputContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

      // 2. Setup Audio Output
      this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: OUTPUT_SAMPLE_RATE,
      });

      if (this.outputContext.state === 'suspended') {
        await this.outputContext.resume();
      }
      this.nextStartTime = this.outputContext.currentTime;

      // 3. Connect to Gemini Live
      const sessionPromise = this.ai!.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          systemInstruction: `You are Raksa (รักษา), an intelligent AI assistant for the Royal Thai Police intake desk.
Your job is to fill out a police report form by interviewing the person in front of you.

LANGUAGE: ${langInstruction}

WORKFLOW:
1. Greet the person warmly and tell them you will help them file a report.
2. Ask for the CURRENT field being collected.
3. When the user answers, call "update_field" for EVERY piece of information you can extract — even if it belongs to a later field. For example if the user says "My name is John, I'm 30, male, from the USA", you MUST call update_field four times (full_name, age, gender, nationality).
4. After calling update_field, read back the value of the FIRST unconfirmed field and ask the user to confirm.
5. When the user confirms (says yes / correct / right / okay / ครับ / ค่ะ / ใช่), call "confirm_field".
6. Then IMMEDIATELY move to the NEXT unconfirmed field. If that field already has a value (because you pre-filled it), read it back and ask for confirmation.
7. If the user sends an image, call "update_field" with source="image" for every field you can infer from the image.
8. When you receive a system message like "[USER_ACTION] Field X confirmed via UI", that means the user clicked the confirm button on the form. You MUST call "confirm_field" for that field and move on to the next unconfirmed field WITHOUT re-asking.

PHOTO STEP:
- The very first thing you receive may be a photo of the user.
- Analyze the photo and call "update_field" with source="image" for any personal details you can infer: gender, approximate age, etc.
- Then proceed with the personal details interview, starting with the first unconfirmed field.

PERSONAL DETAILS FIELDS (ask in this order):
- full_name (ชื่อ-นามสกุล / Full Name)
- date_of_birth (วันเกิด / Date of Birth)
- age (อายุ / Age)
- gender (เพศ / Gender)
- nationality (สัญชาติ / Nationality)
- phone (หมายเลขโทรศัพท์ / Phone Number)
- address (ที่อยู่ / Address)

CRITICAL RULE — STEP TRANSITIONS:
- You MUST call "confirm_field" for EVERY field in the current section before calling "next_step".
- NEVER call "next_step" unless EVERY field in the current section has been confirmed via "confirm_field".
- NEVER verbally announce moving to the next section unless you have confirmed ALL fields first.
- If you receive a [SYSTEM] message saying fields are unconfirmed, you MUST go back and confirm them before proceeding.
- Count your confirm_field calls: Personal Details has 7 fields, Incident Details has 7 fields. ALL must be confirmed.

After ALL 7 personal details are confirmed (every single one must have had confirm_field called), call "next_step" with step="incident" and announce you're moving to incident details.

INCIDENT DETAILS FIELDS (ask in this order):
- incident_type (ประเภทเหตุการณ์ / Type of Incident)
- incident_description (รายละเอียด / What Happened)
- incident_date (วันเวลาเกิดเหตุ / When It Happened)
- incident_location (สถานที่ / Location)
- incident_victims (ผู้เสียหาย / Who Was Affected)
- incident_suspects (ลักษณะผู้ต้องสงสัย / Suspect Description)
- incident_evidence (หลักฐาน / Evidence / Notes)

After ALL 7 incident details are confirmed, call "next_step" with step="receipt" and tell the user the report is complete.

RULES:
- ${langInstruction}
- Be polite, calm, and reassuring.
- Keep responses concise and spoken-word friendly.
- ALWAYS use the tools to update and confirm fields. Never skip the tool calls.
- If a user gives multiple pieces of info at once, call update_field for EACH field separately in one batch.
- If a field is already filled from a previous answer, just read it back and ask for confirmation — don't re-ask.
- If the user corrects a value, call update_field again with the new value, then ask for confirmation again.
- When you receive a [USER_ACTION] system message, treat it as an authoritative confirmation and move on.
- NEVER skip confirm_field for ANY field. Even if you think it's obvious or trivially correct, you MUST still call confirm_field.`,
          tools: [{ functionDeclarations: TOOLS }],
        },
        callbacks: {
          onopen: () => {
            this.isConnected = true;
            this.onStateChange(ConnectionState.CONNECTED);
            // Immediately start listening when connected
            this.startAudioStreaming(sessionPromise);
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg, sessionPromise),
          onclose: () => {
            this.isConnected = false;
            this.cleanupAudio();
            this.onStateChange(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error('Gemini Live Error:', err);
            this.isConnected = false;
            this.cleanupAudio();
            this.onStateChange(ConnectionState.ERROR);
          },
        },
      });

      this.session = sessionPromise;

    } catch (error) {
      console.error('Connection failed:', error);
      this.onStateChange(ConnectionState.ERROR);
    }
  }

  // Method to send image data
  public sendImage(base64Data: string, mimeType: string = 'image/jpeg') {
    if (!this.session || !this.isConnected) return;
    this.session.then((s: any) => {
      if (!this.isConnected) return;
      try {
        s.sendRealtimeInput({
          media: { mimeType, data: base64Data },
        });
      } catch {
        // WebSocket may be closed
      }
    });
  }

  private startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.processor || !this.source || !this.inputContext) return;

    this.processor.onaudioprocess = (e) => {
      // Guard: don't send audio if the WebSocket is closed
      if (!this.isConnected) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Simple visualizer data
      const visualData = new Uint8Array(inputData.length);
      for(let i=0; i<inputData.length; i++) {
        visualData[i] = Math.abs(inputData[i]) * 255;
      }
      this.onAudioData(visualData.slice(0, 64)); 

      const pcmBlob = createPcmBlob(inputData);
      
      // Send audio chunk
      sessionPromise.then((session) => {
        try {
          session.sendRealtimeInput({ media: pcmBlob });
        } catch {
          // WebSocket may be closed, ignore
        }
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  /** Immediately stop all scheduled audio buffers and reset the playback timeline */
  private flushAudioQueue() {
    for (const src of this.scheduledSources) {
      try { src.stop(); } catch { /* already stopped */ }
      try { src.disconnect(); } catch { /* already disconnected */ }
    }
    this.scheduledSources = [];
    if (this.outputContext) {
      this.nextStartTime = this.outputContext.currentTime;
    }
    console.log('[gemini] Audio queue flushed (interrupted)');
  }

  /** Strip Gemini control tokens like <ctrl46>, <shift>, etc. from transcript text */
  private sanitizeTranscript(text: string): string {
    return text.replace(/<ctrl\d+>|<shift>|<alt\d+>|<[A-Za-z]+\d*>/g, '').trim();
  }

  private async handleMessage(message: LiveServerMessage, sessionPromise: Promise<any>) {
    // ─── Handle interruption: user spoke over the model ───
    if ((message.serverContent as any)?.interrupted) {
      console.log('[gemini] Model interrupted by user');
      this.flushAudioQueue();
    }

    // ─── User speech transcript ───
    const rawInputTranscript = message.serverContent?.inputTranscription?.text;
    if (rawInputTranscript) {
       // User is speaking → flush any remaining model audio so it doesn't overlap
       this.flushAudioQueue();
       this.speechEndTime = performance.now();
       const cleaned = this.sanitizeTranscript(rawInputTranscript);
       if (cleaned) this.onTranscript(cleaned, 'user', false);
    }

    // 1. Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.outputContext) {
      // Latency: first audio chunk after user speech = response latency
      if (this.speechEndTime !== null) {
        const latencyMs = performance.now() - this.speechEndTime;
        console.log(`[gemini] Response latency: ${latencyMs.toFixed(0)}ms`);
        this.speechEndTime = null;
      }
      this.playAudioChunk(audioData);
    }

    // 2. Handle Transcription
    const rawOutputTranscript = message.serverContent?.outputTranscription?.text;
    if (rawOutputTranscript) {
       const cleaned = this.sanitizeTranscript(rawOutputTranscript);
       if (cleaned) this.onTranscript(cleaned, 'model', false);
    }

    // Handle Turn Complete (finalize transcript)
    if (message.serverContent?.turnComplete) {
       this.onTranscript('', 'model', true);
    }

    // 3. Handle Tool Calls
    if (message.toolCall?.functionCalls) {
      for (const call of message.toolCall.functionCalls) {
        const name = call.name ?? '';
        const args = call.args ?? {};
        const id = call.id ?? '';

        // Notify the app (App.tsx handles form state updates)
        this.onToolCall(name, args, id);

        // Send success response back to Gemini so it continues
        sessionPromise.then((session) => {
          session.sendToolResponse({
            functionResponses: {
              id: call.id,
              name: call.name,
              response: { result: 'ok' },
            },
          });
        });
      }
    }
  }

  private async playAudioChunk(base64Audio: string) {
    if (!this.outputContext) return;

    try {
      const bytes = decodeBase64(base64Audio);
      const dataInt16 = new Int16Array(bytes.buffer);

      // --- Visualizer: Process output audio for visual feedback ---
      let sum = 0;
      for (let i = 0; i < dataInt16.length; i += 50) {
        sum += Math.abs(dataInt16[i]);
      }
      const avg = sum / (dataInt16.length / 50);
      const normalized = Math.min(255, (avg / 10000) * 255); 
      const visualData = new Uint8Array(64).fill(normalized);
      this.onAudioData(visualData);
      // -----------------------------------------------------------

      const buffer = this.outputContext.createBuffer(1, dataInt16.length, OUTPUT_SAMPLE_RATE);
      const channelData = buffer.getChannelData(0);
      
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = this.outputContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputContext.destination);

      const currentTime = this.outputContext.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
      
      source.start(startTime);
      this.nextStartTime = startTime + buffer.duration;

      // Track so we can cancel on interruption
      this.scheduledSources.push(source);
      source.onended = () => {
        const idx = this.scheduledSources.indexOf(source);
        if (idx !== -1) this.scheduledSources.splice(idx, 1);
      };
      
    } catch (e) {
      console.error('Error playing audio chunk', e);
    }
  }

  private cleanupAudio() {
    // Stop all scheduled audio sources first
    this.flushAudioQueue();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
    if (this.processor) this.processor.disconnect();
    if (this.source) this.source.disconnect();
    if (this.inputContext) {
      try { this.inputContext.close(); } catch { /* already closed */ }
    }
    if (this.outputContext) {
      try { this.outputContext.close(); } catch { /* already closed */ }
    }
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.inputContext = null;
    this.outputContext = null;
    this.nextStartTime = 0;
  }

  async disconnect() {
    this.isConnected = false;
    this.cleanupAudio();
    this.onStateChange(ConnectionState.DISCONNECTED);

    if (this.session) {
      try { await this.session; } catch { /* ignore */ }
    }
    this.session = null;
  }

  public sendText(text: string) {
    if (!this.session || !this.isConnected) return;
    this.session.then((session: any) => {
      if (!this.isConnected) return;
      try {
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text }] }],
          turnComplete: true,
        });
      } catch {
        // WebSocket may be closed
      }
    });
  }
}
