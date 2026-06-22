import { type Command } from 'commander';

export function register(program: Command): void {
  program
    .command('cleanup')
    .description('List large LM Studio model files on disk')
    .option('--delete', 'Model deletion (not available in v0.1)')
    .action(async (opts: { delete?: boolean }) => {
      await runCleanup(opts);
    });
}

// Stub — fully implemented in Section 10
export async function runCleanup(_opts: { delete?: boolean }): Promise<void> {
  console.log('cleanup [not yet implemented]');
}
