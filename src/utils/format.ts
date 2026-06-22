import chalk from 'chalk';
import type { CheckResult } from '../core/scanner.js';
import type {
  HardwareCapabilities,
  ModelRecommendation,
} from '../core/envcheck.js';

// ---------------------------------------------------------------------------
// Status icons
// ---------------------------------------------------------------------------

const ICON: Record<string, string> = {
  ok: chalk.green('✓'),
  warn: chalk.yellow('⚠'),
  missing: chalk.red('✗'),
  error: chalk.red('✗'),
};

// ---------------------------------------------------------------------------
// Exported format helpers — Task 4.4
// ---------------------------------------------------------------------------

export function printHeader(title: string): void {
  console.log('');
  console.log(chalk.bold.cyan(`Welcome to local-ai  —  ${title}`));
  console.log(chalk.dim('Developed by Brijesh B'));
  console.log('');
}

export function printSection(title: string): void {
  console.log('');
  console.log(chalk.bold.white(title));
}

export function printCheckResult(r: CheckResult): void {
  const icon = ICON[r.status] ?? chalk.gray('?');
  const label = chalk.white(r.label);
  const value = r.value ? chalk.gray(` ${r.value}`) : '';
  const detail = r.detail ? chalk.dim(`\n    ${r.detail}`) : '';
  console.log(`  ${icon} ${label}${value}${detail}`);
}

export function printSuccess(msg: string): void {
  console.log(chalk.green(`✓ ${msg}`));
}

export function printWarn(msg: string): void {
  console.log(chalk.yellow(`⚠ ${msg}`));
}

export function printError(msg: string): void {
  console.log(chalk.red(`✗ ${msg}`));
}

export function printInfo(msg: string): void {
  console.log(chalk.cyan(`→ ${msg}`));
}

export function printHardwareSummary(hw: HardwareCapabilities): void {
  printSection('Hardware');

  const ram = `${hw.ram.totalGB} GB RAM`;
  const gpu = hw.gpu.detected
    ? `${hw.gpu.name ?? 'GPU'}${hw.gpu.vramGB !== undefined ? ` (${hw.gpu.vramGB} GB VRAM)` : ''}`
    : 'No GPU detected';
  const accel = hw.gpu.accelerationAvailable
    ? `GPU acceleration: ${hw.gpu.accelerationType ?? 'available'}`
    : 'CPU only';
  const tiers = hw.runnableModelTiers.join(', ');

  console.log(`  ${chalk.white(ram)}  |  ${chalk.white(gpu)}  |  ${chalk.dim(accel)}`);
  console.log(`  ${chalk.dim('Can run:')} ${chalk.green(tiers)} ${chalk.dim('models')}`);

  for (const note of hw.notes) {
    console.log(`  ${chalk.yellow('⚠')} ${chalk.dim(note)}`);
  }
}

// ---------------------------------------------------------------------------
// llm-env-check catalog recommendations
// ---------------------------------------------------------------------------

const RATING_COLOR: Record<ModelRecommendation['rating'], (s: string) => string> = {
  GOOD: chalk.green,
  BORDERLINE: chalk.yellow,
  'NOT RECOMMENDED': chalk.dim,
};

export function printCatalogRecommendations(
  recs: ModelRecommendation[],
  profile: string,
): void {
  if (recs.length === 0) return;

  printSection(`Recommended Models (${profile} profile, from llm-env-check)`);

  const nameWidth = Math.max(...recs.map((r) => r.name.length), 10);
  const ratingWidth = Math.max(...recs.map((r) => r.rating.length + 2)); // +2 for brackets

  for (const r of recs) {
    const colored = RATING_COLOR[r.rating];
    const tag = colored(`[${r.rating}]`.padEnd(ratingWidth));
    const name = chalk.white(r.name.padEnd(nameWidth));
    const size = chalk.dim(`~${r.estimatedMemoryGb} GB ${r.quantization}`);
    const profileMatch = r.profiles.includes(profile as 'coding' | 'chat' | 'writing' | 'agentic')
      ? chalk.cyan('★')
      : ' ';
    console.log(`  ${tag} ${profileMatch} ${name}  ${size}`);
  }
  console.log(
    chalk.dim(
      '  ★ = matches your profile.  GOOD = fits comfortably, BORDERLINE = tight fit.',
    ),
  );
}

export function printVSCodeCard(model: string): void {
  console.log('');
  console.log(chalk.bold('VS Code workflow ready.'));
  console.log('');
  console.log('To start using local AI in VS Code:');
  console.log('  1. VS Code will open (or is already open)');
  console.log('  2. Go to: Terminal → New Terminal');
  console.log('  3. In the terminal, run: opencode');
  console.log('  4. opencode will connect to your local model automatically');
  console.log('');
  console.log(`Your local model: ${chalk.green(model)}`);
  console.log(`Local server:     ${chalk.cyan('http://127.0.0.1:1234/v1')}`);
  console.log('');
  console.log('To verify it\'s working:');
  console.log('  In opencode, type: Hello, are you running locally?');
  console.log('  The model should respond without any internet connection.');
  console.log('');
}
