import { spawn } from 'node:child_process';
import { runCommand } from '../utils/command.js';

export async function checkVSCodeInstalled(): Promise<boolean> {
  const out = await runCommand('code', ['--version']);
  return out !== null;
}

function printManualVSCodeFallback(cwd: string): void {
  console.log('');
  console.log('Could not launch VS Code automatically.');
  console.log('To start manually:');
  console.log(`  code ${cwd}`);
}

export async function launchVSCode(cwd: string): Promise<void> {
  try {
    // `code` on Windows is a .cmd; spawn through shell so PATH resolves it.
    const child = spawn('code', [cwd], {
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    child.unref();
  } catch {
    printManualVSCodeFallback(cwd);
  }
}
