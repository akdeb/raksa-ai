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
  
  public onStateChange: (state: ConnectionState) => void = () => {};
  public onTranscript: (text: string, role: 'user' | 'model', isFinal: boolean) => void = () => {};
  public onToolCall: (name: string, args: any, id: string) => void = () => {};
  public onAudioData: (frequencyData: Uint8Array) => void = () => {}; 

  constructor() {}

  private getApiKey() {
    return (
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY
    );
  }

  private getClient() {
    if (!this.ai) {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error('Missing Gemini API key.');
      }
      this.ai = new GoogleGenAI({ apiKey });
    }
    return this.ai;
  }

  async connect() {
    this.onStateChange(ConnectionState.CONNECTING);

    try {
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
      const sessionPromise = this.getClient().live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          systemInstruction: `You are Raksa, an intelligent AI assistant for the Royal Thai Police intake desk.
Your job is to fill out a police report form by interviewing the person in front of you.

WORKFLOW:
1. Greet the person warmly and tell them you will help them file a report.
2. You MUST ask for each field ONE AT A TIME, in order.
3. When the user answers, call the "update_field" tool with the value and source="speech".
4. Read back what you understood and ask the user to confirm. For example: "I heard your name is John Smith. Is that correct?"
5. When the user confirms (says yes / correct / right), call the "confirm_field" tool.
6. Then move to the NEXT unconfirmed field.
7. If the user sends an image and you can extract info from it, call "update_field" with source="image" for each field you can read.

PERSONAL DETAILS FIELDS (ask in this order):
- full_name (Full Name)
- date_of_birth (Date of Birth)
- age (Age)
- gender (Gender)
- nationality (Nationality)
- phone (Phone Number)
- address (Address)

After ALL personal details are confirmed, call "next_step" with step="incident" and announce you're moving to incident details.

INCIDENT DETAILS FIELDS (ask in this order):
- incident_type (Type of Incident)
- incident_description (What Happened)
- incident_date (When It Happened)
- incident_location (Location)
- incident_victims (Who Was Affected)
- incident_suspects (Suspect Description)
- incident_evidence (Evidence / Notes)

After ALL incident details are confirmed, call "next_step" with step="receipt" and tell the user the report is complete.

RULES:
- Detect the language spoken (Thai or English) and respond in the same language.
- Be polite, calm, and reassuring.
- Keep responses concise and spoken-word friendly.
- ALWAYS use the tools to update and confirm fields. Never skip the tool calls.
- If a user gives multiple pieces of info at once, call update_field for EACH field separately.
- If the user corrects a value, call update_field again with the new value, then ask for confirmation again.`,
          tools: [{ functionDeclarations: TOOLS }],
        },
        callbacks: {
          onopen: () => {
            this.onStateChange(ConnectionState.CONNECTED);
            // Immediately start listening when connected
            this.startAudioStreaming(sessionPromise);
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg, sessionPromise),
          onclose: () => this.onStateChange(ConnectionState.DISCONNECTED),
          onerror: (err) => {
            console.error('Gemini Live Error:', err);
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
    if (this.session) {
      this.session.then((s: any) => {
        s.sendRealtimeInput({
          media: {
            mimeType,
            data: base64Data
          }
        });
      });
    }
  }

  private startAudioStreaming(sessionPromise: Promise<any>) {
    if (!this.processor || !this.source || !this.inputContext) return;

    this.processor.onaudioprocess = (e) => {
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
        session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  private async handleMessage(message: LiveServerMessage, sessionPromise: Promise<any>) {
    // Latency: mark when user turn ends (turnComplete after user speech)
    // Gemini signals end-of-user-speech via inputTranscription followed by model audio
    const inputTranscript = message.serverContent?.inputTranscription?.text;
    if (inputTranscript) {
       this.speechEndTime = performance.now();
       this.onTranscript(inputTranscript, 'user', false);
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
    const outputTranscript = message.serverContent?.outputTranscription?.text;
    if (outputTranscript) {
       this.onTranscript(outputTranscript, 'model', false);
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
      
    } catch (e) {
      console.error('Error playing audio chunk', e);
    }
  }

  async disconnect() {
    this.onStateChange(ConnectionState.DISCONNECTED);
    
    if (this.session) {
      await this.session; // Wait for promise to settle if needed, but we don't need to close it explicitly as per API design
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }
    
    if (this.processor) this.processor.disconnect();
    if (this.source) this.source.disconnect();
    if (this.inputContext) this.inputContext.close();
    if (this.outputContext) this.outputContext.close();
    
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.inputContext = null;
    this.outputContext = null;
    this.nextStartTime = 0;
  }

  public sendText(_text: string) {
    // Gemini live model is voice-first; text input is not supported here.
  }
}