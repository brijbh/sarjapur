import { type Command } from 'commander';

export function register(program: Command): void {
  program
    .command('doctor')
    .description('Check system readiness and show hardware + tool status')
    .action(async () => {
      await runDoctor();
    });
}

// Stub — fully implemented in Section 6
export async function runDoctor(): Promise<void> {
  console.log('doctor [not yet implemented]');
}
