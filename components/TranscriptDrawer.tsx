'use client';

import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { t, type Lang } from '../lib/i18n';
import { X, Mic } from 'lucide-react';

interface TranscriptDrawerProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  lang: Lang;
}

const TranscriptDrawer: React.FC<TranscriptDrawerProps> = ({
  open,
  onClose,
  messages,
  lang,
}) => {
  const l = t(lang);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer from bottom */}
      <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] bg-white rounded-t-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{l.transcript}</h3>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {messages.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-h-[200px]">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3 animate-pulse">
                <Mic className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-sm text-gray-400">{l.listening}</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="text-sm leading-relaxed min-w-0">
              <span
                className={
                  msg.role === 'user'
                    ? 'font-semibold text-blue-600'
                    : 'font-semibold text-gray-700'
                }
              >
                {msg.role === 'user' ? 'You' : 'Raksa'}
              </span>
              <p className="text-gray-500 mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {msg.text}
              </p>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
};

export default TranscriptDrawer;
