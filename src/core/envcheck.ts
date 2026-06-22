import os from 'node:os';
import { detectSystem, type SystemInfo } from 'llm-env-check';

export type ModelTier = '1B' | '3B' | '7B' | '13B' | '30B' | '70B' | '70B+';

const TIER_ORDER: readonly ModelTier[] = ['1B', '3B', '7B', '13B', '30B', '70B', '70B+'] as const;

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
  };
}
