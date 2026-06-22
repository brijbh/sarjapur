import { type Command } from 'commander';

import { readState, writeState } from '../core/state.js';
import { getHardwareCapabilities } from '../core/envcheck.js';
import { checkLMStudio } from '../providers/lmstudio.js';
import {
  checkOpencodeConfig,
  writeOpencodeConfig,
} from '../integrations/opencode.js';
import { ask } from '../core/permissions.js';
import {
  printHeader,
  printSection,
  printSuccess,
  printWarn,
  printError,
  printInfo,
} from '../utils/format.js';

export function register(program: Command): void {
  program
    .command('repair')
    .description('Re-verify saved setup and fix any broken components')
    .action(async () => {
      await runRepair();
    });
}

// ---------------------------------------------------------------------------
// runRepair — Task 9.1
// ---------------------------------------------------------------------------

export async function runRepair(): Promise<void> {
  printHeader('Repair');

  const state = await readState();
  if (!state) {
    printError('No saved setup found.');
    printInfo('Run: local-ai setup');
    process.exit(1);
  }

  printSection('Saved state');
  console.log(`  model:        ${state.model}`);
  console.log(`  workflow:     ${state.workflow}`);
  console.log(`  serverUrl:    ${state.serverUrl}`);
  console.log(`  configPath:   ${state.configPath}`);
  console.log(`  lastVerified: ${state.lastVerified}`);

  printSection('Live verification');

  // --- LM Studio + model availability ---------------------------------------
  const hardware = await getHardwareCapabilities();
  const lm = await checkLMStudio(hardware);

  if (lm.server.status !== 'ok') {
    printError('LM Studio server is not reachable.');
    printInfo('Open LM Studio and start the local server, then re-run: local-ai repair');
    process.exit(1);
  }
  printSuccess('LM Studio server reachable.');

  const availableIds = lm.models.modelIds ?? [];
  if (availableIds.length === 0) {
    printError('No models loaded in LM Studio.');
    printInfo('Load a model in LM Studio, then re-run: local-ai repair');
    process.exit(1);
  }

  let activeModel = state.model;
  if (!availableIds.includes(state.model)) {
    printWarn(`Saved model "${state.model}" is not loaded in LM Studio.`);
    console.log(`  Available models: ${availableIds.join(', ')}`);
    const replacement =
      lm.models.selectedModel ?? lm.models.compatibleModelIds?.[0] ?? availableIds[0];
    if (replacement && (await ask(`Update saved setup to use "${replacement}" instead?`))) {
      activeModel = replacement;
      printSuccess(`Will update saved setup + opencode config to use ${activeModel}.`);
    } else {
      printError('Cannot repair without a matching model. Load the saved model in LM Studio and retry.');
      process.exit(1);
    }
  } else {
    printSuccess(`Saved model "${state.model}" is loaded.`);
  }

  // --- opencode config ------------------------------------------------------
  const cfg = await checkOpencodeConfig();

  if (!cfg.exists) {
    printWarn('opencode config is missing.');
    if (await ask('Recreate opencode config pointing to your local model?')) {
      const result = await writeOpencodeConfig(activeModel);
      if (result.written) {
        printSuccess(`opencode config written to ${cfg.path}`);
        if (result.backedUp && result.backupPath) {
          printInfo(`Previous config backed up to: ${result.backupPath}`);
        }
      } else {
        printError('Repair aborted: opencode config not recreated.');
        process.exit(1);
      }
    } else {
      printError('Repair aborted: opencode config still missing.');
      process.exit(1);
    }
  } else if (!cfg.valid) {
    printWarn('opencode config exists but is not valid JSON.');
    if (await ask('Back up and rewrite the opencode config?')) {
      const result = await writeOpencodeConfig(activeModel);
      if (result.written) {
        printSuccess(`opencode config rewritten at ${cfg.path}`);
        if (result.backedUp && result.backupPath) {
          printInfo(`Previous config backed up to: ${result.backupPath}`);
        }
      }
    } else {
      printError('Repair aborted: invalid opencode config left in place.');
      process.exit(1);
    }
  } else if (activeModel !== state.model) {
    // Config is valid but the model changed during this repair — update it.
    if (await ask(`Update opencode config to point to ${activeModel}?`)) {
      const result = await writeOpencodeConfig(activeModel);
      if (result.written) {
        printSuccess(`opencode config updated for ${activeModel}.`);
        if (result.backedUp && result.backupPath) {
          printInfo(`Previous config backed up to: ${result.backupPath}`);
        }
      }
    }
  } else {
    printSuccess('opencode config present and valid.');
  }

  // --- Final re-verification + state update --------------------------------
  printSection('Final verification');

  const lm2 = await checkLMStudio(hardware);
  const cfg2 = await checkOpencodeConfig();
  const finalOk =
    lm2.server.status === 'ok' &&
    (lm2.models.modelIds ?? []).includes(activeModel) &&
    cfg2.exists &&
    cfg2.valid;

  if (!finalOk) {
    printError('Repair could not bring the setup to a verified state.');
    process.exit(1);
  }

  await writeState({
    ...state,
    model: activeModel,
    lastVerified: new Date().toISOString(),
  });

  printSuccess('Setup verified and state updated.');
  console.log('');
  console.log('Next command:');
  console.log('  opencode');
  process.exit(0);
}
