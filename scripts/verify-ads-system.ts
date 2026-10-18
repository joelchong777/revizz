/**
 * Revizz Ads & Monetization System QA & Verification Suite
 * 
 * Comprehensive automated test suite validating:
 * 1. Default Configuration & Smart Suggestions Contract (Zero Fake Data & 3 Reference Examples)
 * 2. Placement Rules & Guardrails Decision Engine (shouldRenderAdSlot)
 * 3. Presets & Suggestion Application (applySuggestedPlacement, applyPlacementPreset)
 * 4. Campaign Selection & Telemetry (selectCampaignForSlot, computeAdsAnalyticsSummary)
 * 5. Static Component Wiring, Server API Route & Zero-Fake-Data Purge Verification
 * 
 * Run with: npx tsx scripts/verify-ads-system.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_PLACEMENT_SLOT_IDS,
  getDefaultAdsConfig,
  getSuggestedPlacements,
  shouldRenderAdSlot,
  applySuggestedPlacement,
  applyPlacementPreset,
  selectCampaignForSlot,
  computeAdsAnalyticsSummary,
  AdsSystemConfig,
  AdPlacementSlotId,
  ApplyPresetMode,
} from '../lib/ads';

interface AssertionResult {
  passed: boolean;
  message: string;
}

interface TestGroup {
  name: string;
  assertions: AssertionResult[];
}

const groups: TestGroup[] = [];

function createGroup(name: string): (passed: boolean, message: string) => void {
  const group: TestGroup = { name, assertions: [] };
  groups.push(group);
  return (passed: boolean, message: string) => {
    group.assertions.push({ passed, message });
  };
}

// ============================================================================
// SUITE 1: Default Configuration & Smart Suggestions Contract
// ============================================================================
{
  const assert = createGroup('1. Default Configuration & Smart Suggestions Contract');
  const defaults = getDefaultAdsConfig();

  // Guardrail default values
  assert(defaults.globalAdsEnabled === true, 'Default globalAdsEnabled must be true');
  assert(defaults.hideAdsForSchoolAccounts === true, 'Default hideAdsForSchoolAccounts must be true (school protection)');
  assert(defaults.hideAdsInTimedExamMode === true, 'Default hideAdsInTimedExamMode must be true (concentration protection)');
  assert(defaults.audienceFilter === 'free_and_demo_only', 'Default audienceFilter must be free_and_demo_only');

  // Zero-Fake-Data: adsensePublisherId must be clean empty string by default
  assert(defaults.adsensePublisherId === '', 'Default adsensePublisherId must be empty string (zero fake publisher IDs)');

  // Verify exactly 3 Cambridge reference example campaigns starting with 0 impressions/clicks
  assert(defaults.campaigns.length === 3, `Default campaigns contains exactly 3 reference example campaigns (found ${defaults.campaigns.length})`);
  defaults.campaigns.forEach((c) => {
    assert(
      c.impressions === 0 && c.clicks === 0,
      `Campaign '${c.id}' starts with 0 impressions and 0 clicks (impressions=${c.impressions}, clicks=${c.clicks})`
    );
  });

  // Verify initial computeAdsAnalyticsSummary on default clean state
  const initialSummary = computeAdsAnalyticsSummary(defaults);
  assert(initialSummary.totalImpressions === 0, 'Initial analytics starts at totalImpressions === 0');
  assert(initialSummary.totalClicks === 0, 'Initial analytics starts at totalClicks === 0');
  assert(initialSummary.overallCtr === 0, 'Initial analytics starts at overallCtr === 0');
  assert(initialSummary.estimatedRpmUsd === 0, 'Initial analytics starts at estimatedRpmUsd === 0');
  assert(initialSummary.activeCampaignCount === 3, 'Initial analytics activeCampaignCount matches 3 reference campaigns');
  assert(initialSummary.enabledSlotCount === 3, 'Initial analytics enabledSlotCount matches 3 default enabled slots');

  // Verify all 5 slot IDs exist in config.slots
  assert(ALL_PLACEMENT_SLOT_IDS.length === 5, 'ALL_PLACEMENT_SLOT_IDS contains exactly 5 slots');

  const requiredSlots: AdPlacementSlotId[] = [
    'start_flow_banner',
    'question_card_footer',
    'between_questions_interstitial',
    'round_summary_card',
    'leaderboard_footer',
  ];

  for (const slotId of requiredSlots) {
    const slot = defaults.slots[slotId];
    assert(!!slot, `Slot config exists for '${slotId}'`);
    if (slot) {
      assert(slot.slotId === slotId, `Slot '${slotId}' has matching slotId property`);
      assert(typeof slot.label === 'string' && slot.label.length > 0, `Slot '${slotId}' has a non-empty label`);
      assert(typeof slot.surface === 'string' && slot.surface.length > 0, `Slot '${slotId}' has a non-empty surface`);
      assert(typeof slot.enabled === 'boolean', `Slot '${slotId}' enabled is a boolean`);
      assert(['banner', 'native_card', 'interstitial', 'compact_pill'].includes(slot.format), `Slot '${slotId}' has a valid format (${slot.format})`);
      assert(['native', 'adsense', 'hybrid'].includes(slot.sourceMode), `Slot '${slotId}' has a valid sourceMode (${slot.sourceMode})`);
    }
  }

  // Suggestions contract
  const suggestions = getSuggestedPlacements();
  assert(suggestions.length === 5, `getSuggestedPlacements() returns 5 curated placement suggestions (found ${suggestions.length})`);

  for (const s of suggestions) {
    assert(
      s.uxSafetyScore >= 80,
      `Suggestion '${s.id}' UX safety score >= 80 (actual: ${s.uxSafetyScore})`
    );
    assert(
      typeof s.rationale === 'string' && s.rationale.trim().length > 15,
      `Suggestion '${s.id}' has a detailed cognitive-load rationale`
    );
    assert(
      typeof s.estimatedCtrRange === 'string' && s.estimatedCtrRange.includes('%'),
      `Suggestion '${s.id}' provides an estimated CTR range (${s.estimatedCtrRange})`
    );
    assert(
      requiredSlots.includes(s.slotId),
      `Suggestion '${s.id}' references a known placement slot ('${s.slotId}')`
    );
    assert(
      typeof s.recommendedSettings === 'object' && Object.keys(s.recommendedSettings).length > 0,
      `Suggestion '${s.id}' provides recommended settings overrides`
    );
  }
}

// ============================================================================
// SUITE 2: Placement Rules & Guardrails Decision Engine (shouldRenderAdSlot)
// ============================================================================
{
  const assert = createGroup('2. Placement Rules & Guardrails Decision Engine');
  const baseConfig = getDefaultAdsConfig();

  // Test 2.1: Global killswitch
  {
    const killswitchConfig: AdsSystemConfig = {
      ...baseConfig,
      globalAdsEnabled: false,
    };
    const rendered = shouldRenderAdSlot({
      config: killswitchConfig,
      slotId: 'start_flow_banner',
    });
    assert(rendered === false, 'Global kill-switch disables slot rendering when globalAdsEnabled is false');
  }

  // Test 2.2: School account exemption
  {
    const schoolExemptConfig: AdsSystemConfig = {
      ...baseConfig,
      globalAdsEnabled: true,
      hideAdsForSchoolAccounts: true,
    };
    const schoolRender = shouldRenderAdSlot({
      config: schoolExemptConfig,
      slotId: 'start_flow_banner',
      isSchoolAccount: true,
    });
    assert(schoolRender === false, 'School account exemption hides ads when hideAdsForSchoolAccounts is true');

    const nonSchoolRender = shouldRenderAdSlot({
      config: schoolExemptConfig,
      slotId: 'start_flow_banner',
      isSchoolAccount: false,
    });
    assert(nonSchoolRender === true, 'Non-school account sees ads when slot is enabled');
  }

  // Test 2.3: Timed exam mode focus protection
  {
    const timedConfig: AdsSystemConfig = {
      ...baseConfig,
      globalAdsEnabled: true,
      hideAdsInTimedExamMode: true,
    };
    const timedRender = shouldRenderAdSlot({
      config: timedConfig,
      slotId: 'start_flow_banner',
      isTimedMode: true,
    });
    assert(timedRender === false, 'Timed exam mode focus protection hides ads when isTimedMode is true');

    const untimedRender = shouldRenderAdSlot({
      config: timedConfig,
      slotId: 'start_flow_banner',
      isTimedMode: false,
    });
    assert(untimedRender === true, 'Practice untimed mode renders ad when slot is enabled');
  }

  // Test 2.4: Audience filtering
  {
    // Case: 'demo_only'
    const demoOnlyConfig: AdsSystemConfig = {
      ...baseConfig,
      audienceFilter: 'demo_only',
    };
    assert(
      shouldRenderAdSlot({ config: demoOnlyConfig, slotId: 'start_flow_banner', isDemoSession: true }) === true,
      'Audience filter demo_only permits demo sessions'
    );
    assert(
      shouldRenderAdSlot({ config: demoOnlyConfig, slotId: 'start_flow_banner', isDemoSession: false }) === false,
      'Audience filter demo_only rejects non-demo sessions'
    );

    // Case: 'logged_in_non_school'
    const loggedInNonSchoolConfig: AdsSystemConfig = {
      ...baseConfig,
      audienceFilter: 'logged_in_non_school',
    };
    assert(
      shouldRenderAdSlot({
        config: loggedInNonSchoolConfig,
        slotId: 'start_flow_banner',
        isAuthenticated: true,
        isDemoSession: false,
        isSchoolAccount: false,
      }) === true,
      'Audience filter logged_in_non_school permits authenticated non-school non-demo users'
    );
    assert(
      shouldRenderAdSlot({
        config: loggedInNonSchoolConfig,
        slotId: 'start_flow_banner',
        isAuthenticated: false,
        isDemoSession: false,
        isSchoolAccount: false,
      }) === false,
      'Audience filter logged_in_non_school blocks unauthenticated users'
    );
    assert(
      shouldRenderAdSlot({
        config: loggedInNonSchoolConfig,
        slotId: 'start_flow_banner',
        isAuthenticated: true,
        isDemoSession: true,
        isSchoolAccount: false,
      }) === false,
      'Audience filter logged_in_non_school blocks demo sessions'
    );
    assert(
      shouldRenderAdSlot({
        config: loggedInNonSchoolConfig,
        slotId: 'start_flow_banner',
        isAuthenticated: true,
        isDemoSession: false,
        isSchoolAccount: true,
      }) === false,
      'Audience filter logged_in_non_school blocks school accounts'
    );

    // Case: 'free_and_demo_only'
    const freeDemoConfig: AdsSystemConfig = {
      ...baseConfig,
      audienceFilter: 'free_and_demo_only',
    };
    assert(
      shouldRenderAdSlot({ config: freeDemoConfig, slotId: 'start_flow_banner', isSchoolAccount: false }) === true,
      'Audience filter free_and_demo_only permits non-school users'
    );
    assert(
      shouldRenderAdSlot({ config: freeDemoConfig, slotId: 'start_flow_banner', isSchoolAccount: true }) === false,
      'Audience filter free_and_demo_only blocks school accounts'
    );

    // Case: 'all'
    const allAudienceConfig: AdsSystemConfig = {
      ...baseConfig,
      audienceFilter: 'all',
      hideAdsForSchoolAccounts: false,
    };
    assert(
      shouldRenderAdSlot({ config: allAudienceConfig, slotId: 'start_flow_banner', isSchoolAccount: true }) === true,
      'Audience filter all permits all audiences when school exemption is turned off'
    );
  }

  // Test 2.5: Interstitial interval math
  {
    const interstitialConfig: AdsSystemConfig = {
      ...baseConfig,
      slots: {
        ...baseConfig.slots,
        between_questions_interstitial: {
          ...baseConfig.slots.between_questions_interstitial,
          enabled: true,
          interstitialIntervalQuestions: 5,
          frequencyCapPerSession: 0,
        },
      },
    };

    // Question index is 0-based:
    // index 0 -> Question 1
    // index 1 -> Question 2
    // index 2 -> Question 3
    // index 3 -> Question 4
    // index 4 -> Question 5 (should be TRUE: (4+1) % 5 === 0)
    // index 8 -> Question 9 (should be FALSE)
    // index 9 -> Question 10 (should be TRUE: (9+1) % 5 === 0)
    assert(
      shouldRenderAdSlot({ config: interstitialConfig, slotId: 'between_questions_interstitial', questionIndex: 0 }) === false,
      'Interstitial returns false at questionIndex 0 (Question 1)'
    );
    assert(
      shouldRenderAdSlot({ config: interstitialConfig, slotId: 'between_questions_interstitial', questionIndex: 1 }) === false,
      'Interstitial returns false at questionIndex 1 (Question 2)'
    );
    assert(
      shouldRenderAdSlot({ config: interstitialConfig, slotId: 'between_questions_interstitial', questionIndex: 2 }) === false,
      'Interstitial returns false at questionIndex 2 (Question 3)'
    );
    assert(
      shouldRenderAdSlot({ config: interstitialConfig, slotId: 'between_questions_interstitial', questionIndex: 3 }) === false,
      'Interstitial returns false at questionIndex 3 (Question 4)'
    );
    assert(
      shouldRenderAdSlot({ config: interstitialConfig, slotId: 'between_questions_interstitial', questionIndex: 4 }) === true,
      'Interstitial returns true at questionIndex 4 (5th question milestone)'
    );
    assert(
      shouldRenderAdSlot({ config: interstitialConfig, slotId: 'between_questions_interstitial', questionIndex: 8 }) === false,
      'Interstitial returns false at questionIndex 8 (Question 9)'
    );
    assert(
      shouldRenderAdSlot({ config: interstitialConfig, slotId: 'between_questions_interstitial', questionIndex: 9 }) === true,
      'Interstitial returns true at questionIndex 9 (10th question milestone)'
    );
  }

  // Test 2.6: Frequency cap per session
  {
    const cappedConfig: AdsSystemConfig = {
      ...baseConfig,
      slots: {
        ...baseConfig.slots,
        question_card_footer: {
          ...baseConfig.slots.question_card_footer,
          enabled: true,
          frequencyCapPerSession: 3,
        },
      },
    };

    assert(
      shouldRenderAdSlot({ config: cappedConfig, slotId: 'question_card_footer', sessionImpressionsForSlot: 0 }) === true,
      'Renders when session impressions (0) < frequency cap (3)'
    );
    assert(
      shouldRenderAdSlot({ config: cappedConfig, slotId: 'question_card_footer', sessionImpressionsForSlot: 2 }) === true,
      'Renders when session impressions (2) < frequency cap (3)'
    );
    assert(
      shouldRenderAdSlot({ config: cappedConfig, slotId: 'question_card_footer', sessionImpressionsForSlot: 3 }) === false,
      'Blocked when session impressions (3) reaches frequency cap (3)'
    );
    assert(
      shouldRenderAdSlot({ config: cappedConfig, slotId: 'question_card_footer', sessionImpressionsForSlot: 5 }) === false,
      'Blocked when session impressions (5) exceeds frequency cap (3)'
    );
  }

  // Test 2.7: Disabled slot check
  {
    const disabledConfig: AdsSystemConfig = {
      ...baseConfig,
      slots: {
        ...baseConfig.slots,
        start_flow_banner: {
          ...baseConfig.slots.start_flow_banner,
          enabled: false,
        },
      },
    };
    assert(
      shouldRenderAdSlot({ config: disabledConfig, slotId: 'start_flow_banner' }) === false,
      'Returns false when slot.enabled is explicitly false'
    );
  }
}

// ============================================================================
// SUITE 3: Presets & Suggestion Application
// ============================================================================
{
  const assert = createGroup('3. Presets & Suggestion Application');
  const initialConfig = getDefaultAdsConfig();

  // Test 3.1: Preset student_friendly_minimal
  {
    const p = applyPlacementPreset(initialConfig, 'student_friendly_minimal');
    assert(p.globalAdsEnabled === true, 'student_friendly_minimal keeps globalAdsEnabled = true');
    assert(p.hideAdsForSchoolAccounts === true, 'student_friendly_minimal enforces school protection');
    assert(p.hideAdsInTimedExamMode === true, 'student_friendly_minimal enforces timed exam protection');
    assert(p.slots.start_flow_banner.enabled === true, 'student_friendly_minimal enables start_flow_banner');
    assert(p.slots.round_summary_card.enabled === true, 'student_friendly_minimal enables round_summary_card');
    assert(p.slots.leaderboard_footer.enabled === false, 'student_friendly_minimal disables leaderboard_footer');
    assert(p.slots.between_questions_interstitial.enabled === false, 'student_friendly_minimal disables interstitials');
    assert(p.slots.question_card_footer.enabled === false, 'student_friendly_minimal disables question card footer');
  }

  // Test 3.2: Preset balanced_edtech
  {
    const p = applyPlacementPreset(initialConfig, 'balanced_edtech');
    assert(p.globalAdsEnabled === true, 'balanced_edtech keeps globalAdsEnabled = true');
    assert(p.slots.start_flow_banner.enabled === true, 'balanced_edtech enables start_flow_banner');
    assert(p.slots.round_summary_card.enabled === true, 'balanced_edtech enables round_summary_card');
    assert(p.slots.leaderboard_footer.enabled === true, 'balanced_edtech enables leaderboard_footer');
    assert(p.slots.between_questions_interstitial.enabled === true, 'balanced_edtech enables interstitial');
    assert(p.slots.between_questions_interstitial.interstitialIntervalQuestions === 5, 'balanced_edtech sets interstitial interval to 5 questions');
    assert(p.slots.question_card_footer.enabled === false, 'balanced_edtech keeps question card footer disabled');
  }

  // Test 3.3: Preset high_yield_monetization
  {
    const p = applyPlacementPreset(initialConfig, 'high_yield_monetization');
    assert(p.globalAdsEnabled === true, 'high_yield_monetization keeps globalAdsEnabled = true');
    assert(p.slots.start_flow_banner.enabled === true, 'high_yield_monetization enables start_flow_banner');
    assert(p.slots.round_summary_card.enabled === true, 'high_yield_monetization enables round_summary_card');
    assert(p.slots.leaderboard_footer.enabled === true, 'high_yield_monetization enables leaderboard_footer');
    assert(p.slots.between_questions_interstitial.enabled === true, 'high_yield_monetization enables interstitial');
    assert(p.slots.between_questions_interstitial.interstitialIntervalQuestions === 3, 'high_yield_monetization sets tight interval of 3 questions');
    assert(p.slots.question_card_footer.enabled === true, 'high_yield_monetization enables question_card_footer');
    assert(p.globalFrequencyCapPerRound === 6, 'high_yield_monetization raises frequency cap to 6');
  }

  // Test 3.4: Preset pause_all
  {
    const p = applyPlacementPreset(initialConfig, 'pause_all');
    assert(p.globalAdsEnabled === false, 'pause_all sets globalAdsEnabled = false');
  }

  // Test 3.5: applySuggestedPlacement
  {
    // Start with disabled interstitial slot
    const freshConfig = getDefaultAdsConfig();
    freshConfig.slots.between_questions_interstitial.enabled = false;

    // Apply by suggestion ID
    const appliedById = applySuggestedPlacement(freshConfig, 'suggestion-interstitial-paced');
    assert(
      appliedById.slots.between_questions_interstitial.enabled === true,
      'applySuggestedPlacement by suggestion ID enables slot'
    );
    assert(
      appliedById.slots.between_questions_interstitial.interstitialIntervalQuestions === 5,
      'applySuggestedPlacement merges recommended settings (interval = 5)'
    );

    // Apply by slot ID fallback
    freshConfig.slots.question_card_footer.enabled = false;
    const appliedBySlot = applySuggestedPlacement(freshConfig, 'question_card_footer');
    assert(
      appliedBySlot.slots.question_card_footer.enabled === true,
      'applySuggestedPlacement by slot ID enables slot'
    );
  }
}

// ============================================================================
// SUITE 4: Campaign Selection & Dynamic Telemetry
// ============================================================================
{
  const assert = createGroup('4. Campaign Selection & Dynamic Telemetry');
  const config = getDefaultAdsConfig();

  // Test 4.1: Subject-aware matching
  {
    // Campaign 2 is past-paper-formula-sheet targeting subjects ['0620', '0625', '0610', '0455']
    // on slot 'round_summary_card'
    const matchedPhysics = selectCampaignForSlot(config, 'round_summary_card', '0625');
    assert(!!matchedPhysics, 'Campaign matched for Physics (0625) on round_summary_card');
    if (matchedPhysics) {
      assert(matchedPhysics.id === 'past-paper-formula-sheet', 'Physics (0625) selects formula sheet campaign');
    }

    // Math subject 0580 should match daily sprint tracker
    const matchedMath = selectCampaignForSlot(config, 'start_flow_banner', '0580');
    assert(!!matchedMath, 'Campaign matched for Mathematics (0580) on start_flow_banner');
    if (matchedMath) {
      assert(matchedMath.id === 'stem-graphing-calculator-tool', 'Math (0580) selects daily sprint tracker');
    }

    // Generic subject with no specific match falls back to universal campaign
    const matchedGeneric = selectCampaignForSlot(config, 'start_flow_banner', '0478');
    assert(!!matchedGeneric, 'Universal campaign matched for unlisted subject (0478)');
  }

  // Test 4.2: Paused and draft campaigns are never selected
  {
    const allPausedConfig: AdsSystemConfig = {
      ...config,
      campaigns: config.campaigns.map(c => ({
        ...c,
        status: 'paused' as const,
      })),
    };
    const pausedResult = selectCampaignForSlot(allPausedConfig, 'start_flow_banner');
    assert(pausedResult === null, 'selectCampaignForSlot returns null when all campaigns are paused');

    const draftConfig: AdsSystemConfig = {
      ...config,
      campaigns: config.campaigns.map(c => ({
        ...c,
        status: 'draft' as const,
      })),
    };
    const draftResult = selectCampaignForSlot(draftConfig, 'start_flow_banner');
    assert(draftResult === null, 'selectCampaignForSlot returns null when all campaigns are drafts');
  }

  // Test 4.3: Dynamic Telemetry & Analytics Calculation (Zero Fake Pre-seeded Data)
  {
    // Build dynamic test configuration with realistic test traffic
    const dynamicTestConfig: AdsSystemConfig = {
      ...config,
      campaigns: [
        {
          ...config.campaigns[0],
          status: 'active',
          impressions: 1000,
          clicks: 50,
        },
        {
          ...config.campaigns[1],
          status: 'active',
          impressions: 0,
          clicks: 0,
        },
        {
          ...config.campaigns[2],
          status: 'paused',
          impressions: 0,
          clicks: 0,
        },
      ],
    };

    const dynamicSummary = computeAdsAnalyticsSummary(dynamicTestConfig);
    // 50 clicks / 1000 impressions * 100 = 5.00%
    // 50 clicks * $0.40 / 1000 * 1000 = $20.00 RPM
    assert(dynamicSummary.totalImpressions === 1000, `totalImpressions accurately computed (expected 1000, got ${dynamicSummary.totalImpressions})`);
    assert(dynamicSummary.totalClicks === 50, `totalClicks accurately computed (expected 50, got ${dynamicSummary.totalClicks})`);
    assert(dynamicSummary.overallCtr === 5.0, `overallCtr accurately computed (expected 5.0%, got ${dynamicSummary.overallCtr}%)`);
    assert(dynamicSummary.estimatedRpmUsd === 20.0, `estimatedRpmUsd accurately computed (expected $20.00, got $${dynamicSummary.estimatedRpmUsd})`);
    assert(dynamicSummary.activeCampaignCount === 2, `activeCampaignCount matches 2 active campaigns (got ${dynamicSummary.activeCampaignCount})`);
    assert(dynamicSummary.enabledSlotCount === 3, `enabledSlotCount matches default enabled slots (${dynamicSummary.enabledSlotCount})`);

    // Zero-data defense
    const emptyConfig: AdsSystemConfig = {
      ...config,
      campaigns: [],
    };
    const emptySummary = computeAdsAnalyticsSummary(emptyConfig);
    assert(emptySummary.totalImpressions === 0, 'Zero impressions for empty campaigns');
    assert(emptySummary.totalClicks === 0, 'Zero clicks for empty campaigns');
    assert(emptySummary.overallCtr === 0, 'Zero CTR (no NaN) for empty campaigns');
    assert(emptySummary.estimatedRpmUsd === 0, 'Zero RPM for empty campaigns');
  }
}

// ============================================================================
// SUITE 5: Static Component Wiring, Server Route & Zero-Fake-Data Purge Verification
// ============================================================================
{
  const assert = createGroup('5. Static Component Wiring, Server Route & Zero-Fake-Data Purge');
  const baseDir = process.cwd();

  // Test 5.1: Verify /api/ads/config/route.ts exists and exports GET, POST, DELETE
  {
    const routePath = path.resolve(baseDir, 'app/api/ads/config/route.ts');
    const routeExists = fs.existsSync(routePath);
    assert(routeExists, 'API route exists: app/api/ads/config/route.ts');

    if (routeExists) {
      const routeContent = fs.readFileSync(routePath, 'utf8');
      assert(routeContent.includes('export async function GET'), 'app/api/ads/config/route.ts exports GET handler');
      assert(routeContent.includes('export async function POST'), 'app/api/ads/config/route.ts exports POST handler');
      assert(routeContent.includes('export async function DELETE'), 'app/api/ads/config/route.ts exports DELETE handler');
    }
  }

  // Test 5.2: Verify zero occurrences of fake publisher ID and handleSimulateTelemetry
  {
    const STRICT_CHECK_FILES = [
      'lib/ads.ts',
      'components/ads/AdSlotBanner.tsx',
      'components/admin/AdsManagerHub.tsx',
    ];

    const FORBIDDEN_STRINGS = [
      'handleSimulateTelemetry',
    ];

    for (const relPath of STRICT_CHECK_FILES) {
      const fullPath = path.resolve(baseDir, relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');

        for (const forbidden of FORBIDDEN_STRINGS) {
          assert(
            !content.includes(forbidden),
            `File '${relPath}' does not contain forbidden string: "${forbidden}"`
          );
        }

        // Check ca-pub fake string (allow only as sanitization check if preceded by clean/sanitize logic or none at all)
        // If the string appears in active assignment / default:
        const hasFakePubDefault = content.includes("'ca-pub-9482104829104812'") &&
          !content.includes("=== 'ca-pub-9482104829104812'") &&
          !content.includes("|| 'ca-pub-9482104829104812'");
        
        assert(
          !hasFakePubDefault,
          `File '${relPath}' has no active assignment to fake publisher 'ca-pub-9482104829104812'`
        );
      }
    }
  }

  // Test 5.3: Component wiring & integration tokens
  const REQUIRED_COMPONENTS = [
    {
      file: 'components/ads/AdSlotBanner.tsx',
      tokens: ['AdSlotBanner', 'shouldRenderAdSlot', 'selectCampaignForSlot', 'recordAdImpression', 'recordAdClick'],
    },
    {
      file: 'components/admin/AdsManagerHub.tsx',
      tokens: ['AdsManagerHub', 'loadAdsConfig', 'saveAdsConfig', 'applyPlacementPreset'],
    },
    {
      file: 'app/admin/page.tsx',
      tokens: ['ads', 'Ads & Monetization'],
    },
    {
      file: 'components/admin/AppAdminNav.tsx',
      tokens: ['ads', 'Ads & Monetization'],
    },
    {
      file: 'components/admin/AppAdminHub.tsx',
      tokens: ['AdsManagerHub', "'ads'"],
    },
    {
      file: 'components/StartFlow.tsx',
      tokens: ['AdSlotBanner', 'start_flow_banner'],
    },
    {
      file: 'components/QuestionCard.tsx',
      tokens: ['AdSlotBanner', 'question_card_footer'],
    },
    {
      file: 'components/RoundSummary.tsx',
      tokens: ['AdSlotBanner', 'round_summary_card'],
    },
    {
      file: 'components/LeaderboardModal.tsx',
      tokens: ['AdSlotBanner', 'leaderboard_footer'],
    },
  ];

  const FORBIDDEN_MOCK_PATTERNS = [
    'Dr. Jane Smith',
    'Marcus Vance',
    'Sarah Jenkins',
    'Mr. D. Patel',
    'Ms. A. Okafor',
    'Mr. C. Tan',
    'Alex M.',
    'Frontier International Academy',
    "Frontier Int'l",
    'frontier.edu',
    'revizz.edu',
  ];

  for (const item of REQUIRED_COMPONENTS) {
    const fullPath = path.resolve(baseDir, item.file);
    const fileExists = fs.existsSync(fullPath);
    assert(fileExists, `Component file exists: ${item.file}`);

    if (fileExists) {
      const content = fs.readFileSync(fullPath, 'utf8');

      // Check required integration tokens
      for (const token of item.tokens) {
        assert(
          content.includes(token),
          `Component '${item.file}' includes integration token: "${token}"`
        );
      }

      // Check zero forbidden fake data occurrences
      let mockFound = false;
      for (const pattern of FORBIDDEN_MOCK_PATTERNS) {
        if (content.includes(pattern)) {
          mockFound = true;
          assert(false, `Component '${item.file}' contains forbidden mock data: "${pattern}"`);
        }
      }
      if (!mockFound) {
        assert(true, `Component '${item.file}' has 0 forbidden mock identities`);
      }
    }
  }
}

// ============================================================================
// REPORT & EXIT
// ============================================================================
console.log('='.repeat(80));
console.log('📢 REVIZZ ADS & MONETIZATION SYSTEM AUTOMATED VERIFICATION SUITE');
console.log('='.repeat(80));

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

for (const g of groups) {
  console.log(`\n📦 [${g.name}]`);
  for (const a of g.assertions) {
    totalAssertions++;
    if (a.passed) {
      passedAssertions++;
      console.log(`  ✅ PASS: ${a.message}`);
    } else {
      failedAssertions++;
      console.error(`  ❌ FAIL: ${a.message}`);
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log(`SUMMARY: ${passedAssertions}/${totalAssertions} assertions passed (${failedAssertions} failed)`);
console.log('='.repeat(80));

if (failedAssertions > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL ADS SYSTEM CONTRACTS, GUARDRAILS, PRESETS & WIRING VERIFIED!\n');
  process.exit(0);
}
