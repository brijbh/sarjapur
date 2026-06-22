import { execa } from 'execa';

const DEFAULT_TIMEOUT_MS = 5000;

export async function runCommand(cmd: string, args: string[]): Promise<string | null> {
  try {
    const result = await execa(cmd, args, { timeout: DEFAULT_TIMEOUT_MS });
    return result.stdout ?? '';
  } catch {
    return null;
  }
}

export async function commandExists(cmd: string): Promise<boolean> {
  const out = await runCommand(cmd, ['--version']);
  return out !== null;
}
