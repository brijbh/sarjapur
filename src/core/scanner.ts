import os from 'node:os';
import { promises as fs } from 'node:fs';

import { getHardwareCapabilities, type HardwareCapabilities } from './envcheck.js';
import { runCommand } from '../utils/command.js';
import { STATE_FILE, OPENCODE_CONFIG_FILE } from './paths.js';
import { checkLMStudio } from '../providers/lmstudio.js';

export type CheckStatus = 'ok' | 'warn' | 'missing' | 'error';

export interface CheckResult {
  label: string;
  status: CheckStatus;
  value?: string;
  detail?: string;
}

export interface ModelCheckResult extends CheckResult {
  modelIds?: string[];
  compatibleModelIds?: string[];
  selectedModel?: string;
}

export interface ScanResult {
  hardware: HardwareCapabilities;
  os: CheckResult;
  arch: CheckResult;
  node: CheckResult;
  npm: CheckResult;
  git: CheckResult;
  winget: CheckResult;
  opencode: CheckResult;
  vscode: CheckResult;
  lmstudio: CheckResult;
  models: ModelCheckResult;
  state: CheckResult;
  opencodeConfig: CheckResult;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10));
  const pb = b.split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function extractVersion(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d+\.\d+\.\d+)/);
  return m?.[1];
}

export async function checkOS(): Promise<CheckResult> {
  const plat = os.platform();
  if (plat !== 'win32') {
    return {
      label: 'Operating System',
      status: 'warn',
      value: plat,
      detail: 'v0.1 supports Windows only.',
    };
  }
  return {
    label: 'Operating System',
    status: 'ok',
    value: `${plat} (${os.release()})`,
  };
}

export async function checkArch(): Promise<CheckResult> {
  return { label: 'Architecture', status: 'ok', value: os.arch() };
}

export async function checkNode(): Promise<CheckResult> {
  const v = process.version.replace(/^v/, '');
  if (compareSemver(v, '18.0.0') < 0) {
    return {
      label: 'Node.js',
      status: 'warn',
      value: v,
      detail: 'Node 18.0.0 or newer is required.',
    };
  }
  return { label: 'Node.js', status: 'ok', value: v };
}

export async function checkNpm(): Promise<CheckResult> {
  const out = await runCommand('npm', ['--version']);
  if (out === null) {
    return { label: 'npm', status: 'missing', detail: 'npm not found.' };
  }
  const v = out.trim();
  if (compareSemver(v, '9.0.0') < 0) {
    return {
      label: 'npm',
      status: 'warn',
      value: v,
      detail: 'npm 9.0.0 or newer is required.',
    };
  }
  return { label: 'npm', status: 'ok', value: v };
}

export async function checkGit(): Promise<CheckResult> {
  const out = await runCommand('git', ['--version']);
  if (out === null) {
    return {
      label: 'Git',
      status: 'missing',
      detail: 'Git is required. local-ai can install it via winget.',
    };
  }
  return { label: 'Git', status: 'ok', value: extractVersion(out) ?? out.trim() };
}

export async function checkWinget(): Promise<CheckResult> {
  const out = await runCommand('winget', ['--version']);
  if (out === null) {
    return {
      label: 'winget',
      status: 'warn',
      detail: 'winget not found. Some installations will require manual download.',
    };
  }
  return { label: 'winget', status: 'ok', value: out.trim() };
}

export async function checkOpencode(): Promise<CheckResult> {
  const out = await runCommand('opencode', ['--version']);
  if (out === null) return { label: 'opencode', status: 'missing' };
  return { label: 'opencode', status: 'ok', value: extractVersion(out) ?? out.trim() };
}

export async function checkVSCode(): Promise<CheckResult> {
  const out = await runCommand('code', ['--version']);
  if (out === null) {
    return {
      label: 'VS Code',
      status: 'missing',
      detail:
        "Open VS Code → Command Palette → Shell Command: Install 'code' command in PATH",
    };
  }
  return { label: 'VS Code', status: 'ok', value: extractVersion(out) ?? out.trim() };
}

export async function checkStateFile(): Promise<CheckResult> {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    try {
      JSON.parse(raw);
      return { label: 'Saved Setup', status: 'ok', value: STATE_FILE };
    } catch {
      return {
        label: 'Saved Setup',
        status: 'warn',
        detail: 'State file exists but is not valid JSON.',
      };
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') return { label: 'Saved Setup', status: 'missing' };
    return {
      label: 'Saved Setup',
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkOpencodeConfig(): Promise<CheckResult> {
  try {
    const raw = await fs.readFile(OPENCODE_CONFIG_FILE, 'utf8');
    try {
      JSON.parse(raw);
      return { label: 'opencode config', status: 'ok', value: OPENCODE_CONFIG_FILE };
    } catch {
      return {
        label: 'opencode config',
        status: 'warn',
        detail: 'opencode config exists but is not valid JSON.',
      };
    }
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') return { label: 'opencode config', status: 'missing' };
    return {
      label: 'opencode config',
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function runScan(): Promise<ScanResult> {
  const hardware = await getHardwareCapabilities();

  const [
    osR,
    archR,
    nodeR,
    npmR,
    gitR,
    wingetR,
    opencodeR,
    vscodeR,
    stateR,
    opencodeCfgR,
    lmCheck,
  ] = await Promise.all([
    checkOS(),
    checkArch(),
    checkNode(),
    checkNpm(),
    checkGit(),
    checkWinget(),
    checkOpencode(),
    checkVSCode(),
    checkStateFile(),
    checkOpencodeConfig(),
    checkLMStudio(hardware),
  ]);

  return {
    hardware,
    os: osR,
    arch: archR,
    node: nodeR,
    npm: npmR,
    git: gitR,
    winget: wingetR,
    opencode: opencodeR,
    vscode: vscodeR,
    lmstudio: lmCheck.server,
    models: lmCheck.models,
    state: stateR,
    opencodeConfig: opencodeCfgR,
  };
}
