'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ExternalLink, X, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, isDemoStudentSession } from '@/lib/auth';
import {
  AdPlacementSlotId,
  AdCampaignItem,
  AdsSystemConfig,
  AdAccentColor,
  loadAdsConfig,
  getDefaultAdsConfig,
  subscribeAdsConfig,
  syncAdsConfigFromServer,
  shouldRenderAdSlot,
  selectCampaignForSlot,
  recordAdImpression,
  recordAdClick,
} from '@/lib/ads';

export interface AdSlotBannerProps {
  slotId: AdPlacementSlotId;
  subjectCode?: string;
  questionIndex?: number;
  isTimedMode?: boolean;
  className?: string;
  previewMode?: boolean;
  previewConfig?: AdsSystemConfig;
  previewCampaign?: AdCampaignItem | null;
  onDismiss?: () => void;
  onAdClick?: (campaign: AdCampaignItem) => void;
  onContinue?: () => void;
  isSchoolAccount?: boolean;
  isDemoSession?: boolean;
  isAuthenticated?: boolean;
}

interface AccentStyle {
  bg: string;
  badge: string;
  button: string;
  borderAccent: string;
}

const ACCENT_STYLES: Record<AdAccentColor, AccentStyle> = {
  peach: {
    bg: 'bg-[#FFF3EE]',
    badge: 'bg-[#FFDFC6] text-[#9A3412] border-[#201e1d]',
    button: 'bg-[#EA580C] hover:bg-[#C2410C] text-white',
    borderAccent: 'border-[#EA580C]',
  },
  sage: {
    bg: 'bg-[#F2F8F5]',
    badge: 'bg-[#D1E7DD] text-[#0F5132] border-[#201e1d]',
    button: 'bg-[#198754] hover:bg-[#146C43] text-white',
    borderAccent: 'border-[#198754]',
  },
  amber: {
    bg: 'bg-[#FFFBEB]',
    badge: 'bg-[#FEF3C7] text-[#92400E] border-[#201e1d]',
    button: 'bg-[#D97706] hover:bg-[#B45309] text-white',
    borderAccent: 'border-[#D97706]',
  },
  sky: {
    bg: 'bg-[#F0F9FF]',
    badge: 'bg-[#E0F2FE] text-[#0369A1] border-[#201e1d]',
    button: 'bg-[#0284C7] hover:bg-[#0369A1] text-white',
    borderAccent: 'border-[#0284C7]',
  },
};

export function AdSlotBanner({
  slotId,
  subjectCode,
  questionIndex,
  isTimedMode = false,
  className,
  previewMode = false,
  previewConfig,
  previewCampaign,
  onDismiss,
  onAdClick,
  onContinue,
  isSchoolAccount,
  isDemoSession,
  isAuthenticated,
}: AdSlotBannerProps) {
  // ---------------------------------------------------------------------------
  // REACT ERROR #310 DEFENSE:
  // Declare ALL React hooks unconditionally at the very top of the component
  // before ANY condition or early return.
  // ---------------------------------------------------------------------------

  // 1. Local State Hooks
  const [internalConfig, setInternalConfig] = useState<AdsSystemConfig>(() => {
    return previewConfig || (typeof window !== 'undefined' ? loadAdsConfig() : getDefaultAdsConfig());
  });
  const [isDismissed, setIsDismissed] = useState(false);
  const [sessionImpressions, setSessionImpressions] = useState(0);
  const [adsenseLoaded, setAdsenseLoaded] = useState(false);

  // 2. Ref Hooks
  const impressionTrackedRef = useRef<string | null>(null);

  // 3. Authentication Hook
  const { userProfile, isDemo } = useAuth();

  // 4. Memoized Active Configurations and Session Values
  const activeConfig = useMemo(() => {
    return previewConfig || internalConfig;
  }, [previewConfig, internalConfig]);

  const slotConfig = useMemo(() => {
    return activeConfig.slots[slotId] || getDefaultAdsConfig().slots[slotId];
  }, [activeConfig, slotId]);

  const effectiveIsDemo = useMemo(() => {
    if (typeof isDemoSession === 'boolean') return isDemoSession;
    return isDemo || isDemoStudentSession(userProfile);
  }, [isDemoSession, isDemo, userProfile]);

  const effectiveIsSchool = useMemo(() => {
    if (typeof isSchoolAccount === 'boolean') return isSchoolAccount;
    return Boolean(userProfile?.is_school_account);
  }, [isSchoolAccount, userProfile]);

  const effectiveIsAuth = useMemo(() => {
    if (typeof isAuthenticated === 'boolean') return isAuthenticated;
    return Boolean(userProfile) && !effectiveIsDemo;
  }, [isAuthenticated, userProfile, effectiveIsDemo]);

  const activeCampaign = useMemo(() => {
    if (previewCampaign !== undefined) {
      return previewCampaign;
    }
    return selectCampaignForSlot(activeConfig, slotId, subjectCode);
  }, [previewCampaign, activeConfig, slotId, subjectCode]);

  const shouldRender = useMemo(() => {
    if (isDismissed) return false;
    if (previewMode) return true;

    return shouldRenderAdSlot({
      config: activeConfig,
      slotId,
      isSchoolAccount: effectiveIsSchool,
      isDemoSession: effectiveIsDemo,
      isAuthenticated: effectiveIsAuth,
      isTimedMode,
      questionIndex,
      sessionImpressionsForSlot: sessionImpressions,
    });
  }, [
    isDismissed,
    previewMode,
    activeConfig,
    slotId,
    effectiveIsSchool,
    effectiveIsDemo,
    effectiveIsAuth,
    isTimedMode,
    questionIndex,
    sessionImpressions,
  ]);

  // 5. Side Effects

  // Sync internal config if previewConfig prop changes
  useEffect(() => {
    if (previewConfig) {
      setInternalConfig(previewConfig);
    }
  }, [previewConfig]);

  // Initial server sync on mount when not in previewConfig mode
  useEffect(() => {
    if (previewConfig) return;
    syncAdsConfigFromServer()
      .then(serverCfg => {
        if (serverCfg) setInternalConfig(serverCfg);
      })
      .catch(() => {});
  }, [previewConfig]);

  // Subscribe to config changes in browser when not in isolated previewConfig mode
  useEffect(() => {
    if (previewConfig) return;
    const unsubscribe = subscribeAdsConfig(() => {
      setInternalConfig(loadAdsConfig());
    });
    return () => {
      unsubscribe();
    };
  }, [previewConfig]);

  // Reset dismissal state whenever questionIndex or slotId changes to allow milestone intervals
  useEffect(() => {
    setIsDismissed(false);
  }, [questionIndex, slotId]);

  // Track impression once per campaign per slot session and question interval
  useEffect(() => {
    if (!shouldRender || !activeCampaign || previewMode) return;

    const trackingKey = `${activeCampaign.id}:${slotId}:${questionIndex ?? 'static'}`;
    if (impressionTrackedRef.current !== trackingKey) {
      impressionTrackedRef.current = trackingKey;
      recordAdImpression(activeCampaign.id, slotId);
      setSessionImpressions(prev => prev + 1);
    }
  }, [shouldRender, activeCampaign, slotId, questionIndex, previewMode]);

  // Handle external AdSense tag initialization if requested
  useEffect(() => {
    if (!shouldRender) return;

    const isAdSense = slotConfig?.sourceMode === 'adsense' || activeCampaign?.sourceType === 'adsense';
    if (!isAdSense) return;

    try {
      if (typeof window !== 'undefined') {
        const win = window as any;
        if (win.adsbygoogle) {
          (win.adsbygoogle = win.adsbygoogle || []).push({});
          setAdsenseLoaded(true);
        }
      }
    } catch (err) {
      console.debug('[Revizz Ads] AdSense push notice:', err);
    }
  }, [shouldRender, slotConfig?.sourceMode, activeCampaign?.sourceType]);

  // ---------------------------------------------------------------------------
  // CONDITIONAL RENDERING SAFE BOUNDARY
  // All hooks have completed execution. Early returns below are completely safe.
  // ---------------------------------------------------------------------------

  if (!shouldRender) {
    return null;
  }

  const isAdSense = slotConfig?.sourceMode === 'adsense' || activeCampaign?.sourceType === 'adsense';

  if (!activeCampaign && !previewMode && !isAdSense) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleCtaClick = () => {
    if (activeCampaign) {
      recordAdClick(activeCampaign.id, slotId);
      onAdClick?.(activeCampaign);
    }
  };

  // Default display fallbacks for preview mode without loaded campaign
  const campaign: AdCampaignItem = activeCampaign || {
    id: 'preview-placeholder',
    title: 'Cambridge Practice Partner',
    sponsorName: 'Cambridge Study Network',
    badgeText: 'FEATURED · STUDY RESOURCE',
    headline: 'High-Yield Revision & Mark Scheme Guides',
    bodyCopy: 'Step-by-step topic breakdowns and examiner tips curated for Cambridge exams.',
    ctaText: 'Explore Partner Guides',
    targetUrl: 'https://example.com/study-resource',
    accentColor: 'peach',
    sourceType: 'native',
    status: 'active',
    targetSlots: [slotId],
    targetSubjects: [],
    impressions: 0,
    clicks: 0,
    createdAt: new Date().toISOString(),
  };

  const theme = ACCENT_STYLES[campaign.accentColor] || ACCENT_STYLES.peach;

  // ---------------------------------------------------------------------------
  // RENDER VARIATION: External Google AdSense Placement Container
  // ---------------------------------------------------------------------------
  if (isAdSense) {
    const pubId = activeConfig.adsensePublisherId || '';
    const pubIdDisplay = pubId || 'Not configured (set in Placement Settings)';
    const slotCode = campaign.adsenseSlotId || slotConfig.externalAdSenseSlotId || '';

    return (
      <div
        className={cn(
          'w-full rounded-2xl border-2 border-[#201e1d] bg-[#FFFDF7] p-3 sm:p-4 text-center shadow-[3px_3px_0_0_#201e1d]',
          className
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-[#201e1d] bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700 shadow-[1px_1px_0_0_#201e1d]">
              Google AdSense Network
            </span>
          </div>
          {slotConfig.dismissible && (
            <button
              onClick={handleDismiss}
              aria-label="Dismiss Advertisement"
              className="rounded-lg border border-[#201e1d] bg-white p-1 text-slate-600 shadow-[1px_1px_0_0_#201e1d] transition-all hover:bg-slate-100 active:translate-y-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex min-h-[90px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#201e1d]/30 bg-white/60 p-2">
          <ins
            className="adsbygoogle block w-full"
            style={{ display: 'block', minHeight: '90px' }}
            data-ad-client={pubId || undefined}
            data-ad-slot={slotCode || undefined}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
          {(!adsenseLoaded || previewMode || !pubId) && (
            <div className="flex select-none flex-col items-center gap-0.5 py-1 font-mono text-[11px] text-slate-500">
              <span className="font-bold text-slate-700">AdSense Display Container</span>
              <span>Pub: {pubIdDisplay}</span>
              <span>Slot: {slotCode || 'auto-assigned'}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER VARIATION: Between Questions Interstitial Micro-Break
  // ---------------------------------------------------------------------------
  if (slotConfig.format === 'interstitial') {
    return (
      <div
        className={cn(
          'w-full rounded-2xl border-2 border-[#201e1d] p-4 text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] sm:p-5',
          theme.bg,
          className
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#201e1d] bg-amber-300 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-950 shadow-[1px_1px_0_0_#201e1d]">
              Milestone Break
            </span>
            <span className="text-[11px] font-bold text-slate-600 sm:text-xs">
              Quick breath · Sponsor Spotlight
            </span>
          </div>
          {slotConfig.dismissible && (
            <button
              onClick={handleDismiss}
              aria-label="Dismiss Break Card"
              className="rounded-lg border border-[#201e1d] bg-white p-1 text-[#201e1d] shadow-[1px_1px_0_0_#201e1d] transition-all hover:bg-slate-100 active:translate-y-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[1px_1px_0_0_#201e1d]', theme.badge)}>
              {campaign.badgeText || 'SPONSORED'}
            </span>
            <span className="text-xs font-bold text-slate-600">
              {campaign.sponsorName}
            </span>
          </div>
          <h4 className="text-base font-extrabold tracking-tight text-[#201e1d] sm:text-lg">
            {campaign.headline}
          </h4>
          <p className="text-xs text-slate-700 sm:text-sm">
            {campaign.bodyCopy}
          </p>
        </div>

        <div className="mt-4 flex flex-col items-stretch gap-2.5 pt-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => {
              handleDismiss();
              onContinue?.();
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#201e1d] bg-[#201e1d] px-4 py-2 text-xs font-black text-white shadow-[2px_2px_0_0_#201e1d] transition-all hover:bg-slate-800 active:translate-y-0.5 active:shadow-none sm:text-sm"
          >
            <span>Continue to Question</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <a
            href={campaign.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCtaClick}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#201e1d] px-4 py-2 text-xs font-black shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-y-0.5 active:shadow-none sm:text-sm',
              theme.button
            )}
          >
            <span>{campaign.ctaText}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER VARIATION: Compact Pill (Leaderboard & Question Footer)
  // ---------------------------------------------------------------------------
  if (slotConfig.format === 'compact_pill') {
    return (
      <div
        className={cn(
          'flex w-full flex-col items-start justify-between gap-2 rounded-xl border-2 border-[#201e1d] px-3 py-2 text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] sm:flex-row sm:items-center sm:px-4 sm:py-2.5',
          theme.bg,
          className
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              'shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[1px_1px_0_0_#201e1d]',
              theme.badge
            )}
          >
            {campaign.badgeText || 'SPONSORED'}
          </span>
          <p className="truncate text-xs font-bold text-[#201e1d]">
            {campaign.headline}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
          <a
            href={campaign.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCtaClick}
            className={cn(
              'flex items-center gap-1 rounded-lg border border-[#201e1d] px-2.5 py-1 text-xs font-black shadow-[1px_1px_0_0_#201e1d] transition-all active:translate-y-0.5 active:shadow-none',
              theme.button
            )}
          >
            <span>{campaign.ctaText}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
          {slotConfig.dismissible && (
            <button
              onClick={handleDismiss}
              aria-label="Dismiss Pill"
              className="rounded-lg border border-[#201e1d] bg-white p-1 text-[#201e1d] shadow-[1px_1px_0_0_#201e1d] transition-all hover:bg-slate-100 active:translate-y-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER VARIATION: Native Card (Round Summary Celebration Screen)
  // ---------------------------------------------------------------------------
  if (slotConfig.format === 'native_card') {
    return (
      <div
        className={cn(
          'w-full rounded-2xl border-2 border-[#201e1d] p-4 text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] sm:p-5',
          theme.bg,
          className
        )}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider shadow-[1px_1px_0_0_#201e1d]',
                theme.badge
              )}
            >
              {campaign.badgeText || 'RECOMMENDED RESOURCE'}
            </span>
            <span className="text-xs font-bold text-slate-600">
              {campaign.sponsorName}
            </span>
          </div>
          {slotConfig.dismissible && (
            <button
              onClick={handleDismiss}
              aria-label="Dismiss Card"
              className="rounded-lg border border-[#201e1d] bg-white p-1 text-[#201e1d] shadow-[1px_1px_0_0_#201e1d] transition-all hover:bg-slate-100 active:translate-y-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-black tracking-tight text-[#201e1d] sm:text-lg">
            {campaign.headline}
          </h3>
          <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
            {campaign.bodyCopy}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-[#201e1d]/15">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Curated for Cambridge revision</span>
          </div>
          <a
            href={campaign.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCtaClick}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border-2 border-[#201e1d] px-4 py-2 text-xs font-black shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-y-0.5 active:shadow-none sm:text-sm',
              theme.button
            )}
          >
            <span>{campaign.ctaText}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER VARIATION: Standard Banner (Start Flow Banner / General Placement)
  // ---------------------------------------------------------------------------
  return (
    <div
      className={cn(
        'w-full rounded-2xl border-2 border-[#201e1d] p-3.5 text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] sm:p-4',
        theme.bg,
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[1px_1px_0_0_#201e1d]',
              theme.badge
            )}
          >
            {campaign.badgeText || 'SPONSORED RESOURCE'}
          </span>
          <span className="text-xs font-bold text-slate-600">
            {campaign.sponsorName}
          </span>
        </div>
        {slotConfig.dismissible && (
          <button
            onClick={handleDismiss}
            aria-label="Dismiss Banner"
            className="rounded-lg border border-[#201e1d] bg-white p-1 text-[#201e1d] shadow-[1px_1px_0_0_#201e1d] transition-all hover:bg-slate-100 active:translate-y-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <h4 className="text-sm font-black tracking-tight text-[#201e1d] sm:text-base">
            {campaign.headline}
          </h4>
          <p className="text-xs text-slate-700">
            {campaign.bodyCopy}
          </p>
        </div>

        <a
          href={campaign.targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleCtaClick}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-[#201e1d] px-3.5 py-1.5 text-xs font-black shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-y-0.5 active:shadow-none sm:text-sm',
            theme.button
          )}
        >
          <span>{campaign.ctaText}</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

export default AdSlotBanner;
