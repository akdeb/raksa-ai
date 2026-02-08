import React, { useMemo } from 'react';
import type { IntakeFormState } from '../types';

interface ReceiptPanelProps {
  form: IntakeFormState;
  onReset: () => void;
}

const ReceiptPanel: React.FC<ReceiptPanelProps> = ({ form, onReset }) => {
  const code = form.receiptCode ?? 'N/A';

  const fullName =
    form.groups
      .find((g) => g.id === 'personal')
      ?.fields.find((f) => f.id === 'full_name')?.value || 'Unknown';

  // Simple QR code URL via a public QR API
  const qrUrl = useMemo(
    () =>
      `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
        code
      )}`,
    [code]
  );

  const allData = form.groups.flatMap((g) =>
    g.fields.map((f) => ({ group: g.label, label: f.label, value: f.value }))
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 print:shadow-none print:border-0">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-7 h-7 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Intake Complete</h2>
          <p className="text-sm text-gray-400 mt-1">All fields have been confirmed.</p>
        </div>

        {/* User photo + Receipt code */}
        <div className="bg-gray-50 rounded-xl p-4 text-center mb-6">
          {form.userPhoto && (
            <div className="flex justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/jpeg;base64,${form.userPhoto}`}
                alt="User"
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
              />
            </div>
          )}
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Reference Code</p>
          <p className="text-2xl font-mono font-bold tracking-widest text-gray-900">{code}</p>
          <p className="text-sm text-gray-500 mt-2">{fullName}</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR Code" className="w-40 h-40 rounded-lg" />
        </div>

        {/* Summary */}
        <div className="mb-6 space-y-2">
          {allData.map((d, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-gray-400">{d.label}</span>
              <span className="text-gray-900 font-medium text-right max-w-[60%] truncate">
                {d.value || '—'}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Print Receipt
          </button>
          <button
            onClick={onReset}
            className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Next Customer
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiptPanel;
