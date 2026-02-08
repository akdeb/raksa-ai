import React, { useEffect, useState, useRef } from 'react';
import { GeminiLiveModel } from './models/gemini';
import { GrokLiveModel } from './models/grok';
import { ConnectionState, ToolExecution, ChatMessage } from './types';
import WaveVisualizer from './components/WaveVisualizer';
import ToolCard from './components/ToolCard';
import { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';
import { Button } from './components/ui/button';

const RaksaApp = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [activeTool, setActiveTool] = useState<ToolExecution | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [modelChoice, setModelChoice] = useState<'gemini' | 'grok'>('gemini');
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<GeminiLiveModel | GrokLiveModel | null>(null);
  const connectInFlightRef = useRef(false);

  // Helper to stop camera and cleanup tracks
  const stopCamera = () => {
    setShowCamera(false);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // Initialize Model
  useEffect(() => {
    const model = modelChoice === 'grok' ? new GrokLiveModel() : new GeminiLiveModel();
    modelRef.current = model;

    model.onStateChange = (state) => {
      setConnectionState(state);
      if (state === ConnectionState.DISCONNECTED) {
        stopCamera();
      }
    };

    model.onToolCall = (name: string, args: Record<string, unknown>, id: string) => {
      setActiveTool({ name, args, id, status: 'pending' });
      if (name !== 'dialEmergency') {
        setTimeout(() => setActiveTool(null), 5000);
      }
    };

    model.onAudioData = (data) => {
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i];
      }
      const avg = sum / data.length;
      setAudioLevel(avg / 255);
    };

    model.onTranscript = (text: string, role: 'user' | 'model', isFinal: boolean) => {
      setMessages(prev => {
        const history = [...prev];
        const lastMsg = history[history.length - 1];

        // If it's a new turn (role changed or history empty)
        if (!lastMsg || lastMsg.role !== role) {
           // Don't add empty messages
           if (text.trim() || text) { // Allow whitespace if needed, but prevents empty bubbles
             history.push({
               id: Date.now().toString() + Math.random().toString(),
               role,
               text,
               timestamp: new Date()
             });
           }
        } else {
           // Append to existing turn
           history[history.length - 1] = {
             ...lastMsg,
             text: lastMsg.text + text
           };
        }
        return history;
      });
    };

    return () => {
      model.disconnect();
      modelRef.current = null;
    };
  }, [modelChoice]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleConnection = async () => {
    if (!modelRef.current) return;
    if (connectInFlightRef.current) return;
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      connectInFlightRef.current = true;
      await modelRef.current.disconnect();
      connectInFlightRef.current = false;
    } else {
      connectInFlightRef.current = true;
      setMessages([]); // Clear history for new session
      try {
        await modelRef.current.connect();
      } finally {
        connectInFlightRef.current = false;
      }
    }
  };

  const handleCameraToggle = async () => {
    if (showCamera) {
      stopCamera();
    } else {
      setShowCamera(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        console.error("Camera access denied:", e);
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
  const isSwitchDisabled = connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING;

  return (
    <div className="h-full w-full bg-white flex flex-col font-sans text-black overflow-hidden relative">
      
      {/* Header */}
      <div className={`absolute top-0 left-0 right-0 p-6 z-10 text-center transition-opacity duration-300 ${isConnected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <h1 className="text-2xl font-semibold tracking-tight">Raksa AI</h1>
        <p className="text-gray-500 text-sm mt-1">Police Station Assistant</p>
      </div>

      {/* Model Toggle */}
      <div className="absolute top-6 right-6 z-[60] flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            if (!modelRef.current || !('sendText' in modelRef.current)) return;
            if (connectionState === ConnectionState.DISCONNECTED) {
              await toggleConnection();
              setTimeout(() => modelRef.current?.sendText('Hello'), 600);
              return;
            }
            modelRef.current.sendText('Hello');
          }}
        >
          Test Voice
        </Button>
        <ToggleGroup
          type="single"
          value={modelChoice}
          onValueChange={(value) => {
            if (value) setModelChoice(value as 'gemini' | 'grok');
          }}
          disabled={isSwitchDisabled}
          className={isSwitchDisabled ? 'opacity-60 cursor-not-allowed' : ''}
        >
          <ToggleGroupItem value="gemini">Gemini</ToggleGroupItem>
          <ToggleGroupItem value="grok">Grok</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col">
        
        {/* Sidebar Tools - Fixed Left */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-6 z-20">
          <button className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center hover:bg-red-50 text-2xl shadow-sm border border-gray-100 transition-all hover:scale-105 active:scale-95" title="Emergency 191">
            🚨
          </button>
          <button className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center hover:bg-blue-50 text-2xl shadow-sm border border-gray-100 transition-all hover:scale-105 active:scale-95" title="Tourist Police 1155">
            👮‍♂️
          </button>
        </div>

        {/* Start Button (Centered) - Added z-50 to ensure clickability */}
        <div className={`absolute inset-0 flex items-center justify-center z-50 transition-all duration-500 ${isConnected ? 'opacity-0 translate-y-20 pointer-events-none' : 'opacity-100 translate-y-0 pointer-events-none'}`}>
          <button 
            onClick={toggleConnection}
            className="w-32 h-32 bg-black rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform pointer-events-auto"
          >
            {connectionState === ConnectionState.CONNECTING ? (
              <span className="animate-pulse">Connecting...</span>
            ) : (
              <span className="font-semibold text-lg">Start</span>
            )}
          </button>
        </div>

        {/* Chat Transcript Area - Centered and Width Constrained */}
        <div className={`flex-1 overflow-y-auto transition-opacity duration-300 ${isConnected ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="max-w-2xl mx-auto w-full min-h-full flex flex-col p-6 pb-40">
            
            <div className="flex-1"></div> {/* Spacer to push content down */}
            
            {/* Listening State / Empty State */}
            {isConnected && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full space-y-6 my-auto animate-in fade-in duration-500">
                 <div className="relative">
                   <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center animate-pulse">
                      <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                   </div>
                   <div className="absolute inset-0 border-4 border-red-100 rounded-full animate-ping opacity-20"></div>
                 </div>
                 <div className="text-center">
                   <h2 className="text-xl font-semibold text-gray-900">Raksa is listening</h2>
                   <p className="text-gray-500 mt-2">Please speak clearly to start.</p>
                 </div>
              </div>
            )}

            {/* Messages Loop */}
            <div className="flex flex-col space-y-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`max-w-[80%] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}
                >
                  {/* Role Label */}
                  <div className={`text-xs mb-1 ml-1 ${msg.role === 'user' ? 'text-right text-gray-400' : 'text-left text-gray-500'}`}>
                    {msg.role === 'user' ? 'You' : 'Raksa'}
                  </div>
                  
                  <div className={`px-5 py-3 rounded-2xl text-[17px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#007AFF] text-white rounded-tr-md' 
                      : 'bg-[#F2F2F7] text-black rounded-tl-md'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            
            <div ref={messagesEndRef}></div>
          </div>
        </div>

        {/* Active Tool Toast */}
        {activeTool && (
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-full max-w-sm z-30 px-4">
            <ToolCard tool={activeTool} />
          </div>
        )}

        {/* Camera View - Repositioned slightly */}
        {showCamera && (
          <div className="absolute bottom-32 right-6 w-40 h-52 bg-black rounded-2xl overflow-hidden shadow-2xl border-2 border-white z-30 animate-in fade-in zoom-in duration-300">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            <button 
              onClick={handleCaptureImage}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full border-4 border-gray-200 active:bg-gray-300 transition-colors"
            ></button>
          </div>
        )}
      </div>

      {/* Floating Call Bar - Centered and Width Constrained */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl h-20 bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-gray-100 flex items-center justify-between px-2 sm:px-4 transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${isConnected ? 'translate-y-0 opacity-100' : 'translate-y-[150%] opacity-0'}`}>
        
        {/* Camera Toggle */}
        <button 
          onClick={handleCameraToggle}
          className={`p-3.5 rounded-full transition-all duration-200 ml-1 ${showCamera ? 'bg-black text-white shadow-lg' : 'bg-gray-50 text-gray-900 hover:bg-gray-100'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Visualizer Area */}
        <div className="flex-1 mx-4 sm:mx-8 h-12 flex items-center">
          <WaveVisualizer isListening={true} audioLevel={audioLevel} />
        </div>

        {/* End Call */}
        <button 
          onClick={toggleConnection}
          className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/30 mr-1"
        >
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
             <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
          </svg>
        </button>
      </div>

    </div>
  );
};

export default RaksaApp;