import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { STATE_DIR, STATE_FILE } from './paths.js';

// ---------------------------------------------------------------------------
// State schema — Task 4.2
// ---------------------------------------------------------------------------

export const StateSchema = z.object({
  version: z.string(),
  profile: z.string(),
  workflow: z.enum(['terminal', 'vscode', 'both']),
  setupComplete: z.boolean(),
  provider: z.string(),
  serverUrl: z.string(),
  model: z.string(),
  configPath: z.string(),
  lastVerified: z.string(), // ISO 8601
});

export type State = z.infer<typeof StateSchema>;

// ---------------------------------------------------------------------------
// readState
// ---------------------------------------------------------------------------

export async function readState(): Promise<State | null> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const result = StateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// writeState — atomic write via temp file → rename — Task 4.2
// ---------------------------------------------------------------------------

export async function writeState(state: State): Promise<void> {
  await fs.mkdir(STATE_DIR, { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  await fs.rename(tmp, STATE_FILE);
}

// ---------------------------------------------------------------------------
// clearState — deletes state file only — Task 4.2
// ---------------------------------------------------------------------------

export async function clearState(): Promise<void> {
  try {
    await fs.unlink(STATE_FILE);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') throw err; // ignore missing file
  }
}
