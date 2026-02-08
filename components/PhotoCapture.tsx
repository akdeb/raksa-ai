import React, { useRef, useState, useEffect } from 'react';
import { t, type Lang } from '../lib/i18n';
import { Camera, RotateCcw, Check, Ban } from 'lucide-react';

interface PhotoCaptureProps {
  lang: Lang;
  onCapture: (base64: string) => void;
  onSkip: () => void;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ lang, onCapture, onSkip }) => {
  const l = t(lang);
  const alt = t(lang === 'th' ? 'en' : 'th');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setCameraError(true));
    return () => { active = false; stream?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.85).split(',')[1];
    setCaptured(base64);
  };

  const handleConfirm = () => {
    if (captured) { stream?.getTracks().forEach((t) => t.stop()); onCapture(captured); }
  };

  if (cameraError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <Ban className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-0.5">{l.cameraUnavailable}</h3>
        <p className="text-[11px] text-gray-400">{alt.cameraUnavailable}</p>
        <p className="text-sm text-gray-400 mt-2 mb-6">{l.cameraUnavailableDesc}</p>
        <button onClick={onSkip} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
          {l.skip}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-0.5">{l.takePhoto}</h2>
      <p className="text-[11px] text-gray-400">{alt.takePhoto}</p>
      <p className="text-sm text-gray-400 mt-1 mb-6">{l.takePhotoDesc}</p>

      <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-black shadow-xl border-4 border-white mb-6">
        {captured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/jpeg;base64,${captured}`} alt="Captured" className="w-full h-full object-cover" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="flex items-center gap-3">
        {captured ? (
          <>
            <button onClick={() => setCaptured(null)} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors">
              <RotateCcw className="w-4 h-4" />
              {l.retake}
            </button>
            <button onClick={handleConfirm} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 shadow-md shadow-green-500/20 transition-all active:scale-95">
              <Check className="w-4 h-4" />
              {l.usePhoto}
            </button>
          </>
        ) : (
          <>
            <button onClick={onSkip} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-sm font-medium hover:bg-gray-50 transition-colors">
              {l.skip}
            </button>
            <button onClick={takePhoto} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 active:bg-gray-100 transition-all shadow-lg flex items-center justify-center">
              <Camera className="w-6 h-6 text-gray-600" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoCapture;
