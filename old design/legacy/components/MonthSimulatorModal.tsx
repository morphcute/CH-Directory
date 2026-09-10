import React from 'react';
import { X, Calendar, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { MONTH_NAMES } from '../utils/sheetDetector';

interface MonthSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  simulatedMonthIndex: number;
  onSelectSimulatedMonth: (monthIndex: number) => void;
  onResetToRealDate: () => void;
  isCustomSimulated: boolean;
}

export const MonthSimulatorModal: React.FC<MonthSimulatorModalProps> = ({
  isOpen,
  onClose,
  simulatedMonthIndex,
  onSelectSimulatedMonth,
  onResetToRealDate,
  isCustomSimulated,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-[#3B82F6] border border-blue-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Monthly Auto-Detection Test
            </h3>
            <p className="text-xs text-slate-500">
              Simulate different months to test the automated tab picker
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-4 leading-relaxed">
          The app automatically checks the current month and activates the matching Google Sheet tab (e.g. <em>September 5, 2026</em>). Select any month below to simulate how the app transitions between tournament cycles:
        </p>

        {/* 12 Months Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {MONTH_NAMES.map((month, idx) => {
            const isSelected = simulatedMonthIndex === idx;
            // Highlight months that exist in sample sheet tabs (June, July, August, September)
            const hasSheetTab = idx >= 5 && idx <= 8; // June(5), July(6), Aug(7), Sep(8)

            return (
              <button
                key={month}
                type="button"
                onClick={() => {
                  onSelectSimulatedMonth(idx);
                }}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all flex flex-col items-center justify-center ${
                  isSelected
                    ? 'bg-[#0F172A] text-white border-slate-900 ring-2 ring-[#3B82F6]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>{month}</span>
                {hasSheetTab && (
                  <span
                    className={`text-[9px] mt-0.5 ${
                      isSelected ? 'text-blue-400' : 'text-blue-600'
                    }`}
                  >
                    Tab Available
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {isCustomSimulated && (
          <div className="mb-4 p-2.5 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between text-xs">
            <span className="text-blue-900 font-medium">
              Simulation Active: <strong>{MONTH_NAMES[simulatedMonthIndex]} 2026</strong>
            </span>
            <button
              type="button"
              onClick={onResetToRealDate}
              className="inline-flex items-center text-xs font-bold text-blue-700 hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset to Real Date
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#3B82F6] hover:bg-blue-600 transition-colors shadow-xs"
        >
          Done
        </button>
      </div>
    </div>
  );
};
