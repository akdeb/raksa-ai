import { ConnectionState } from '../types';

const XAI_REALTIME_URL = 'wss://api.x.ai/v1/realtime';
const INPUT_SAMPLE_RATE = 24000;
const OUTPUT_SAMPLE_RATE = 24000;

type GrokEvent = {
  type: string;
  [key: string]: unknown;
};

function createPcmBase64(data: Float32Array): string {
  const int16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class GrokLiveModel {
  private ws: WebSocket | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private isSessionConfigured = false;

  public onStateChange: (state: ConnectionState) => void = () => {};
  public onTranscript: (text: string, role: 'user' | 'model', isFinal: boolean) => void = () => {};
  public onToolCall: (name: string, args: Record<string, unknown>, id: string) => void = () => {};
  public onAudioData: (frequencyData: Uint8Array) => void = () => {};

  /**
   * Fetch an ephemeral token from our Next.js API route
   */
  private async fetchEphemeralToken(): Promise<string> {
    const res = await fetch('/api/session', { method: 'POST' });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ephemeral token failed (${res.status}): ${body}`);
    }
    const data = await res.json();
    const token = data?.client_secret?.value;
    if (!token || typeof token !== 'string') {
      throw new Error('Ephemeral token missing in response');
    }
    return token;
  }

  async connect() {
    this.onStateChange(ConnectionState.CONNECTING);
    this.isSessionConfigured = false;

    try {
      // 1. Get ephemeral token
      const token = await this.fetchEphemeralToken();

      // 2. Connect to xAI with ephemeral token via WebSocket subprotocols
      //    This is the official xAI browser auth method
      this.ws = new WebSocket(XAI_REALTIME_URL, [
        'realtime',
        `openai-insecure-api-key.${token}`,
        'openai-beta.realtime-v1',
      ]);

      this.ws.onopen = async () => {
        console.log('[grok] WebSocket connected to xAI');
        // Don't set CONNECTED yet - wait for session.updated
      };

      this.ws.onmessage = async (event) => {
        let raw: string;
        if (typeof event.data === 'string') {
          raw = event.data;
        } else if (event.data instanceof Blob) {
          raw = await event.data.text();
        } else {
          raw = String(event.data);
        }
        const msg: GrokEvent = JSON.parse(raw);
        this.handleMessage(msg);
      };

      this.ws.onclose = () => {
        this.isSessionConfigured = false;
        this.onStateChange(ConnectionState.DISCONNECTED);
      };

      this.ws.onerror = (err) => {
        console.error('[grok] WebSocket Error:', err);
        this.onStateChange(ConnectionState.ERROR);
      };
    } catch (error) {
      console.error('[grok] Connection failed:', error);
      this.onStateChange(ConnectionState.ERROR);
    }
  }

  /**
   * Configure session after conversation.created
   */
  private sendSessionUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const config = {
      type: 'session.update',
      session: {
        voice: 'Ara',
        instructions: `You are Raksa, an intelligent AI assistant for the Royal Thai Police.
Your goal is to assist citizens and tourists at a police station kiosk.
Detect the language spoken (Thai or English) and respond in the same language.
Be authoritative yet polite, calm, and reassuring. Keep responses concise.`,
        turn_detection: { type: 'server_vad' },
        audio: {
          input: { format: { type: 'audio/pcm', rate: INPUT_SAMPLE_RATE } },
          output: { format: { type: 'audio/pcm', rate: OUTPUT_SAMPLE_RATE } },
        },
      },
    };
    this.ws.send(JSON.stringify(config));
  }

  /**
   * Setup mic and start streaming audio after session is configured
   */
  private async startAudioCapture() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.inputContext = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
    this.source = this.inputContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

    this.outputContext = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    if (this.outputContext.state === 'suspended') {
      await this.outputContext.resume();
    }
    this.nextStartTime = this.outputContext.currentTime;

    this.processor.onaudioprocess = (e) => {
      if (!this.isSessionConfigured) return;

      const inputData = e.inputBuffer.getChannelData(0);

      // Visualizer
      const visualData = new Uint8Array(64);
      for (let i = 0; i < 64 && i < inputData.length; i++) {
        visualData[i] = Math.abs(inputData[i]) * 255;
      }
      this.onAudioData(visualData);

      // Send audio
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: createPcmBase64(inputData),
          })
        );
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  private handleMessage(msg: GrokEvent) {
    const { type } = msg;

    // 1. conversation.created -> configure session
    if (type === 'conversation.created' && !this.isSessionConfigured) {
      console.log('[grok] Conversation created, configuring session...');
      this.sendSessionUpdate();
    }

    // 2. session.updated -> start audio, mark ready
    if (type === 'session.updated' && !this.isSessionConfigured) {
      console.log('[grok] Session configured, starting audio...');
      this.isSessionConfigured = true;
      this.onStateChange(ConnectionState.CONNECTED);
      this.startAudioCapture();
    }

    // 3. Audio output from Grok
    if (type === 'response.output_audio.delta' && msg.delta && this.outputContext) {
      this.playAudioChunk(msg.delta as string);
    }

    // 4. Model transcript
    if (type === 'response.output_audio_transcript.delta' && msg.delta) {
      this.onTranscript(msg.delta as string, 'model', false);
    }
    if (type === 'response.output_audio_transcript.done' || type === 'response.done') {
      this.onTranscript('', 'model', true);
    }

    // 5. User transcript (from conversation.item.added)
    if (type === 'conversation.item.added') {
      const item = msg.item as Record<string, unknown> | undefined;
      if (item?.role === 'user' && Array.isArray(item.content)) {
        for (const content of item.content) {
          const c = content as Record<string, unknown>;
          if (c.type === 'input_audio' && typeof c.transcript === 'string' && c.transcript) {
            this.onTranscript(c.transcript, 'user', true);
            break;
          }
        }
      }
    }

    // Also handle the dedicated transcription event
    if (type === 'conversation.item.input_audio_transcription.completed' && typeof msg.transcript === 'string') {
      this.onTranscript(msg.transcript, 'user', true);
    }
  }

  private playAudioChunk(base64Audio: string) {
    if (!this.outputContext) return;
    try {
      const bytes = decodeBase64(base64Audio);
      const dataInt16 = new Int16Array(bytes.buffer);

      // Visualizer
      let sum = 0;
      for (let i = 0; i < dataInt16.length; i += 50) {
        sum += Math.abs(dataInt16[i]);
      }
      const avg = sum / (dataInt16.length / 50);
      const normalized = Math.min(255, (avg / 10000) * 255);
      this.onAudioData(new Uint8Array(64).fill(normalized));

      // Play PCM
      const buffer = this.outputContext.createBuffer(1, dataInt16.length, OUTPUT_SAMPLE_RATE);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < dataInt16.length; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const src = this.outputContext.createBufferSource();
      src.buffer = buffer;
      src.connect(this.outputContext.destination);

      const currentTime = this.outputContext.currentTime;
      const startTime = Math.max(currentTime, this.nextStartTime);
      src.start(startTime);
      this.nextStartTime = startTime + buffer.duration;
    } catch (e) {
      console.error('[grok] Error playing audio chunk', e);
    }
  }

  public sendImage(_base64Data?: string, _mimeType: string = 'image/jpeg') {
    // Grok Voice Agent API does not support images
  }

  public sendText(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSessionConfigured) return;
    this.ws.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      })
    );
    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  async disconnect() {
    this.isSessionConfigured = false;
    this.onStateChange(ConnectionState.DISCONNECTED);

    if (this.ws) this.ws.close();
    if (this.mediaStream) this.mediaStream.getTracks().forEach((t) => t.stop());
    if (this.processor) this.processor.disconnect();
    if (this.source) this.source.disconnect();
    if (this.inputContext) this.inputContext.close();
    if (this.outputContext) this.outputContext.close();

    this.ws = null;
    this.mediaStream = null;
    this.processor = null;
    this.source = null;
    this.inputContext = null;
    this.outputContext = null;
    this.nextStartTime = 0;
  }
}
