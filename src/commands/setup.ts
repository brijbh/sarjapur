import { type Command } from 'commander';

export function register(program: Command): void {
  program
    .command('setup')
    .description('Guided setup: scan hardware, install tools, configure opencode')
    .action(async () => {
      await runSetup();
    });
}

// Stub — fully implemented in Section 7
export async function runSetup(): Promise<void> {
  console.log('setup [not yet implemented]');
}
