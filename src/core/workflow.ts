import { execa } from 'execa';
import { input } from '@inquirer/prompts';

import type { ScanResult } from './scanner.js';
import type { Advice } from './advisor.js';
import { ask, choose } from './permissions.js';
import {
  printSection,
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
import { launchVSCode } from '../integrations/vscode.js';
import { checkLMStudio } from '../providers/lmstudio.js';
import { commandExists } from '../utils/command.js';
import { LMSTUDIO_BASE_URL, OPENCODE_CONFIG_FILE } from './paths.js';

// ---------------------------------------------------------------------------
// WorkflowTarget — Task 4.8
// ---------------------------------------------------------------------------

export type WorkflowTarget = 'terminal' | 'vscode' | 'both';

const PROFILE_DEFAULT = 'coding';
const VERSION = '0.1.0';

// ===========================================================================
// Installation phase — Task 7.2
// ===========================================================================

async function waitForUserReady(): Promise<void> {
  try {
    const answer = await input({
      message: 'Press Enter when LM Studio server is ready, or type S to skip:',
      default: '',
    });
    if (answer.trim().toLowerCase() === 's') {
      printWarn('Skipping LM Studio readiness check.');
    }
  } catch {
    console.log('\nCancelled.');
    process.exit(0);
  }
}

async function installGitIfMissing(scan: ScanResult): Promise<void> {
  if (scan.git.status === 'ok') return;

  printSection('Git');
  console.log('Git is not installed. Git is required for opencode.');
  console.log('');

  if (!(await ask('Install Git via winget?'))) {
    printWarn('Skipping Git install. opencode may not work without Git.');
    return;
  }

  if (!(await commandExists('winget'))) {
    printWarn('winget is not available on this system.');
    console.log('  Download Git manually: https://git-scm.com/download/win');
    return;
  }

  try {
    await execa(
      'winget',
      [
        'install',
        '--id',
        'Git.Git',
        '--silent',
        '--accept-package-agreements',
        '--accept-source-agreements',
      ],
      { stdio: 'inherit' },
    );
    printSuccess('Git installation completed.');
  } catch {
    printError('Git install failed. Try manually: winget install Git.Git');
  }
}

async function installLMStudioIfMissing(scan: ScanResult, advice: Advice): Promise<void> {
  if (scan.lmstudio.status === 'ok') return;

  printSection('LM Studio');
  console.log('LM Studio is not installed. LM Studio runs the local AI model.');
  console.log('');

  if (!(await ask('Install LM Studio via winget?'))) {
    printWarn('Skipping LM Studio install. local-ai cannot continue without it.');
    return;
  }

  if (!(await commandExists('winget'))) {
    printWarn('winget is not available on this system.');
    console.log('  Download LM Studio manually: https://lmstudio.ai/');
    return;
  }

  // Prompt notes the winget ID should be verified; try the most common known IDs.
  const candidateIds = ['ElementLabs.LMStudio', 'LMStudio.LMStudio', 'lmstudio'];
  let installed = false;
  for (const id of candidateIds) {
    try {
      await execa(
        'winget',
        [
          'install',
          '--id',
          id,
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
        ],
        { stdio: 'inherit' },
      );
      installed = true;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!installed) {
    printWarn('Could not install LM Studio via winget.');
    console.log('  Download LM Studio manually: https://lmstudio.ai/');
    return;
  }

  printSuccess('LM Studio installed.');
  console.log('');
  console.log('Next: download a model inside LM Studio.');
  if (advice.preferredModel) {
    console.log(`Recommended for your hardware: ${advice.preferredModel}`);
  }
  console.log('');
  console.log('Steps:');
  console.log('  1. Open LM Studio');
  console.log('  2. Go to the Search tab');
  console.log(
    `  3. Search: ${advice.preferredModel ?? 'Qwen3-Coder-30B-A3B-Instruct-GGUF'}`,
  );
  console.log('  4. Download the Q4_K_M variant');
  console.log('  5. Go to Local Server → Load model → Start server');
  console.log('');

  await waitForUserReady();
}

async function installOpencodeIfMissing(scan: ScanResult): Promise<void> {
  if (scan.opencode.status === 'ok') return;

  printSection('opencode');
  console.log('opencode is not installed.');
  console.log('');

  if (!(await ask('Install opencode globally via npm?'))) {
    printWarn('Skipping opencode install. local-ai cannot continue without it.');
    return;
  }

  try {
    await execa('npm', ['install', '-g', 'opencode'], { stdio: 'inherit' });
    printSuccess('opencode installed.');
    console.log(
      '  Note: you may need to restart your terminal for the `opencode` command to be on PATH.',
    );
  } catch {
    printError('opencode install failed. Try manually: npm install -g opencode');
  }
}

export async function installMissingTools(
  scan: ScanResult,
  advice: Advice,
): Promise<void> {
  await installGitIfMissing(scan);
  await installLMStudioIfMissing(scan, advice);
  await installOpencodeIfMissing(scan);
}

// ===========================================================================
// Re-verification — LM Studio may have just had a model loaded
// ===========================================================================

async function reVerifyLMStudio(scan: ScanResult): Promise<ScanResult> {
  const lm = await checkLMStudio(scan.hardware);
  return {
    ...scan,
    lmstudio: lm.server,
    models: lm.models,
  };
}

// ===========================================================================
// Shared steps: opencode config write + state save
// ===========================================================================

async function ensureOpencodeConfig(scan: ScanResult, model: string): Promise<void> {
  if (scan.opencodeConfig.status === 'ok') {
    printSuccess('opencode config already in place.');
    return;
  }

  if (!(await ask('Create opencode config pointing to your local model?'))) {
    printWarn('Skipping opencode config. You will need to configure it manually.');
    return;
  }

  const result = await writeOpencodeConfig(model);
  if (result.written) {
    printSuccess(`opencode config written to ${OPENCODE_CONFIG_FILE}`);
    if (result.backedUp && result.backupPath) {
      printInfo(`Previous config backed up to: ${result.backupPath}`);
    }
  }
}

async function saveStateIfApproved(
  target: WorkflowTarget,
  model: string,
  profile: string,
): Promise<void> {
  if (!(await ask('Save setup state for future runs?'))) {
    printWarn('Skipping state save. Setup will be re-checked next time.');
    return;
  }
  await writeState({
    version: VERSION,
    profile,
    workflow: target,
    setupComplete: true,
    provider: 'lmstudio',
    serverUrl: LMSTUDIO_BASE_URL,
    model,
    configPath: OPENCODE_CONFIG_FILE,
    lastVerified: new Date().toISOString(),
  });
  printSuccess('Setup state saved.');
}

// ===========================================================================
// Terminal flow — Task 7.3
// ===========================================================================

async function runTerminalSetup(
  scan: ScanResult,
  model: string,
  profile: string,
): Promise<boolean> {
  printSection('Terminal workflow');

  if (!(await checkOpencodeInstalled())) {
    printError('opencode is not installed. Cannot proceed with terminal workflow.');
    return false;
  }
  if (scan.lmstudio.status !== 'ok') {
    printError('LM Studio is not reachable. Start the LM Studio server and try again.');
    return false;
  }
  if (scan.models.status !== 'ok') {
    printError('No models loaded in LM Studio. Load a model and try again.');
    return false;
  }

  await ensureOpencodeConfig(scan, model);
  await saveStateIfApproved('terminal', model, profile);

  console.log('');
  console.log('Terminal workflow ready.');
  console.log('');
  console.log('Next command:');
  console.log('  opencode');
  console.log('');
  console.log('Developed by Brijesh B');
  console.log('');

  if (await ask('Open opencode in a new terminal window now?')) {
    await launchOpencode(process.cwd());
  }
  return true;
}

// ===========================================================================
// VS Code flow — Task 7.4
// ===========================================================================

async function runVSCodeSetup(
  scan: ScanResult,
  model: string,
  profile: string,
): Promise<boolean> {
  printSection('VS Code workflow');

  if (scan.vscode.status === 'missing') {
    printWarn("VS Code 'code' command not found.");
    console.log(
      "  Open VS Code → Command Palette → Shell Command: Install 'code' command in PATH",
    );
    console.log("  Continuing — opencode can still be used inside VS Code's terminal.");
  }
  if (!(await checkOpencodeInstalled())) {
    printError('opencode is not installed. Cannot proceed.');
    return false;
  }
  if (scan.lmstudio.status !== 'ok' || scan.models.status !== 'ok') {
    printError('LM Studio + a loaded model are required. Start the server and load a model.');
    return false;
  }

  await ensureOpencodeConfig(scan, model);
  await saveStateIfApproved('vscode', model, profile);

  printVSCodeCard(model);

  if (scan.vscode.status === 'ok' && (await ask('Open VS Code in this folder now?'))) {
    await launchVSCode(process.cwd());
  }
  return true;
}

// ===========================================================================
// Both flow — Task 7.5 (terminal + VS Code; shared config write)
// ===========================================================================

async function runBothSetup(
  scan: ScanResult,
  model: string,
  profile: string,
): Promise<boolean> {
  printSection('Terminal + VS Code workflow');

  if (!(await checkOpencodeInstalled())) {
    printError('opencode is not installed. Cannot proceed.');
    return false;
  }
  if (scan.lmstudio.status !== 'ok' || scan.models.status !== 'ok') {
    printError('LM Studio + a loaded model are required. Start the server and load a model.');
    return false;
  }

  // Config + state happen once for the combined flow.
  await ensureOpencodeConfig(scan, model);
  await saveStateIfApproved('both', model, profile);

  // Terminal launch step
  if (await ask('Open opencode in a new terminal window now?')) {
    await launchOpencode(process.cwd());
  }

  // VS Code next steps
  printVSCodeCard(model);
  if (scan.vscode.status === 'ok' && (await ask('Open VS Code in this folder now?'))) {
    await launchVSCode(process.cwd());
  }
  return true;
}

// ===========================================================================
// runSetupWorkflow — Section 7 main entry
// ===========================================================================

export async function runSetupWorkflow(
  target: WorkflowTarget,
  scan: ScanResult,
  advice: Advice,
): Promise<void> {
  // Phase 1 — install any missing base tools (Git, LM Studio, opencode).
  await installMissingTools(scan, advice);

  // Phase 2 — re-scan LM Studio: the user may have just loaded a model.
  const refreshedScan = await reVerifyLMStudio(scan);

  // Phase 3 — resolve a model to wire opencode to.
  let model = refreshedScan.models.selectedModel ?? advice.preferredModel;
  if (!model) {
    const available =
      refreshedScan.models.compatibleModelIds ?? refreshedScan.models.modelIds ?? [];
    if (available.length === 0) {
      printWarn(
        'No models are available in LM Studio. Load a model and run: local-ai setup',
      );
      return;
    }
    model = await choose('Which model should opencode use?', available);
  }

  // Phase 4 — dispatch by workflow target.
  switch (target) {
    case 'terminal':
      await runTerminalSetup(refreshedScan, model, PROFILE_DEFAULT);
      break;
    case 'vscode':
      await runVSCodeSetup(refreshedScan, model, PROFILE_DEFAULT);
      break;
    case 'both':
      await runBothSetup(refreshedScan, model, PROFILE_DEFAULT);
      break;
  }
}
