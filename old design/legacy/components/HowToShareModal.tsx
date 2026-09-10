import React from 'react';
import { X, CheckCircle2, FileSpreadsheet, Share2, Sparkles, Layers } from 'lucide-react';

interface HowToShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToShareModal: React.FC<HowToShareModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-50 text-[#3B82F6] border border-blue-200">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Google Sheets Setup & Tab Detection
            </h3>
            <p className="text-xs text-slate-500">
              How the automatic monthly sheet detection works
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-600">
          {/* Step 1: Sharing */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center font-bold text-slate-900">
              <Share2 className="w-4 h-4 text-blue-600 mr-1.5" />
              1. Enable Link Sharing in Google Sheets
            </div>
            <p className="text-slate-600 leading-relaxed">
              Open your sheet (e.g. <em>2026 CH DIY PREPARATION SHEET</em>), click the top-right <strong>Share</strong> button, and set General Access to <strong>"Anyone with the link can view"</strong>.
            </p>
          </div>

          {/* Step 2: Tab naming */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center font-bold text-slate-900">
              <Sparkles className="w-4 h-4 text-blue-600 mr-1.5" />
              2. Automatic Monthly Tab Naming
            </div>
            <p className="text-slate-600 leading-relaxed">
              Name your tabs using the month and date, such as:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <code className="px-2 py-1 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                September 5, 2026
              </code>
              <code className="px-2 py-1 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                August 5, 2026
              </code>
              <code className="px-2 py-1 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                July 6, 2026
              </code>
              <code className="px-2 py-1 bg-white rounded border border-slate-200 font-mono text-[11px] text-slate-800">
                June 5, 2026
              </code>
            </div>
            <p className="text-slate-500 text-[11px] pt-1">
              The app checks the current system month (e.g. September) and automatically detects and loads that month's tab without requiring manual changes every month!
            </p>
          </div>

          {/* Step 3: Column Structure */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex items-center font-bold text-slate-900">
              <Layers className="w-4 h-4 text-blue-600 mr-1.5" />
              3. Expected Column Structure
            </div>
            <ul className="space-y-1 pl-1 text-[11px] text-slate-700">
              <li><strong>Col A:</strong> <code>1</code> for Active / Registered CH (blank or colored for inactive)</li>
              <li><strong>Col B (AREA):</strong> Province or City (e.g. Rizal, Cavite, Laguna, Batangas, Quezon Province)</li>
              <li><strong>Col C:</strong> CH Full Name</li>
              <li><strong>Col D:</strong> <strong>CH Nickname</strong> (e.g. Lester, Meg, Yvonne, Frank, Tala)</li>
              <li><strong>Col E:</strong> <strong>Tournament Posting Link</strong> (e.g. tinyurl.com or bit.ly link)</li>
            </ul>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#3B82F6] hover:bg-blue-600 transition-colors shadow-xs"
          >
            Got it, close
          </button>
        </div>
      </div>
    </div>
  );
};
