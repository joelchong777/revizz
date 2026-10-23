import { authFetch } from './authFetch';

/**
 * Revizz Ads & Monetization Engine
 * 
 * Pure, SSR-safe TypeScript module providing configuration, audience targeting,
 * frequency capping, preset management, analytics aggregation, and Cambridge-aligned
 * resource campaign matching.
 */

export type AdPlacementSlotId =
  | 'start_flow_banner'
  | 'question_card_footer'
  | 'between_questions_interstitial'
  | 'round_summary_card'
  | 'leaderboard_footer';

export type AdSourceMode = 'native' | 'adsense' | 'hybrid';
export type AdFormatType = 'banner' | 'native_card' | 'interstitial' | 'compact_pill';
export type AdAudienceFilter = 'all' | 'free_and_demo_only' | 'demo_only' | 'logged_in_non_school';
export type AdCampaignStatus = 'active' | 'paused' | 'scheduled' | 'draft';
export type AdAccentColor = 'peach' | 'sage' | 'amber' | 'sky';
export type ApplyPresetMode =
  | 'student_friendly_minimal'
  | 'balanced_edtech'
  | 'high_yield_monetization'
  | 'pause_all';

export type AdCreativeMode = 'image_banner' | 'illustrated_card' | 'text_card';
export type AdImageFit = 'cover' | 'contain';

export interface AdPlacementSlotConfig {
  slotId: AdPlacementSlotId;
  label: string;
  surface: string;
  description: string;
  enabled: boolean;
  format: AdFormatType;
  sourceMode: AdSourceMode;
  frequencyCapPerSession: number;
  interstitialIntervalQuestions: number;
  externalAdSenseSlotId?: string;
  dismissible: boolean;
  priorityWeight: number;
}

export interface AdCampaignItem {
  id: string;
  title: string;
  sponsorName: string;
  badgeText: string;
  headline: string;
  bodyCopy: string;
  ctaText: string;
  targetUrl: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  imageAlt?: string;
  creativeMode?: AdCreativeMode;
  imageFit?: AdImageFit;
  showCaptionBarOnBanner?: boolean;
  accentColor: AdAccentColor;
  sourceType: 'native' | 'adsense';
  adsenseSlotId?: string;
  status: AdCampaignStatus;
  targetSlots: AdPlacementSlotId[];
  targetSubjects: string[];
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface SuggestedAdPlacement {
  id: string;
  slotId: AdPlacementSlotId;
  title: string;
  surfaceLabel: string;
  impactTier: 'High Yield · Zero Friction' | 'Balanced Engagement' | 'High Visibility';
  estimatedCtrRange: string;
  uxSafetyScore: number;
  rationale: string;
  recommendedSettings: Partial<AdPlacementSlotConfig>;
}

export interface AdsSystemConfig {
  globalAdsEnabled: boolean;
  hideAdsForSchoolAccounts: boolean;
  hideAdsInTimedExamMode: boolean;
  audienceFilter: AdAudienceFilter;
  globalFrequencyCapPerRound: number;
  adsensePublisherId: string;
  slots: Record<AdPlacementSlotId, AdPlacementSlotConfig>;
  campaigns: AdCampaignItem[];
}

export interface AdsAnalyticsSummary {
  totalImpressions: number;
  totalClicks: number;
  overallCtr: number;
  activeCampaignCount: number;
  enabledSlotCount: number;
  estimatedRpmUsd: number;
}

export const ADS_CONFIG_STORAGE_KEY = 'revizz_ads_system_config_v1';
export const ADS_CONFIG_CHANGE_EVENT = 'revizz-ads-config-changed';

export const ALL_PLACEMENT_SLOT_IDS: AdPlacementSlotId[] = [
  'start_flow_banner',
  'question_card_footer',
  'between_questions_interstitial',
  'round_summary_card',
  'leaderboard_footer',
];

/**
 * Default Revizz Ads System Configuration.
 * Conforms to Cambridge edtech standards with 3 realistic, student-friendly partner campaigns.
 */
export function getDefaultAdsConfig(): AdsSystemConfig {
  return {
    globalAdsEnabled: true,
    hideAdsForSchoolAccounts: true,
    hideAdsInTimedExamMode: true,
    audienceFilter: 'free_and_demo_only',
    globalFrequencyCapPerRound: 4,
    adsensePublisherId: '',
    slots: {
      start_flow_banner: {
        slotId: 'start_flow_banner',
        label: 'Start Flow Banner',
        surface: 'Quiz Setup & Paper Selection',
        description: 'Tactile study resource banner displayed before quiz drill initiation.',
        enabled: true,
        format: 'banner',
        sourceMode: 'native',
        frequencyCapPerSession: 0,
        interstitialIntervalQuestions: 0,
        dismissible: true,
        priorityWeight: 10,
      },
      round_summary_card: {
        slotId: 'round_summary_card',
        label: 'Round Summary Card',
        surface: 'Quiz Results & Review Pile',
        description: 'High-yield completion card shown on score celebration screens.',
        enabled: true,
        format: 'native_card',
        sourceMode: 'native',
        frequencyCapPerSession: 0,
        interstitialIntervalQuestions: 0,
        dismissible: false,
        priorityWeight: 20,
      },
      leaderboard_footer: {
        slotId: 'leaderboard_footer',
        label: 'Leaderboard Footer',
        surface: 'Cohort & Global Leaderboard',
        description: 'Subtle partner pill positioned beneath high score leaderboards.',
        enabled: true,
        format: 'compact_pill',
        sourceMode: 'native',
        frequencyCapPerSession: 0,
        interstitialIntervalQuestions: 0,
        dismissible: false,
        priorityWeight: 15,
      },
      between_questions_interstitial: {
        slotId: 'between_questions_interstitial',
        label: 'Between-Questions Interstitial',
        surface: 'Live Quiz Session Break',
        description: 'Paced micro-break card between question batches to alleviate cognitive fatigue.',
        enabled: false,
        format: 'interstitial',
        sourceMode: 'native',
        frequencyCapPerSession: 3,
        interstitialIntervalQuestions: 5,
        dismissible: true,
        priorityWeight: 5,
      },
      question_card_footer: {
        slotId: 'question_card_footer',
        label: 'Question Card Footer',
        surface: 'Active Question Layout',
        description: 'Ultra-compact study tip or sponsor pill under multiple choice options.',
        enabled: false,
        format: 'compact_pill',
        sourceMode: 'native',
        frequencyCapPerSession: 5,
        interstitialIntervalQuestions: 0,
        dismissible: false,
        priorityWeight: 5,
      },
    },
    campaigns: [
      {
        id: 'cambridge-igcse-revision-guide',
        title: 'Example 1: Cambridge IGCSE Revision Companion',
        sponsorName: 'Revizz Study Guide (Example Reference)',
        badgeText: 'EXAMPLE · STUDY RESOURCE',
        headline: 'Master Core & Extended Cambridge Syllabus Topics',
        bodyCopy: 'Concise summary charts, examiner mark scheme breakdowns, and topic-by-topic checklists for Cambridge candidates.',
        ctaText: 'Explore Study Guide',
        targetUrl: '/portal',
        imageUrl: '/ads/banner-cambridge-economics.svg',
        imageAlt: 'Cambridge IGCSE 0455 Economics Revision Companion Banner',
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
        createdAt: '2026-01-15T08:00:00.000Z',
      },
      {
        id: 'past-paper-formula-sheet',
        title: 'Example 2: Sciences Formula & Data Reference Pack',
        sponsorName: 'Revizz Science Lab (Example Reference)',
        badgeText: 'EXAMPLE · QUICK REFERENCE',
        headline: 'High-Contrast Printable Science & Economics Formula Sheets',
        bodyCopy: 'Physics (0625), Chemistry (0620), Biology (0610), and Economics (0455) equation & diagram sheets.',
        ctaText: 'Open Reference Pack',
        targetUrl: '/portal',
        imageUrl: '/ads/banner-sciences-formula-pack.svg',
        imageAlt: 'IGCSE Sciences Formula & Data Reference Pack Banner',
        creativeMode: 'image_banner',
        imageFit: 'cover',
        showCaptionBarOnBanner: false,
        accentColor: 'sage',
        sourceType: 'native',
        status: 'active',
        targetSlots: ['round_summary_card', 'between_questions_interstitial', 'leaderboard_footer'],
        targetSubjects: ['0620', '0625', '0610', '0455'],
        impressions: 0,
        clicks: 0,
        createdAt: '2026-02-01T10:00:00.000Z',
      },
      {
        id: 'stem-graphing-calculator-tool',
        title: 'Example 3: Daily Past-Paper Sprint & Mastery Tracker',
        sponsorName: 'Revizz Exam Prep (Example Reference)',
        badgeText: 'EXAMPLE · FEATURED TOOL',
        headline: 'Build a First-Try Accuracy Streak & Unlock Gold Mastery Badges',
        bodyCopy: 'Practice untimed topic drills and track syllabus mastery across every Cambridge paper.',
        ctaText: 'View Topic Mastery',
        targetUrl: '/',
        imageUrl: '/ads/banner-daily-sprint-challenge.svg',
        imageAlt: 'Daily Past-Paper Sprint & Mastery Tracker Graphic',
        creativeMode: 'illustrated_card',
        imageFit: 'cover',
        showCaptionBarOnBanner: true,
        accentColor: 'sky',
        sourceType: 'native',
        status: 'active',
        targetSlots: ['start_flow_banner', 'question_card_footer', 'leaderboard_footer', 'between_questions_interstitial'],
        targetSubjects: ['0580', '0455', '0625'],
        impressions: 0,
        clicks: 0,
        createdAt: '2026-02-10T12:00:00.000Z',
      },
    ],
  };
}

/**
 * Returns 5 smart placement recommendations with UX safety scores, CTR estimates,
 * and cognitive-load rationales.
 */
export function getSuggestedPlacements(): SuggestedAdPlacement[] {
  return [
    {
      id: 'suggestion-start-flow',
      slotId: 'start_flow_banner',
      title: 'Setup Surface Pre-Roll Banner',
      surfaceLabel: 'Quiz Setup & Subject Select',
      impactTier: 'High Visibility',
      estimatedCtrRange: '3.4% – 5.1%',
      uxSafetyScore: 98,
      rationale: 'Students are preparing for their practice session and cognitive load is lowest here. Non-intrusive placement above subject selectors creates zero friction with zero interruption to active recall.',
      recommendedSettings: {
        enabled: true,
        format: 'banner',
        dismissible: true,
        frequencyCapPerSession: 0,
      },
    },
    {
      id: 'suggestion-round-summary',
      slotId: 'round_summary_card',
      title: 'Completion Celebration Resource Card',
      surfaceLabel: 'Round Summary & Review Pile',
      impactTier: 'High Yield · Zero Friction',
      estimatedCtrRange: '4.5% – 7.2%',
      uxSafetyScore: 95,
      rationale: 'Displayed when the quiz round is completed and the student has achieved a learning victory. Contextually presenting relevant revision guides or formula sheets yields maximum student engagement with zero disruption to drill focus.',
      recommendedSettings: {
        enabled: true,
        format: 'native_card',
        dismissible: false,
        frequencyCapPerSession: 0,
      },
    },
    {
      id: 'suggestion-leaderboard-footer',
      slotId: 'leaderboard_footer',
      title: 'Leaderboard Community Sponsor Pill',
      surfaceLabel: 'Leaderboard & Achievements',
      impactTier: 'Balanced Engagement',
      estimatedCtrRange: '2.1% – 3.8%',
      uxSafetyScore: 91,
      rationale: 'Passive footer banner on the competitive ranking screen. Students reviewing scores and streaks are receptive to partner tools without breaking quiz immersion.',
      recommendedSettings: {
        enabled: true,
        format: 'compact_pill',
        dismissible: false,
        frequencyCapPerSession: 0,
      },
    },
    {
      id: 'suggestion-interstitial-paced',
      slotId: 'between_questions_interstitial',
      title: 'Paced Milestone Micro-Break',
      surfaceLabel: 'Between Questions (Every 5 Qs)',
      impactTier: 'High Yield · Zero Friction',
      estimatedCtrRange: '3.8% – 6.0%',
      uxSafetyScore: 86,
      rationale: 'Provides a structured breathing room between intense question blocks. A strict frequency cap and 5-question interval mitigate cognitive fatigue while preserving study momentum.',
      recommendedSettings: {
        enabled: true,
        format: 'interstitial',
        interstitialIntervalQuestions: 5,
        frequencyCapPerSession: 3,
        dismissible: true,
      },
    },
    {
      id: 'suggestion-question-footer',
      slotId: 'question_card_footer',
      title: 'In-Question Minimal Sponsor Pill',
      surfaceLabel: 'Active Question Card Footer',
      impactTier: 'High Visibility',
      estimatedCtrRange: '1.8% – 2.9%',
      uxSafetyScore: 82,
      rationale: 'Positioned safely below question options. Subdued neobrutalist pill styling prevents accidental clicks during rapid-fire drills while keeping monetization continuous.',
      recommendedSettings: {
        enabled: false,
        format: 'compact_pill',
        dismissible: false,
        frequencyCapPerSession: 5,
      },
    },
  ];
}

/**
 * Loads AdsSystemConfig from localStorage in browser environments, merging defensively with defaults.
 */
export function loadAdsConfig(): AdsSystemConfig {
  const defaults = getDefaultAdsConfig();
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(ADS_CONFIG_STORAGE_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<AdsSystemConfig>;
    if (!parsed || typeof parsed !== 'object') {
      return defaults;
    }

    // Defensively merge slot configurations
    const mergedSlots: Record<AdPlacementSlotId, AdPlacementSlotConfig> = { ...defaults.slots };
    if (parsed.slots && typeof parsed.slots === 'object') {
      for (const slotId of ALL_PLACEMENT_SLOT_IDS) {
        if (parsed.slots[slotId]) {
          mergedSlots[slotId] = {
            ...defaults.slots[slotId],
            ...parsed.slots[slotId],
          };
        }
      }
    }

    // Defensively merge campaigns and sanitize legacy pre-seeded fake telemetry or URLs
    let mergedCampaigns = defaults.campaigns;
    if (Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0) {
      mergedCampaigns = parsed.campaigns.map(c => {
        let updated = { ...c };
        // Sanitize legacy fake numbers (1420/980/630) or external example.com URLs from earlier drafts
        if (
          (c.id === 'cambridge-igcse-revision-guide' && (c.impressions === 1420 || c.targetUrl?.includes('example.com'))) ||
          (c.id === 'past-paper-formula-sheet' && (c.impressions === 980 || c.targetUrl?.includes('example.com'))) ||
          (c.id === 'stem-graphing-calculator-tool' && (c.impressions === 630 || c.targetUrl?.includes('example.com')))
        ) {
          const defaultMatch = defaults.campaigns.find(d => d.id === c.id);
          updated = defaultMatch ? { ...defaultMatch } : { ...c, impressions: 0, clicks: 0 };
        }

        // Backfill image banner properties if missing on reference campaigns
        const defaultMatch = defaults.campaigns.find(d => d.id === c.id);
        if (defaultMatch && (!updated.imageUrl || !updated.creativeMode)) {
          updated.imageUrl = updated.imageUrl || defaultMatch.imageUrl;
          updated.imageAlt = updated.imageAlt || defaultMatch.imageAlt;
          updated.creativeMode = updated.creativeMode || defaultMatch.creativeMode;
          updated.imageFit = updated.imageFit || defaultMatch.imageFit;
          if (updated.showCaptionBarOnBanner === undefined) {
            updated.showCaptionBarOnBanner = defaultMatch.showCaptionBarOnBanner;
          }
        }

        return updated;
      });
    }

    const cleanPubId =
      parsed.adsensePublisherId === 'ca-pub-9482104829104812'
        ? ''
        : (parsed.adsensePublisherId ?? defaults.adsensePublisherId);

    return {
      globalAdsEnabled: typeof parsed.globalAdsEnabled === 'boolean' ? parsed.globalAdsEnabled : defaults.globalAdsEnabled,
      hideAdsForSchoolAccounts: typeof parsed.hideAdsForSchoolAccounts === 'boolean' ? parsed.hideAdsForSchoolAccounts : defaults.hideAdsForSchoolAccounts,
      hideAdsInTimedExamMode: typeof parsed.hideAdsInTimedExamMode === 'boolean' ? parsed.hideAdsInTimedExamMode : defaults.hideAdsInTimedExamMode,
      audienceFilter: parsed.audienceFilter || defaults.audienceFilter,
      globalFrequencyCapPerRound: typeof parsed.globalFrequencyCapPerRound === 'number' ? parsed.globalFrequencyCapPerRound : defaults.globalFrequencyCapPerRound,
      adsensePublisherId: cleanPubId,
      slots: mergedSlots,
      campaigns: mergedCampaigns,
    };
  } catch (err) {
    console.warn('[Revizz Ads Engine] Failed to parse stored config, reverting to defaults:', err);
    return defaults;
  }
}

export type AdsSaveResult = { ok: boolean; error?: string };

/**
 * Pushes the config to the server with the admin's bearer token. Never throws.
 * Resolves { ok: false, error } on 401/403 (not an admin) or a network failure.
 */
export async function pushAdsConfigToServer(config: AdsSystemConfig): Promise<AdsSaveResult> {
  try {
    const res = await authFetch('/api/ads/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: 'Not saved to the server: sign in as an admin to change ads.' };
    }
    return { ok: false, error: `Not saved to the server (HTTP ${res.status}).` };
  } catch {
    return { ok: false, error: 'Not saved to the server: network error.' };
  }
}

/**
 * Persists AdsSystemConfig to localStorage, dispatches change notification event,
 * and syncs state to the server. Returns the config synchronously (many callers chain on it).
 * Pass options.pushToServer=false to save locally only (student telemetry). Pass onServerResult to learn whether the server save worked; it is not called during SSR.
 */
export function saveAdsConfig(
  config: AdsSystemConfig,
  onServerResult?: (result: AdsSaveResult) => void,
  options?: { pushToServer?: boolean }
): AdsSystemConfig {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(ADS_CONFIG_STORAGE_KEY, JSON.stringify(config));
      window.dispatchEvent(new CustomEvent(ADS_CONFIG_CHANGE_EVENT, { detail: config }));
      if (options?.pushToServer !== false) {
        void pushAdsConfigToServer(config).then((result) => onServerResult?.(result));
      }
    } catch (err) {
      console.error('[Revizz Ads Engine] Failed to save config to localStorage:', err);
    }
  }
  return config;
}

/**
 * Resets impression and click telemetry to zero for a specific campaign or across all campaigns.
 */
export function resetCampaignTelemetry(config: AdsSystemConfig, campaignId?: string): AdsSystemConfig {
  const updatedCampaigns = config.campaigns.map(c => {
    if (!campaignId || c.id === campaignId) {
      return {
        ...c,
        impressions: 0,
        clicks: 0,
      };
    }
    return c;
  });

  const updatedConfig: AdsSystemConfig = {
    ...config,
    campaigns: updatedCampaigns,
  };

  return saveAdsConfig(updatedConfig);
}

/**
 * Synchronizes ads configuration from the server API route (/api/ads/config).
 */
export async function syncAdsConfigFromServer(): Promise<AdsSystemConfig> {
  if (typeof window === 'undefined') {
    return loadAdsConfig();
  }

  try {
    const res = await fetch('/api/ads/config', { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      return loadAdsConfig();
    }
    const data = await res.json();
    const serverConfig: AdsSystemConfig = data?.config || data;
    if (serverConfig && typeof serverConfig === 'object' && serverConfig.slots) {
      const defaults = getDefaultAdsConfig();
      const cleanPubId =
        serverConfig.adsensePublisherId === 'ca-pub-9482104829104812'
          ? ''
          : (serverConfig.adsensePublisherId ?? '');

      const cleanConfig: AdsSystemConfig = {
        ...defaults,
        ...serverConfig,
        adsensePublisherId: cleanPubId,
        slots: {
          ...defaults.slots,
          ...serverConfig.slots,
        },
        campaigns: Array.isArray(serverConfig.campaigns) && serverConfig.campaigns.length > 0
          ? serverConfig.campaigns.map(c => {
              const defaultMatch = defaults.campaigns.find(d => d.id === c.id);
              if (defaultMatch && (!c.imageUrl || !c.creativeMode)) {
                return {
                  ...c,
                  imageUrl: c.imageUrl || defaultMatch.imageUrl,
                  imageAlt: c.imageAlt || defaultMatch.imageAlt,
                  creativeMode: c.creativeMode || defaultMatch.creativeMode,
                  imageFit: c.imageFit || defaultMatch.imageFit,
                  showCaptionBarOnBanner: c.showCaptionBarOnBanner !== undefined ? c.showCaptionBarOnBanner : defaultMatch.showCaptionBarOnBanner,
                };
              }
              return c;
            })
          : defaults.campaigns,
      };

      window.localStorage.setItem(ADS_CONFIG_STORAGE_KEY, JSON.stringify(cleanConfig));
      window.dispatchEvent(new CustomEvent(ADS_CONFIG_CHANGE_EVENT, { detail: cleanConfig }));
      return cleanConfig;
    }
  } catch (err) {
    console.debug('[Revizz Ads Engine] Could not sync config from server:', err);
  }

  return loadAdsConfig();
}

/**
 * Resets configuration back to defaults and saves.
 */
export function resetAdsConfigToDefaults(): AdsSystemConfig {
  const defaults = getDefaultAdsConfig();
  return saveAdsConfig(defaults);
}

/**
 * Subscribes to ads configuration changes across components and browser tabs.
 */
export function subscribeAdsConfig(listener: () => void): () => void {
  if (typeof window === 'undefined' || !window.addEventListener) {
    return () => {};
  }

  const handleCustomEvent = () => listener();
  const handleStorageEvent = (e: StorageEvent) => {
    if (!e.key || e.key === ADS_CONFIG_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(ADS_CONFIG_CHANGE_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(ADS_CONFIG_CHANGE_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

/**
 * Applies a suggested placement to the configuration and enables the slot.
 */
export function applySuggestedPlacement(config: AdsSystemConfig, suggestionId: string): AdsSystemConfig {
  const suggestions = getSuggestedPlacements();
  const suggestion = suggestions.find(s => s.id === suggestionId || s.slotId === suggestionId);

  if (!suggestion) {
    return config;
  }

  const updatedSlots = {
    ...config.slots,
    [suggestion.slotId]: {
      ...config.slots[suggestion.slotId],
      ...suggestion.recommendedSettings,
      enabled: true,
    },
  };

  const updatedConfig: AdsSystemConfig = {
    ...config,
    slots: updatedSlots,
  };

  return saveAdsConfig(updatedConfig);
}

/**
 * Applies a pre-configured operational policy preset.
 */
export function applyPlacementPreset(config: AdsSystemConfig, preset: ApplyPresetMode): AdsSystemConfig {
  const updatedSlots = { ...config.slots };
  let globalAdsEnabled = config.globalAdsEnabled;
  let hideAdsForSchoolAccounts = config.hideAdsForSchoolAccounts;
  let hideAdsInTimedExamMode = config.hideAdsInTimedExamMode;
  let globalFrequencyCapPerRound = config.globalFrequencyCapPerRound;

  switch (preset) {
    case 'student_friendly_minimal':
      globalAdsEnabled = true;
      hideAdsForSchoolAccounts = true;
      hideAdsInTimedExamMode = true;
      updatedSlots.start_flow_banner = { ...updatedSlots.start_flow_banner, enabled: true };
      updatedSlots.round_summary_card = { ...updatedSlots.round_summary_card, enabled: true };
      updatedSlots.leaderboard_footer = { ...updatedSlots.leaderboard_footer, enabled: false };
      updatedSlots.between_questions_interstitial = { ...updatedSlots.between_questions_interstitial, enabled: false };
      updatedSlots.question_card_footer = { ...updatedSlots.question_card_footer, enabled: false };
      break;

    case 'balanced_edtech':
      globalAdsEnabled = true;
      hideAdsForSchoolAccounts = true;
      hideAdsInTimedExamMode = true;
      updatedSlots.start_flow_banner = { ...updatedSlots.start_flow_banner, enabled: true };
      updatedSlots.round_summary_card = { ...updatedSlots.round_summary_card, enabled: true };
      updatedSlots.leaderboard_footer = { ...updatedSlots.leaderboard_footer, enabled: true };
      updatedSlots.between_questions_interstitial = {
        ...updatedSlots.between_questions_interstitial,
        enabled: true,
        interstitialIntervalQuestions: 5,
      };
      updatedSlots.question_card_footer = { ...updatedSlots.question_card_footer, enabled: false };
      break;

    case 'high_yield_monetization':
      globalAdsEnabled = true;
      hideAdsForSchoolAccounts = false;
      hideAdsInTimedExamMode = false;
      updatedSlots.start_flow_banner = { ...updatedSlots.start_flow_banner, enabled: true };
      updatedSlots.round_summary_card = { ...updatedSlots.round_summary_card, enabled: true };
      updatedSlots.leaderboard_footer = { ...updatedSlots.leaderboard_footer, enabled: true };
      updatedSlots.between_questions_interstitial = {
        ...updatedSlots.between_questions_interstitial,
        enabled: true,
        interstitialIntervalQuestions: 3,
      };
      updatedSlots.question_card_footer = { ...updatedSlots.question_card_footer, enabled: true };
      globalFrequencyCapPerRound = 6;
      break;

    case 'pause_all':
      globalAdsEnabled = false;
      break;
  }

  const updatedConfig: AdsSystemConfig = {
    ...config,
    globalAdsEnabled,
    hideAdsForSchoolAccounts,
    hideAdsInTimedExamMode,
    globalFrequencyCapPerRound,
    slots: updatedSlots,
  };

  return saveAdsConfig(updatedConfig);
}

/**
 * Core Decision Logic: determines whether an ad slot should render for a given user & session state.
 */
export function shouldRenderAdSlot(params: {
  config: AdsSystemConfig;
  slotId: AdPlacementSlotId;
  isSchoolAccount?: boolean;
  isDemoSession?: boolean;
  isAuthenticated?: boolean;
  isTimedMode?: boolean;
  questionIndex?: number;
  sessionImpressionsForSlot?: number;
}): boolean {
  const { config, slotId } = params;

  // 1. Global killswitch
  if (!config.globalAdsEnabled) {
    return false;
  }

  // 2. School account protection policy
  if (config.hideAdsForSchoolAccounts && params.isSchoolAccount) {
    return false;
  }

  // 3. Timed exam concentration policy
  if (config.hideAdsInTimedExamMode && params.isTimedMode) {
    return false;
  }

  // 4. Audience filter validation
  switch (config.audienceFilter) {
    case 'demo_only':
      if (!params.isDemoSession) return false;
      break;
    case 'logged_in_non_school':
      if (!params.isAuthenticated || params.isDemoSession || params.isSchoolAccount) return false;
      break;
    case 'free_and_demo_only':
      if (params.isSchoolAccount) return false;
      break;
    case 'all':
    default:
      break;
  }

  // 5. Slot existence & activation
  const slot = config.slots[slotId];
  if (!slot || !slot.enabled) {
    return false;
  }

  // 6. Frequency capping per session
  if (slot.frequencyCapPerSession > 0 && (params.sessionImpressionsForSlot ?? 0) >= slot.frequencyCapPerSession) {
    return false;
  }

  // 7. Interstitial spacing logic (e.g. show on Q5, Q10, Q15...)
  if (slotId === 'between_questions_interstitial' && typeof params.questionIndex === 'number') {
    const interval = Math.max(1, slot.interstitialIntervalQuestions || 5);
    // Question index is 0-based: e.g. questionIndex = 4 is Question 5
    if (params.questionIndex <= 0 || (params.questionIndex + 1) % interval !== 0) {
      return false;
    }
  }

  return true;
}

/**
 * Selects the optimal campaign for a slot considering status, targeting, and source mode.
 */
export function selectCampaignForSlot(
  config: AdsSystemConfig,
  slotId: AdPlacementSlotId,
  subjectCode?: string
): AdCampaignItem | null {
  const slot = config.slots[slotId];
  const eligible = config.campaigns.filter(
    c => c.status === 'active' && c.targetSlots.includes(slotId)
  );

  if (eligible.length === 0) {
    return null;
  }

  const preferredSourceMode = slot?.sourceMode || 'native';

  // Scoring algorithm for smart relevance ranking
  const scored = eligible.map(campaign => {
    let score = 0;

    // Subject relevance
    if (subjectCode && campaign.targetSubjects.length > 0) {
      if (campaign.targetSubjects.includes(subjectCode)) {
        score += 50;
      } else {
        score -= 20; // Targeted to other subjects
      }
    } else if (campaign.targetSubjects.length === 0) {
      score += 20; // Broad/Universal campaign
    }

    // Source mode preference
    if (preferredSourceMode === 'native') {
      if (campaign.sourceType === 'native') score += 30;
    } else if (preferredSourceMode === 'adsense') {
      if (campaign.sourceType === 'adsense') score += 30;
    } else if (preferredSourceMode === 'hybrid') {
      if (campaign.sourceType === 'native') score += 20;
      else if (campaign.sourceType === 'adsense') score += 10;
    }

    // Rotation fairness: campaigns with fewer impressions receive minor boost
    const impressionWeight = Math.max(0, 10 - Math.floor(campaign.impressions / 200));
    score += impressionWeight;

    return { campaign, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.campaign || null;
}

/**
 * Increments impression count for a specific campaign in stored configuration.
 */
export function recordAdImpression(campaignId: string, slotId: AdPlacementSlotId): void {
  if (typeof window === 'undefined') return;

  try {
    const config = loadAdsConfig();
    const campaign = config.campaigns.find(c => c.id === campaignId);
    if (campaign) {
      campaign.impressions = (campaign.impressions || 0) + 1;
      saveAdsConfig(config, undefined, { pushToServer: false });
    }
  } catch (err) {
    console.debug('[Revizz Ads Engine] Could not record impression:', err);
  }
}

/**
 * Increments click count for a specific campaign in stored configuration.
 */
export function recordAdClick(campaignId: string, slotId: AdPlacementSlotId): void {
  if (typeof window === 'undefined') return;

  try {
    const config = loadAdsConfig();
    const campaign = config.campaigns.find(c => c.id === campaignId);
    if (campaign) {
      campaign.clicks = (campaign.clicks || 0) + 1;
      saveAdsConfig(config, undefined, { pushToServer: false });
    }
  } catch (err) {
    console.debug('[Revizz Ads Engine] Could not record click:', err);
  }
}

/**
 * Computes live operational analytics and revenue approximations.
 */
export function computeAdsAnalyticsSummary(config: AdsSystemConfig): AdsAnalyticsSummary {
  const totalImpressions = config.campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalClicks = config.campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const overallCtr = totalImpressions > 0
    ? Number(((totalClicks / totalImpressions) * 100).toFixed(2))
    : 0;
  const activeCampaignCount = config.campaigns.filter(c => c.status === 'active').length;
  const enabledSlotCount = Object.values(config.slots).filter(s => s && s.enabled).length;

  // Realistic EdTech blended RPM calculation (~$0.40 CPC average across educational resources)
  const estimatedRpmUsd = totalImpressions > 0
    ? Number(((totalClicks * 0.40 / totalImpressions) * 1000).toFixed(2))
    : 0;

  return {
    totalImpressions,
    totalClicks,
    overallCtr,
    activeCampaignCount,
    enabledSlotCount,
    estimatedRpmUsd,
  };
}
