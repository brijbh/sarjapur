import { type Command } from 'commander';
import { readState } from '../core/state.js';
import { checkLMStudio } from '../providers/lmstudio.js';
import { getHardwareCapabilities } from '../core/envcheck.js';
import { checkOpencodeConfig } from '../core/scanner.js';
import { writeState } from '../core/state.js';
import {
  printHeader,
  printSection,
  printSuccess,
  printError,
  printInfo,
  printCheckResult,
} from '../utils/format.js';
import chalk from 'chalk';

export function register(program: Command): void {
  program
    .command('status')
    .description('Show current setup state and verify live connection to LM Studio')
    .action(async () => {
      await runStatus();
    });
}

// ---------------------------------------------------------------------------
// runStatus — Task 6.2
// ---------------------------------------------------------------------------

export async function runStatus(): Promise<void> {
  printHeader('Developed by Brijesh B');

  // Step 1 — read state file
  const state = await readState();
  if (!state) {
    printError('No setup found.');
    printInfo('Run: local-ai setup');
    process.exit(1);
  }

  // Step 2 — print saved state
  printSection('Saved Setup');
  console.log(`  ${chalk.dim('Profile:')}   ${chalk.white(state.profile)}`);
  console.log(`  ${chalk.dim('Workflow:')}  ${chalk.white(state.workflow)}`);
  console.log(`  ${chalk.dim('Provider:')}  ${chalk.white(state.provider)}`);
  console.log(`  ${chalk.dim('Server:')}    ${chalk.cyan(state.serverUrl)}`);
  console.log(`  ${chalk.dim('Model:')}     ${chalk.green(state.model)}`);
  console.log(`  ${chalk.dim('Config:')}    ${chalk.gray(state.configPath)}`);
  console.log(`  ${chalk.dim('Last verified:')} ${chalk.gray(state.lastVerified)}`);

  // Step 3 — live verification
  printSection('Live Verification');
  console.log('  Checking...');

  const hardware = await getHardwareCapabilities();
  const lmCheck = await checkLMStudio(hardware);
  const configCheck = await checkOpencodeConfig();

  let allOk = true;

  // LM Studio server
  printCheckResult(lmCheck.server);
  if (lmCheck.server.status !== 'ok') allOk = false;

  // Model availability
  const modelIds = lmCheck.models.modelIds ?? [];
  const modelAvailable = modelIds.includes(state.model);
  if (modelAvailable) {
    printCheckResult({
      label: `Model: ${state.model}`,
      status: 'ok',
      value: 'available in LM Studio',
    });
  } else if (lmCheck.server.status === 'ok') {
    printCheckResult({
      label: `Model: ${state.model}`,
      status: 'missing',
      detail: 'Model from saved state is not loaded in LM Studio.',
    });
    allOk = false;
  }

  // opencode config
  printCheckResult(configCheck);
  if (configCheck.status !== 'ok') allOk = false;

  console.log('');

  // Step 4/5 — result
  if (allOk) {
    // Update lastVerified timestamp
    try {
      await writeState({ ...state, lastVerified: new Date().toISOString() });
    } catch {
      // non-fatal — state update failure doesn't block the user
    }

    printSuccess('Local AI is ready.');
    console.log('');
    console.log(chalk.bold('Next command:'));
    console.log(chalk.cyan('opencode'));
    console.log('');
    process.exit(0);
  } else {
    printError('Some checks failed.');
    printInfo('Run: local-ai repair');
    process.exit(1);
  }
}
