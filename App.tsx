'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GeminiLiveModel } from './models/gemini';
import {
  ConnectionState,
  ChatMessage,
  IntakeFormState,
  IntakeStep,
  FieldStatus,
} from './types';
import {
  createDefaultForm,
  findNextField,
  generateReceiptCode,
  saveFormToStorage,
  loadFormFromStorage,
  clearFormStorage,
  hasSavedInProgressForm,
} from './lib/form';
import WaveVisualizer from './components/WaveVisualizer';
import Sidebar from './components/Sidebar';
import FormPanel from './components/FormPanel';
import ReceiptPanel from './components/ReceiptPanel';
import PhotoCapture from './components/PhotoCapture';

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

const RaksaApp = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );
  const [audioLevel, setAudioLevel] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [form, setForm] = useState<IntakeFormState>(createDefaultForm);
  const [hasResumable, setHasResumable] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<GeminiLiveModel | null>(null);
  const connectInFlightRef = useRef(false);

  // Check for resumable form on mount
  useEffect(() => {
    setHasResumable(hasSavedInProgressForm());
  }, []);

  // Persist form to localStorage on every change
  useEffect(() => {
    saveFormToStorage(form);
  }, [form]);

  // ─── Form mutations ───

  const updateField = useCallback(
    (fieldId: string, value: string, source: 'speech' | 'image') => {
      setForm((prev) => {
        const groups = prev.groups.map((g) => ({
          ...g,
          fields: g.fields.map((f) =>
            f.id === fieldId
              ? {
                  ...f,
                  value,
                  status: (source === 'speech'
                    ? 'inferred_from_speech'
                    : 'inferred_from_image') as FieldStatus,
                }
              : f
          ),
        }));
        return { ...prev, groups };
      });
    },
    []
  );

  const confirmField = useCallback((fieldId: string) => {
    setForm((prev) => {
      const groups = prev.groups.map((g) => ({
        ...g,
        fields: g.fields.map((f) =>
          f.id === fieldId ? { ...f, status: 'confirmed' as FieldStatus } : f
        ),
      }));
      const next = findNextField({ ...prev, groups });
      return {
        ...prev,
        groups,
        activeFieldId: next?.fieldId ?? prev.activeFieldId,
      };
    });
  }, []);

  const moveToStep = useCallback((step: IntakeStep) => {
    setForm((prev) => {
      if (step === 'receipt') {
        return {
          ...prev,
          step: 'receipt',
          activeFieldId: null,
          receiptCode: generateReceiptCode(),
        };
      }
      const group = prev.groups.find((g) => g.id === step);
      return {
        ...prev,
        step,
        activeFieldId: group?.fields[0]?.id ?? null,
      };
    });
  }, []);

  const handleReset = useCallback(() => {
    clearFormStorage();
    setForm(createDefaultForm());
    setMessages([]);
    setHasResumable(false);
    setSessionStarted(false);
    if (modelRef.current) {
      modelRef.current.disconnect();
    }
  }, []);

  // ─── UI confirm (green check button) ───

  const handleUiConfirm = useCallback(
    (fieldId: string) => {
      // Find the field label for the message
      let label = fieldId;
      for (const g of form.groups) {
        const f = g.fields.find((f) => f.id === fieldId);
        if (f) {
          label = f.label;
          break;
        }
      }

      confirmField(fieldId);

      // Tell the AI about this user action so it moves on
      if (modelRef.current) {
        modelRef.current.sendText(
          `[USER_ACTION] Field "${label}" (${fieldId}) confirmed via UI button. Move to the next unconfirmed field.`
        );
      }
    },
    [confirmField, form.groups]
  );

  const handleUiEdit = useCallback(
    (fieldId: string, value: string) => {
      updateField(fieldId, value, 'speech');
    },
    [updateField]
  );

  // ─── Camera helpers ───

  const stopCamera = useCallback(() => {
    setShowCamera(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // ─── Initialize Gemini Model ───

  useEffect(() => {
    const model = new GeminiLiveModel();
    modelRef.current = model;

    model.onStateChange = (state) => {
      setConnectionState(state);
      if (state === ConnectionState.DISCONNECTED) {
        stopCamera();
      }
    };

    model.onToolCall = (
      name: string,
      args: Record<string, unknown>,
      _id: string
    ) => {
      console.log('[tool]', name, args);
      if (name === 'update_field') {
        const fId = args.field_id as string;
        const val = args.value as string;
        const src = (args.source as string) === 'image' ? 'image' : 'speech';
        updateField(fId, val, src);
      } else if (name === 'confirm_field') {
        confirmField(args.field_id as string);
      } else if (name === 'next_step') {
        moveToStep(args.step as IntakeStep);
      }
    };

    model.onAudioData = (data) => {
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setAudioLevel(sum / data.length / 255);
    };

    model.onTranscript = (
      text: string,
      role: 'user' | 'model',
      isFinal: boolean
    ) => {
      if (isFinal) return;
      setMessages((prev) => {
        const history = [...prev];
        const lastMsg = history[history.length - 1];
        if (!lastMsg || lastMsg.role !== role) {
          if (text.trim()) {
            history.push({
              id: Date.now().toString() + Math.random().toString(),
              role,
              text,
              timestamp: new Date(),
            });
          }
        } else {
          history[history.length - 1] = { ...lastMsg, text: lastMsg.text + text };
        }
        return history;
      });
    };

    return () => {
      model.disconnect();
      modelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Connection ───

  const startSession = useCallback(
    async (resumeForm?: IntakeFormState) => {
      if (!modelRef.current || connectInFlightRef.current) return;
      connectInFlightRef.current = true;
      setSessionStarted(true);

      if (resumeForm) {
        setForm(resumeForm);
      }

      setMessages([]);
      try {
        await modelRef.current.connect();
      } finally {
        connectInFlightRef.current = false;
      }
    },
    []
  );

  const reconnect = useCallback(async () => {
    if (!modelRef.current || connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    try {
      await modelRef.current.connect();
    } finally {
      connectInFlightRef.current = false;
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!modelRef.current || connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    await modelRef.current.disconnect();
    connectInFlightRef.current = false;
  }, []);

  // ─── Photo capture handlers ───

  const handlePhotoCapture = useCallback(
    (base64: string) => {
      setForm((prev) => ({
        ...prev,
        userPhoto: base64,
        step: 'personal',
        activeFieldId: prev.groups[0]?.fields[0]?.id ?? null,
      }));

      // Send the photo to Gemini for inference
      if (modelRef.current) {
        modelRef.current.sendImage(base64);
        modelRef.current.sendText(
          '[SYSTEM] A photo of the person has been taken. Analyze the photo and call update_field with source="image" for any personal details you can infer (e.g. gender, approximate age). Then start the personal details interview with the first unconfirmed field.'
        );
      }
    },
    []
  );

  const handlePhotoSkip = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      step: 'personal',
      activeFieldId: prev.groups[0]?.fields[0]?.id ?? null,
    }));
  }, []);

  // ─── Camera (for inline during form) ───

  const handleCameraToggle = async () => {
    if (showCamera) {
      stopCamera();
    } else {
      setShowCamera(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) {
        console.error('Camera access denied:', e);
        setShowCamera(false);
      }
    }
  };

  const handleCaptureImage = () => {
    if (!videoRef.current || !canvasRef.current || !modelRef.current) return;
    const context = canvasRef.current.getContext('2d');
    if (context) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
      modelRef.current.sendImage(base64);
    }
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isReconnecting = connectionState === ConnectionState.CONNECTING && sessionStarted;
  const isDisconnectedMidSession =
    sessionStarted &&
    (connectionState === ConnectionState.DISCONNECTED ||
      connectionState === ConnectionState.ERROR);
  const showReconnectBanner = isDisconnectedMidSession || isReconnecting;

  // ─── RENDER ───

  // Start / Resume screen (only when no session has been started)
  if (!sessionStarted && !isConnected && connectionState !== ConnectionState.CONNECTING) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-gray-50 to-white flex flex-col items-center justify-center font-sans text-black">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-2">Raksa AI</h1>
          <p className="text-gray-400 text-sm">Police Station Intake Assistant</p>
        </div>

        <div className="flex flex-col items-center gap-4">
          {/* Start new */}
          <button
            onClick={() => {
              setForm(createDefaultForm());
              startSession();
            }}
            className="w-40 h-40 bg-black rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="font-semibold text-lg">Start New</span>
          </button>

          {/* Resume previous */}
          {hasResumable && (
            <button
              onClick={() => {
                const saved = loadFormFromStorage();
                if (saved) {
                  startSession(saved);
                }
              }}
              className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Resume Previous Session
            </button>
          )}
        </div>
      </div>
    );
  }

  // Connecting (first time only — not reconnecting mid-session)
  if (connectionState === ConnectionState.CONNECTING && !sessionStarted) {
    return (
      <div className="h-full w-full bg-white flex flex-col items-center justify-center font-sans text-black">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center animate-pulse mb-4">
          <svg className="w-8 h-8 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <p className="text-gray-500 text-sm">Connecting to Raksa...</p>
      </div>
    );
  }

  // ─── Session started: 3-column layout (stays even if disconnected) ───
  return (
    <div className="h-full w-full bg-white flex font-sans text-black overflow-hidden relative">
      {/* Reconnect banner (shown when connection drops mid-session) */}
      {showReconnectBanner && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-center gap-3">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-sm text-amber-700">
            {isReconnecting ? 'Reconnecting...' : 'Connection lost. Your form progress is saved.'}
          </span>
          {!isReconnecting && (
            <button
              onClick={reconnect}
              className="ml-2 px-4 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
            >
              Reconnect
            </button>
          )}
          {isReconnecting && (
            <svg className="w-4 h-4 text-amber-600 animate-spin ml-1" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-amber-600 text-xs font-medium hover:text-amber-800 transition-colors"
          >
            End Session
          </button>
        </div>
      )}

      {/* Column 1 – Sidebar */}
      <div className="w-1/5 min-w-[220px] border-r border-gray-100 flex-shrink-0">
        <Sidebar form={form} />
      </div>

      {/* Column 2 – Main content area */}
      <div className="flex-1 min-w-0 bg-gray-50/30 relative">
        {form.step === 'photo' ? (
          <PhotoCapture onCapture={handlePhotoCapture} onSkip={handlePhotoSkip} />
        ) : form.step === 'receipt' ? (
          <ReceiptPanel form={form} onReset={handleReset} />
        ) : (
          <FormPanel
            form={form}
            onConfirmField={handleUiConfirm}
            onEditField={handleUiEdit}
          />
        )}

        {/* Inline camera overlay (for sending evidence photos) */}
        {showCamera && form.step !== 'photo' && (
          <div className="absolute bottom-28 right-6 w-40 h-52 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white z-30">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <button
              onClick={handleCaptureImage}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full border-4 border-gray-200 active:bg-gray-300 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Column 3 – Transcript */}
      <div className="w-1/5 min-w-[220px] border-l border-gray-100 flex-shrink-0 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Transcript
          </h3>
          <span className="text-[10px] text-gray-300">{messages.length} messages</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mb-2 animate-pulse">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p className="text-xs text-gray-400">Listening...</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="text-xs leading-relaxed">
              <span
                className={
                  msg.role === 'user'
                    ? 'font-semibold text-blue-600'
                    : 'font-semibold text-gray-700'
                }
              >
                {msg.role === 'user' ? 'You' : 'Raksa'}
              </span>
              <p className="text-gray-500 mt-0.5">{msg.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Floating Call Bar */}
      {form.step !== 'photo' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[50%] max-w-lg h-14 bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-100 flex items-center justify-between px-2 z-50">
          {/* Camera Toggle */}
          <button
            onClick={handleCameraToggle}
            className={`p-2.5 rounded-full transition-all duration-200 ml-1 ${
              showCamera
                ? 'bg-black text-white shadow-lg'
                : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Visualizer */}
          <div className="flex-1 mx-3 h-8 flex items-center">
            <WaveVisualizer isListening={true} audioLevel={audioLevel} />
          </div>

          {/* End Call */}
          <button
            onClick={endSession}
            className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30 mr-1"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default RaksaApp;
