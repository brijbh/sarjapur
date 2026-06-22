import { type Command } from 'commander';

export function register(program: Command): void {
  program
    .command('repair')
    .description('Re-verify saved setup and fix any broken components')
    .action(async () => {
      await runRepair();
    });
}

// Stub — fully implemented in Section 9
export async function runRepair(): Promise<void> {
  console.log('repair [not yet implemented]');
}
