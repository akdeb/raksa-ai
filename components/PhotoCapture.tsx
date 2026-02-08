import React, { useRef, useState, useEffect } from 'react';

interface PhotoCaptureProps {
  onCapture: (base64: string) => void;
  onSkip: () => void;
}

const PhotoCapture: React.FC<PhotoCaptureProps> = ({ onCapture, onSkip }) => {
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
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(() => {
        setCameraError(true);
      });

    return () => {
      active = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
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
    if (captured) {
      stream?.getTracks().forEach((t) => t.stop());
      onCapture(captured);
    }
  };

  const handleRetake = () => {
    setCaptured(null);
  };

  if (cameraError) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Camera Unavailable</h3>
        <p className="text-sm text-gray-400 mb-6">
          Please allow camera access or skip this step.
        </p>
        <button
          onClick={onSkip}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Skip Photo
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Take a Photo</h2>
      <p className="text-sm text-gray-400 mb-6">
        This helps us identify you and pre-fill some details.
      </p>

      {/* Camera / Preview */}
      <div className="relative w-72 h-72 rounded-2xl overflow-hidden bg-black shadow-xl border-4 border-white mb-6">
        {captured ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/jpeg;base64,${captured}`}
            alt="Captured"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3">
        {captured ? (
          <>
            <button
              onClick={handleRetake}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Retake
            </button>
            <button
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 shadow-md shadow-green-500/20 transition-all active:scale-95"
            >
              Use This Photo
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onSkip}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-400 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={takePhoto}
              className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 active:bg-gray-100 transition-all shadow-lg"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoCapture;
