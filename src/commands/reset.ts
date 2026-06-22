import { type Command } from 'commander';

import { clearState } from '../core/state.js';
import { ask } from '../core/permissions.js';
import {
  printHeader,
  printInfo,
  printSuccess,
  printWarn,
} from '../utils/format.js';

export function register(program: Command): void {
  program
    .command('reset')
    .description('Delete saved setup state (does not uninstall tools or remove config)')
    .action(async () => {
      await runReset();
    });
}

// ---------------------------------------------------------------------------
// runReset — Task 9.2
// ---------------------------------------------------------------------------

export async function runReset(): Promise<void> {
  printHeader('Reset');

  console.log(
    'Reset will delete the local-ai state file. opencode config and installed tools are not affected.',
  );
  console.log('');

  if (!(await ask('Reset local-ai setup state?'))) {
    printWarn('Reset cancelled. State is unchanged.');
    process.exit(0);
  }

  await clearState();
  printSuccess('State cleared.');
  console.log('');
  printInfo('Run: local-ai setup to start fresh.');
  process.exit(0);
}
