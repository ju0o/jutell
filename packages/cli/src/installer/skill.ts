import { promises as fs } from 'node:fs';
import path from 'node:path';
import { exists, readText, writeTextSafely } from '../config/managed.js';
import type { ScopePaths } from '../types.js';

async function filesUnder(root: string, current = root): Promise<string[]> {
  if (!(await exists(current))) return [];
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const file = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(root, file));
    else files.push(path.relative(root, file));
  }
  return files;
}

export async function installSkill(source: string, destination: string) {
  const conflicts: string[] = [];
  const changed: string[] = [];
  for (const relative of await filesUnder(source)) {
    const sourceFile = path.join(source, relative);
    const targetFile = path.join(destination, relative);
    const sourceContent = await fs.readFile(sourceFile);
    let targetContent: Buffer | undefined;
    try { targetContent = await fs.readFile(targetFile); } catch { /* new file */ }
    if (targetContent && !targetContent.equals(sourceContent)) { conflicts.push(relative); continue; }
    if (!targetContent) {
      await fs.mkdir(path.dirname(targetFile), { recursive: true });
      await fs.copyFile(sourceFile, targetFile);
      changed.push(relative);
    }
  }
  return { conflicts, changed };
}

function manifestFile(paths: ScopePaths) {
  return path.join(paths.dataRoot, 'cli-install.json');
}

async function readManifest(paths: ScopePaths) {
  const raw = await readText(manifestFile(paths));
  if (!raw) return { skillFiles: [] as string[] };
  try {
    const value = JSON.parse(raw) as { skillFiles?: unknown };
    return { skillFiles: Array.isArray(value.skillFiles) ? value.skillFiles.filter((item): item is string => typeof item === 'string') : [] };
  } catch { return { skillFiles: [] as string[] }; }
}

export async function recordSkillFiles(paths: ScopePaths, relativeFiles: string[]) {
  if (relativeFiles.length === 0) return;
  const current = await readManifest(paths);
  await fs.mkdir(paths.dataRoot, { recursive: true });
  await writeTextSafely(manifestFile(paths), `${JSON.stringify({ skillFiles: [...new Set([...current.skillFiles, ...relativeFiles])] }, null, 2)}\n`);
}

export async function removeManagedSkillFiles(source: string, destination: string, paths: ScopePaths) {
  const manifest = await readManifest(paths);
  const removed: string[] = [];
  for (const relative of manifest.skillFiles) {
    const sourceFile = path.join(source, relative);
    const targetFile = path.join(destination, relative);
    try {
      const [sourceContent, targetContent] = await Promise.all([fs.readFile(sourceFile), fs.readFile(targetFile)]);
      if (!sourceContent.equals(targetContent)) continue;
      await fs.rm(targetFile, { force: true });
      removed.push(relative);
    } catch { /* already absent or user file differs */ }
  }
  for (const relative of [...manifest.skillFiles].reverse()) {
    const directory = path.dirname(path.join(destination, relative));
    try { if ((await fs.readdir(directory)).length === 0) await fs.rmdir(directory); } catch { /* keep non-empty directories */ }
  }
  if (removed.length > 0) await writeTextSafely(manifestFile(paths), `${JSON.stringify({ skillFiles: manifest.skillFiles.filter((item) => !removed.includes(item)) }, null, 2)}\n`);
  return removed;
}

export async function removeAddedSkillFiles(destination: string, relativeFiles: string[]) {
  for (const relative of relativeFiles) await fs.rm(path.join(destination, relative), { force: true });
}
