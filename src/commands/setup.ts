import { type Command } from 'commander';
import chalk from 'chalk';

import { runScan } from '../core/scanner.js';
import { buildAdvice } from '../core/advisor.js';
import {
  printHeader,
  printHardwareSummary,
  printCheckResult,
  printSection,
  printInfo,
  printSuccess,
} from '../utils/format.js';
import { choose } from '../core/permissions.js';
import { runSetupWorkflow, type WorkflowTarget } from '../core/workflow.js';

export function register(program: Command): void {
  program
    .command('setup')
    .description('Guided setup: scan hardware, install tools, configure opencode')
    .action(async () => {
      await runSetup();
    });
}

// ---------------------------------------------------------------------------
// runSetup — Task 7.1
// ---------------------------------------------------------------------------

export async function runSetup(): Promise<void> {
  printHeader('Setup');
  console.log('Setting up local AI...');

  const scan = await runScan();
  const advice = buildAdvice(scan);

  // Hardware + check summary
  printHardwareSummary(scan.hardware);

  printSection('System');
  printCheckResult(scan.os);
  printCheckResult(scan.arch);
  printCheckResult(scan.node);
  printCheckResult(scan.npm);
  printCheckResult(scan.git);
  printCheckResult(scan.winget);

  printSection('Local AI Runtime');
  printCheckResult(scan.lmstudio);
  printCheckResult(scan.models);

  printSection('Coding Tools');
  printCheckResult(scan.opencode);
  printCheckResult(scan.vscode);

  printSection('Saved Setup');
  printCheckResult(scan.state);
  printCheckResult(scan.opencodeConfig);

  // Already set up? Don't repeat.
  if (advice.isSetupComplete) {
    console.log('');
    printSuccess('Local AI is ready. Setup already complete.');
    console.log('');
    console.log('Next command:');
    console.log('  opencode');
    process.exit(0);
  }

  // Compatible models / recommendation
  if (advice.compatibleModels.length > 0) {
    printSection('Compatible Models');
    for (const id of advice.compatibleModels) {
      const tag = id === advice.preferredModel ? chalk.dim('  ← recommended') : '';
      console.log(`  ${chalk.cyan('-')} ${id}${tag}`);
    }
  }
  if (advice.preferredModel) {
    console.log('');
    printInfo(`Recommended model for your hardware: ${advice.preferredModel}`);
  }

  // Ask workflow target
  console.log('');
  const target = await choose<WorkflowTarget>(
    'Where do you want to use local AI?',
    ['terminal', 'vscode', 'both'],
  );

  await runSetupWorkflow(target, scan, advice);
}
