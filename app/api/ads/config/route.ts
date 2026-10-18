import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getDefaultAdsConfig, AdsSystemConfig, ALL_PLACEMENT_SLOT_IDS } from '@/lib/ads';

const STATE_FILE_PATH = path.join(process.cwd(), '.agent/state/ads-config.json');

async function readPersistedConfig(): Promise<AdsSystemConfig> {
  const defaults = getDefaultAdsConfig();
  try {
    const raw = await fs.readFile(STATE_FILE_PATH, 'utf-8');
    if (!raw.trim()) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<AdsSystemConfig>;
    if (!parsed || typeof parsed !== 'object') {
      return defaults;
    }

    // Defensively merge slot configurations
    const mergedSlots = { ...defaults.slots };
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

    // Defensively merge campaigns
    const mergedCampaigns = Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0
      ? parsed.campaigns
      : defaults.campaigns;

    return {
      globalAdsEnabled: typeof parsed.globalAdsEnabled === 'boolean' ? parsed.globalAdsEnabled : defaults.globalAdsEnabled,
      hideAdsForSchoolAccounts: typeof parsed.hideAdsForSchoolAccounts === 'boolean' ? parsed.hideAdsForSchoolAccounts : defaults.hideAdsForSchoolAccounts,
      hideAdsInTimedExamMode: typeof parsed.hideAdsInTimedExamMode === 'boolean' ? parsed.hideAdsInTimedExamMode : defaults.hideAdsInTimedExamMode,
      audienceFilter: parsed.audienceFilter || defaults.audienceFilter,
      globalFrequencyCapPerRound: typeof parsed.globalFrequencyCapPerRound === 'number' ? parsed.globalFrequencyCapPerRound : defaults.globalFrequencyCapPerRound,
      adsensePublisherId: parsed.adsensePublisherId === 'ca-pub-9482104829104812' ? '' : (parsed.adsensePublisherId ?? defaults.adsensePublisherId),
      slots: mergedSlots,
      campaigns: mergedCampaigns,
    };
  } catch {
    return defaults;
  }
}

async function writePersistedConfig(config: AdsSystemConfig): Promise<void> {
  const dir = path.dirname(STATE_FILE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STATE_FILE_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const config = await readPersistedConfig();
    return NextResponse.json({ ok: true, config });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to read ads config' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const payload: Partial<AdsSystemConfig> = body?.config || body;
    const defaults = getDefaultAdsConfig();

    // Defensively merge slots
    const mergedSlots = { ...defaults.slots };
    if (payload.slots && typeof payload.slots === 'object') {
      for (const slotId of ALL_PLACEMENT_SLOT_IDS) {
        if (payload.slots[slotId]) {
          mergedSlots[slotId] = {
            ...defaults.slots[slotId],
            ...payload.slots[slotId],
          };
        }
      }
    }

    const cleanConfig: AdsSystemConfig = {
      globalAdsEnabled: typeof payload.globalAdsEnabled === 'boolean' ? payload.globalAdsEnabled : defaults.globalAdsEnabled,
      hideAdsForSchoolAccounts: typeof payload.hideAdsForSchoolAccounts === 'boolean' ? payload.hideAdsForSchoolAccounts : defaults.hideAdsForSchoolAccounts,
      hideAdsInTimedExamMode: typeof payload.hideAdsInTimedExamMode === 'boolean' ? payload.hideAdsInTimedExamMode : defaults.hideAdsInTimedExamMode,
      audienceFilter: payload.audienceFilter || defaults.audienceFilter,
      globalFrequencyCapPerRound: typeof payload.globalFrequencyCapPerRound === 'number' ? payload.globalFrequencyCapPerRound : defaults.globalFrequencyCapPerRound,
      adsensePublisherId: payload.adsensePublisherId === 'ca-pub-9482104829104812' ? '' : (payload.adsensePublisherId ?? defaults.adsensePublisherId),
      slots: mergedSlots,
      campaigns: Array.isArray(payload.campaigns) && payload.campaigns.length > 0 ? payload.campaigns : defaults.campaigns,
    };

    await writePersistedConfig(cleanConfig);
    return NextResponse.json({ ok: true, config: cleanConfig });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to persist ads config' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const defaults = getDefaultAdsConfig();
    await writePersistedConfig(defaults);
    return NextResponse.json({ ok: true, config: defaults });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to reset ads config' },
      { status: 500 }
    );
  }
}
