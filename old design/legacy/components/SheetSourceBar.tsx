import React, { useState } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Sparkles,
  ExternalLink,
  HelpCircle,
  RotateCw,
  SlidersHorizontal,
} from 'lucide-react';
import { SheetTab } from '../types';

interface SheetSourceBarProps {
  sheetUrlInput: string;
  onUrlChange: (val: string) => void;
  onDetect: () => void;
  isLoading: boolean;
  spreadsheetTitle: string;
  detectedTabs: SheetTab[];
  activeTab: string;
  autoDetectedTab: string | null;
  onSelectTab: (tabName: string) => void;
  onResetToDemo: () => void;
  onOpenSimulator: () => void;
  onOpenHowTo: () => void;
  currentMonthName: string;
}

export const SheetSourceBar: React.FC<SheetSourceBarProps> = ({
  sheetUrlInput,
  onUrlChange,
  onDetect,
  isLoading,
  spreadsheetTitle,
  detectedTabs,
  activeTab,
  autoDetectedTab,
  onSelectTab,
  onResetToDemo,
  onOpenSimulator,
  onOpenHowTo,
  currentMonthName,
}) => {
  const [isUrlExpanded, setIsUrlExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
      {/* Top row: Spreadsheet info and Google Sheets URL control */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="p-2.5 rounded-xl bg-blue-50 text-[#3B82F6] border border-blue-100 shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {spreadsheetTitle}
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Google Sheets Source
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Auto-detects monthly tournament preparation tabs (June 5, July 6, August 5, September 5)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setIsUrlExpanded(!isUrlExpanded)}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            {isUrlExpanded ? 'Hide Sheet Link' : 'Change Sheet Link'}
          </button>

          <button
            type="button"
            onClick={onOpenSimulator}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
            title="Test how the auto-detection works for any given month"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#3B82F6]" />
            Simulate Month
          </button>

          <button
            type="button"
            onClick={onOpenHowTo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title="How to link your Google Sheet"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded URL Input drawer */}
      {isUrlExpanded && (
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={sheetUrlInput}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="Paste Google Sheets link (e.g. https://docs.google.com/spreadsheets/d/...)"
                className="w-full pl-3.5 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] text-slate-900 placeholder:text-slate-400"
              />
            </div>
            <button
              type="button"
              onClick={onDetect}
              disabled={isLoading}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white bg-[#3B82F6] hover:bg-blue-600 transition-colors disabled:opacity-50 shrink-0 shadow-xs"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 mr-1.5 animate-spin" />
                  Detecting...
                </>
              ) : (
                'Detect Tabs & Load'
              )}
            </button>
            <button
              type="button"
              onClick={onResetToDemo}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
            >
              Reset to 2026 CH Sheet
            </button>
          </div>
          <p className="text-[11px] text-slate-500 flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 mr-1 shrink-0" />
            Make sure the Google Sheet permission is set to <strong>"Anyone with the link can view"</strong> so tabs can be fetched directly.
          </p>
        </div>
      )}

      {/* Auto-detected Month Match Alert Card matching design HTML */}
      {autoDetectedTab && (
        <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs text-blue-600 font-bold mb-0.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Auto-detected Month Match
            </p>
            <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Active Cycle Tab: <strong>{autoDetectedTab}</strong></span>
            </p>
          </div>
          <span className="text-[11px] font-medium text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-1 rounded-full self-start sm:self-auto">
            Synchronized with {currentMonthName} 2026
          </span>
        </div>
      )}

      {/* Monthly Sheet Tabs Bar */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Available Monthly Tabs:
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline font-mono">
            System: <strong className="text-slate-800">{currentMonthName} 2026</strong>
          </span>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-2">
          {detectedTabs.map((tab) => {
            const isSelected = activeTab === tab.name;
            const isCurrentMonthMatch = tab.isCurrentMonth;

            return (
              <button
                key={tab.name}
                type="button"
                onClick={() => onSelectTab(tab.name)}
                className={`group relative inline-flex items-center px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-[#0F172A] text-white shadow-sm ring-2 ring-[#3B82F6] ring-offset-1'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                }`}
              >
                <Calendar
                  className={`w-3.5 h-3.5 mr-1.5 ${
                    isSelected ? 'text-blue-400' : isCurrentMonthMatch ? 'text-blue-600' : 'text-slate-400'
                  }`}
                />
                <span className="font-semibold">{tab.name}</span>

                {isCurrentMonthMatch && (
                  <span
                    className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isSelected
                        ? 'bg-[#3B82F6] text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                    title="Matches current month"
                  >
                    Auto Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
