#!/usr/bin/env node
import { Command } from 'commander';

const WELCOME_BANNER = `Welcome to local-ai

This tool helps you set up local AI chat and coding tools
without provider API keys.

Developed by Brijesh B`;

const program = new Command();

program
  .name('local-ai')
  .description('Set up local AI coding and chat tools without provider API keys. Developed by Brijesh B.')
  .version('0.1.0');

program.parse(process.argv);

if (process.argv.slice(2).length === 0) {
  console.log(WELCOME_BANNER);
}
