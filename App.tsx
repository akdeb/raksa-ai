'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GeminiLiveModel } from './models/gemini';
import {
  ConnectionState,
  ChatMessage,
  IntakeFormState,
  IntakeStep,
  FieldStatus,
  AppLang,
} from './types';
import {
  createDefaultForm,
  findNextField,
  generateReceiptCode,
  groupFullyConfirmed,
  unconfirmedFieldsInGroup,
  saveFormToStorage,
  loadFormFromStorage,
  clearFormStorage,
  hasSavedInProgressForm,
} from './lib/form';
import { t, type Lang } from './lib/i18n';
import WaveVisualizer from './components/WaveVisualizer';
import Sidebar from './components/Sidebar';
import FormPanel from './components/FormPanel';
import ReceiptPanel from './components/ReceiptPanel';
import PhotoCapture from './components/PhotoCapture';
import TranscriptDrawer from './components/TranscriptDrawer';
import {
  AlertTriangle,
  Camera,
  Loader2,
  MessageSquareText,
  Mic,
  PhoneOff,
  RotateCcw,
  X,
} from 'lucide-react';

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
  const [selectedLang, setSelectedLang] = useState<AppLang>('th');
  const [showTranscript, setShowTranscript] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<GeminiLiveModel | null>(null);
  const connectInFlightRef = useRef(false);

  const lang = (form.lang ?? selectedLang) as Lang;
  const l = t(lang);

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
      const updatedForm = { ...prev, groups };
      const next = findNextField(updatedForm);

      // If current group is fully confirmed and next field is in a different group,
      // auto-advance the step
      let nextStep = prev.step;
      if (next && next.groupId !== prev.step && groupFullyConfirmed(updatedForm, prev.step)) {
        nextStep = next.groupId as IntakeStep;
        console.log(`[form] Auto-advancing step: ${prev.step} → ${nextStep}`);
      }

      return {
        ...updatedForm,
        step: nextStep,
        activeFieldId: next?.fieldId ?? prev.activeFieldId,
      };
    });
  }, []);

  /**
   * Move to the next step. Returns unconfirmed field names if the current
   * group isn't fully confirmed (the transition is BLOCKED).
   */
  const moveToStep = useCallback((step: IntakeStep): string[] | null => {
    let blocked: string[] | null = null;
    setForm((prev) => {
      // Guard: don't allow step transition if current group has unconfirmed fields
      // (except when moving within the same step or to photo)
      const currentGroupId = prev.step;
      if (
        currentGroupId !== step &&
        currentGroupId !== 'photo' &&
        currentGroupId !== 'receipt' &&
        !groupFullyConfirmed(prev, currentGroupId)
      ) {
        const missing = unconfirmedFieldsInGroup(prev, currentGroupId);
        console.warn(`[form] Blocked step transition → ${step}. Unconfirmed:`, missing);
        blocked = missing;
        // Stay on current step, point to first unconfirmed field
        const nextInGroup = prev.groups
          .find((g) => g.id === currentGroupId)
          ?.fields.find((f) => f.status !== 'confirmed');
        return {
          ...prev,
          activeFieldId: nextInGroup?.id ?? prev.activeFieldId,
        };
      }

      if (step === 'receipt') {
        // Also guard receipt: ALL groups must be confirmed
        const allDone = prev.groups.every((g) =>
          g.fields.every((f) => f.status === 'confirmed')
        );
        if (!allDone) {
          const nextField = findNextField(prev);
          const missingGroup = prev.groups.find((g) =>
            g.fields.some((f) => f.status !== 'confirmed')
          );
          blocked = missingGroup
            ? unconfirmedFieldsInGroup(prev, missingGroup.id)
            : [];
          return {
            ...prev,
            step: missingGroup?.id as IntakeStep ?? prev.step,
            activeFieldId: nextField?.fieldId ?? prev.activeFieldId,
          };
        }
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
    return blocked;
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
      let label = fieldId;
      for (const g of form.groups) {
        const f = g.fields.find((f) => f.id === fieldId);
        if (f) {
          label = f.label;
          break;
        }
      }

      confirmField(fieldId);

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
        const blocked = moveToStep(args.step as IntakeStep);
        if (blocked && blocked.length > 0 && model) {
          // Tell the AI it can't move on — fields are still unconfirmed
          model.sendText(
            `[SYSTEM] Cannot move to "${args.step}" yet. The following fields in the current section are NOT confirmed: ${blocked.join(', ')}. Please confirm each of these fields first by calling confirm_field for each one before calling next_step again.`
          );
        }
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
          history[history.length - 1] = {
            ...lastMsg,
            text: lastMsg.text + text,
          };
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

  // Auto-scroll transcript (desktop)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Connection ───

  const startSession = useCallback(
    async (resumeForm?: IntakeFormState) => {
      if (!modelRef.current || connectInFlightRef.current) return;
      connectInFlightRef.current = true;
      setSessionStarted(true);

      const formToUse = resumeForm ?? {
        ...createDefaultForm(),
        lang: selectedLang,
      };
      setForm(formToUse);
      setMessages([]);
      try {
        await modelRef.current.connect(formToUse.lang);
      } finally {
        connectInFlightRef.current = false;
      }
    },
    [selectedLang]
  );

  const reconnect = useCallback(async () => {
    if (!modelRef.current || connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    try {
      await modelRef.current.connect(form.lang);
    } finally {
      connectInFlightRef.current = false;
    }
  }, [form.lang]);

  const endSession = useCallback(async () => {
    if (!modelRef.current || connectInFlightRef.current) return;
    connectInFlightRef.current = true;
    await modelRef.current.disconnect();
    connectInFlightRef.current = false;
  }, []);

  // ─── Photo capture handlers ───

  const handlePhotoCapture = useCallback((base64: string) => {
    setForm((prev) => ({
      ...prev,
      userPhoto: base64,
      step: 'personal',
      activeFieldId: prev.groups[0]?.fields[0]?.id ?? null,
    }));

    if (modelRef.current) {
      modelRef.current.sendImage(base64);
      modelRef.current.sendText(
        '[SYSTEM] A photo of the person has been taken. Analyze the photo and call update_field with source="image" for any personal details you can infer (e.g. gender, approximate age). Then start the personal details interview with the first unconfirmed field.'
      );
    }
  }, []);

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
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
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
  const isReconnecting =
    connectionState === ConnectionState.CONNECTING && sessionStarted;
  const isDisconnectedMidSession =
    sessionStarted &&
    (connectionState === ConnectionState.DISCONNECTED ||
      connectionState === ConnectionState.ERROR);
  const showReconnectBanner = isDisconnectedMidSession || isReconnecting;

  // ─── RENDER ───

  // Start / Resume screen
  if (
    !sessionStarted &&
    !isConnected &&
    connectionState !== ConnectionState.CONNECTING
  ) {
    return (
      <div className="h-full w-full bg-gradient-to-br from-gray-50 to-white flex flex-col items-center justify-center font-sans text-black px-4">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-1">
            รักษา AI
          </h1>
          <p className="text-sm text-gray-500">Raksa AI</p>
          <p className="text-gray-400 text-xs mt-1">{t('th').appSubtitle}</p>
          <p className="text-gray-400 text-xs">{t('en').appSubtitle}</p>
        </div>

        {/* Language toggle */}
        <div className="mb-8">
          <p className="text-xs text-gray-400 text-center mb-2">
            {t(selectedLang).selectLanguage}
          </p>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setSelectedLang('th')}
              className={`px-6 py-2.5 text-sm font-medium transition-colors ${
                selectedLang === 'th'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              🇹🇭 ไทย
            </button>
            <button
              onClick={() => setSelectedLang('en')}
              className={`px-6 py-2.5 text-sm font-medium transition-colors ${
                selectedLang === 'en'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => startSession()}
            className="w-32 h-32 md:w-40 md:h-40 bg-red-400 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          >
            <span className="font-semibold text-base md:text-lg">
              {t(selectedLang).startNew}
            </span>
          </button>

          {hasResumable && (
            <button
              onClick={() => {
                const saved = loadFormFromStorage();
                if (saved) startSession(saved);
              }}
              className="mt-2 flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t(selectedLang).resumePrevious}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Connecting (first time only)
  if (connectionState === ConnectionState.CONNECTING && !sessionStarted) {
    return (
      <div className="h-full w-full bg-white flex flex-col items-center justify-center font-sans text-black">
        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center animate-pulse mb-4">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
        <p className="text-gray-500 text-sm">{l.connecting}</p>
      </div>
    );
  }

  // ─── Session started: responsive layout ───
  return (
    <div className="h-full w-full bg-white flex flex-col md:flex-row font-sans text-black overflow-hidden relative">
      {/* Reconnect banner */}
      {showReconnectBanner && (
        <div className="absolute top-0 left-0 right-0 z-[60] bg-amber-50 border-b border-amber-200 px-3 md:px-4 py-2 md:py-2.5 flex items-center justify-center gap-2 md:gap-3 flex-wrap">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs md:text-sm text-amber-700">
            {isReconnecting ? l.reconnecting : l.connectionLost}
          </span>
          {!isReconnecting && (
            <button
              onClick={reconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-semibold rounded-lg hover:bg-green-600 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              {l.reconnect}
            </button>
          )}
          {isReconnecting && (
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {l.endSession}
          </button>
        </div>
      )}

      {/* Sidebar: desktop = left column, mobile = top bar (rendered inside Sidebar component) */}
      <div className="md:w-1/5 md:min-w-[220px] md:border-r md:border-gray-100 md:flex-shrink-0">
        <Sidebar form={form} />
      </div>

      {/* Column 2 – Main content area */}
      <div className="flex-1 min-w-0 bg-gray-50/30 relative overflow-y-auto">
        {form.step === 'photo' ? (
          <PhotoCapture
            lang={lang}
            onCapture={handlePhotoCapture}
            onSkip={handlePhotoSkip}
          />
        ) : form.step === 'receipt' ? (
          <ReceiptPanel form={form} onReset={handleReset} />
        ) : (
          <FormPanel
            form={form}
            onConfirmField={handleUiConfirm}
            onEditField={handleUiEdit}
          />
        )}

        {/* Inline camera overlay */}
        {showCamera && form.step !== 'photo' && (
          <div className="absolute bottom-28 right-4 md:right-6 w-36 md:w-40 h-48 md:h-52 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white z-30">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <button
              onClick={handleCaptureImage}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 bg-white rounded-full border-4 border-gray-200 active:bg-gray-300 transition-colors"
            />
          </div>
        )}
      </div>

      {/* Column 3 – Transcript (desktop only) */}
      <div className="hidden md:flex w-1/5 min-w-[220px] border-l border-gray-100 flex-shrink-0 flex-col">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {l.transcript}
          </h3>
          <span className="text-[10px] text-gray-300">
            {messages.length} {l.messages}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mb-2 animate-pulse">
                <Mic className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-xs text-gray-400">{l.listening}</p>
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

      {/* Mobile transcript drawer */}
      <TranscriptDrawer
        open={showTranscript}
        onClose={() => setShowTranscript(false)}
        messages={messages}
        lang={lang}
      />

      {/* Floating Call Bar */}
      {form.step !== 'photo' && (
        <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 w-[90%] md:w-[50%] max-w-lg h-14 bg-white/90 backdrop-blur-xl rounded-full shadow-2xl border border-gray-100 flex items-center justify-between px-2 z-50">
          {/* Camera Toggle */}
          <button
            onClick={handleCameraToggle}
            className={`p-2.5 rounded-full transition-all duration-200 ml-1 ${
              showCamera
                ? 'bg-black text-white shadow-lg'
                : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* Transcript button (mobile only) */}
          <button
            onClick={() => setShowTranscript(true)}
            className="md:hidden p-2.5 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors relative"
          >
            <MessageSquareText className="w-4 h-4" />
            {messages.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {messages.length > 99 ? '99' : messages.length}
              </span>
            )}
          </button>

          {/* Visualizer */}
          <div className="flex-1 mx-2 md:mx-3 h-8 flex items-center">
            <WaveVisualizer isListening={true} audioLevel={audioLevel} />
          </div>

          {/* End Call */}
          <button
            onClick={() => setShowEndConfirm(true)}
            className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30 mr-1"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* End Call Confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-xs w-full mx-4 p-6 text-center">
            <button
              onClick={() => setShowEndConfirm(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{l.endCallTitle}</h3>
            <p className="text-sm text-gray-400 mb-6">{l.endCallDesc}</p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                {l.cancel}
              </button>
              <button
                onClick={() => {
                  setShowEndConfirm(false);
                  handleReset();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
              >
                {l.endSession}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RaksaApp;
