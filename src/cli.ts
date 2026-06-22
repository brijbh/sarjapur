#!/usr/bin/env node
import { Command } from 'commander';
import { register as registerDoctor } from './commands/doctor.js';
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
  .version('0.1.0');

// Register all subcommands
registerDoctor(program);
registerSetup(program);
registerStatus(program);
registerRepair(program);
registerReset(program);
registerCleanup(program);

program.parse(process.argv);

// Default: invoke setup when no subcommand given
if (process.argv.slice(2).length === 0) {
  const { runSetup } = await import('./commands/setup.js');
  await runSetup();
}
