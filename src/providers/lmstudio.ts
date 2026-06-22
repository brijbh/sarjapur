import { z } from 'zod';
import { LMSTUDIO_MODELS_ENDPOINT } from '../core/paths.js';
import type { HardwareCapabilities, ModelTier } from '../core/envcheck.js';
import type { CheckResult } from '../core/scanner.js';

// ---------------------------------------------------------------------------
// Zod schemas — Task 3.2
// ---------------------------------------------------------------------------

const LMStudioModelSchema = z.object({
  id: z.string(),
  object: z.string(),
  owned_by: z.string().optional(),
});

const LMStudioModelsResponseSchema = z.object({
  data: z.array(LMStudioModelSchema),
  object: z.string(),
});

type LMStudioModel = z.infer<typeof LMStudioModelSchema>;

// ---------------------------------------------------------------------------
// Server reachability — Task 3.1
// ---------------------------------------------------------------------------

const SERVER_TIMEOUT_MS = 3000;

async function fetchModelsRaw(): Promise<{ ok: true; data: unknown } | { ok: false; reason: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SERVER_TIMEOUT_MS);
    try {
      const res = await fetch(LMSTUDIO_MODELS_ENDPOINT, { signal: controller.signal });
      if (!res.ok) {
        return { ok: false, reason: `HTTP ${res.status} ${res.statusText}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnRefused =
      msg.includes('ECONNREFUSED') ||
      msg.includes('fetch failed') ||
      msg.includes('aborted') ||
      msg.includes('abort');
    return {
      ok: false,
      reason: isConnRefused
        ? 'LM Studio server not reachable. Open LM Studio and start the local server.'
        : msg,
    };
  }
}

// ---------------------------------------------------------------------------
// Hardware-aware model filtering — Task 3.3
// ---------------------------------------------------------------------------

const TIER_REGEX: Array<{ pattern: RegExp; tier: ModelTier }> = [
  { pattern: /70b\+|671b|236b|141b|123b/i, tier: '70B+' },
  { pattern: /70b/i, tier: '70B' },
  { pattern: /30b|32b|35b|34b|33b/i, tier: '30B' },
  { pattern: /13b|14b|15b/i, tier: '13B' },
  { pattern: /7b|8b|9b/i, tier: '7B' },
  { pattern: /3b|4b/i, tier: '3B' },
  { pattern: /1b|1\.5b|2b/i, tier: '1B' },
];

const TIER_ORDER: readonly ModelTier[] = ['1B', '3B', '7B', '13B', '30B', '70B', '70B+'];

function parseTierFromId(modelId: string): ModelTier | null {
  for (const { pattern, tier } of TIER_REGEX) {
    if (pattern.test(modelId)) return tier;
  }
  return null;
}

export function filterCompatibleModels(
  modelIds: string[],
  hardware: HardwareCapabilities,
): string[] {
  const supported = new Set<ModelTier>(hardware.runnableModelTiers);

  const compatible = modelIds.filter((id) => {
    const tier = parseTierFromId(id);
    if (tier === null) return true; // unknown size → include (can't determine incompatibility)
    return supported.has(tier);
  });

  // If nothing survived filtering, return all with a warning (caller handles it)
  return compatible.length > 0 ? compatible : modelIds;
}

// ---------------------------------------------------------------------------
// Model preference selection — Task 3.4
// ---------------------------------------------------------------------------

const PREFERENCE_RULES: Array<(id: string) => boolean> = [
  (id) => /qwen3-coder/i.test(id),
  (id) => /qwen3/i.test(id),
  (id) => /qwen/i.test(id),
  (id) => /coder/i.test(id),
  (id) => /code/i.test(id),
];

function tierIndex(modelId: string): number {
  const tier = parseTierFromId(modelId);
  if (tier === null) return -1;
  return TIER_ORDER.indexOf(tier);
}

export function selectPreferredModel(
  modelIds: string[],
  hardware: HardwareCapabilities,
): string | null {
  if (modelIds.length === 0) return null;

  const supported = new Set<ModelTier>(hardware.runnableModelTiers);

  for (const rule of PREFERENCE_RULES) {
    const matches = modelIds.filter(rule);
    if (matches.length === 0) continue;

    // Among matches, prefer the largest runnable tier
    const ranked = matches.sort((a, b) => {
      const tA = parseTierFromId(a);
      const tB = parseTierFromId(b);
      const iA = tA && supported.has(tA) ? TIER_ORDER.indexOf(tA) : -1;
      const iB = tB && supported.has(tB) ? TIER_ORDER.indexOf(tB) : -1;
      return iB - iA; // descending
    });

    return ranked[0] ?? null;
  }

  return null; // caller will ask user to choose
}

// ---------------------------------------------------------------------------
// checkLMStudio() — Task 3.5
// ---------------------------------------------------------------------------

export interface LMStudioCheckResult {
  server: CheckResult;
  models: CheckResult & {
    modelIds?: string[];
    compatibleModelIds?: string[];
    selectedModel?: string;
  };
}

export async function checkLMStudio(hardware: HardwareCapabilities): Promise<LMStudioCheckResult> {
  const raw = await fetchModelsRaw();

  if (!raw.ok) {
    return {
      server: {
        label: 'LM Studio',
        status: 'missing',
        detail: raw.reason,
      },
      models: {
        label: 'Models',
        status: 'missing',
        detail: 'LM Studio server is not reachable — cannot list models.',
      },
    };
  }

  // Parse with Zod — Task 3.2
  const parsed = LMStudioModelsResponseSchema.safeParse(raw.data);
  if (!parsed.success) {
    return {
      server: { label: 'LM Studio', status: 'ok' },
      models: {
        label: 'Models',
        status: 'warn',
        detail: `Unexpected response format from LM Studio: ${parsed.error.message}`,
      },
    };
  }

  const allModels: LMStudioModel[] = parsed.data.data;
  const allIds = allModels.map((m) => m.id);

  if (allIds.length === 0) {
    return {
      server: { label: 'LM Studio', status: 'ok' },
      models: {
        label: 'Models',
        status: 'missing',
        detail: 'No models detected in LM Studio.',
        modelIds: [],
        compatibleModelIds: [],
      },
    };
  }

  const compatibleIds = filterCompatibleModels(allIds, hardware);
  const allFiltered = compatibleIds.length === allIds.length && allIds.every((id) => compatibleIds.includes(id));
  const selectedModel = selectPreferredModel(compatibleIds, hardware) ?? undefined;

  const detail =
    compatibleIds.length < allIds.length
      ? `${allIds.length} model(s) found; ${compatibleIds.length} compatible with your hardware.`
      : undefined;

  // Warn if filtering returned all models because nothing was compatible
  const noCompatible =
    compatibleIds.length === allIds.length && allIds.some((id) => parseTierFromId(id) !== null) && !allFiltered;

  return {
    server: { label: 'LM Studio', status: 'ok' },
    models: {
      label: 'Models',
      status: noCompatible ? 'warn' : 'ok',
      value: `${allIds.length} total, ${compatibleIds.length} compatible`,
      detail,
      modelIds: allIds,
      compatibleModelIds: compatibleIds,
      selectedModel,
    },
  };
}
