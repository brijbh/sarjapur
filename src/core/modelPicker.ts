import { select } from '@inquirer/prompts';
import chalk from 'chalk';

import type { ModelRecommendation, Profile } from './envcheck.js';

export interface ModelOption {
  name: string;              // Display name from catalog (e.g. "Qwen2.5-Coder 7B")
  searchHint: string;        // Hint for the LM Studio search box
  quantization: string;      // e.g. "Q4"
  estimatedMemoryGb: number;
  useCase: string;
  rating: 'GOOD' | 'BORDERLINE' | 'NOT RECOMMENDED';
}

function toOption(r: ModelRecommendation): ModelOption {
  return {
    name: r.name,
    searchHint: r.name,
    quantization: r.quantization,
    estimatedMemoryGb: r.estimatedMemoryGb,
    useCase: r.useCase,
    rating: r.rating,
  };
}

// Rough family identifier — first non-digit word of the model name.
// "Qwen2.5-Coder 7B" → "qwen2.5-coder", "DeepSeek-Coder 6.7B" → "deepseek-coder".
function familyOf(name: string): string {
  const head = name.split(' ')[0] ?? '';
  return head.toLowerCase();
}

// ---------------------------------------------------------------------------
// topTwoPicks — chooses the two model options shown by default
// ---------------------------------------------------------------------------

export function topTwoPicks(
  recs: ModelRecommendation[],
  profile: Profile,
): { primary: ModelOption | null; secondary: ModelOption | null; allCompatible: ModelOption[] } {
  // All GOOD + BORDERLINE recommendations matching the requested profile.
  const compatible = recs
    .filter((r) => r.rating !== 'NOT RECOMMENDED')
    .map(toOption);

  // Prefer ones whose `profiles` list includes the requested profile.
  const inProfile = recs
    .filter(
      (r) => r.rating !== 'NOT RECOMMENDED' && r.profiles.includes(profile),
    )
    .map(toOption);

  const pool = inProfile.length > 0 ? inProfile : compatible;
  if (pool.length === 0) {
    return { primary: null, secondary: null, allCompatible: [] };
  }

  // Primary = smallest GOOD-for-profile (fastest).
  const goodFirst = pool
    .slice()
    .sort((a, b) => {
      // GOOD before BORDERLINE
      if (a.rating !== b.rating) return a.rating === 'GOOD' ? -1 : 1;
      return a.estimatedMemoryGb - b.estimatedMemoryGb;
    });

  const primary = goodFirst[0] ?? null;

  // Secondary = first entry from a different family (or the next entry if
  // there's no family diversity available).
  let secondary: ModelOption | null = null;
  if (primary) {
    const primaryFamily = familyOf(primary.name);
    secondary =
      goodFirst.find(
        (m) => m.name !== primary.name && familyOf(m.name) !== primaryFamily,
      ) ??
      goodFirst.find((m) => m.name !== primary.name) ??
      null;
  }

  return { primary, secondary, allCompatible: compatible };
}

// ---------------------------------------------------------------------------
// formatOption — single-line label used in the picker
// ---------------------------------------------------------------------------

function formatOption(opt: ModelOption): string {
  const size = chalk.dim(`~${opt.estimatedMemoryGb} GB ${opt.quantization}`);
  const tag =
    opt.rating === 'BORDERLINE' ? chalk.yellow('  (tight fit)') : '';
  return `${chalk.white(opt.name)}  ${size}  ${chalk.gray(opt.useCase)}${tag}`;
}

// ---------------------------------------------------------------------------
// pickModelToInstall — the actual selection UI
// ---------------------------------------------------------------------------

export async function pickModelToInstall(
  recs: ModelRecommendation[],
  profile: Profile,
): Promise<ModelOption | null> {
  const { primary, secondary, allCompatible } = topTwoPicks(recs, profile);

  if (!primary) {
    // Nothing fits — caller handles the "your hardware can't run anything" path.
    return null;
  }

  // If only one fits, skip the picker entirely.
  if (!secondary) {
    return primary;
  }

  const SHOW_MORE = '__show_more__';
  const choices: Array<{ name: string; value: string }> = [
    { name: formatOption(primary), value: primary.name },
    { name: formatOption(secondary), value: secondary.name },
  ];

  const remaining = allCompatible.filter(
    (m) => m.name !== primary.name && m.name !== secondary.name,
  );
  if (remaining.length > 0) {
    choices.push({
      name: chalk.cyan(`Show all ${allCompatible.length} compatible models…`),
      value: SHOW_MORE,
    });
  }

  let chosenName: string;
  try {
    chosenName = await select<string>({
      message: 'Pick a model:',
      choices,
      default: primary.name,
    });
  } catch {
    console.log('\nCancelled.');
    setImmediate(() => process.exit(0));
    return await new Promise<never>(() => undefined);
  }

  if (chosenName !== SHOW_MORE) {
    const found = allCompatible.find((m) => m.name === chosenName);
    return found ?? primary;
  }

  // Expanded view — show every compatible model.
  const expandedChoices = allCompatible.map((m) => ({
    name: formatOption(m),
    value: m.name,
  }));
  try {
    const expandedChoice = await select<string>({
      message: 'Pick a model (showing all compatible):',
      choices: expandedChoices,
      default: primary.name,
    });
    return allCompatible.find((m) => m.name === expandedChoice) ?? primary;
  } catch {
    console.log('\nCancelled.');
    setImmediate(() => process.exit(0));
    return await new Promise<never>(() => undefined);
  }
}
