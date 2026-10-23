'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  CheckCircle2,
  Sparkles,
  Sliders,
  Eye,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Layers,
  Smartphone,
  Monitor,
  AlertTriangle,
  Play,
  Pause,
  BarChart3,
  ArrowRight,
  Save,
  Percent,
  DollarSign,
  TrendingUp,
  HelpCircle,
  X,
  Target,
  Clock,
  BookOpen,
  RotateCcw,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

import {
  AdPlacementSlotId,
  AdSourceMode,
  AdFormatType,
  AdAudienceFilter,
  AdCampaignStatus,
  AdAccentColor,
  ApplyPresetMode,
  AdPlacementSlotConfig,
  AdCampaignItem,
  SuggestedAdPlacement,
  AdsSystemConfig,
  ALL_PLACEMENT_SLOT_IDS,
  getDefaultAdsConfig,
  getSuggestedPlacements,
  loadAdsConfig,
  saveAdsConfig,
  type AdsSaveResult,
  resetAdsConfigToDefaults,
  subscribeAdsConfig,
  applySuggestedPlacement,
  applyPlacementPreset,
  computeAdsAnalyticsSummary,
  resetCampaignTelemetry,
  syncAdsConfigFromServer,
  AdCreativeMode,
  AdImageFit,
} from '@/lib/ads';

import AdSlotBanner from '@/components/ads/AdSlotBanner';

export type AdsManagerSubTab = 'suggestions' | 'placements' | 'campaigns' | 'preview';

const CAMBRIDGE_SUBJECT_OPTIONS = [
  { code: '0455', label: '0455 Economics' },
  { code: '0610', label: '0610 Biology' },
  { code: '0620', label: '0620 Chemistry' },
  { code: '0625', label: '0625 Physics' },
  { code: '0580', label: '0580 Mathematics' },
];

const SLOT_DISPLAY_INFO: Record<
  AdPlacementSlotId,
  { name: string; surface: string; description: string; defaultFormat: AdFormatType }
> = {
  start_flow_banner: {
    name: 'Start Flow Banner',
    surface: 'Pre-Quiz Setup & Paper Selection',
    description: 'Header banner shown on setup screens before a student begins a practice drill.',
    defaultFormat: 'banner',
  },
  round_summary_card: {
    name: 'Round Summary Card',
    surface: 'Quiz Results & Review Pile',
    description: 'Neobrutalist native card integrated with celebration & score review cards.',
    defaultFormat: 'native_card',
  },
  between_questions_interstitial: {
    name: 'Between-Questions Interstitial',
    surface: 'Live Quiz Session Break',
    description: 'Gentle cognitive break card rendered between question batches (e.g. every 5 questions).',
    defaultFormat: 'interstitial',
  },
  question_card_footer: {
    name: 'Question Card Footer',
    surface: 'Active Question Layout',
    description: 'Compact study pill positioned beneath multiple choice option cards.',
    defaultFormat: 'compact_pill',
  },
  leaderboard_footer: {
    name: 'Leaderboard Footer',
    surface: 'Cohort & Global Leaderboard Modal',
    description: 'Tactile sponsor pill pinned beneath the high score ranking list.',
    defaultFormat: 'compact_pill',
  },
};

export default function AdsManagerHub() {
  // All hooks must be unconditional at the top
  const [config, setConfig] = useState<AdsSystemConfig>(getDefaultAdsConfig());
  const [activeSubTab, setActiveSubTab] = useState<AdsManagerSubTab>('suggestions');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Campaign management state
  const [campaignFilter, setCampaignFilter] = useState<'all' | AdCampaignStatus>('all');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignFormData, setCampaignFormData] = useState<Partial<AdCampaignItem>>({});

  // Preview simulator state
  const [previewSlot, setPreviewSlot] = useState<AdPlacementSlotId>('start_flow_banner');
  const [previewCampaignId, setPreviewCampaignId] = useState<string>('auto');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Load config on client mount, sync with server API, and subscribe to changes
  useEffect(() => {
    setConfig(loadAdsConfig());
    if (typeof window !== 'undefined') {
      syncAdsConfigFromServer()
        .then((remote) => {
          if (remote) setConfig(remote);
        })
        .catch(() => {});
    }
    const unsubscribe = subscribeAdsConfig(() => {
      setConfig(loadAdsConfig());
    });
    return () => unsubscribe();
  }, []);

  // Compute analytics
  const analytics = useMemo(() => computeAdsAnalyticsSummary(config), [config]);
  const suggestions = useMemo(() => getSuggestedPlacements(), []);

  // Auto-clear feedback toast
  const showFeedback = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 3500);
  };

  // Server save outcome (the local save always happens; a failed server save is shown)
  const reportSaveResult = (result: AdsSaveResult) => {
    if (!result.ok) showFeedback(result.error || 'Not saved to the server', 'error');
  };

  // Preset handlers
  const handleApplyPreset = (preset: ApplyPresetMode, title: string) => {
    const updated = applyPlacementPreset(config, preset);
    setConfig(updated);
    showFeedback(`Activated preset: "${title}"`);
  };

  // Suggestion handlers (enable / disable)
  const handleApplySuggestion = (suggestion: SuggestedAdPlacement) => {
    const updated = applySuggestedPlacement(config, suggestion.id);
    setConfig(updated);
    showFeedback(`Applied recommendation for ${suggestion.title}`);
  };

  const handleDisableSlot = (slotId: AdPlacementSlotId) => {
    handleUpdateSlot(slotId, { enabled: false });
    showFeedback(`Disabled ${SLOT_DISPLAY_INFO[slotId]?.name || slotId}`);
  };

  // Global config update
  const handleUpdateGlobal = (patch: Partial<AdsSystemConfig>) => {
    const updated: AdsSystemConfig = {
      ...config,
      ...patch,
    };
    setConfig(updated);
    saveAdsConfig(updated, reportSaveResult);
    showFeedback('Global settings updated');
  };

  // Slot config update
  const handleUpdateSlot = (slotId: AdPlacementSlotId, patch: Partial<AdPlacementSlotConfig>) => {
    const currentSlot = config.slots[slotId] || {
      slotId,
      label: SLOT_DISPLAY_INFO[slotId].name,
      surface: SLOT_DISPLAY_INFO[slotId].surface,
      description: SLOT_DISPLAY_INFO[slotId].description,
      enabled: false,
      format: SLOT_DISPLAY_INFO[slotId].defaultFormat,
      sourceMode: 'native',
      frequencyCapPerSession: 0,
      interstitialIntervalQuestions: 5,
      dismissible: true,
      priorityWeight: 10,
    };

    const updated: AdsSystemConfig = {
      ...config,
      slots: {
        ...config.slots,
        [slotId]: {
          ...currentSlot,
          ...patch,
        },
      },
    };
    setConfig(updated);
    saveAdsConfig(updated, reportSaveResult);
    showFeedback(`Updated ${SLOT_DISPLAY_INFO[slotId].name} settings`);
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    if (typeof window !== 'undefined' && !window.confirm('Reset all ads configurations and campaigns to factory defaults?')) {
      return;
    }
    const defaults = resetAdsConfigToDefaults();
    setConfig(defaults);
    showFeedback('Reset configuration to Cambridge EdTech defaults');
  };

  // Campaign helpers
  const filteredCampaigns = useMemo(() => {
    if (campaignFilter === 'all') return config.campaigns;
    return config.campaigns.filter((c) => c.status === campaignFilter);
  }, [config.campaigns, campaignFilter]);

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      alert('Image file is too large (max 2.5MB). Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCampaignFormData((prev) => ({
          ...prev,
          imageUrl: dataUrl,
          imageAlt: prev.imageAlt || file.name.replace(/\.[^/.]+$/, ''),
        }));
        showFeedback(`Uploaded banner file: ${file.name}`);
      }
    };
    reader.readAsDataURL(file);
  };

  const startCreateCampaign = () => {
    setIsCreatingCampaign(true);
    setEditingCampaignId(null);
    setCampaignFormData({
      id: `campaign-${Date.now().toString(36)}`,
      title: '',
      sponsorName: '',
      badgeText: 'SPONSORED · STUDY PARTNER',
      headline: '',
      bodyCopy: '',
      ctaText: 'Explore Resource',
      targetUrl: 'https://',
      imageUrl: '/ads/banner-cambridge-economics.svg',
      mobileImageUrl: '',
      imageAlt: 'Cambridge Economics Revision Guide',
      creativeMode: 'image_banner',
      imageFit: 'cover',
      showCaptionBarOnBanner: true,
      accentColor: 'peach',
      sourceType: 'native',
      status: 'active',
      targetSlots: ['start_flow_banner', 'round_summary_card'],
      targetSubjects: [],
      impressions: 0,
      clicks: 0,
    });
  };

  const startEditCampaign = (campaign: AdCampaignItem) => {
    setEditingCampaignId(campaign.id);
    setIsCreatingCampaign(false);
    setCampaignFormData({ ...campaign });
  };

  const handleSaveCampaignForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignFormData.title?.trim() || !campaignFormData.sponsorName?.trim()) {
      alert('Please provide a campaign title and sponsor name.');
      return;
    }

    const campaignToSave: AdCampaignItem = {
      id: campaignFormData.id || `campaign-${Date.now().toString(36)}`,
      title: campaignFormData.title.trim(),
      sponsorName: campaignFormData.sponsorName.trim(),
      badgeText: campaignFormData.badgeText?.trim() || 'SPONSORED',
      headline: campaignFormData.headline?.trim() || campaignFormData.title.trim(),
      bodyCopy: campaignFormData.bodyCopy?.trim() || '',
      ctaText: campaignFormData.ctaText?.trim() || 'Learn More',
      targetUrl: campaignFormData.targetUrl?.trim() || 'https://',
      imageUrl: campaignFormData.imageUrl?.trim() || undefined,
      mobileImageUrl: campaignFormData.mobileImageUrl?.trim() || undefined,
      imageAlt: campaignFormData.imageAlt?.trim() || undefined,
      creativeMode: campaignFormData.creativeMode || 'image_banner',
      imageFit: campaignFormData.imageFit || 'cover',
      showCaptionBarOnBanner: campaignFormData.showCaptionBarOnBanner !== false,
      accentColor: campaignFormData.accentColor || 'peach',
      sourceType: campaignFormData.sourceType || 'native',
      adsenseSlotId: campaignFormData.adsenseSlotId?.trim() || undefined,
      status: campaignFormData.status || 'active',
      targetSlots: campaignFormData.targetSlots && campaignFormData.targetSlots.length > 0
        ? campaignFormData.targetSlots
        : ['start_flow_banner'],
      targetSubjects: campaignFormData.targetSubjects || [],
      impressions: campaignFormData.impressions || 0,
      clicks: campaignFormData.clicks || 0,
      createdAt: campaignFormData.createdAt || new Date().toISOString(),
    };

    let updatedCampaigns: AdCampaignItem[];
    if (editingCampaignId) {
      updatedCampaigns = config.campaigns.map((c) =>
        c.id === editingCampaignId ? campaignToSave : c
      );
    } else {
      updatedCampaigns = [campaignToSave, ...config.campaigns];
    }

    const updatedConfig: AdsSystemConfig = {
      ...config,
      campaigns: updatedCampaigns,
    };
    setConfig(updatedConfig);
    saveAdsConfig(updatedConfig, reportSaveResult);
    setIsCreatingCampaign(false);
    setEditingCampaignId(null);
    showFeedback(editingCampaignId ? 'Campaign saved successfully' : 'Created new campaign');
  };

  const handleToggleCampaignStatus = (campaign: AdCampaignItem) => {
    const nextStatus: AdCampaignStatus = campaign.status === 'active' ? 'paused' : 'active';
    const updatedCampaigns = config.campaigns.map((c) =>
      c.id === campaign.id ? { ...c, status: nextStatus } : c
    );
    const updatedConfig: AdsSystemConfig = {
      ...config,
      campaigns: updatedCampaigns,
    };
    setConfig(updatedConfig);
    saveAdsConfig(updatedConfig, reportSaveResult);
    showFeedback(`Campaign status: ${nextStatus}`);
  };

  const handleDuplicateCampaign = (campaign: AdCampaignItem) => {
    const cloned: AdCampaignItem = {
      ...campaign,
      id: `${campaign.id}-copy-${Date.now().toString(36).slice(-4)}`,
      title: `${campaign.title} (Copy)`,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString(),
    };
    const updatedConfig: AdsSystemConfig = {
      ...config,
      campaigns: [cloned, ...config.campaigns],
    };
    setConfig(updatedConfig);
    saveAdsConfig(updatedConfig, reportSaveResult);
    showFeedback(`Duplicated "${campaign.title}"`);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this campaign permanently?')) {
      return;
    }
    const updatedConfig: AdsSystemConfig = {
      ...config,
      campaigns: config.campaigns.filter((c) => c.id !== campaignId),
    };
    setConfig(updatedConfig);
    saveAdsConfig(updatedConfig, reportSaveResult);
    showFeedback('Campaign deleted');
  };

  // Reset telemetry for a single campaign (real analytics)
  const handleResetCampaignStats = (campaignId: string) => {
    const updated = resetCampaignTelemetry(config, campaignId);
    setConfig(updated);
    showFeedback('Reset campaign telemetry to 0');
  };

  // Reset telemetry across all campaigns
  const handleResetAllStats = () => {
    if (typeof window !== 'undefined' && !window.confirm('Reset impressions and clicks to 0 across all campaigns?')) {
      return;
    }
    const updated = resetCampaignTelemetry(config);
    setConfig(updated);
    showFeedback('Reset telemetry to 0 across all campaigns');
  };

  // Restore 3 Cambridge Reference Example Campaigns
  const handleRestoreReferenceExamples = () => {
    const defaultCampaigns = getDefaultAdsConfig().campaigns;
    const mergedCampaigns = [...config.campaigns];

    for (const ref of defaultCampaigns) {
      const idx = mergedCampaigns.findIndex((c) => c.id === ref.id);
      if (idx >= 0) {
        mergedCampaigns[idx] = { ...ref };
      } else {
        mergedCampaigns.push({ ...ref });
      }
    }

    const updatedConfig: AdsSystemConfig = {
      ...config,
      campaigns: mergedCampaigns,
    };
    setConfig(updatedConfig);
    saveAdsConfig(updatedConfig, reportSaveResult);
    showFeedback('Restored 3 Cambridge reference example campaigns');
  };

  // Preview simulator resolved campaign
  const previewCampaign = useMemo(() => {
    if (previewCampaignId === 'auto') {
      return config.campaigns.find((c) => c.status === 'active' && c.targetSlots.includes(previewSlot)) || config.campaigns[0] || null;
    }
    return config.campaigns.find((c) => c.id === previewCampaignId) || null;
  }, [config.campaigns, previewCampaignId, previewSlot]);

  // Copy AdSense snippet
  const copyAdSenseSnippet = (code: string, label: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(code);
      setCopiedSnippet(label);
      setTimeout(() => setCopiedSnippet(null), 2500);
      showFeedback(`Copied ${label} snippet to clipboard`);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 font-body text-[#201e1d]">
      {/* Toast Feedback Notification */}
      {feedback && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl text-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-2 animate-in fade-in slide-in-from-top-2 duration-150 ${feedback.type === 'error' ? 'bg-[#9b2c1f]' : 'bg-[#201e1d]'}`}>
          <CheckCircle2 className={`w-4 h-4 shrink-0 ${feedback.type === 'error' ? 'text-[#ffd2c9]' : 'text-emerald-400'}`} />
          <span className="text-xs font-bold">{feedback.message}</span>
        </div>
      )}

      {/* Main Studio Header */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-2 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-offset-1 shrink-0 -rotate-2">
                <Megaphone className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-[#201e1d]">
                    Ads &amp; Monetization Studio
                  </h1>
                  <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] font-mono text-[10px] font-bold text-[#201e1d]">
                    V1.0 Cambridge-Safe
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                  Configure placement strategies, frequency caps, exam guardrails, and sponsor campaigns with live surface simulation.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#dcd3c4] active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5"
              title="Reset configuration to Cambridge default presets"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Defaults</span>
            </button>
            <button
              type="button"
              onClick={() => {
                saveAdsConfig(config, reportSaveResult);
                showFeedback('All changes saved to persistent storage');
              }}
              className="px-4 py-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-black text-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Studio Sub-Tab Navigation Pills */}
        <div className="pt-2 border-t-2 border-[#201e1d]/10 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveSubTab('suggestions')}
            className={`px-4 py-2 rounded-xl border-2 font-heading font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'suggestions'
                ? 'bg-[#ffe1d0] text-[#201e1d] border-[#201e1d] shadow-offset-2 translate-y-[-1px]'
                : 'bg-white text-[#645c50] border-[#201e1d]/20 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Suggested Placements &amp; Strategy</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#201e1d] text-[#f9f4ed] text-[10px] font-mono">
              5
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('placements')}
            className={`px-4 py-2 rounded-xl border-2 font-heading font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'placements'
                ? 'bg-[#ffe1d0] text-[#201e1d] border-[#201e1d] shadow-offset-2 translate-y-[-1px]'
                : 'bg-white text-[#645c50] border-[#201e1d]/20 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Placement Settings &amp; Slot Matrix</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#ccdbb2] text-[#201e1d] text-[10px] font-mono font-bold border border-[#201e1d]/30">
              {analytics.enabledSlotCount}/5 Active
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('campaigns')}
            className={`px-4 py-2 rounded-xl border-2 font-heading font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'campaigns'
                ? 'bg-[#ffe1d0] text-[#201e1d] border-[#201e1d] shadow-offset-2 translate-y-[-1px]'
                : 'bg-white text-[#645c50] border-[#201e1d]/20 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Campaign Manager &amp; Ad Creator</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#eee7db] text-[#201e1d] text-[10px] font-mono font-bold border border-[#201e1d]/30">
              {config.campaigns.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('preview')}
            className={`px-4 py-2 rounded-xl border-2 font-heading font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeSubTab === 'preview'
                ? 'bg-[#ffe1d0] text-[#201e1d] border-[#201e1d] shadow-offset-2 translate-y-[-1px]'
                : 'bg-white text-[#645c50] border-[#201e1d]/20 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Live Placement Simulator &amp; AdSense Code</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: SUGGESTED PLACEMENTS & STRATEGY                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'suggestions' && (
        <div className="space-y-6">
          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#645c50] flex items-center gap-1">
                <Eye className="w-3 h-3 text-[#201e1d]" />
                Impressions
              </span>
              <div className="text-xl font-heading font-black text-[#201e1d]">
                {analytics.totalImpressions.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#645c50] font-medium">Aggregated views</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#645c50] flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-600" />
                Clicks
              </span>
              <div className="text-xl font-heading font-black text-emerald-700">
                {analytics.totalClicks.toLocaleString()}
              </div>
              <span className="text-[10px] text-[#645c50] font-medium">Outbound leads</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#645c50] flex items-center gap-1">
                <Percent className="w-3 h-3 text-indigo-600" />
                Average CTR
              </span>
              <div className="text-xl font-heading font-black text-indigo-700">
                {analytics.overallCtr}%
              </div>
              <span className="text-[10px] text-[#645c50] font-medium">Healthy: &gt; 2.5%</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#645c50] flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-amber-600" />
                Estimated RPM
              </span>
              <div className="text-xl font-heading font-black text-amber-700">
                ${analytics.estimatedRpmUsd.toFixed(2)}
              </div>
              <span className="text-[10px] text-[#645c50] font-medium">Per 1,000 views</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#645c50] flex items-center gap-1">
                <BarChart3 className="w-3 h-3 text-[#201e1d]" />
                Active Slots
              </span>
              <div className="text-xl font-heading font-black text-[#201e1d]">
                {analytics.enabledSlotCount} / 5
              </div>
              <span className="text-[10px] text-[#645c50] font-medium">Configured surfaces</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-[#645c50] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#201e1d]" />
                Campaigns
              </span>
              <div className="text-xl font-heading font-black text-[#201e1d]">
                {analytics.activeCampaignCount}
              </div>
              <span className="text-[10px] text-[#645c50] font-medium">Active in rotation</span>
            </div>
          </div>

          {/* Strategy Preset Bar */}
          <div className="p-5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-2 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-heading font-black text-base text-[#201e1d] flex items-center gap-2">
                  <span>Strategy Preset Engine</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#eee7db] border border-[#201e1d]/30 text-[10px] font-mono font-bold">
                    1-Click Tuning
                  </span>
                </h3>
                <p className="text-xs text-[#645c50]">
                  Instantly rebalance Revizz between non-intrusive student learning and maximum monetization yield.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {/* Preset 1 */}
              <button
                type="button"
                onClick={() => handleApplyPreset('student_friendly_minimal', 'Student-Friendly Minimal')}
                className="p-3.5 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] hover:bg-[#ffe1d0] text-left transition-all active:translate-y-0.5 shadow-offset-1 cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="font-heading font-black text-xs sm:text-sm text-[#201e1d] flex items-center justify-between">
                    <span>🌱 Student-Friendly</span>
                    <span className="text-xs">Minimal</span>
                  </div>
                  <p className="text-[11px] text-[#645c50] mt-1 line-clamp-2">
                    Only start flow banner &amp; round summary. Interstitials and in-quiz footer disabled.
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-mono font-bold text-[#201e1d] inline-flex items-center gap-1">
                  Apply Preset →
                </span>
              </button>

              {/* Preset 2 */}
              <button
                type="button"
                onClick={() => handleApplyPreset('balanced_edtech', 'Balanced EdTech')}
                className="p-3.5 rounded-xl border-2 border-[#201e1d] bg-[#f2f8f5] hover:bg-[#ccdbb2] text-left transition-all active:translate-y-0.5 shadow-offset-1 cursor-pointer group flex flex-col justify-between relative"
              >
                <span className="absolute top-2 right-2 px-1.5 py-0.2 rounded-full bg-[#198754] text-white text-[9px] font-bold">
                  Recommended
                </span>
                <div>
                  <div className="font-heading font-black text-xs sm:text-sm text-[#201e1d]">
                    ⚖️ Balanced EdTech
                  </div>
                  <p className="text-[11px] text-[#645c50] mt-1 line-clamp-2">
                    Start banner, summary card, leaderboard, gentle interstitial every 5 questions.
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-mono font-bold text-[#146C43] inline-flex items-center gap-1">
                  Apply Preset →
                </span>
              </button>

              {/* Preset 3 */}
              <button
                type="button"
                onClick={() => handleApplyPreset('high_yield_monetization', 'High-Yield Monetization')}
                className="p-3.5 rounded-xl border-2 border-[#201e1d] bg-[#fffbeb] hover:bg-[#fde68a] text-left transition-all active:translate-y-0.5 shadow-offset-1 cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="font-heading font-black text-xs sm:text-sm text-[#201e1d]">
                    🚀 High-Yield Monetization
                  </div>
                  <p className="text-[11px] text-[#645c50] mt-1 line-clamp-2">
                    All 5 slots active with hybrid fallback for peak revenue and partner discovery.
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-mono font-bold text-[#92400E] inline-flex items-center gap-1">
                  Apply Preset →
                </span>
              </button>

              {/* Preset 4 */}
              <button
                type="button"
                onClick={() => handleApplyPreset('pause_all', 'Pause All Ads')}
                className="p-3.5 rounded-xl border-2 border-[#201e1d] bg-[#fcfaf6] hover:bg-[#ffe4e6] text-left transition-all active:translate-y-0.5 shadow-offset-1 cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="font-heading font-black text-xs sm:text-sm text-[#201e1d]">
                    ⏸️ Pause All Ads
                  </div>
                  <p className="text-[11px] text-[#645c50] mt-1 line-clamp-2">
                    Emergency master switch. Suppresses all placements across every student screen.
                  </p>
                </div>
                <span className="mt-3 text-[10px] font-mono font-bold text-[#E11D48] inline-flex items-center gap-1">
                  Pause System →
                </span>
              </button>
            </div>
          </div>

          {/* Smart Placement Recommendations Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-base text-[#201e1d]">
                  Smart Placement Recommendations
                </h3>
                <p className="text-xs text-[#645c50]">
                  Calibrated against Cambridge cognitive load standards and student attention span studies.
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-[#645c50]">
                5 Curated Slots
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suggestions.map((item) => {
                const currentSlot = config.slots[item.slotId];
                const isMatchingFormat = !item.recommendedSettings.format || currentSlot?.format === item.recommendedSettings.format;
                const isApplied = currentSlot?.enabled && isMatchingFormat;

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-2 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-[#eee7db] border border-[#201e1d]/30 font-mono text-[10px] font-bold text-[#201e1d]">
                          {item.surfaceLabel}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#201e1d]/30 ${
                            item.impactTier.includes('High Yield')
                              ? 'bg-[#ccdbb2] text-[#14421b]'
                              : item.impactTier.includes('High Visibility')
                              ? 'bg-[#ffe1d0] text-[#7c2d12]'
                              : 'bg-[#bae6fd] text-[#075985]'
                          }`}
                        >
                          {item.impactTier}
                        </span>
                      </div>

                      {/* Title & Slot ID */}
                      <div>
                        <h4 className="font-heading font-black text-base text-[#201e1d]">
                          {item.title}
                        </h4>
                        <span className="font-mono text-[10px] text-[#645c50]">
                          slotId: <code className="font-bold text-[#201e1d]">{item.slotId}</code>
                        </span>
                      </div>

                      {/* UX Safety Score Meter */}
                      <div className="p-2.5 rounded-xl bg-[#f9f4ed] border border-[#201e1d]/20 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1 text-[#474238]">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                            UX Safety Score:
                          </span>
                          <span
                            className={`font-mono ${
                              item.uxSafetyScore >= 90
                                ? 'text-emerald-700'
                                : item.uxSafetyScore >= 75
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {item.uxSafetyScore} / 100
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-[#e5dcce] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.uxSafetyScore >= 90
                                ? 'bg-emerald-600'
                                : item.uxSafetyScore >= 75
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${item.uxSafetyScore}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[#645c50] pt-0.5">
                          <span>Est. CTR: <strong className="text-[#201e1d]">{item.estimatedCtrRange}</strong></span>
                          <span>Cap: <strong>{item.recommendedSettings.frequencyCapPerSession ? `${item.recommendedSettings.frequencyCapPerSession}/session` : 'Paced'}</strong></span>
                        </div>
                      </div>

                      {/* Rationale */}
                      <p className="text-xs text-[#645c50] leading-relaxed">
                        {item.rationale}
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2 border-t-2 border-[#201e1d]/10 flex items-center gap-2">
                      {isApplied ? (
                        <>
                          <div className="flex-1 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-center font-heading font-black text-xs text-[#201e1d] flex items-center justify-center gap-1 shadow-xs">
                            <Check className="w-3.5 h-3.5 text-emerald-800" />
                            <span>Active &amp; Applied ✓</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDisableSlot(item.slotId)}
                            className="px-3 py-2 rounded-xl bg-[#fcfaf6] border-2 border-[#201e1d] hover:bg-[#ffe4e6] text-xs font-bold text-[#be123c] active:translate-y-0.5 shadow-offset-1 transition-all cursor-pointer whitespace-nowrap"
                            title="Disable this placement slot"
                          >
                            Disable Slot
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleApplySuggestion(item)}
                          className="w-full py-2.5 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] hover:bg-[#ffc6a5] active:translate-y-0.5 font-heading font-black text-xs text-[#201e1d] shadow-offset-1 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Apply Suggested Placement</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: PLACEMENT SETTINGS & SLOT MATRIX                               */}
      {/* ========================================================================= */}
      {activeSubTab === 'placements' && (
        <div className="space-y-6">
          {/* Global Placement Guardrails Card */}
          <div className="p-6 rounded-3xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-lg text-[#201e1d] flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-700" />
                  <span>Global Placement Guardrails &amp; Policies</span>
                </h3>
                <p className="text-xs text-[#645c50]">
                  High-level safety constraints that supersede individual slot settings across all surfaces.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-white border border-[#201e1d] font-mono text-[11px] font-bold text-[#201e1d]">
                Master Controls
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {/* Master Switch */}
              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d]">Master Switch</span>
                  <button
                    type="button"
                    onClick={() => handleUpdateGlobal({ globalAdsEnabled: !config.globalAdsEnabled })}
                    className={`w-12 h-7 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer ${
                      config.globalAdsEnabled ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-[#201e1d] transition-transform ${
                        config.globalAdsEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-[#645c50]">
                  {config.globalAdsEnabled
                    ? 'Ads engine enabled globally. Individual slot toggles apply.'
                    : 'All ads currently suppressed across every screen.'}
                </p>
              </div>

              {/* School Licence Protection */}
              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d]">School Licence Protection</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateGlobal({ hideAdsForSchoolAccounts: !config.hideAdsForSchoolAccounts })
                    }
                    className={`w-12 h-7 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer ${
                      config.hideAdsForSchoolAccounts ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-[#201e1d] transition-transform ${
                        config.hideAdsForSchoolAccounts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-[#645c50]">
                  Auto-disables ads for enrolled classroom students and institutional school licenses.
                </p>
              </div>

              {/* Timed Exam Focus Protection */}
              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d]">Timed Exam Mode Protection</span>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateGlobal({ hideAdsInTimedExamMode: !config.hideAdsInTimedExamMode })
                    }
                    className={`w-12 h-7 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer ${
                      config.hideAdsInTimedExamMode ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-[#201e1d] transition-transform ${
                        config.hideAdsInTimedExamMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-[#645c50]">
                  Suppresses all ads during timed mock exams to preserve focus and exam conditions.
                </p>
              </div>

              {/* Audience Targeting Filter */}
              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-2">
                <label className="font-heading font-black text-sm text-[#201e1d] block">
                  Audience Targeting Filter
                </label>
                <select
                  value={config.audienceFilter}
                  onChange={(e) => handleUpdateGlobal({ audienceFilter: e.target.value as AdAudienceFilter })}
                  className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                >
                  <option value="all">All Students &amp; Guests</option>
                  <option value="free_and_demo_only">Free Tier &amp; Demo Mode Only (Recommended)</option>
                  <option value="demo_only">Unregistered Demo Mode Only</option>
                  <option value="logged_in_non_school">Logged-in Non-School Accounts</option>
                </select>
                <p className="text-[11px] text-[#645c50]">
                  Controls which user cohort is eligible to receive ad impressions.
                </p>
              </div>

              {/* Global Frequency Cap */}
              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-2">
                <label className="font-heading font-black text-sm text-[#201e1d] block">
                  Global Frequency Cap / Round
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={config.globalFrequencyCapPerRound}
                    onChange={(e) =>
                      handleUpdateGlobal({ globalFrequencyCapPerRound: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-24 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                  <span className="text-xs text-[#645c50] font-bold">
                    {config.globalFrequencyCapPerRound === 0 ? 'Unlimited' : 'Max impressions per round'}
                  </span>
                </div>
                <p className="text-[11px] text-[#645c50]">
                  Ceiling to prevent ad fatigue during extensive quiz practice drills.
                </p>
              </div>

              {/* AdSense Publisher ID */}
              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-2">
                <label className="font-heading font-black text-sm text-[#201e1d] block">
                  Google AdSense Publisher ID
                </label>
                <input
                  type="text"
                  placeholder="ca-pub-0000000000000000"
                  value={config.adsensePublisherId || ''}
                  onChange={(e) => handleUpdateGlobal({ adsensePublisherId: e.target.value })}
                  className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#201e1d] focus:outline-none"
                />
                <p className="text-[11px] text-[#645c50]">
                  Applied automatically to script tags and adsbygoogle fallback containers.
                </p>
              </div>
            </div>
          </div>

          {/* Per-Slot Configuration Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-base text-[#201e1d]">
                  Slot Configuration Matrix (5 Surfaces)
                </h3>
                <p className="text-xs text-[#645c50]">
                  Customize formats, source modes, and session caps individually per placement surface.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {ALL_PLACEMENT_SLOT_IDS.map((slotId) => {
                const info = SLOT_DISPLAY_INFO[slotId];
                const slot = config.slots[slotId] || {
                  slotId,
                  label: info.name,
                  surface: info.surface,
                  description: info.description,
                  enabled: false,
                  format: info.defaultFormat,
                  sourceMode: 'native',
                  frequencyCapPerSession: 0,
                  interstitialIntervalQuestions: 5,
                  dismissible: true,
                  priorityWeight: 10,
                };

                return (
                  <div
                    key={slotId}
                    className={`p-5 rounded-2xl border-2 border-[#201e1d] shadow-offset-2 transition-all ${
                      slot.enabled ? 'bg-white' : 'bg-[#fcfaf6] opacity-90'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b-2 border-[#201e1d]/10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-heading font-black text-base text-[#201e1d]">
                            {info.name}
                          </h4>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#eee7db] border border-[#201e1d]/30 font-bold">
                            {slotId}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#201e1d]/30 ${
                              slot.enabled
                                ? 'bg-[#ccdbb2] text-[#14421b]'
                                : 'bg-[#ffe4e6] text-[#be123c]'
                            }`}
                          >
                            {slot.enabled ? 'ACTIVE' : 'DISABLED'}
                          </span>
                        </div>
                        <p className="text-xs text-[#645c50]">{info.description}</p>
                        <span className="text-[11px] font-bold text-[#474238]">
                          Appears in: <em>{info.surface}</em>
                        </span>
                      </div>

                      {/* Enable Toggle */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold text-[#201e1d]">
                          {slot.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateSlot(slotId, { enabled: !slot.enabled })}
                          className={`w-14 h-8 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer ${
                            slot.enabled ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full bg-[#201e1d] transition-transform ${
                              slot.enabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Slot Configuration Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                      {/* Format Selector */}
                      <div className="space-y-1.5">
                        <label className="font-heading font-black text-xs text-[#201e1d]">
                          Ad Format
                        </label>
                        <select
                          value={slot.format}
                          onChange={(e) =>
                            handleUpdateSlot(slotId, { format: e.target.value as AdFormatType })
                          }
                          className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                        >
                          <option value="banner">Banner (728x90 / 320x50)</option>
                          <option value="native_card">Native Neobrutalist Card</option>
                          <option value="interstitial">Interstitial Overlay Card</option>
                          <option value="compact_pill">Compact Pill</option>
                        </select>
                      </div>

                      {/* Source Mode */}
                      <div className="space-y-1.5">
                        <label className="font-heading font-black text-xs text-[#201e1d]">
                          Source Mode
                        </label>
                        <select
                          value={slot.sourceMode}
                          onChange={(e) =>
                            handleUpdateSlot(slotId, { sourceMode: e.target.value as AdSourceMode })
                          }
                          className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                        >
                          <option value="native">Native Campaigns Only</option>
                          <option value="adsense">Google AdSense Only</option>
                          <option value="hybrid">Hybrid (Native first, AdSense fallback)</option>
                        </select>
                      </div>

                      {/* Session Frequency Cap */}
                      <div className="space-y-1.5">
                        <label className="font-heading font-black text-xs text-[#201e1d]">
                          Session Cap (0 = Unlimited)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={slot.frequencyCapPerSession}
                          onChange={(e) =>
                            handleUpdateSlot(slotId, {
                              frequencyCapPerSession: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                        />
                      </div>

                      {/* Interstitial Question Interval (for interstitial slot) */}
                      {slotId === 'between_questions_interstitial' ? (
                        <div className="space-y-1.5">
                          <label className="font-heading font-black text-xs text-[#201e1d]">
                            Question Interval
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="2"
                              max="20"
                              value={slot.interstitialIntervalQuestions || 5}
                              onChange={(e) =>
                                handleUpdateSlot(slotId, {
                                  interstitialIntervalQuestions: Math.max(
                                    2,
                                    parseInt(e.target.value, 10) || 5
                                  ),
                                })
                              }
                              className="w-20 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                            />
                            <span className="text-xs text-[#645c50] font-bold">Every N questions</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="font-heading font-black text-xs text-[#201e1d]">
                            Dismissible by Student
                          </label>
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id={`dismiss-${slotId}`}
                              checked={slot.dismissible}
                              onChange={(e) =>
                                handleUpdateSlot(slotId, { dismissible: e.target.checked })
                              }
                              className="w-4 h-4 rounded border-[#201e1d] text-[#201e1d] focus:ring-0 cursor-pointer"
                            />
                            <label
                              htmlFor={`dismiss-${slotId}`}
                              className="text-xs font-bold text-[#474238] cursor-pointer"
                            >
                              Show &apos;X&apos; Close button
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* External AdSense Slot ID */}
                    <div className="mt-3 pt-3 border-t border-[#201e1d]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-[#474238]">AdSense Slot ID:</span>
                        <input
                          type="text"
                          placeholder="e.g. 1234567890 (optional)"
                          value={slot.externalAdSenseSlotId || ''}
                          onChange={(e) =>
                            handleUpdateSlot(slotId, { externalAdSenseSlotId: e.target.value })
                          }
                          className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1 text-xs font-mono font-bold text-[#201e1d] focus:outline-none w-56"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewSlot(slotId);
                          setActiveSubTab('preview');
                        }}
                        className="text-xs font-bold text-[#201e1d] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Simulate this slot in preview →</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: CAMPAIGN MANAGER & AD CREATOR                                  */}
      {/* ========================================================================= */}
      {activeSubTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="p-5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-heading font-black text-base text-[#201e1d]">
                Active Campaigns &amp; Learning Sponsors
              </h3>
              <p className="text-xs text-[#645c50]">
                Manage study partner cards, formula sheet downloads, and subject-specific exam tools.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Filter */}
              <div className="flex items-center gap-1 bg-[#f9f4ed] p-1 rounded-xl border border-[#201e1d]/30 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setCampaignFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    campaignFilter === 'all' ? 'bg-[#201e1d] text-[#f9f4ed]' : 'text-[#645c50]'
                  }`}
                >
                  All ({config.campaigns.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCampaignFilter('active')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    campaignFilter === 'active' ? 'bg-[#201e1d] text-[#f9f4ed]' : 'text-[#645c50]'
                  }`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setCampaignFilter('paused')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    campaignFilter === 'paused' ? 'bg-[#201e1d] text-[#f9f4ed]' : 'text-[#645c50]'
                  }`}
                >
                  Paused
                </button>
              </div>

              <button
                type="button"
                onClick={handleRestoreReferenceExamples}
                className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] font-heading font-black text-xs text-[#201e1d] shadow-offset-1 hover:bg-[#ffe1d0] active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Restore the 3 Cambridge reference example partner campaigns"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Restore 3 Reference Examples</span>
              </button>

              <button
                type="button"
                onClick={handleResetAllStats}
                className="px-3 py-2 rounded-xl bg-[#fcfaf6] border-2 border-[#201e1d] font-heading font-black text-xs text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer shadow-offset-1"
                title="Reset impressions and clicks to 0 across all campaigns"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Stats</span>
              </button>

              <button
                type="button"
                onClick={startCreateCampaign}
                className="px-4 py-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-heading font-black text-xs text-[#201e1d] shadow-offset-1 hover:bg-[#ffc6a5] active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Campaign</span>
              </button>
            </div>
          </div>

          {/* Create / Edit Campaign Drawer/Modal */}
          {(isCreatingCampaign || editingCampaignId) && (
            <div className="p-6 rounded-3xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-2 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#201e1d]/10">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center font-bold text-sm">
                    {editingCampaignId ? '✏️' : '✨'}
                  </span>
                  <h3 className="font-heading font-black text-lg text-[#201e1d]">
                    {editingCampaignId ? 'Edit Campaign' : 'Create New Partner Campaign'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCampaign(false);
                    setEditingCampaignId(null);
                  }}
                  className="p-1 rounded-lg border border-[#201e1d]/30 hover:bg-[#eee7db] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveCampaignForm} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Internal Title */}
                  <div className="space-y-1">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      Campaign Internal Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cambridge IGCSE Revision Guide"
                      value={campaignFormData.title || ''}
                      onChange={(e) => setCampaignFormData({ ...campaignFormData, title: e.target.value })}
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>

                  {/* Sponsor Name */}
                  <div className="space-y-1">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      Sponsor / Organization Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Cambridge Study Network"
                      value={campaignFormData.sponsorName || ''}
                      onChange={(e) =>
                        setCampaignFormData({ ...campaignFormData, sponsorName: e.target.value })
                      }
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>

                  {/* Badge Text */}
                  <div className="space-y-1">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      Badge Text
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. SPONSORED · STUDY RESOURCE"
                      value={campaignFormData.badgeText || ''}
                      onChange={(e) =>
                        setCampaignFormData({ ...campaignFormData, badgeText: e.target.value })
                      }
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>

                  {/* Creative Format / Display Mode Selector */}
                  <div className="space-y-1 sm:col-span-3">
                    <label className="font-heading font-black text-xs text-[#201e1d] block">
                      Creative Format / Display Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCampaignFormData({ ...campaignFormData, creativeMode: 'image_banner' })
                        }
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          (campaignFormData.creativeMode || 'image_banner') === 'image_banner'
                            ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-1 font-bold'
                            : 'bg-white border-[#201e1d]/30 text-[#645c50]'
                        }`}
                      >
                        <div className="font-heading font-black text-xs text-[#201e1d] flex items-center gap-1.5">
                          <span>🖼️ Full Picture Banner</span>
                        </div>
                        <p className="text-[11px] text-[#645c50] mt-0.5">
                          Advertiser graphic with optional caption &amp; CTA
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCampaignFormData({ ...campaignFormData, creativeMode: 'illustrated_card' })
                        }
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          campaignFormData.creativeMode === 'illustrated_card'
                            ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-1 font-bold'
                            : 'bg-white border-[#201e1d]/30 text-[#645c50]'
                        }`}
                      >
                        <div className="font-heading font-black text-xs text-[#201e1d] flex items-center gap-1.5">
                          <span>🎨 Illustrated Card</span>
                        </div>
                        <p className="text-[11px] text-[#645c50] mt-0.5">
                          Picture artwork + headline, body copy &amp; CTA
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCampaignFormData({ ...campaignFormData, creativeMode: 'text_card' })
                        }
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                          campaignFormData.creativeMode === 'text_card'
                            ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-1 font-bold'
                            : 'bg-white border-[#201e1d]/30 text-[#645c50]'
                        }`}
                      >
                        <div className="font-heading font-black text-xs text-[#201e1d] flex items-center gap-1.5">
                          <span>📝 Text &amp; Badge Card</span>
                        </div>
                        <p className="text-[11px] text-[#645c50] mt-0.5">
                          Neobrutalist typography card with CTA button
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Dedicated Advertiser Banner Graphic & Upload Panel */}
                  <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-3 sm:col-span-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#201e1d]/15">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-[#ffe1d0] border border-[#201e1d] flex items-center justify-center text-[#201e1d]">
                          <ImageIcon className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="font-heading font-black text-xs text-[#201e1d]">
                            Advertiser Banner Graphic &amp; Artwork
                          </h4>
                          <p className="text-[10px] text-[#645c50]">
                            Upload an advertiser&apos;s banner file (PNG/JPG/SVG/WebP) or choose a built-in preset
                          </p>
                        </div>
                      </div>

                      {/* Direct file upload button */}
                      <label className="px-3 py-1.5 rounded-xl bg-[#eee7db] hover:bg-[#dcd3c4] border border-[#201e1d] text-xs font-bold text-[#201e1d] transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shadow-xs">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Banner File</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                          onChange={handleImageFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Quick built-in presets */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[#645c50] block">
                        Quick Built-in Artwork Presets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setCampaignFormData({
                              ...campaignFormData,
                              imageUrl: '/ads/banner-cambridge-economics.svg',
                              imageAlt: 'Cambridge Economics Revision Guide',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#f9f4ed] hover:bg-[#ffe1d0] border border-[#201e1d]/30 text-[11px] font-bold text-[#201e1d] transition-colors cursor-pointer"
                        >
                          📊 Economics Banner
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCampaignFormData({
                              ...campaignFormData,
                              imageUrl: '/ads/banner-sciences-formula-pack.svg',
                              imageAlt: 'Cambridge Science Formula Sheets',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#f9f4ed] hover:bg-[#ffe1d0] border border-[#201e1d]/30 text-[11px] font-bold text-[#201e1d] transition-colors cursor-pointer"
                        >
                          🧪 Sciences Banner
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCampaignFormData({
                              ...campaignFormData,
                              imageUrl: '/ads/banner-daily-sprint-challenge.svg',
                              imageAlt: 'Daily Past-Paper Sprint & Mastery',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#f9f4ed] hover:bg-[#ffe1d0] border border-[#201e1d]/30 text-[11px] font-bold text-[#201e1d] transition-colors cursor-pointer"
                        >
                          ⚡ Sprint Artwork
                        </button>
                        {campaignFormData.imageUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setCampaignFormData({
                                ...campaignFormData,
                                imageUrl: '',
                                mobileImageUrl: '',
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#fff1f2] hover:bg-[#ffe4e6] border border-[#be123c]/40 text-[11px] font-bold text-[#be123c] transition-colors cursor-pointer"
                          >
                            ✕ Clear Image
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Desktop image URL */}
                      <div className="space-y-1">
                        <label className="font-heading font-black text-xs text-[#201e1d]">
                          Desktop Banner Image URL / Path
                        </label>
                        <input
                          type="text"
                          placeholder="/ads/banner-example.svg or https://... (or upload file above)"
                          value={campaignFormData.imageUrl || ''}
                          onChange={(e) =>
                            setCampaignFormData({ ...campaignFormData, imageUrl: e.target.value })
                          }
                          className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#201e1d] focus:outline-none"
                        />
                      </div>

                      {/* Mobile image URL */}
                      <div className="space-y-1">
                        <label className="font-heading font-black text-xs text-[#201e1d]">
                          Optional Mobile Banner Image URL
                        </label>
                        <input
                          type="text"
                          placeholder="Optional mobile square/portrait variant"
                          value={campaignFormData.mobileImageUrl || ''}
                          onChange={(e) =>
                            setCampaignFormData({ ...campaignFormData, mobileImageUrl: e.target.value })
                          }
                          className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#201e1d] focus:outline-none"
                        />
                      </div>

                      {/* Alt Text */}
                      <div className="space-y-1">
                        <label className="font-heading font-black text-xs text-[#201e1d]">
                          Image Alt Text (Accessibility)
                        </label>
                        <input
                          type="text"
                          placeholder="Description of the advertiser graphic"
                          value={campaignFormData.imageAlt || ''}
                          onChange={(e) =>
                            setCampaignFormData({ ...campaignFormData, imageAlt: e.target.value })
                          }
                          className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                        />
                      </div>

                      {/* Image Fit */}
                      <div className="space-y-1">
                        <label className="font-heading font-black text-xs text-[#201e1d]">
                          Image Sizing Fit
                        </label>
                        <select
                          value={campaignFormData.imageFit || 'cover'}
                          onChange={(e) =>
                            setCampaignFormData({
                              ...campaignFormData,
                              imageFit: e.target.value as AdImageFit,
                            })
                          }
                          className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                        >
                          <option value="cover">Cover (Fill container seamlessly)</option>
                          <option value="contain">Contain (Fit full graphic without crop)</option>
                        </select>
                      </div>
                    </div>

                    {/* Caption bar toggle */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="caption-bar-toggle"
                        checked={campaignFormData.showCaptionBarOnBanner !== false}
                        onChange={(e) =>
                          setCampaignFormData({
                            ...campaignFormData,
                            showCaptionBarOnBanner: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-[#201e1d] text-[#201e1d] focus:ring-0 cursor-pointer"
                      />
                      <label
                        htmlFor="caption-bar-toggle"
                        className="text-xs font-bold text-[#474238] cursor-pointer"
                      >
                        Show bottom caption &amp; CTA button bar beneath picture banner (uncheck for pure picture banner)
                      </label>
                    </div>

                    {/* Live Thumbnail Preview */}
                    {campaignFormData.imageUrl && (
                      <div className="pt-2 border-t border-[#201e1d]/15">
                        <span className="text-[10px] font-bold text-[#645c50] block mb-1">
                          Banner Image Live Preview:
                        </span>
                        <div className="relative w-full max-w-md h-28 rounded-xl border-2 border-[#201e1d] overflow-hidden bg-[#201e1d]/5 shadow-xs flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={campaignFormData.imageUrl}
                            alt={campaignFormData.imageAlt || 'Banner preview'}
                            className={`w-full h-full ${
                              campaignFormData.imageFit === 'contain' ? 'object-contain' : 'object-cover'
                            }`}
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Headline */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      Ad Headline (Student Facing)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Master Core & Extended Cambridge Syllabus Topics"
                      value={campaignFormData.headline || ''}
                      onChange={(e) =>
                        setCampaignFormData({ ...campaignFormData, headline: e.target.value })
                      }
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>

                  {/* CTA Text */}
                  <div className="space-y-1">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      CTA Button Text
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Explore Study Guide"
                      value={campaignFormData.ctaText || ''}
                      onChange={(e) =>
                        setCampaignFormData({ ...campaignFormData, ctaText: e.target.value })
                      }
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>

                  {/* Target URL */}
                  <div className="space-y-1 sm:col-span-2">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      Destination Target URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com/study-resource"
                      value={campaignFormData.targetUrl || ''}
                      onChange={(e) =>
                        setCampaignFormData({ ...campaignFormData, targetUrl: e.target.value })
                      }
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>

                  {/* Accent Color */}
                  <div className="space-y-1">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      Tactile Accent Color
                    </label>
                    <select
                      value={campaignFormData.accentColor || 'peach'}
                      onChange={(e) =>
                        setCampaignFormData({
                          ...campaignFormData,
                          accentColor: e.target.value as AdAccentColor,
                        })
                      }
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                    >
                      <option value="peach">Peach (#FFF3EE)</option>
                      <option value="sage">Sage (#F2F8F5)</option>
                      <option value="amber">Amber (#FFFBEB)</option>
                      <option value="sky">Sky (#F0F9FF)</option>
                    </select>
                  </div>

                  {/* Body Copy */}
                  <div className="space-y-1 sm:col-span-3">
                    <label className="font-heading font-black text-xs text-[#201e1d]">
                      Body Copy (Description)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Concise summary charts, examiner mark scheme breakdowns, and topic checklists."
                      value={campaignFormData.bodyCopy || ''}
                      onChange={(e) =>
                        setCampaignFormData({ ...campaignFormData, bodyCopy: e.target.value })
                      }
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl p-3 text-xs font-medium text-[#201e1d] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Target Slots Multi-select */}
                <div className="space-y-1.5 pt-2">
                  <label className="font-heading font-black text-xs text-[#201e1d] block">
                    Target Placement Surfaces *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {ALL_PLACEMENT_SLOT_IDS.map((slotId) => {
                      const isChecked = campaignFormData.targetSlots?.includes(slotId) ?? false;
                      return (
                        <label
                          key={slotId}
                          className={`p-2.5 rounded-xl border-2 flex items-center gap-2 cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-1 font-bold'
                              : 'bg-white border-[#201e1d]/30 text-[#645c50]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const current = campaignFormData.targetSlots || [];
                              const next = e.target.checked
                                ? [...current, slotId]
                                : current.filter((s) => s !== slotId);
                              setCampaignFormData({ ...campaignFormData, targetSlots: next });
                            }}
                            className="w-4 h-4 rounded border-[#201e1d] text-[#201e1d] focus:ring-0"
                          />
                          <span className="text-xs">{SLOT_DISPLAY_INFO[slotId].name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Target Cambridge Subjects */}
                <div className="space-y-1.5 pt-2">
                  <label className="font-heading font-black text-xs text-[#201e1d] block">
                    Target Cambridge Subject Codes (Leave empty for universal delivery)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CAMBRIDGE_SUBJECT_OPTIONS.map((sub) => {
                      const isChecked = campaignFormData.targetSubjects?.includes(sub.code) ?? false;
                      return (
                        <button
                          key={sub.code}
                          type="button"
                          onClick={() => {
                            const current = campaignFormData.targetSubjects || [];
                            const next = isChecked
                              ? current.filter((c) => c !== sub.code)
                              : [...current, sub.code];
                            setCampaignFormData({ ...campaignFormData, targetSubjects: next });
                          }}
                          className={`px-3 py-1.5 rounded-xl border-2 font-mono text-xs font-bold transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-[#ccdbb2] border-[#201e1d] text-[#14421b] shadow-offset-1'
                              : 'bg-white border-[#201e1d]/30 text-[#645c50]'
                          }`}
                        >
                          {sub.label} {isChecked ? '✓' : '+'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex justify-end items-center gap-2 pt-3 border-t-2 border-[#201e1d]/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCampaign(false);
                      setEditingCampaignId(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-white border-2 border-[#201e1d] font-bold text-xs hover:bg-[#eee7db] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-heading font-black text-xs text-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] active:translate-y-0.5 transition-all cursor-pointer"
                  >
                    {editingCampaignId ? 'Update Campaign' : 'Save New Campaign'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Campaigns List Grid */}
          <div className="space-y-3">
            {filteredCampaigns.map((campaign) => {
              const ctr =
                campaign.impressions > 0
                  ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2)
                  : '0.00';

              return (
                <div
                  key={campaign.id}
                  className="p-5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-2 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-3xl min-w-0">
                    {campaign.imageUrl && (
                      <div className="w-full sm:w-36 h-20 rounded-xl border-2 border-[#201e1d] overflow-hidden bg-[#f9f4ed] shrink-0 shadow-xs flex items-center justify-center">
                        <img
                          src={campaign.imageUrl}
                          alt={campaign.imageAlt || campaign.title}
                          className={`w-full h-full ${campaign.imageFit === 'contain' ? 'object-contain p-1' : 'object-cover'}`}
                        />
                      </div>
                    )}
                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`w-3 h-3 rounded-full border border-[#201e1d] ${
                            campaign.accentColor === 'sage'
                              ? 'bg-[#ccdbb2]'
                              : campaign.accentColor === 'sky'
                              ? 'bg-[#bae6fd]'
                              : campaign.accentColor === 'amber'
                              ? 'bg-[#fde68a]'
                              : 'bg-[#ffe1d0]'
                          }`}
                          title={`Accent: ${campaign.accentColor}`}
                        />
                        <h4 className="font-heading font-black text-base text-[#201e1d]">
                          {campaign.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-[#f9f4ed] border border-[#201e1d]/30 font-mono text-[10px] font-bold text-[#201e1d]">
                          {campaign.creativeMode === 'image_banner' || (!campaign.creativeMode && campaign.imageUrl)
                            ? '🖼️ Picture Banner'
                            : campaign.creativeMode === 'illustrated_card'
                            ? '🎨 Illustrated Card'
                            : '📝 Text Card'}
                        </span>
                        {(() => {
                          const isReferenceExample =
                            campaign.id === 'cambridge-igcse-revision-guide' ||
                            campaign.id === 'past-paper-formula-sheet' ||
                            campaign.id === 'stem-graphing-calculator-tool' ||
                            campaign.badgeText?.includes('EXAMPLE');

                          if (!isReferenceExample) return null;
                          return (
                            <span className="px-2 py-0.5 rounded-full bg-[#fef08a] text-[#854d0e] border border-[#ca8a04]/40 font-mono text-[10px] font-bold">
                              Reference Example
                            </span>
                          );
                        })()}
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-[#eee7db] border border-[#201e1d]/30 font-bold">
                          {campaign.sponsorName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-[#201e1d]/30 ${
                            campaign.status === 'active'
                              ? 'bg-[#ccdbb2] text-[#14421b]'
                              : 'bg-[#ffe4e6] text-[#be123c]'
                          }`}
                        >
                          {campaign.status.toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#f9f4ed] border border-[#201e1d]/20 text-[10px] font-mono font-bold">
                          {campaign.sourceType}
                        </span>
                      </div>

                      <p className="text-xs text-[#645c50] line-clamp-1">
                        <strong>Headline:</strong> {campaign.headline} &bull; <em>{campaign.bodyCopy}</em>
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                        <span className="font-bold text-[#645c50]">Slots:</span>
                        {campaign.targetSlots.map((s) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded-md bg-[#eee7db] border border-[#201e1d]/20 font-mono text-[10px]"
                          >
                            {s}
                          </span>
                        ))}
                        {campaign.targetSubjects.length > 0 ? (
                          <>
                            <span className="font-bold text-[#645c50] ml-2">Subjects:</span>
                            {campaign.targetSubjects.map((sub) => (
                              <span
                                key={sub}
                                className="px-1.5 py-0.5 rounded-md bg-[#f2f8f5] border border-[#201e1d]/20 font-mono text-[10px] font-bold text-[#146C43]"
                              >
                                {sub}
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-[#f9f4ed] border border-[#201e1d]/20 font-mono text-[10px] text-[#645c50] ml-2">
                            Universal Delivery
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Stats & Quick Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                    {/* Stats pill */}
                    <div className="p-2.5 rounded-xl bg-[#f9f4ed] border border-[#201e1d]/20 flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-[#645c50] block font-mono">Views</span>
                        <strong className="font-heading font-black text-[#201e1d]">
                          {campaign.impressions.toLocaleString()}
                        </strong>
                      </div>
                      <div className="w-[1px] h-6 bg-[#201e1d]/15" />
                      <div>
                        <span className="text-[10px] text-[#645c50] block font-mono">Clicks</span>
                        <strong className="font-heading font-black text-emerald-700">
                          {campaign.clicks.toLocaleString()}
                        </strong>
                      </div>
                      <div className="w-[1px] h-6 bg-[#201e1d]/15" />
                      <div>
                        <span className="text-[10px] text-[#645c50] block font-mono">CTR</span>
                        <strong className="font-heading font-black text-indigo-700">
                          {ctr}%
                        </strong>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleResetCampaignStats(campaign.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#eee7db] border border-[#201e1d]/30 text-xs font-bold text-[#645c50] hover:text-[#201e1d] transition-colors cursor-pointer"
                        title="Reset telemetry counters (impressions and clicks) to 0"
                      >
                        Reset (0)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCampaignStatus(campaign)}
                        className="p-2 rounded-xl bg-white hover:bg-[#eee7db] border border-[#201e1d]/30 text-[#201e1d] transition-colors cursor-pointer"
                        title={campaign.status === 'active' ? 'Pause Campaign' : 'Activate Campaign'}
                      >
                        {campaign.status === 'active' ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-emerald-700" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditCampaign(campaign)}
                        className="p-2 rounded-xl bg-white hover:bg-[#eee7db] border border-[#201e1d]/30 text-[#201e1d] transition-colors cursor-pointer text-xs font-bold"
                        title="Edit campaign details"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateCampaign(campaign)}
                        className="p-2 rounded-xl bg-white hover:bg-[#eee7db] border border-[#201e1d]/30 text-[#201e1d] transition-colors cursor-pointer"
                        title="Duplicate Campaign"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="p-2 rounded-xl bg-white hover:bg-[#ffe4e6] border border-[#201e1d]/30 text-[#be123c] transition-colors cursor-pointer"
                        title="Delete Campaign"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: LIVE PLACEMENT SIMULATOR & ADSENSE CODE                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'preview' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-5 rounded-3xl bg-white border-2 border-[#201e1d] shadow-offset-2 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-heading font-black text-base text-[#201e1d] flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#201e1d]" />
                  <span>Interactive Surface Simulator</span>
                </h3>
                <p className="text-xs text-[#645c50]">
                  Inspect how ads render on live Revizz student drill interfaces before releasing to production.
                </p>
              </div>

              {/* Viewport switcher */}
              <div className="flex items-center gap-2 bg-[#f9f4ed] p-1 rounded-xl border border-[#201e1d]/30">
                <button
                  type="button"
                  onClick={() => setPreviewViewport('desktop')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    previewViewport === 'desktop'
                      ? 'bg-[#201e1d] text-[#f9f4ed]'
                      : 'text-[#645c50] hover:text-[#201e1d]'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                    previewViewport === 'mobile'
                      ? 'bg-[#201e1d] text-[#f9f4ed]'
                      : 'text-[#645c50] hover:text-[#201e1d]'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile 390px</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#201e1d]/10">
              {/* Slot selector */}
              <div className="space-y-1">
                <label className="font-heading font-black text-xs text-[#201e1d]">
                  Select Placement Surface
                </label>
                <select
                  value={previewSlot}
                  onChange={(e) => setPreviewSlot(e.target.value as AdPlacementSlotId)}
                  className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                >
                  {ALL_PLACEMENT_SLOT_IDS.map((slotId) => (
                    <option key={slotId} value={slotId}>
                      {SLOT_DISPLAY_INFO[slotId].name} ({SLOT_DISPLAY_INFO[slotId].surface})
                    </option>
                  ))}
                </select>
              </div>

              {/* Campaign selector */}
              <div className="space-y-1">
                <label className="font-heading font-black text-xs text-[#201e1d]">
                  Select Campaign to Render
                </label>
                <select
                  value={previewCampaignId}
                  onChange={(e) => setPreviewCampaignId(e.target.value)}
                  className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                >
                  <option value="auto">Auto-select matching campaign (Live rotation algorithm)</option>
                  {config.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} [{c.status}] ({c.sponsorName})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Simulator Canvas Frame */}
          <div className="p-6 rounded-3xl bg-[#ebddc5] border-2 border-[#201e1d] shadow-offset-2 flex flex-col items-center justify-center min-h-[420px]">
            <div className="w-full flex items-center justify-between pb-3 text-xs font-bold text-[#645c50]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Simulated Surface: <strong>{SLOT_DISPLAY_INFO[previewSlot].name}</strong></span>
              </div>
              <span className="font-mono text-[11px]">
                Viewport: {previewViewport === 'mobile' ? '390px Fluid' : 'Responsive Max-W'}
              </span>
            </div>

            {/* Simulated Device Container */}
            <div
              className={`transition-all duration-200 ${
                previewViewport === 'mobile'
                  ? 'w-full max-w-[390px] rounded-3xl border-4 border-[#201e1d] bg-[#FFFDF7] p-4 shadow-chunky space-y-4'
                  : 'w-full max-w-2xl rounded-3xl border-2 border-[#201e1d] bg-[#FFFDF7] p-6 shadow-offset-2 space-y-4'
              }`}
            >
              {/* Mock Student UI Header */}
              <div className="flex items-center justify-between pb-2 border-b-2 border-[#201e1d]/10 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-black text-xs text-[#201e1d]">REVIZZ</span>
                  <span className="px-1.5 py-0.2 rounded bg-[#ffe1d0] text-[9px] font-mono font-bold">
                    PREVIEW DRILL
                  </span>
                </div>
                <span className="font-mono text-[10px] text-[#645c50]">0625 Physics MCQ</span>
              </div>

              {/* Target Ad Component in Preview Mode */}
              <div className="py-2">
                <AdSlotBanner
                  slotId={previewSlot}
                  previewMode={true}
                  previewConfig={config}
                  previewCampaign={previewCampaign}
                />
              </div>

              {/* Mock Question Content to show realistic context */}
              <div className="p-4 rounded-2xl bg-white border-2 border-slate-200 space-y-2 opacity-60">
                <div className="h-4 bg-slate-200 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="h-8 rounded-xl bg-slate-100 border border-slate-200" />
                  <div className="h-8 rounded-xl bg-slate-100 border border-slate-200" />
                </div>
              </div>
            </div>
          </div>

          {/* Copyable Google AdSense Code Generator */}
          <div className="p-6 rounded-3xl bg-white border-2 border-[#201e1d] shadow-offset-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-base text-[#201e1d] flex items-center gap-2">
                  <span>Google AdSense Integration Snippets</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[10px] font-mono font-bold border border-[#201e1d]/30">
                    Publisher Ready
                  </span>
                </h3>
                <p className="text-xs text-[#645c50]">
                  Copy production script tags calibrated with your active publisher ID:{' '}
                  <code className="font-mono font-bold text-[#201e1d]">
                    {config.adsensePublisherId || 'ca-pub-XXXXXXXXXXXXXXXX'}
                  </code>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Snippet 1: Global head script */}
              <div className="p-3.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#201e1d]">
                    1. Global Next.js Head Script Tag (`app/layout.tsx` or `components/Header.tsx`)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyAdSenseSnippet(
                        `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsensePublisherId || 'ca-pub-XXXXXXXXXXXXXXXX'}" crossorigin="anonymous"></script>`,
                        'Header Script'
                      )
                    }
                    className="px-3 py-1 rounded-lg bg-white border border-[#201e1d] text-xs font-bold hover:bg-[#ffe1d0] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSnippet === 'Header Script' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSnippet === 'Header Script' ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-[#201e1d] text-[#f9f4ed] text-[11px] font-mono overflow-x-auto">
{`<script
  async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.adsensePublisherId || 'ca-pub-XXXXXXXXXXXXXXXX'}"
  crossOrigin="anonymous"
/>`}
                </pre>
              </div>

              {/* Snippet 2: AdSense ins container */}
              <div className="p-3.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#201e1d]">
                    2. Responsive AdSense Slot Container (`<ins className="adsbygoogle" />`)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyAdSenseSnippet(
                        `<ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client="${config.adsensePublisherId || 'ca-pub-XXXXXXXXXXXXXXXX'}" data-ad-slot="${config.slots[previewSlot]?.externalAdSenseSlotId || 'XXXXXXXXXX'}" data-ad-format="auto" data-full-width-responsive="true"></ins>`,
                        'Ad Container'
                      )
                    }
                    className="px-3 py-1 rounded-lg bg-white border border-[#201e1d] text-xs font-bold hover:bg-[#ffe1d0] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {copiedSnippet === 'Ad Container' ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSnippet === 'Ad Container' ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-[#201e1d] text-[#f9f4ed] text-[11px] font-mono overflow-x-auto">
{`<ins
  className="adsbygoogle"
  style={{ display: 'block' }}
  data-ad-client="${config.adsensePublisherId || 'ca-pub-XXXXXXXXXXXXXXXX'}"
  data-ad-slot="${config.slots[previewSlot]?.externalAdSenseSlotId || 'XXXXXXXXXX'}"
  data-ad-format="auto"
  data-full-width-responsive="true"
/>`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
