import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckSquare,
  Square,
  RefreshCw,
  Clock,
  ExternalLink,
  Users,
  Eye,
  Sliders,
  Sparkles,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  Image as ImageIcon,
  Upload,
  Palette,
  Check,
  Edit2,
  Trash2,
  Save,
  Link as LinkIcon,
  MapPin,
  ListPlus,
  Minus,
  Globe,
} from 'lucide-react';
import { CHPlayer, HeaderBackgroundConfig } from '../types';
import { HEADER_PRESETS } from '../data/headerPresets';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: CHPlayer[];
  selectedNicknames: string[];
  onToggleNickname: (nickname: string) => void;
  onSelectAllNicknames: (select: boolean) => void;
  onSelectActiveOnly: () => void;
  onAddPlayer?: (player: Omit<CHPlayer, 'id'>) => void;
  onUpdatePlayer?: (player: CHPlayer) => void;
  onDeletePlayer?: (playerId: string) => void;
  onBulkAddNicknames?: (nicknames: string[]) => void;
  onUpdatePlayerCapacity: (playerId: string, teamsRegistered: number, maxTeams: number) => void;
  onRunHourlyDetection: () => Promise<void>;
  isDetecting: boolean;
  lastHourlySync: string;
  nextSyncCountdown: string;
  onSwitchToVisitorView: () => void;
  onOpenMonthSimulator: () => void;
  currentTabName: string;
  bgConfig: HeaderBackgroundConfig;
  onUpdateBgConfig: (config: HeaderBackgroundConfig) => void;
  defaultTab?: 'banner' | 'nicknames' | 'responseSheets' | 'source';
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  players,
  selectedNicknames,
  onToggleNickname,
  onSelectAllNicknames,
  onSelectActiveOnly,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onBulkAddNicknames,
  onUpdatePlayerCapacity,
  onRunHourlyDetection,
  isDetecting,
  lastHourlySync,
  nextSyncCountdown,
  onSwitchToVisitorView,
  onOpenMonthSimulator,
  currentTabName,
  bgConfig,
  onUpdateBgConfig,
  defaultTab = 'banner',
}) => {
  const [activeTab, setActiveTab] = useState<'banner' | 'nicknames' | 'responseSheets' | 'source'>(
    defaultTab
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [customImageUrlInput, setCustomImageUrlInput] = useState(
    bgConfig.type === 'custom' && bgConfig.customUrl ? bgConfig.customUrl : ''
  );
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // CH Nickname Management State
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New Player Form State
  const [newNickname, setNewNickname] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newPostingLink, setNewPostingLink] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newTeamsRegistered, setNewTeamsRegistered] = useState(10);
  const [newMaxTeams, setNewMaxTeams] = useState(16);
  const [newResponseSheet, setNewResponseSheet] = useState('');

  // Edit Player State
  const [editingPlayer, setEditingPlayer] = useState<CHPlayer | null>(null);
  const [editForm, setEditForm] = useState<{
    chNickname: string;
    area: string;
    fullName: string;
    registrationFormLink: string;
    tournamentResponseSheet: string;
    teamsRegistered: number;
    maxTeams: number;
  }>({
    chNickname: '',
    area: '',
    fullName: '',
    registrationFormLink: '',
    tournamentResponseSheet: '',
    teamsRegistered: 10,
    maxTeams: 16,
  });

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  if (!isOpen) return null;

  // Filter nicknames by search query
  const filteredPlayers = players.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.chNickname.toLowerCase().includes(q) ||
      p.fullName.toLowerCase().includes(q) ||
      p.area.toLowerCase().includes(q)
    );
  });

  const selectedCount = selectedNicknames.length;
  const totalCount = players.length;

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onUpdateBgConfig({
            ...bgConfig,
            type: 'custom',
            customUrl: result,
          });
          setCustomImageUrlInput(result);
          setUploadSuccess(true);
          setTimeout(() => setUploadSuccess(false), 3000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyCustomUrl = () => {
    if (customImageUrlInput.trim()) {
      onUpdateBgConfig({
        ...bgConfig,
        type: 'custom',
        customUrl: customImageUrlInput.trim(),
      });
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Admin Control Center</h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  Community Heroes Admin
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Choose background header image, select visible CH Nicknames, and manage hourly response detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSwitchToVisitorView();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
              title="Preview the clean visitor directory"
            >
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Visitor Preview</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 px-4 pt-2 border-b border-slate-200 flex flex-wrap gap-1 sm:gap-2">
          {/* Tab: Background Header Image */}
          <button
            onClick={() => setActiveTab('banner')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-t-2 ${
              activeTab === 'banner'
                ? 'bg-white text-amber-600 border-amber-500 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Header Background</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </button>

          {/* Tab: CH Nickname Directory */}
          <button
            onClick={() => setActiveTab('nicknames')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-t-2 ${
              activeTab === 'nicknames'
                ? 'bg-white text-blue-600 border-blue-500 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>CH Nicknames & Directory</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-xs font-bold ${
                activeTab === 'nicknames' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {selectedCount}/{totalCount}
            </span>
          </button>

          {/* Tab: Response Sheet & Capacity */}
          <button
            onClick={() => setActiveTab('responseSheets')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-t-2 ${
              activeTab === 'responseSheets'
                ? 'bg-white text-blue-600 border-blue-500 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Capacity (16/16 vs 10/16)</span>
          </button>

          {/* Tab: Month & Sheet */}
          <button
            onClick={() => setActiveTab('source')}
            className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-t-2 ${
              activeTab === 'source'
                ? 'bg-white text-blue-600 border-blue-500 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Monthly Sheet Cycle</span>
          </button>
        </div>

        {/* Tab Content: Banner Image Selector */}
        {activeTab === 'banner' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
              <ImageIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Google Forms Style Header Picture Banner</p>
                <p className="text-amber-900 mt-0.5">
                  The header picture banner sits at the very top of the directory just like a Google Forms banner. Upload your own banner image file (e.g. image.png), choose an official preset, or set a custom image link.
                </p>
              </div>
            </div>

            {/* Live Banner Preview */}
            <div className="border border-slate-300 rounded-2xl overflow-hidden bg-slate-950 shadow-md">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Live Header Picture Banner Preview
                </span>
                <span className="text-[11px] text-amber-400 font-mono">
                  {bgConfig.type === 'custom' ? 'Custom Uploaded Banner' : 'Preset Banner'}
                </span>
              </div>
              <div
                className={`relative w-full overflow-hidden ${
                  bgConfig.bannerHeight === 'compact'
                    ? 'h-28'
                    : bgConfig.bannerHeight === 'tall'
                    ? 'h-44'
                    : 'h-36'
                }`}
              >
                <img
                  src={
                    bgConfig.type === 'custom' && bgConfig.customUrl
                      ? bgConfig.customUrl
                      : HEADER_PRESETS.find((p) => p.id === bgConfig.presetId)?.imageUrl ||
                        HEADER_PRESETS[0].imageUrl
                  }
                  alt="Banner preview"
                  className={`w-full h-full ${
                    bgConfig.bannerFit === 'contain' ? 'object-contain' : 'object-cover'
                  }`}
                  referrerPolicy="no-referrer"
                />
                {(bgConfig.overlayDarkness ?? 0.15) > 0 && (
                  <div
                    className="absolute inset-0 bg-slate-950 pointer-events-none"
                    style={{ opacity: bgConfig.overlayDarkness ?? 0.15 }}
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-3 z-10 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-[10px] text-slate-300 font-mono">
                  Preview ({bgConfig.bannerHeight || 'standard'} • {bgConfig.bannerFit || 'cover'})
                </div>
              </div>
            </div>

            {/* Presets Grid */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                Official MLBB Community Hero Presets
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HEADER_PRESETS.map((preset) => {
                  const isSelected =
                    bgConfig.type === 'preset' && bgConfig.presetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() =>
                        onUpdateBgConfig({
                          ...bgConfig,
                          type: 'preset',
                          presetId: preset.id,
                        })
                      }
                      className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all p-3 flex flex-col justify-between h-36 ${
                        isSelected
                          ? 'border-amber-500 ring-2 ring-amber-500/30 shadow-md'
                          : 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                      }`}
                      style={{
                        backgroundImage: `linear-gradient(rgba(15,23,42,0.65), rgba(15,23,42,0.85)), url(${preset.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500 text-slate-950">
                          {preset.badge}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs shadow-xs">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div>
                        <h5 className="font-bold text-white text-sm drop-shadow-xs">{preset.name}</h5>
                        <p className="text-[11px] text-slate-300 line-clamp-1">{preset.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upload or Custom URL */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-slate-600" />
                Upload Your Own Banner Image (e.g. image.png)
              </h4>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* File input button */}
                <label className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-all shadow-xs border border-slate-700">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>Choose Image File from Computer</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <span className="text-xs text-slate-400">or paste direct image URL below</span>
              </div>

              {/* URL Input */}
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={customImageUrlInput}
                  onChange={(e) => setCustomImageUrlInput(e.target.value)}
                  placeholder="https://example.com/mlbb_community_hero_banner.png"
                  className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomUrl}
                  disabled={!customImageUrlInput.trim()}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs transition-colors shrink-0 shadow-xs"
                >
                  Apply URL
                </button>
              </div>

              {uploadSuccess && (
                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Header background updated successfully!</span>
                </div>
              )}
            </div>

            {/* Google Forms Style Banner Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Banner Height */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Banner Height (Google Forms Format)
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['compact', 'standard', 'tall'] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() =>
                        onUpdateBgConfig({
                          ...bgConfig,
                          bannerHeight: h,
                        })
                      }
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border ${
                        (bgConfig.bannerHeight || 'standard') === h
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Standard (220px) matches Google Forms header image proportions.
                </p>
              </div>

              {/* Banner Fit */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Image Sizing & Fit
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['cover', 'contain'] as const).map((fit) => (
                    <button
                      key={fit}
                      type="button"
                      onClick={() =>
                        onUpdateBgConfig({
                          ...bgConfig,
                          bannerFit: fit,
                        })
                      }
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border ${
                        (bgConfig.bannerFit || 'cover') === fit
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {fit === 'cover' ? 'Full Bleed (Cover)' : 'Fit Entire Image'}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">
                  Choose &quot;Fit Entire Image&quot; if your graphic banner has logos at the extreme edges.
                </p>
              </div>
            </div>

            {/* Darkness Overlay Slider */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-slate-500" />
                  <span>Banner Contrast / Dimming (0% = Full Color Picture)</span>
                </label>
                <span className="font-mono text-xs text-slate-600 font-bold">
                  {Math.round((bgConfig.overlayDarkness ?? 0.15) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={bgConfig.overlayDarkness ?? 0.15}
                onChange={(e) =>
                  onUpdateBgConfig({
                    ...bgConfig,
                    overlayDarkness: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Keep low (0%–20%) like Google Forms to display the uploaded banner artwork in its original full colors.
              </p>
            </div>
          </div>
        )}

        {/* Tab Content: CH Nickname Directory Manager */}
        {activeTab === 'nicknames' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            {/* Status notification banner */}
            {statusMessage && (
              <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl p-3 flex items-center justify-between gap-2 text-xs font-semibold animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{statusMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusMessage(null)}
                  className="text-emerald-700 hover:text-emerald-950 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Nationwide Header Notice */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 flex items-start gap-3 shadow-xs">
              <Globe className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-blue-950 text-sm">
                  Nationwide CH Nickname Management
                </p>
                <p className="text-blue-800 leading-relaxed">
                  We are not focusing on CALABARZON. You can list Community Heads from <strong>any province, city, or region</strong> (Quezon Province, Metro Manila, Laguna, Cavite, Batangas, Rizal, Cebu, Davao, Bicol, Pampanga, etc.).
                </p>
                <p className="text-blue-900 font-semibold pt-0.5">
                  ✓ Every CH Nickname listed here displays in both the <strong>Admin Directory</strong> and the <strong>Normal View Directory</strong>.
                </p>
              </div>
            </div>

            {/* Top Controls: Add CH, Bulk Add, Search & Batch Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pb-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(!showAddForm);
                    setShowBulkAdd(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                    showAddForm
                      ? 'bg-blue-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddForm ? 'Close Add Form' : '+ List New CH Nickname'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBulkAdd(!showBulkAdd);
                    setShowAddForm(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                    showBulkAdd
                      ? 'bg-slate-800 text-white border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                  }`}
                >
                  <ListPlus className="w-3.5 h-3.5 text-blue-600" />
                  <span>{showBulkAdd ? 'Close Bulk' : 'Bulk Paste Nicknames'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onSelectAllNicknames(true)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                >
                  Select All ({players.length})
                </button>
                <button
                  onClick={onSelectActiveOnly}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                >
                  Select Active Only
                </button>
                <button
                  onClick={() => onSelectAllNicknames(false)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* FORM A: Add New CH Nickname */}
            {showAddForm && (
              <div className="bg-slate-50 border-2 border-blue-400/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>List New CH Nickname in Directory</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Will display in public & admin directory</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      CH Nickname <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      placeholder="e.g. Lester, Meg, Frank, Tigz"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Area / Province / Region <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newArea}
                      onChange={(e) => setNewArea(e.target.value)}
                      placeholder="e.g. Quezon Province, Cebu, Manila"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Full Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="e.g. Kim Lester L. Evangelista"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">
                      Tournament Posting Link / Form URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={newPostingLink}
                      onChange={(e) => setNewPostingLink(e.target.value)}
                      placeholder="https://tinyurl.com/... or https://forms.gle/..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Initial Status Slots (Registered / Max)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={16}
                        value={newTeamsRegistered}
                        onChange={(e) => setNewTeamsRegistered(parseInt(e.target.value) || 0)}
                        className="w-16 px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold text-center bg-white"
                      />
                      <span className="text-slate-400 font-bold">/</span>
                      <input
                        type="number"
                        min={1}
                        max={64}
                        value={newMaxTeams}
                        onChange={(e) => setNewMaxTeams(parseInt(e.target.value) || 16)}
                        className="w-16 px-2.5 py-2 border border-slate-300 rounded-lg text-xs font-bold text-center bg-white"
                      />
                      <span className="text-[11px] text-slate-500">
                        {newTeamsRegistered >= newMaxTeams ? '(Full 16/16)' : `(${newMaxTeams - newTeamsRegistered} open)`}
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="block font-bold text-slate-800 mb-1">
                      Tournament Response Sheet URL (Optional, for hourly row-count detection)
                    </label>
                    <input
                      type="url"
                      value={newResponseSheet}
                      onChange={(e) => setNewResponseSheet(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/... (Column G link)"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newNickname.trim()) {
                        alert('Please provide a CH Nickname');
                        return;
                      }
                      const nick = newNickname.trim();
                      const link =
                        newPostingLink.trim() ||
                        `https://forms.gle/${nick.toLowerCase()}-mlbb-tournament`;
                      const area = newArea.trim() || 'General';

                      if (onAddPlayer) {
                        onAddPlayer({
                          active: true,
                          area: area,
                          fullName: newFullName.trim() || nick,
                          chNickname: nick,
                          registrationFormLink: link,
                          tournamentPostingLink: link,
                          tournamentResponseSheet: newResponseSheet.trim(),
                          teamsRegistered: newTeamsRegistered,
                          maxTeams: newMaxTeams,
                          lastDetectedAt:
                            new Date().toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            }) + ' PHT',
                        });
                      } else {
                        // Fallback toggle
                        onToggleNickname(nick);
                      }

                      setStatusMessage(
                        `CH Nickname "${nick}" has been added and listed in both Admin & Normal View Directory!`
                      );
                      setNewNickname('');
                      setNewArea('');
                      setNewPostingLink('');
                      setNewFullName('');
                      setNewResponseSheet('');
                      setNewTeamsRegistered(10);
                      setShowAddForm(false);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>List CH Nickname in Directory</span>
                  </button>
                </div>
              </div>
            )}

            {/* FORM B: Bulk Paste Nicknames */}
            {showBulkAdd && (
              <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <ListPlus className="w-4 h-4 text-blue-600" />
                    <span>Bulk Paste CH Nicknames</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Separated by comma or new lines</span>
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder="e.g. Lester, Meg, Frank, Tigz, Kix, Clyde, Tala, Yvonne, Dan, Cheska, Vien, Seiun, Jerz, Tron, Yuki, JV"
                    className="w-full p-3 border border-slate-300 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Any new nicknames will be registered in the directory and automatically marked visible.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkAdd(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!bulkInput.trim()) return;
                      const parts = bulkInput
                        .split(/[,\n]/)
                        .map((s) => s.trim())
                        .filter(Boolean);

                      if (onBulkAddNicknames) {
                        onBulkAddNicknames(parts);
                      } else {
                        parts.forEach((p) => onToggleNickname(p));
                      }

                      setStatusMessage(`Added/Selected ${parts.length} CH Nicknames in directory.`);
                      setBulkInput('');
                      setShowBulkAdd(false);
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>List All Nicknames</span>
                  </button>
                </div>
              </div>
            )}

            {/* EDIT MODAL DIALOG */}
            {editingPlayer && (
              <div className="bg-amber-50/90 border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-amber-700" />
                    <h4 className="font-bold text-sm text-amber-950">
                      Edit CH: {editingPlayer.chNickname}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">CH Nickname</label>
                    <input
                      type="text"
                      value={editForm.chNickname}
                      onChange={(e) => setEditForm({ ...editForm, chNickname: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Area / Province</label>
                    <input
                      type="text"
                      value={editForm.area}
                      onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-800 mb-1">Tournament Posting Link</label>
                    <input
                      type="url"
                      value={editForm.registrationFormLink}
                      onChange={(e) =>
                        setEditForm({ ...editForm, registrationFormLink: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Teams / Max</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={64}
                        value={editForm.teamsRegistered}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            teamsRegistered: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold text-center bg-white"
                      />
                      <span>/</span>
                      <input
                        type="number"
                        min={1}
                        max={64}
                        value={editForm.maxTeams}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            maxTeams: parseInt(e.target.value) || 16,
                          })
                        }
                        className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-xs font-bold text-center bg-white"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 md:col-span-3">
                    <label className="block font-bold text-slate-800 mb-1">Response Sheet URL</label>
                    <input
                      type="url"
                      value={editForm.tournamentResponseSheet}
                      onChange={(e) =>
                        setEditForm({ ...editForm, tournamentResponseSheet: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editForm.chNickname.trim()) return;
                      if (onUpdatePlayer) {
                        onUpdatePlayer({
                          ...editingPlayer,
                          chNickname: editForm.chNickname.trim(),
                          area: editForm.area.trim() || 'General',
                          fullName: editForm.fullName.trim(),
                          registrationFormLink: editForm.registrationFormLink.trim(),
                          tournamentPostingLink: editForm.registrationFormLink.trim(),
                          tournamentResponseSheet: editForm.tournamentResponseSheet.trim(),
                          teamsRegistered: editForm.teamsRegistered,
                          maxTeams: editForm.maxTeams,
                        });
                      }
                      setStatusMessage(`Updated details for "${editForm.chNickname}".`);
                      setEditingPlayer(null);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            )}

            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CH Nickname (Lester, Meg, Frank, etc.), area, or name..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Listed CH Nicknames Directory Grid */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredPlayers.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No Community Heads found matching &ldquo;{searchQuery}&rdquo;.
                </div>
              ) : (
                filteredPlayers.map((player) => {
                  const isSelected = selectedNicknames.includes(player.chNickname);
                  const isFull = player.teamsRegistered >= player.maxTeams;

                  return (
                    <div
                      key={player.id}
                      className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-50/60 border-blue-300 shadow-xs'
                          : 'bg-slate-50/70 border-slate-200 opacity-60'
                      }`}
                    >
                      {/* Left: Checkbox + Nickname + Area + Full Name */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleNickname(player.chNickname)}
                          className="mt-0.5 sm:mt-0 text-blue-600 hover:text-blue-700 shrink-0"
                          title={
                            isSelected
                              ? 'Visible in public & admin directory (click to hide)'
                              : 'Hidden from public directory (click to show)'
                          }
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </button>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900">
                              {player.chNickname}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              {player.area}
                            </span>
                            {isSelected ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Visible
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                                Hidden
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            {player.fullName && <span>{player.fullName}</span>}
                            {player.tournamentPostingLink && (
                              <a
                                href={player.tournamentPostingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium truncate max-w-[200px]"
                              >
                                <LinkIcon className="w-3 h-3 shrink-0" />
                                <span className="truncate">{player.tournamentPostingLink}</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Slot Capacity (16/16 vs 10/16) + Edit + Delete Controls */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                        {/* Inline Capacity Controls */}
                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePlayerCapacity(
                                player.id,
                                Math.max(0, player.teamsRegistered - 1),
                                player.maxTeams
                              )
                            }
                            className="w-5 h-5 flex items-center justify-center rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                            title="Decrease team count"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <span
                            className={`px-2 py-0.5 text-xs font-mono font-bold rounded-md ${
                              isFull
                                ? 'bg-red-100 text-red-700 font-black'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {player.teamsRegistered}/{player.maxTeams}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              onUpdatePlayerCapacity(
                                player.id,
                                Math.min(player.maxTeams, player.teamsRegistered + 1),
                                player.maxTeams
                              )
                            }
                            className="w-5 h-5 flex items-center justify-center rounded-sm bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                            title="Increase team count"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlayer(player);
                            setEditForm({
                              chNickname: player.chNickname,
                              area: player.area,
                              fullName: player.fullName,
                              registrationFormLink:
                                player.tournamentPostingLink || player.registrationFormLink,
                              tournamentResponseSheet: player.tournamentResponseSheet || '',
                              teamsRegistered: player.teamsRegistered,
                              maxTeams: player.maxTeams,
                            });
                          }}
                          className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Edit CH details"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        {onDeletePlayer && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to remove "${player.chNickname}" from the directory?`
                                )
                              ) {
                                onDeletePlayer(player.id);
                                setStatusMessage(`Removed "${player.chNickname}" from directory.`);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete CH from directory"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom summary bar */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div className="font-medium">
                Active in Directory:{' '}
                <span className="font-bold text-blue-600">{selectedCount}</span> of {totalCount}{' '}
                listed
              </div>
              <div className="text-[11px] text-slate-400">
                All changes persist automatically in live directory
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Response Sheet & Capacity */}
        {activeTab === 'responseSheets' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">Hourly Response Sheet Auto-Detection</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ACTIVE (1 HOUR INTERVAL)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Automatically checks Column G (Response Sheet) row counts to update <strong>STATUS 16/16</strong> vs <strong>STATUS 10/16</strong>.
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                    <span>Last run: <strong className="text-slate-200">{lastHourlySync}</strong></span>
                    <span>•</span>
                    <span>Next auto-check: <strong className="text-emerald-300">{nextSyncCountdown}</strong></span>
                  </div>
                </div>
              </div>

              <button
                onClick={onRunHourlyDetection}
                disabled={isDetecting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black transition-all shadow-xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
                <span>{isDetecting ? 'Detecting Sheets...' : 'Run Auto-Detection Now'}</span>
              </button>
            </div>

            {/* Response Sheets Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Community Head & Response Sheet Link</span>
                <span>Current Capacity & Status (e.g. 16/16 vs 10/16)</span>
              </div>

              <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                {players.map((player) => {
                  const isFull = player.teamsRegistered >= player.maxTeams;

                  return (
                    <div
                      key={player.id}
                      className="p-3 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{player.chNickname}</span>
                          <span className="text-slate-500">({player.area})</span>
                          {selectedNicknames.includes(player.chNickname) ? (
                            <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                              In Directory
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-slate-400">Hidden</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          {player.tournamentResponseSheet ? (
                            <a
                              href={player.tournamentResponseSheet}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 font-mono text-[11px] truncate max-w-xs"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span className="truncate">{player.tournamentResponseSheet}</span>
                            </a>
                          ) : (
                            <span className="text-amber-600 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              <span>No response sheet URL</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Capacity Modifier Controls */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                          <button
                            onClick={() =>
                              onUpdatePlayerCapacity(
                                player.id,
                                Math.max(0, player.teamsRegistered - 1),
                                player.maxTeams
                              )
                            }
                            className="w-6 h-6 rounded bg-white hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center border border-slate-300"
                            title="Decrease team count"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-sm text-slate-900 px-1 min-w-[20px] text-center">
                            {player.teamsRegistered}
                          </span>
                          <button
                            onClick={() =>
                              onUpdatePlayerCapacity(
                                player.id,
                                Math.min(player.maxTeams, player.teamsRegistered + 1),
                                player.maxTeams
                              )
                            }
                            className="w-6 h-6 rounded bg-white hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center border border-slate-300"
                            title="Increase team count"
                          >
                            +
                          </button>
                          <span className="text-slate-400 font-mono">/</span>
                          <span className="font-mono text-xs text-slate-600 px-1">{player.maxTeams}</span>
                        </div>

                        {/* Status Badge */}
                        <div className="w-28 text-center">
                          {isFull ? (
                            <span className="inline-block w-full py-1 px-2 rounded-md font-bold text-[10px] bg-red-100 text-red-700 border border-red-200">
                              STATUS 16/16 (FULL)
                            </span>
                          ) : (
                            <span className="inline-block w-full py-1 px-2 rounded-md font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                              STATUS {player.teamsRegistered}/{player.maxTeams} (OPEN)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Month Source */}
        {activeTab === 'source' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
              <h3 className="font-bold text-slate-900 text-sm">Monthly Tournament Sheet Tab Detection</h3>
              <p className="text-xs text-slate-600">
                The directory auto-detects the Google Sheet tab matching the current month (e.g. <strong>{currentTabName}</strong>).
              </p>

              <div className="pt-2">
                <button
                  onClick={onOpenMonthSimulator}
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Month Tab Simulator</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Changes apply in real time to the Community Heroes directory
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onSwitchToVisitorView();
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition-colors"
            >
              Exit to Visitor View
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shadow-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
