import os from 'node:os';
import path from 'node:path';

export const STATE_DIR = path.join(os.homedir(), '.local-ai');
export const STATE_FILE = path.join(STATE_DIR, 'state.json');

export const OPENCODE_CONFIG_DIR = path.join(os.homedir(), '.config', 'opencode');
export const OPENCODE_CONFIG_FILE = path.join(OPENCODE_CONFIG_DIR, 'opencode.json');

export const LMSTUDIO_BASE_URL = 'http://127.0.0.1:1234/v1';
export const LMSTUDIO_MODELS_ENDPOINT = `${LMSTUDIO_BASE_URL}/models`;

export const LMSTUDIO_MODEL_DIRS = [
  path.join(os.homedir(), '.lmstudio', 'models'),
  path.join(os.homedir(), '.lmstudio', 'hub', 'models'),
];
