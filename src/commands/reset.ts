import { type Command } from 'commander';

export function register(program: Command): void {
  program
    .command('reset')
    .description('Delete saved setup state (does not uninstall tools or remove config)')
    .action(async () => {
      await runReset();
    });
}

// Stub — fully implemented in Section 9
export async function runReset(): Promise<void> {
  console.log('reset [not yet implemented]');
}
