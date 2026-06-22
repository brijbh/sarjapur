import { spawn } from 'node:child_process';
import { OPENCODE_CONFIG_FILE } from '../core/paths.js';
import {
  fileExists,
  readJsonFile,
  writeJsonFile,
  backupFile,
} from '../utils/files.js';
import { ask } from '../core/permissions.js';
import { runCommand } from '../utils/command.js';

// ---------------------------------------------------------------------------
// generateOpencodeConfig — Task 8.1
// ---------------------------------------------------------------------------

// Title-case rule from Appendix B: capitalize first letter of each
// hyphen-separated segment AND any letter immediately following a digit
// (so "30b" → "30B", "a3b" → "A3B", "instruct" → "Instruct").
function titleCaseSegment(segment: string): string {
  if (segment.length === 0) return segment;
  let out = segment.charAt(0).toUpperCase();
  for (let i = 1; i < segment.length; i++) {
    const prev = segment[i - 1] ?? '';
    const ch = segment[i] ?? '';
    if (/[0-9]/.test(prev) && /[a-z]/.test(ch)) {
      out += ch.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}

function deriveHumanName(modelId: string): string {
  return modelId
    .split('-')
    .filter((part) => part.length > 0)
    .map(titleCaseSegment)
    .join(' ');
}

export function generateOpencodeConfig(modelId: string): Record<string, unknown> {
  const humanName = deriveHumanName(modelId);
  return {
    $schema: 'https://opencode.ai/config.json',
    provider: {
      lmstudio: {
        npm: '@ai-sdk/openai-compatible',
        name: 'LM Studio (local)',
        options: {
          baseURL: 'http://127.0.0.1:1234/v1',
        },
        models: {
          [modelId]: {
            name: `${humanName} (local)`,
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// mergeOpencodeConfig — Task 8.2
//   - Touch only provider.lmstudio
//   - Leave other top-level keys and other providers untouched
//   - Deep-merge provider.lmstudio.models (existing wins on conflict)
//   - Do not change $schema if it already exists
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mergeOpencodeConfig(
  existing: Record<string, unknown>,
  generated: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...existing };

  // Preserve existing $schema; only set it if missing.
  if (!('$schema' in merged) && '$schema' in generated) {
    merged.$schema = generated.$schema;
  }

  const existingProvider = isPlainObject(merged.provider) ? { ...merged.provider } : {};
  const generatedProvider = isPlainObject(generated.provider) ? generated.provider : {};
  const generatedLM = isPlainObject(generatedProvider.lmstudio)
    ? generatedProvider.lmstudio
    : {};
  const existingLM = isPlainObject(existingProvider.lmstudio)
    ? { ...existingProvider.lmstudio }
    : {};

  // Base on generated lmstudio scaffold, then overlay any existing fields.
  const newLM: Record<string, unknown> = {
    ...generatedLM,
    ...existingLM,
  };

  // Merge models — existing keys win on conflict (do not remove existing).
  const existingModels = isPlainObject(existingLM.models) ? existingLM.models : {};
  const generatedModels = isPlainObject(generatedLM.models) ? generatedLM.models : {};
  newLM.models = { ...generatedModels, ...existingModels };

  existingProvider.lmstudio = newLM;
  merged.provider = existingProvider;
  return merged;
}

// ---------------------------------------------------------------------------
// writeOpencodeConfig — Task 8.3
// ---------------------------------------------------------------------------

export interface WriteConfigResult {
  backedUp: boolean;
  backupPath: string | null;
  written: boolean;
}

export async function writeOpencodeConfig(modelId: string): Promise<WriteConfigResult> {
  const generated = generateOpencodeConfig(modelId);
  const exists = await fileExists(OPENCODE_CONFIG_FILE);

  if (exists) {
    const proceed = await ask('opencode config already exists. Back up and update it?');
    if (!proceed) {
      console.log('Would have written:');
      console.log(JSON.stringify(generated, null, 2));
      return { backedUp: false, backupPath: null, written: false };
    }
    const backupPath = await backupFile(OPENCODE_CONFIG_FILE);
    const existing =
      (await readJsonFile<Record<string, unknown>>(OPENCODE_CONFIG_FILE)) ?? {};
    const merged = mergeOpencodeConfig(existing, generated);
    await writeJsonFile(OPENCODE_CONFIG_FILE, merged);
    return { backedUp: true, backupPath, written: true };
  }

  // No existing config — write fresh.
  await writeJsonFile(OPENCODE_CONFIG_FILE, generated);
  return { backedUp: false, backupPath: null, written: true };
}

// ---------------------------------------------------------------------------
// Detection helpers — Task 8.4
// ---------------------------------------------------------------------------

export async function checkOpencodeInstalled(): Promise<boolean> {
  const out = await runCommand('opencode', ['--version']);
  return out !== null;
}

export interface OpencodeConfigCheck {
  exists: boolean;
  path: string;
  valid: boolean;
}

export async function checkOpencodeConfig(): Promise<OpencodeConfigCheck> {
  const exists = await fileExists(OPENCODE_CONFIG_FILE);
  if (!exists) return { exists: false, path: OPENCODE_CONFIG_FILE, valid: false };
  const parsed = await readJsonFile<unknown>(OPENCODE_CONFIG_FILE);
  return { exists: true, path: OPENCODE_CONFIG_FILE, valid: parsed !== null };
}

// ---------------------------------------------------------------------------
// launchOpencode — Task 8.5
//   Spawns a new terminal window running opencode in the given cwd.
//   On Windows: cmd /c start powershell -NoExit -Command "Set-Location <cwd>; opencode"
// ---------------------------------------------------------------------------

function printManualOpencodeFallback(cwd: string): void {
  console.log('');
  console.log('Could not launch opencode automatically.');
  console.log('To start manually:');
  console.log(`  cd ${cwd}`);
  console.log('  opencode');
}

export async function launchOpencode(cwd: string): Promise<void> {
  if (process.platform === 'win32') {
    try {
      const child = spawn(
        'cmd.exe',
        [
          '/c',
          'start',
          '',
          'powershell',
          '-NoExit',
          '-Command',
          `Set-Location '${cwd}'; opencode`,
        ],
        { detached: true, stdio: 'ignore' },
      );
      child.unref();
      return;
    } catch {
      printManualOpencodeFallback(cwd);
      return;
    }
  }

  // Non-Windows fallback (v0.1 targets Windows; this is a best-effort path).
  try {
    const child = spawn('opencode', [], {
      cwd,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    printManualOpencodeFallback(cwd);
  }
}
