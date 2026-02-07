import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';

// Audio config constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

// Tool Definitions
const TOOLS: FunctionDeclaration[] = [
  {
    name: 'dialEmergency',
    description: 'Call emergency services (191) immediately if the user is in danger or reports a crime in progress.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING, description: 'The reason for the emergency call' },
        location: { type: Type.STRING, description: 'Current location of the user if provided' }
      },
      required: ['reason']
    }
  },
  {
    name: 'fileComplaint',
    description: 'Start the process of filing a non-emergency police complaint or report. Ask for category and details.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        category: { type: Type.STRING, description: 'Category of complaint: theft, assault, fraud, traffic, lost_property' },
        details: { type: Type.STRING, description: 'Key details provided by the user' }
      },
      required: ['category']
    }
  },
  {
    name: 'checkReportStatus',
    description: 'Check the status of a previously filed police report.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reportId: { type: Type.STRING, description: 'The report ID if known' }
      }
    }
  },
  {
    name: 'bookAppointment',
    description: 'Book an appointment with an officer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        department: { type: Type.STRING, description: 'Department to visit' },
        time: { type: Type.STRING, description: 'Preferred time' }
      }
    }
  }
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
  private ai: GoogleGenAI;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private session: any = null; 
  
  public onStateChange: (state: ConnectionState) => void = () => {};
  public onTranscript: (text: string, role: 'user' | 'model', isFinal: boolean) => void = () => {};
  public onToolCall: (name: string, args: any, id: string) => void = () => {};
  public onAudioData: (frequencyData: Uint8Array) => void = () => {}; 

  constructor() {
    const apiKey =
      import.meta.env.VITE_GEMINI_API_KEY ||
      import.meta.env.GEMINI_API_KEY;
    this.ai = new GoogleGenAI({ apiKey });
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
      const sessionPromise = this.ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
          systemInstruction: `You are Raksa, an intelligent AI assistant for the Royal Thai Police. 
          Your goal is to assist citizens and tourists at a police station kiosk.
          
          Instructions:
          - Listen to the user's request.
          - Detect the language spoken by the user (Thai or English) and respond in the same language.
          - Be authoritative yet polite, calm, and reassuring.
          - Keep responses concise and spoken-word friendly.`,
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
    // 1. Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData && this.outputContext) {
      this.playAudioChunk(audioData);
    }

    // 2. Handle Transcription
    const outputTranscript = message.serverContent?.outputTranscription?.text;
    if (outputTranscript) {
       this.onTranscript(outputTranscript, 'model', false);
    }
    
    const inputTranscript = message.serverContent?.inputTranscription?.text;
    if (inputTranscript) {
       this.onTranscript(inputTranscript, 'user', false);
    }

    // Handle Turn Complete (finalize transcript)
    if (message.serverContent?.turnComplete) {
       this.onTranscript('', 'model', true);
    }

    // 3. Handle Tool Calls
    if (message.toolCall) {
      for (const call of message.toolCall.functionCalls) {
        this.onToolCall(call.name, call.args, call.id);
        
        sessionPromise.then(session => {
          session.sendToolResponse({
            functionResponses: {
              id: call.id,
              name: call.name,
              response: { result: "Success" } // In a real app, this would be the actual API result
            }
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
}