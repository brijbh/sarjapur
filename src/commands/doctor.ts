import { type Command } from 'commander';
import { runScan } from '../core/scanner.js';
import { buildAdvice } from '../core/advisor.js';
import {
  printHeader,
  printSection,
  printCheckResult,
  printHardwareSummary,
  printCatalogRecommendations,
  printInfo,
  printSuccess,
} from '../utils/format.js';
import chalk from 'chalk';

export function register(program: Command): void {
  program
    .command('doctor')
    .description('Check system readiness and show hardware + tool status')
    .action(async () => {
      await runDoctor();
    });
}

// ---------------------------------------------------------------------------
// runDoctor — Task 6.1
// ---------------------------------------------------------------------------

export async function runDoctor(): Promise<void> {
  printHeader('Developed by Brijesh B');
  console.log('Checking your system...');

  const scan = await runScan();
  const advice = buildAdvice(scan);

  // Hardware summary
  printHardwareSummary(scan.hardware);

  // System checks
  printSection('System');
  printCheckResult(scan.os);
  printCheckResult(scan.arch);
  printCheckResult(scan.node);
  printCheckResult(scan.npm);
  printCheckResult(scan.git);
  printCheckResult(scan.winget);

  // Local AI runtime
  printSection('Local AI Runtime');
  printCheckResult(scan.lmstudio);

  if (scan.models.modelIds && scan.models.modelIds.length > 0) {
    const compatible = scan.models.compatibleModelIds ?? scan.models.modelIds;
    console.log(
      `  ${chalk.green('✓')} ${chalk.white('Models detected')} ${chalk.gray(
        `(${scan.models.modelIds.length} total, ${compatible.length} compatible with your hardware):`,
      )}`,
    );
    for (const id of compatible) {
      const tag = id === scan.models.selectedModel ? chalk.dim('  ← recommended') : '';
      console.log(`    ${chalk.cyan('-')} ${id}${tag}`);
    }
  } else {
    printCheckResult(scan.models);
  }

  // Coding tools
  printSection('Coding Tools');
  printCheckResult(scan.opencode);
  printCheckResult(scan.vscode);

  // llm-env-check catalog recommendations (what the user could install)
  printCatalogRecommendations(
    scan.hardware.catalogRecommendations,
    scan.hardware.catalogProfile,
  );

  // Saved setup
  printSection('Saved Setup');
  printCheckResult(scan.state);
  printCheckResult(scan.opencodeConfig);

  // Recommendations
  if (advice.recommendations.length > 0) {
    printSection('Recommendations');
    for (const rec of advice.recommendations) {
      printInfo(rec);
    }
  }

  console.log('');

  // Determine exit code — exit 1 if any check is warn or missing
  const allResults = [
    scan.os, scan.arch, scan.node, scan.npm, scan.git, scan.winget,
    scan.lmstudio, scan.models, scan.opencode, scan.vscode,
    scan.state, scan.opencodeConfig,
  ];
  const hasIssue = allResults.some(
    (r) => r.status === 'warn' || r.status === 'missing' || r.status === 'error',
  );

  if (!hasIssue) {
    printSuccess('All checks passed.');
    process.exit(0);
  } else {
    process.exit(1);
  }
}
