import { execa } from 'execa';
import { input } from '@inquirer/prompts';
import chalk from 'chalk';

import type { HardwareCapabilities } from './envcheck.js';
import { ask } from './permissions.js';
import {
  printSuccess,
  printWarn,
  printError,
  printInfo,
  printVSCodeCard,
} from '../utils/format.js';
import { writeState } from './state.js';
import {
  writeOpencodeConfig,
  checkOpencodeInstalled,
  launchOpencode,
} from '../integrations/opencode.js';
import { launchVSCode, checkVSCodeInstalled } from '../integrations/vscode.js';
import { checkLMStudio } from '../providers/lmstudio.js';
import { commandExists } from '../utils/command.js';
import { LMSTUDIO_BASE_URL, OPENCODE_CONFIG_FILE } from './paths.js';
import { pickModelToInstall } from './modelPicker.js';

export type WorkflowTarget = 'terminal' | 'vscode' | 'both';

const PROFILE_DEFAULT = 'coding';
const VERSION = '0.1.0';

// ===========================================================================
// Compact tool-presence summary + per-tool install prompts
// ===========================================================================

async function printToolStatusLine(present: Record<string, boolean>): Promise<void> {
  const installed = Object.entries(present)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const missing = Object.entries(present)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  console.log(chalk.bold("Checking what's needed…"));
  if (installed.length > 0) {
    console.log(`  ${chalk.green('✓')} ${installed.join(', ')} ${chalk.dim('already installed')}`);
  }
  if (missing.length > 0) {
    for (const tool of missing) {
      console.log(`  ${chalk.red('✗')} ${tool}`);
    }
  }
}

async function installGit(hasWinget: boolean): Promise<void> {
  if (!(await ask('Install Git via winget?'))) {
    printWarn('Skipping Git. opencode may not work without it.');
    return;
  }
  if (!hasWinget) {
    printWarn('winget not available. Download: https://git-scm.com/download/win');
    return;
  }
  try {
    process.stdout.write(`  ${chalk.dim('→ Installing Git…')}\r`);
    await execa(
      'winget',
      ['install', '--id', 'Git.Git', '--silent', '--accept-package-agreements', '--accept-source-agreements'],
      { stdio: 'ignore' },
    );
    console.log(`  ${chalk.green('✓')} Git installed                       `);
  } catch {
    console.log(`  ${chalk.red('✗')} Git install failed. Try: winget install Git.Git`);
  }
}

async function installLMStudio(hasWinget: boolean): Promise<void> {
  if (!(await ask('Install LM Studio via winget?'))) {
    printWarn('Skipping LM Studio. local-ai cannot continue without it.');
    return;
  }
  if (!hasWinget) {
    printWarn('winget not available. Download: https://lmstudio.ai/');
    return;
  }

  // Try a few candidate winget IDs (the canonical one varies by region/source).
  const candidates = ['ElementLabs.LMStudio', 'LMStudio.LMStudio', 'lmstudio'];
  for (const id of candidates) {
    try {
      process.stdout.write(`  ${chalk.dim(`→ Installing LM Studio (${id})…`)}\r`);
      await execa(
        'winget',
        ['install', '--id', id, '--silent', '--accept-package-agreements', '--accept-source-agreements'],
        { stdio: 'ignore' },
      );
      console.log(`  ${chalk.green('✓')} LM Studio installed                           `);
      return;
    } catch {
      // try next
    }
  }
  printWarn('Could not install LM Studio via winget. Download: https://lmstudio.ai/');
}

async function installOpencode(): Promise<void> {
  if (!(await ask('Install opencode globally via npm?'))) {
    printWarn('Skipping opencode. local-ai cannot continue without it.');
    return;
  }
  try {
    process.stdout.write(`  ${chalk.dim('→ Installing opencode (npm install -g opencode)…')}\r`);
    await execa('npm', ['install', '-g', 'opencode'], { stdio: 'ignore' });
    console.log(`  ${chalk.green('✓')} opencode installed                                       `);
  } catch {
    console.log(`  ${chalk.red('✗')} opencode install failed. Try: npm install -g opencode`);
  }
}

// ===========================================================================
// Wait helpers
// ===========================================================================

async function waitForEnter(message: string): Promise<void> {
  try {
    await input({ message, default: '' });
  } catch {
    console.log('\nCancelled.');
    // Defer to let inquirer finish closing its readline interface (Windows libuv).
    setImmediate(() => process.exit(0));
    await new Promise<never>(() => undefined);
  }
}

// ===========================================================================
// Main entry — runSetupWorkflow
// ===========================================================================

export async function runSetupWorkflow(
  target: WorkflowTarget,
  hardware: HardwareCapabilities,
): Promise<void> {
  // Phase 1 — quick presence check of every tool we care about.
  const [gitOk, opencodeOk, vscodeOk, wingetOk] = await Promise.all([
    commandExists('git'),
    checkOpencodeInstalled(),
    checkVSCodeInstalled(),
    commandExists('winget'),
  ]);
  const lmCheck1 = await checkLMStudio(hardware);
  const lmReachable = lmCheck1.server.status === 'ok';

  // Don't require VS Code for terminal-only flows.
  const vscodeRequired = target !== 'terminal';

  await printToolStatusLine({
    Git: gitOk,
    opencode: opencodeOk,
    ...(vscodeRequired ? { 'VS Code': vscodeOk } : {}),
    'LM Studio': lmReachable,
  });

  // Phase 2 — install missing base tools, one at a time.
  if (!gitOk) await installGit(wingetOk);
  if (!opencodeOk) await installOpencode();
  if (!lmReachable) {
    await installLMStudio(wingetOk);
    console.log(`  ${chalk.dim('After install, open LM Studio at least once so it can initialize.')}`);
    await waitForEnter('Press Enter when LM Studio is open (or type S to skip):');
  }

  // Phase 3 — re-scan LM Studio (user may have just installed / opened it).
  console.log('');
  const lmCheck2 = await checkLMStudio(hardware);
  if (lmCheck2.server.status !== 'ok') {
    printError('LM Studio server is still not reachable.');
    printInfo('Open LM Studio → Local Server → Start, then run: local-ai');
    process.exit(1);
  }

  // Phase 4 — pick or reuse a model.
  const loadedCompatible = lmCheck2.models.compatibleModelIds ?? [];
  let modelId: string;
  let modelDisplay: string;

  if (loadedCompatible.length > 0) {
    // A compatible chat/coding model is already loaded — use it, skip the picker.
    const preferred =
      lmCheck2.models.selectedModel ?? loadedCompatible[0] ?? '';
    modelId = preferred;
    modelDisplay = preferred;
    printSuccess(`Using loaded model: ${chalk.green(modelId)}`);
  } else {
    // Show the picker.
    console.log('');
    const pick = await pickModelToInstall(
      hardware.catalogRecommendations,
      hardware.catalogProfile,
    );
    if (!pick) {
      printError('Your hardware cannot run any of the catalog models. Setup cannot continue.');
      process.exit(1);
    }
    modelDisplay = `${pick.name} ${pick.quantization}`;
    console.log('');
    console.log(
      `Open LM Studio → ${chalk.bold('Search')} tab → search ${chalk.cyan(`"${pick.searchHint}"`)}`,
    );
    console.log(
      `Download the ${chalk.cyan(pick.quantization)} variant, then ${chalk.bold('Local Server → Load model → Start server')}.`,
    );
    await waitForEnter('Press Enter when the model is loaded (or type S to skip):');

    // Re-scan to find the actual loaded model ID.
    const lmCheck3 = await checkLMStudio(hardware);
    const loadedNow =
      lmCheck3.models.compatibleModelIds ?? lmCheck3.models.modelIds ?? [];
    if (loadedNow.length === 0) {
      printError('No model was loaded. Setup cannot continue.');
      printInfo('Run: local-ai  once you have a model loaded in LM Studio.');
      process.exit(1);
    }
    modelId =
      lmCheck3.models.selectedModel ??
      loadedNow.find((id) => id.toLowerCase().includes(pick.searchHint.toLowerCase().split(' ')[0] ?? '')) ??
      loadedNow[0] ??
      '';
  }

  if (!modelId) {
    printError('No usable model found.');
    process.exit(1);
  }

  // Phase 5 — write opencode config.
  process.stdout.write(`  ${chalk.dim('→ Writing opencode config…')}\r`);
  const cfgResult = await writeOpencodeConfig(modelId);
  if (!cfgResult.written) {
    console.log(`  ${chalk.red('✗')} opencode config not written. Setup aborted.`);
    process.exit(1);
  }
  console.log(`  ${chalk.green('✓')} opencode config written                  `);
  if (cfgResult.backedUp && cfgResult.backupPath) {
    console.log(`    ${chalk.dim(`(previous config backed up to: ${cfgResult.backupPath})`)}`);
  }

  // Phase 6 — save state (silent default, per UX brief).
  await writeState({
    version: VERSION,
    profile: PROFILE_DEFAULT,
    workflow: target,
    setupComplete: true,
    provider: 'lmstudio',
    serverUrl: LMSTUDIO_BASE_URL,
    model: modelId,
    configPath: OPENCODE_CONFIG_FILE,
    lastVerified: new Date().toISOString(),
  });
  console.log(`  ${chalk.green('✓')} Setup saved`);

  // Phase 7 — final summary + launch.
  console.log('');
  printSuccess(`You're set up. Model: ${chalk.green(modelDisplay)}`);
  console.log('');

  switch (target) {
    case 'terminal':
      console.log('Opening a new terminal window with opencode…');
      await launchOpencode(process.cwd());
      console.log(chalk.dim(`(If nothing opens, run \`opencode\` manually.)`));
      break;

    case 'vscode':
      printVSCodeCard(modelId);
      if (vscodeOk) {
        await launchVSCode(process.cwd());
      } else {
        printWarn("VS Code's `code` command isn't on PATH — open VS Code yourself.");
      }
      break;

    case 'both':
      console.log('Opening a new terminal window with opencode…');
      await launchOpencode(process.cwd());
      printVSCodeCard(modelId);
      if (vscodeOk) {
        await launchVSCode(process.cwd());
      } else {
        printWarn("VS Code's `code` command isn't on PATH — open VS Code yourself.");
      }
      break;
  }
}
