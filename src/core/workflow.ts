import type { ScanResult } from './scanner.js';
import type { Advice } from './advisor.js';

// ---------------------------------------------------------------------------
// WorkflowTarget — Task 4.8
// ---------------------------------------------------------------------------

export type WorkflowTarget = 'terminal' | 'vscode' | 'both';

// ---------------------------------------------------------------------------
// runSetupWorkflow — stub, fully implemented in Section 7
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function runSetupWorkflow(
  target: WorkflowTarget,
  scan: ScanResult,
  advice: Advice,
): Promise<void> {
  // TODO: implement in Section 7
  console.log(`[workflow] target=${target} — not yet implemented`);
}
