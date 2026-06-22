import { promises as fs } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// fileExists
// ---------------------------------------------------------------------------

export async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// readJsonFile / writeJsonFile
// ---------------------------------------------------------------------------

export async function readJsonFile<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile(p: string, data: unknown): Promise<void> {
  const dir = path.dirname(p);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// backupFile
// ---------------------------------------------------------------------------

export async function backupFile(p: string): Promise<string> {
  const exists = await fileExists(p);
  if (!exists) {
    throw new Error(`Cannot back up: file not found: ${p}`);
  }

  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join('') + '-' + pad(now.getHours()) + pad(now.getMinutes());

  const backupPath = `${p}.backup-${stamp}`;
  await fs.copyFile(p, backupPath);
  return backupPath;
}

// ---------------------------------------------------------------------------
// getFolderSize  (recursive byte count)
// ---------------------------------------------------------------------------

export async function getFolderSize(p: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(p, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(p, entry.name);
      if (entry.isDirectory()) {
        total += await getFolderSize(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(full);
          total += stat.size;
        } catch {
          // skip unreadable files
        }
      }
    }
  } catch {
    // skip unreadable directories
  }
  return total;
}
