import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { IntakeFormState } from '../types';
import { t, type Lang } from '../lib/i18n';
import { Check, Printer, ArrowRight, X } from 'lucide-react';

interface ReceiptPanelProps {
  form: IntakeFormState;
  onReset: () => void;
}

const ReceiptPanel: React.FC<ReceiptPanelProps> = ({ form, onReset }) => {
  const lang = (form.lang ?? 'th') as Lang;
  const l = t(lang);
  const code = form.receiptCode ?? 'N/A';
  const [showPrintModal, setShowPrintModal] = useState(false);

  const fullName =
    form.groups.find((g) => g.id === 'personal')?.fields.find((f) => f.id === 'full_name')?.value || 'Unknown';

  const qrUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`,
    [code]
  );

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">{l.intakeComplete}</h2>
          <p className="text-sm text-gray-400 mt-1">{l.intakeCompleteDesc}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 text-center mb-6">
          {form.userPhoto && (
            <div className="flex justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`data:image/jpeg;base64,${form.userPhoto}`} alt="User" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" />
            </div>
          )}
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{l.referenceCode}</p>
          <p className="text-2xl font-mono font-bold tracking-widest text-gray-900">{code}</p>
          <p className="text-sm text-gray-500 mt-2">{fullName}</p>
        </div>

        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR Code" className="w-40 h-40 rounded-lg" />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 shadow-md shadow-green-500/20 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            {l.printReceipt}
          </button>
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-500 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            {l.nextCustomer}
          </button>
        </div>
      </div>

      {showPrintModal && (
        <PrintModal
          lang={lang}
          form={form}
          fullName={fullName}
          code={code}
          qrUrl={qrUrl}
          onClose={() => setShowPrintModal(false)}
          onDone={onReset}
        />
      )}
    </div>
  );
};

// ─── Print Modal ───

interface PrintModalProps {
  lang: Lang;
  form: IntakeFormState;
  fullName: string;
  code: string;
  qrUrl: string;
  onClose: () => void;
  onDone: () => void;
}

const PrintModal: React.FC<PrintModalProps> = ({ lang, form, fullName, code, qrUrl, onClose, onDone }) => {
  const l = t(lang);
  const [countdown, setCountdown] = useState(10);

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (countdown <= 0) {
      finish();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, finish]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-8 text-center">
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <X className="w-4 h-4" />
        </button>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">{l.printPreview}</p>

        {/* Only: photo, name, QR, ID */}
        {form.userPhoto && (
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:image/jpeg;base64,${form.userPhoto}`} alt="User" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
          </div>
        )}
        <p className="text-lg font-bold text-gray-900">{fullName}</p>
        <div className="flex justify-center my-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR Code" className="w-36 h-36 rounded-lg" />
        </div>
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{l.referenceCode}</p>
        <p className="text-xl font-mono font-bold tracking-widest text-gray-900 mb-6">{code}</p>

        {/* Countdown */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
            {countdown}
          </div>
          <span className="text-sm text-gray-500">{l.printingIn} {countdown}{l.seconds}</span>
        </div>

        <button
          onClick={onClose}
          className="mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          {l.cancel}
        </button>
      </div>
    </div>
  );
};

export default ReceiptPanel;
