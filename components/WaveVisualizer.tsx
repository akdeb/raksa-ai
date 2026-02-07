import React, { useEffect, useRef } from 'react';

interface WaveVisualizerProps {
  isListening: boolean;
  audioLevel: number; // 0 to 1 normalized
}

const WaveVisualizer: React.FC<WaveVisualizerProps> = ({ isListening, audioLevel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const { width, height } = canvas;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Idle state: straight line
      if (!isListening) {
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.strokeStyle = '#C6C6C8';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(0, centerY);
      
      const amplitude = (height * 0.2) + (audioLevel * height * 0.6); 
      const frequency = 0.05;
      
      for (let x = 0; x < width; x++) {
        // Simple sine wave
        const y = centerY + 
          Math.sin(x * frequency + phase) * 
          amplitude * 
          Math.sin(x / width * Math.PI); 
        ctx.lineTo(x, y);
      }

      ctx.strokeStyle = '#FF3B30'; // Simple Red
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      phase += 0.2;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [isListening, audioLevel]);

  return (
    <canvas ref={canvasRef} className="w-full h-full" />
  );
};

export default WaveVisualizer;