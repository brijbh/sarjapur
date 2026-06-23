#!/usr/bin/env node
import { Command } from 'commander';
import { register as registerDoctor } from './commands/doctor.js';
import { register as registerSetup, runSetup } from './commands/setup.js';
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
  // Bare `local-ai` IS the setup command — action-first.
  // If setup is already complete, it prints a 2-line "ready" message and exits 0.
  // For the full diagnostic with hardware tiers + 10-row catalog, use `local-ai doctor`.
  .action(async () => {
    await runSetup();
  });

// Register all subcommands
registerDoctor(program);
registerSetup(program);
registerStatus(program);
registerRepair(program);
registerReset(program);
registerCleanup(program);

await program.parseAsync(process.argv);
