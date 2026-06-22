import { type Command } from 'commander';

export function register(program: Command): void {
  program
    .command('status')
    .description('Show current setup state and verify live connection to LM Studio')
    .action(async () => {
      await runStatus();
    });
}

// Stub — fully implemented in Section 6
export async function runStatus(): Promise<void> {
  console.log('status [not yet implemented]');
}
