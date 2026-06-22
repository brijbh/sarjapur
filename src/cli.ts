#!/usr/bin/env node
import { Command } from 'commander';
import { register as registerDoctor, runDoctor } from './commands/doctor.js';
import { register as registerSetup } from './commands/setup.js';
import { register as registerStatus } from './commands/status.js';
import { register as registerRepair } from './commands/repair.js';
import { register as registerReset } from './commands/reset.js';
import { register as registerCleanup } from './commands/cleanup.js';

const program = new Command();

program
  .name('local-ai')
  .description(
    'Set up local AI coding and chat tools without provider API keys. Developed by Brijesh B.',
  )
  .version('0.1.0')
  // Bare `local-ai` (no subcommand) runs the diagnostic scan — same as
  // `local-ai doctor`. Setup is opt-in via `local-ai setup`.
  .action(async () => {
    await runDoctor();
  });

// Register all subcommands
registerDoctor(program);
registerSetup(program);
registerStatus(program);
registerRepair(program);
registerReset(program);
registerCleanup(program);

await program.parseAsync(process.argv);
