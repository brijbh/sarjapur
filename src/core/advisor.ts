import type { ScanResult } from './scanner.js';
import type { HardwareCapabilities } from './envcheck.js';

// ---------------------------------------------------------------------------
// Advice type — Task 4.1
// ---------------------------------------------------------------------------

export interface Advice {
  summary: import('./scanner.js').CheckResult[];
  recommendations: string[];
  hardwareSummary: string;           // e.g. "32 GB RAM, RTX 4070 — can run up to 30B models"
  preferredModel: string | null;
  compatibleModels: string[];        // all compatible model IDs
  preferredWorkflow: 'terminal' | 'vscode' | 'both' | null;
  isSetupComplete: boolean;
  missingTools: string[];            // tool names that are 'missing'
}

// ---------------------------------------------------------------------------
// hardwareSummary builder
// ---------------------------------------------------------------------------

function buildHardwareSummary(hw: HardwareCapabilities): string {
  const ram = `${hw.ram.totalGB} GB RAM`;
  const gpu = hw.gpu.detected
    ? `${hw.gpu.name ?? 'GPU'}${hw.gpu.vramGB !== undefined ? ` (${hw.gpu.vramGB} GB VRAM)` : ''}`
    : 'no GPU';
  const maxTier = hw.runnableModelTiers[hw.runnableModelTiers.length - 1] ?? '?';
  return `${ram}, ${gpu} — can run up to ${maxTier} models`;
}

// ---------------------------------------------------------------------------
// buildAdvice — Task 4.1
// ---------------------------------------------------------------------------

export function buildAdvice(scan: ScanResult): Advice {
  // Collect check results for the summary view
  const summary = [
    scan.os,
    scan.arch,
    scan.node,
    scan.npm,
    scan.git,
    scan.winget,
    scan.lmstudio,
    scan.models,
    scan.opencode,
    scan.vscode,
    scan.state,
    scan.opencodeConfig,
  ];

  // Missing tools list
  const missingTools: string[] = [];
  if (scan.git.status === 'missing') missingTools.push('git');
  if (scan.lmstudio.status === 'missing') missingTools.push('lmstudio');
  if (scan.opencode.status === 'missing') missingTools.push('opencode');

  // Compatible models from scan
  const compatibleModels = scan.models.compatibleModelIds ?? scan.models.modelIds ?? [];
  const preferredModel = scan.models.selectedModel ?? null;

  // Setup is complete only if all key checks pass
  const isSetupComplete =
    scan.state.status === 'ok' &&
    scan.opencodeConfig.status === 'ok' &&
    scan.lmstudio.status === 'ok' &&
    scan.models.status === 'ok';

  // Build ordered recommendations (most blocking first)
  const recommendations: string[] = [];

  if (scan.lmstudio.status === 'missing') {
    recommendations.push('Install LM Studio and start the local server.');
  }
  if (scan.models.status === 'missing') {
    recommendations.push(
      `Download a model in LM Studio. Recommended: ${preferredModel ?? 'Qwen3-Coder-30B-A3B-Instruct-GGUF (Q4_K_M)'}`,
    );
  }
  if (scan.git.status === 'missing') {
    recommendations.push('Install Git (required by opencode).');
  }
  if (scan.opencode.status === 'missing') {
    recommendations.push('Install opencode: npm install -g opencode');
  }
  if (scan.opencodeConfig.status !== 'ok') {
    recommendations.push('Create opencode config pointing to LM Studio.');
  }
  if (scan.vscode.status === 'missing') {
    recommendations.push(
      "VS Code 'code' command not found. Open VS Code → Command Palette → 'Shell Command: Install code command in PATH'",
    );
  }
  if (recommendations.length === 0 && !isSetupComplete) {
    recommendations.push('Run: local-ai setup');
  }
  if (recommendations.length === 0 && isSetupComplete) {
    recommendations.push('Setup complete. Run: opencode');
  }

  // Preferred workflow — infer from state if available, otherwise null
  const preferredWorkflow = null; // set after user chooses in setup

  return {
    summary,
    recommendations,
    hardwareSummary: buildHardwareSummary(scan.hardware),
    preferredModel,
    compatibleModels,
    preferredWorkflow,
    isSetupComplete,
    missingTools,
  };
}
