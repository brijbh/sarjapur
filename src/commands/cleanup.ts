import { promises as fs } from 'node:fs';
import path from 'node:path';
import { type Command } from 'commander';

import { LMSTUDIO_MODEL_DIRS } from '../core/paths.js';
import { fileExists, getFolderSize } from '../utils/files.js';
import {
  printHeader,
  printInfo,
  printWarn,
} from '../utils/format.js';

export function register(program: Command): void {
  program
    .command('cleanup')
    .description('List large LM Studio model files on disk')
    .option('--delete', 'Model deletion (not available in v0.1)')
    .action(async (opts: { delete?: boolean }) => {
      await runCleanup(opts);
    });
}

// ---------------------------------------------------------------------------
// runCleanup — Task 10.1 (list mode), Task 10.2 (--delete stub)
// ---------------------------------------------------------------------------

interface ModelEntry {
  name: string;
  path: string;
  bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export async function runCleanup(opts: { delete?: boolean }): Promise<void> {
  printHeader('Cleanup');

  // Task 10.2 — --delete is a stub in v0.1
  if (opts.delete) {
    console.log('Model deletion is not available in v0.1.');
    console.log('To remove models: use LM Studio → My Models → Delete.');
    process.exit(0);
  }

  console.log('Scanning for large LM Studio model files...');
  console.log('');

  // Gather entries from every known LM Studio model directory.
  const entries: ModelEntry[] = [];
  let foundAnyDir = false;

  for (const dir of LMSTUDIO_MODEL_DIRS) {
    if (!(await fileExists(dir))) continue;
    foundAnyDir = true;
    let children: string[];
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true });
      children = dirents
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue;
    }
    for (const name of children) {
      const sub = path.join(dir, name);
      const bytes = await getFolderSize(sub);
      if (bytes > 0) {
        entries.push({ name, path: sub, bytes });
      }
    }
  }

  if (!foundAnyDir) {
    printWarn('No LM Studio model directories found.');
    console.log('');
    console.log('LM Studio stores models in one of these locations:');
    for (const dir of LMSTUDIO_MODEL_DIRS) {
      console.log(`  - ${dir}`);
    }
    console.log('');
    console.log('If LM Studio is installed but using a custom path, open it and check:');
    console.log('  Settings → Model Directory');
    process.exit(0);
  }

  if (entries.length === 0) {
    printInfo('No model files found in LM Studio directories.');
    process.exit(0);
  }

  entries.sort((a, b) => b.bytes - a.bytes);

  console.log('Large LM Studio model files found:');
  console.log('');

  const indexWidth = String(entries.length).length;
  const nameWidth = Math.min(
    40,
    Math.max(...entries.map((e) => e.name.length)),
  );
  const sizeWidth = Math.max(
    ...entries.map((e) => formatBytes(e.bytes).length),
    8,
  );

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e) continue;
    const idx = String(i + 1).padStart(indexWidth, ' ');
    const name = e.name.padEnd(nameWidth, ' ');
    const size = formatBytes(e.bytes).padStart(sizeWidth, ' ');
    console.log(`  ${idx}. ${name}   ${size}   ${e.path}`);
  }

  console.log('');
  console.log('To free up space, remove models from within LM Studio\'s model manager.');
  console.log('local-ai does not delete model files in v0.1.');
  process.exit(0);
}
