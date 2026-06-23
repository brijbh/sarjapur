import { type Command } from 'commander';
import { select } from '@inquirer/prompts';
import chalk from 'chalk';

import { readState } from '../core/state.js';
import { getHardwareCapabilities } from '../core/envcheck.js';
import { checkLMStudio } from '../providers/lmstudio.js';
import {
  checkOpencodeInstalled,
} from '../integrations/opencode.js';
import { checkOpencodeConfig } from '../core/scanner.js';
import { runSetupWorkflow, type WorkflowTarget } from '../core/workflow.js';
import {
  printSuccess,
  printError,
  printInfo,
} from '../utils/format.js';

export function register(program: Command): void {
  program
    .command('setup')
    .description('Guided setup: scan hardware, install tools, configure opencode')
    .action(async () => {
      await runSetup();
    });
}

// ---------------------------------------------------------------------------
// Quick readiness check — used to short-circuit when everything is wired up.
// ---------------------------------------------------------------------------

interface Readiness {
  ready: boolean;
  modelName?: string;
  reason?: string;
}

async function quickReadinessCheck(): Promise<Readiness> {
  const state = await readState();
  if (!state) return { ready: false, reason: 'no saved setup' };

  const hardware = await getHardwareCapabilities();
  const lm = await checkLMStudio(hardware);
  if (lm.server.status !== 'ok') {
    return { ready: false, reason: 'LM Studio is not reachable' };
  }

  const modelLoaded = (lm.models.modelIds ?? []).includes(state.model);
  if (!modelLoaded) {
    return { ready: false, reason: `saved model "${state.model}" is not loaded` };
  }

  const cfg = await checkOpencodeConfig();
  if (cfg.status !== 'ok') {
    return { ready: false, reason: 'opencode config is missing or invalid' };
  }

  if (!(await checkOpencodeInstalled())) {
    return { ready: false, reason: 'opencode is not installed' };
  }

  return { ready: true, modelName: state.model };
}

// ---------------------------------------------------------------------------
// runSetup — action-first
// ---------------------------------------------------------------------------

export async function runSetup(): Promise<void> {
  console.log('');
  console.log(chalk.bold.cyan('local-ai') + chalk.dim('  —  local AI without API keys'));
  console.log('');

  // Step 1 — already set up? short-circuit in 2 lines.
  const ready = await quickReadinessCheck();
  if (ready.ready && ready.modelName) {
    printSuccess(`Local AI is ready (${chalk.green(ready.modelName)} via LM Studio).`);
    console.log(`${chalk.dim('Next command:')} ${chalk.cyan('opencode')}`);
    process.exit(0);
  }

  // Step 2 — one-line hardware confirmation, then the workflow question.
  console.log('Setting up local AI on this Windows machine…');
  const hardware = await getHardwareCapabilities();
  const ramStr = `${hardware.ram.totalGB} GB RAM`;
  const gpuStr = hardware.gpu.detected
    ? `${hardware.gpu.name ?? 'GPU'}${hardware.gpu.vramGB ? ` (${hardware.gpu.vramGB} GB VRAM)` : ''}`
    : 'no GPU';
  console.log(`${chalk.green('✓')} Hardware: ${ramStr}, ${gpuStr}`);
  console.log('');

  // Step 3 — workflow target (richer prompt than the generic choose()).
  let target: WorkflowTarget;
  try {
    target = await select<WorkflowTarget>({
      message: 'Where do you want to use it?',
      choices: [
        {
          name: `${chalk.bold('Terminal')}     ${chalk.dim('— chat with opencode in a terminal window')}`,
          value: 'terminal',
        },
        {
          name: `${chalk.bold('VS Code')}      ${chalk.dim("— chat inside VS Code's integrated terminal")}`,
          value: 'vscode',
        },
        {
          name: `${chalk.bold('Both')}         ${chalk.dim('— configure for both terminal and VS Code')}`,
          value: 'both',
        },
      ],
      default: 'terminal',
    });
  } catch {
    console.log('\nCancelled.');
    setImmediate(() => process.exit(0));
    return;
  }

  // Step 4 — hand off to the workflow orchestrator.
  await runSetupWorkflow(target, hardware);
}

// Re-export so workflow.ts can call back into the not-ready path if needed.
export { quickReadinessCheck };

// Keep imports linted if we strip prints later.
void printError;
void printInfo;
