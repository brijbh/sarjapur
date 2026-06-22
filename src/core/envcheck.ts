import os from 'node:os';
import {
  detectSystem,
  recommendModels,
  type SystemInfo,
  type ModelRecommendation,
  type Profile,
} from 'llm-env-check';

export type { ModelRecommendation, Profile } from 'llm-env-check';

export type ModelTier = '1B' | '3B' | '7B' | '13B' | '30B' | '70B' | '70B+';

const TIER_ORDER: readonly ModelTier[] = ['1B', '3B', '7B', '13B', '30B', '70B', '70B+'] as const;

// v0.1 hardcodes the profile to 'coding' — setup is for coding-tool integration.
const CATALOG_PROFILE: Profile = 'coding';

export interface HardwareCapabilities {
  ram: {
    totalGB: number;
    availableGB: number;
  };
  gpu: {
    detected: boolean;
    name?: string;
    vramGB?: number;
    accelerationAvailable: boolean;
    accelerationType?: string;
  };
  cpu: {
    cores: number;
    arch: string;
  };
  os: {
    platform: string;
    version?: string;
  };
  runnableModelTiers: ModelTier[];
  notes: string[];
  catalogProfile: Profile;
  catalogRecommendations: ModelRecommendation[];
}

function maxTierFor(ramGB: number, vramGB: number | undefined): ModelTier {
  const vram = vramGB ?? 0;
  if (ramGB < 8) return '3B';
  if (ramGB < 16) return '7B';
  if (ramGB < 32) return '13B';
  if (ramGB < 64) return vram >= 8 ? '30B' : '13B';
  if (vram >= 24) return '70B+';
  if (vram >= 12) return '70B';
  return '30B';
}

function tiersUpTo(max: ModelTier): ModelTier[] {
  const idx = TIER_ORDER.indexOf(max);
  return TIER_ORDER.slice(0, idx + 1);
}

function inferAcceleration(system: SystemInfo): { available: boolean; type?: string } {
  const gpu = (system.gpuName ?? '').toLowerCase();
  if (!gpu) return { available: false };

  if (/nvidia|geforce|rtx|gtx|tesla|quadro/.test(gpu)) {
    return { available: true, type: 'CUDA' };
  }
  if (system.osName.toLowerCase().includes('mac') || /apple/.test(gpu)) {
    return { available: true, type: 'Metal' };
  }
  if (/amd|radeon|navi/.test(gpu)) {
    return { available: true, type: 'Vulkan/ROCm' };
  }
  if (/intel.*arc/.test(gpu)) {
    return { available: true, type: 'Vulkan/oneAPI' };
  }
  return { available: true, type: 'Vulkan' };
}

export async function getHardwareCapabilities(): Promise<HardwareCapabilities> {
  const system: SystemInfo = detectSystem();
  const notes: string[] = [];

  const ramTotal = system.totalRamGb;
  const ramAvail = system.freeRamGb;
  const vram = system.vramGb;
  const accel = inferAcceleration(system);

  const max = maxTierFor(ramTotal, vram);
  const runnable = tiersUpTo(max);

  if (!system.gpuName) {
    notes.push('No GPU detected — models will run on CPU only and may be slow.');
  } else if (vram === undefined) {
    notes.push(`GPU detected (${system.gpuName}) but VRAM could not be determined.`);
  }
  if (ramTotal < 8) {
    notes.push('Less than 8 GB RAM — only the smallest models (1B–3B) are practical.');
  }

  // Catalog recommendations from llm-env-check, ordered (profile-matching first, then by rating).
  let catalogRecommendations: ModelRecommendation[] = [];
  try {
    catalogRecommendations = recommendModels(system, CATALOG_PROFILE);
  } catch {
    // Never let a recommendation failure break the scan.
    notes.push('llm-env-check recommendations unavailable for this system.');
  }

  return {
    ram: { totalGB: ramTotal, availableGB: ramAvail },
    gpu: {
      detected: Boolean(system.gpuName),
      name: system.gpuName,
      vramGB: vram,
      accelerationAvailable: accel.available,
      accelerationType: accel.type,
    },
    cpu: {
      cores: os.cpus().length,
      arch: system.cpuArchitecture,
    },
    os: {
      platform: system.osName,
      version: system.osVersion,
    },
    runnableModelTiers: runnable,
    notes,
    catalogProfile: CATALOG_PROFILE,
    catalogRecommendations,
  };
}

// ---------------------------------------------------------------------------
// Helpers for callers that want a single best download recommendation
// ---------------------------------------------------------------------------

export function pickBestCatalogModel(
  recs: ModelRecommendation[],
  profile: Profile = CATALOG_PROFILE,
): ModelRecommendation | null {
  // Prefer GOOD-rated entries that match the requested profile, largest first.
  const goodForProfile = recs
    .filter((r) => r.rating === 'GOOD' && r.profiles.includes(profile))
    .sort((a, b) => b.estimatedMemoryGb - a.estimatedMemoryGb);
  if (goodForProfile.length > 0) return goodForProfile[0] ?? null;

  // Fallback: any GOOD entry, largest first.
  const anyGood = recs
    .filter((r) => r.rating === 'GOOD')
    .sort((a, b) => b.estimatedMemoryGb - a.estimatedMemoryGb);
  if (anyGood.length > 0) return anyGood[0] ?? null;

  // Fallback: best BORDERLINE for the profile.
  const borderlineForProfile = recs
    .filter((r) => r.rating === 'BORDERLINE' && r.profiles.includes(profile))
    .sort((a, b) => b.estimatedMemoryGb - a.estimatedMemoryGb);
  if (borderlineForProfile.length > 0) return borderlineForProfile[0] ?? null;

  return null;
}
