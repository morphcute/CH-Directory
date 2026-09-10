import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Image as ImageIcon,
  Check,
  Trash2,
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  Shield,
  Layers,
  Type,
  FileImage,
  AlertCircle,
} from 'lucide-react';
import { HeaderBackgroundConfig } from '../types';
import { HEADER_PRESETS } from '../data/headerPresets';
import { compressImageFile } from '../utils/imageUtils';

interface HeaderBannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  bgConfig: HeaderBackgroundConfig;
  onUpdateBgConfig: (newConfig: HeaderBackgroundConfig) => void;
  currentMonthName: string;
  currentYear: number;
}

export const HeaderBannerModal: React.FC<HeaderBannerModalProps> = ({
  isOpen,
  onClose,
  bgConfig,
  onUpdateBgConfig,
  currentMonthName,
  currentYear,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'text' | 'presets'>('upload');
  const [configDraft, setConfigDraft] = useState<HeaderBackgroundConfig>({ ...bgConfig });
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState(configDraft.customUrl || '');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Active banner image preview URL
  const currentBannerPreview =
    configDraft.type === 'custom'
      ? configDraft.uploadedBannerDataUrl || configDraft.customUrl || ''
      : (HEADER_PRESETS.find((p) => p.id === configDraft.presetId) || HEADER_PRESETS[0]).imageUrl;

  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await compressImageFile(file, 1920, 960, 0.88);
      setConfigDraft((prev) => ({
        ...prev,
        type: 'custom',
        uploadedBannerDataUrl: result.dataUrl,
        bannerFileName: result.originalName,
      }));
      setSuccessNotice(`Uploaded "${result.originalName}" (${result.width}×${result.height}px, ${result.sizeKb} KB)`);
      setTimeout(() => setSuccessNotice(null), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to process the uploaded image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const result = await compressImageFile(file, 400, 400, 0.9);
      setConfigDraft((prev) => ({
        ...prev,
        avatarType: 'custom',
        avatarCustomUrl: result.dataUrl,
      }));
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to upload avatar logo.');
    }
  };

  const handleSaveAndApply = () => {
    onUpdateBgConfig(configDraft);
    onClose();
  };

  const handleResetToDefault = () => {
    const defaultConfig: HeaderBackgroundConfig = {
      type: 'preset',
      presetId: 'official-ch-banner',
      title: 'MLBB PH - Community Heroes',
      subtitle: '@OfficialTournamentDirectory',
      description:
        'MLBB PH - Community Heroes, leading MLBB community events for the Filipinos.',
      facebookPageUrl: 'https://www.facebook.com/MLBBPHCommunityHeroes',
      followersText: '286K followers • 5 following',
      categoryText: 'Interest',
      overlayDarkness: 0.15,
      bannerHeight: 'compact',
      bannerFit: 'cover',
      uploadedBannerDataUrl: undefined,
      bannerFileName: undefined,
      customUrl: undefined,
      avatarType: 'custom',
      avatarCustomUrl: undefined,
    };
    setConfigDraft(defaultConfig);
    onUpdateBgConfig(defaultConfig);
    setSuccessNotice('Header banner reset to official default.');
    setTimeout(() => setSuccessNotice(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div
        className="relative w-full max-w-2xl bg-[#0f121a] border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>Header Banner & Design Settings</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Admin
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Upload your tournament banner picture and customize header branding.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Live Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileImage className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Header Banner Preview</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {configDraft.type === 'custom'
                  ? configDraft.uploadedBannerDataUrl
                    ? `Uploaded Banner: ${configDraft.bannerFileName || 'Custom File'}`
                    : 'Custom Image URL'
                  : 'Preset Template'}
              </span>
            </div>

            <div
              className={`relative w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-xl bg-black ${
                configDraft.bannerHeight === 'compact'
                  ? 'h-28 sm:h-36'
                  : configDraft.bannerHeight === 'tall'
                  ? 'h-44 sm:h-56'
                  : 'h-36 sm:h-44'
              }`}
            >
              <img
                src={currentBannerPreview}
                alt="Banner Preview"
                className={`w-full h-full ${
                  configDraft.bannerFit === 'contain'
                    ? 'object-contain bg-slate-950'
                    : 'object-cover object-center'
                }`}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80';
                }}
              />

              {/* Dark Gradient Overlay */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#0f121a] via-[#0f121a]/30 to-transparent"
                style={{
                  backgroundColor: `rgba(0, 0, 0, ${configDraft.overlayDarkness ?? 0.25})`,
                }}
              />

              {/* Live Preview Badges */}
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-lg shadow-sm">
                {currentMonthName} {currentYear}
              </div>

              <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md border border-slate-700/80 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-lg">
                Hourly Sync Active
              </div>

              {/* Title preview in bottom left of banner */}
              <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between">
                <span className="text-xs font-black text-white drop-shadow-md truncate">
                  {configDraft.title || 'MLBB Community Heroes'}
                </span>
                <span className="text-[10px] font-mono text-amber-300/90 bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-xs">
                  {configDraft.bannerFit === 'contain' ? 'Fit: Contain' : 'Fit: Cover'}
                </span>
              </div>
            </div>
          </div>

          {/* Alert messages */}
          {successNotice && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-950/70 border border-red-500/40 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveSubTab('upload')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'upload'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Picture</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('text')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'text'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Titles & Logo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('presets')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'presets'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Official Presets</span>
            </button>
          </div>

          {/* SUBTAB 1: UPLOAD PICTURE */}
          {activeSubTab === 'upload' && (
            <div className="space-y-4">
              {/* Drag & Drop Upload Zone */}
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-slate-700 hover:border-amber-400 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-900/60 hover:bg-slate-900 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    {isProcessing ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    {isProcessing ? 'Processing image...' : 'Click to Browse or Drag & Drop Banner Picture'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Supports PNG, JPG, WebP, GIF • Recommended 1600×400 or 1200×500 px
                  </p>
                  <span className="inline-block mt-3 px-3 py-1 bg-amber-500 text-slate-950 rounded-lg text-xs font-black group-hover:bg-amber-400">
                    Choose Picture File
                  </span>
                </div>
              </div>

              {/* Upload Status Card if uploaded */}
              {configDraft.uploadedBannerDataUrl && (
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {configDraft.bannerFileName || 'Custom Uploaded Banner'}
                      </p>
                      <p className="text-[10px] text-emerald-400">
                        Active as Header Banner
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfigDraft((prev) => ({
                        ...prev,
                        type: 'preset',
                        uploadedBannerDataUrl: undefined,
                        bannerFileName: undefined,
                      }));
                      setSuccessNotice('Custom banner cleared. Reverted to official theme.');
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Remove custom banner"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Alternative: Direct Image URL */}
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
                <label className="block text-xs font-bold text-slate-300">
                  Or Paste Direct Banner Image URL (e.g. Google Drive/Forms/Imgur):
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://example.com/tournaments/banner.jpg"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customUrlInput.trim()) {
                        setConfigDraft((prev) => ({
                          ...prev,
                          type: 'custom',
                          customUrl: customUrlInput.trim(),
                          uploadedBannerDataUrl: undefined, // prioritize the url
                        }));
                        setSuccessNotice('Custom image URL applied!');
                        setTimeout(() => setSuccessNotice(null), 3000);
                      }
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold rounded-xl text-xs transition-colors shrink-0"
                  >
                    Apply URL
                  </button>
                </div>
              </div>

              {/* Aspect Ratio / Fit and Height Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Banner Height */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">Banner Height</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['compact', 'standard', 'tall'] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setConfigDraft((prev) => ({ ...prev, bannerHeight: h }))}
                        className={`py-1 text-[11px] font-bold rounded-lg capitalize transition-colors ${
                          (configDraft.bannerHeight || 'standard') === h
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Banner Fit */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">Image Fit</label>
                  <div className="grid grid-cols-2 gap-1">
                    {(['cover', 'contain'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setConfigDraft((prev) => ({ ...prev, bannerFit: f }))}
                        className={`py-1 text-[11px] font-bold rounded-lg capitalize transition-colors ${
                          (configDraft.bannerFit || 'cover') === f
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Darkness Slider */}
                <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Dark Overlay</span>
                    <span className="font-mono text-amber-400 font-bold">
                      {Math.round((configDraft.overlayDarkness ?? 0.25) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.75"
                    step="0.05"
                    value={configDraft.overlayDarkness ?? 0.25}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        overlayDarkness: parseFloat(e.target.value),
                      }))
                    }
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SUBTAB 2: TITLES, SUBTITLE, BIO & LOGO */}
          {activeSubTab === 'text' && (
            <div className="space-y-4">
              {/* Tournament Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Tournament Title:
                </label>
                <input
                  type="text"
                  value={configDraft.title ?? 'MLBB Community Heroes'}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g. MLBB Community Heroes"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Subtitle / Handle */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Subtitle / Handle:
                </label>
                <input
                  type="text"
                  value={configDraft.subtitle ?? '@OfficialTournamentDirectory'}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  placeholder="e.g. @OfficialTournamentDirectory or @CHQuezonProvince"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Facebook Page URL (Follow Action) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Facebook Page Link (Follow Button):</span>
                  <span className="text-[11px] font-normal text-blue-400">Opens on Follow click</span>
                </label>
                <input
                  type="url"
                  value={configDraft.facebookPageUrl ?? 'https://www.facebook.com/MLBBPHCommunityHeroes'}
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, facebookPageUrl: e.target.value }))
                  }
                  placeholder="https://www.facebook.com/MLBBPHCommunityHeroes"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:border-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Followers & Category Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Followers Count Text:
                  </label>
                  <input
                    type="text"
                    value={configDraft.followersText ?? '286K followers • 5 following'}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, followersText: e.target.value }))
                    }
                    placeholder="e.g. 286K followers • 5 following"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Category Tag:
                  </label>
                  <input
                    type="text"
                    value={configDraft.categoryText ?? 'Interest'}
                    onChange={(e) =>
                      setConfigDraft((prev) => ({ ...prev, categoryText: e.target.value }))
                    }
                    placeholder="e.g. Interest, Esports League, Community"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Bio & Instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Header Bio / Description:
                </label>
                <textarea
                  rows={2}
                  value={
                    configDraft.description ??
                    'MLBB PH - Community Heroes, leading MLBB community events for the Filipinos.'
                  }
                  onChange={(e) =>
                    setConfigDraft((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-amber-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Tournament Logo / Avatar Upload */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <input
                  type="file"
                  ref={avatarInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAvatarUpload(file);
                  }}
                />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>Tournament Profile Logo</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Upload custom squad crest or keep official gold shield.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {configDraft.avatarCustomUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setConfigDraft((prev) => ({
                            ...prev,
                            avatarType: 'icon',
                            avatarCustomUrl: undefined,
                          }))
                        }
                        className="px-2.5 py-1 text-xs text-red-400 hover:bg-slate-800 rounded-lg"
                      >
                        Reset to Shield
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{configDraft.avatarCustomUrl ? 'Change Logo' : 'Upload Logo'}</span>
                    </button>
                  </div>
                </div>

                {configDraft.avatarCustomUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <img
                      src={configDraft.avatarCustomUrl}
                      alt="Custom Avatar"
                      className="w-12 h-12 rounded-xl object-cover border border-amber-500/40"
                    />
                    <span className="text-xs text-emerald-400 font-semibold">
                      Custom tournament avatar loaded!
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBTAB 3: OFFICIAL ESPORTS PRESETS */}
          {activeSubTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Choose any pre-rendered esports championship backdrop if you prefer an instant theme:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {HEADER_PRESETS.map((preset) => {
                  const isSelected =
                    configDraft.type === 'preset' && configDraft.presetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => {
                        setConfigDraft((prev) => ({
                          ...prev,
                          type: 'preset',
                          presetId: preset.id,
                          uploadedBannerDataUrl: undefined,
                          customUrl: undefined,
                        }));
                        setSuccessNotice(`Selected preset "${preset.name}".`);
                        setTimeout(() => setSuccessNotice(null), 2500);
                      }}
                      className={`cursor-pointer rounded-2xl border-2 overflow-hidden transition-all group ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-500/40 shadow-lg'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="h-24 bg-slate-950 relative overflow-hidden">
                        <img
                          src={preset.imageUrl}
                          alt={preset.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute top-2 right-2 bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-bold text-amber-300">
                          {preset.badge}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                            {preset.name}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs text-slate-400 hover:text-red-400 font-semibold transition-colors"
          >
            Reset to Default
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Apply Header Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
