import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ScopePaths } from '../../types.js';
import { sessionRoot } from './storage.js';

// 운영자 로컬 설정 파일. 공개 Git에 포함되지 않으며(.gitignore),
// Review Bundle·check:public에서도 제외·탐지 대상이다.
export const OPERATOR_STORAGE_CONFIG_FILE = '.jutell-operator.local.json';

// 경로가 잘못되었을 때 사용자에게 보여주는 안내. 절대 경로를 포함하지 않는다.
export const OPERATOR_STORAGE_ERROR =
  '운영자 Session 저장 위치를 사용할 수 없습니다.\n' +
  '설정을 확인하거나 제거하면 기본 로컬 저장 위치를 사용할 수 있습니다.';

export type SessionStorageResolution = { kind: 'default' | 'custom'; root: string };

export function operatorStorageConfigFile(targetRoot: string) {
  return path.join(targetRoot, OPERATOR_STORAGE_CONFIG_FILE);
}

// 설정 파일을 읽고 sessionStoragePath를 돌려준다.
// - 파일이 없으면 undefined (기본 저장 사용)
// - JSON이 손상되었거나 형식이 틀리면 OPERATOR_STORAGE_ERROR를 던진다
// - sessionStoragePath가 없으면 undefined
// - sessionStoragePath가 있지만 올바른 절대 경로가 아니면 OPERATOR_STORAGE_ERROR를 던진다
//   (잘못된 경로를 기본 저장으로 조용히 대체하지 않는다)
export async function readOperatorStoragePath(targetRoot: string): Promise<string | undefined> {
  const file = operatorStorageConfigFile(targetRoot);
  let raw: string;
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(OPERATOR_STORAGE_ERROR);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(OPERATOR_STORAGE_ERROR);
  }
  const value = (parsed as Record<string, unknown>).sessionStoragePath;
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || value.trim() === '') throw new Error(OPERATOR_STORAGE_ERROR);
  const candidate = value.trim();
  if (!path.isAbsolute(candidate)) throw new Error(OPERATOR_STORAGE_ERROR);
  return candidate;
}

// Session 명령이 실제 사용할 저장 루트를 결정한다. 폴더를 만들지 않는다.
// 운영자 설정이 있고 사용 가능하면 그 경로를, 없으면 기본 .jutell-local 경로를 돌려준다.
// 설정된 경로가 폴더가 아니거나 접근할 수 없으면 중단한다 (fallback 없음).
export async function resolveSessionRoot(paths: ScopePaths): Promise<SessionStorageResolution> {
  const custom = await readOperatorStoragePath(paths.targetRoot);
  if (custom === undefined) {
    return { kind: 'default', root: sessionRoot(paths.dataRoot) };
  }
  const problem = await inspectDir(custom);
  if (problem !== undefined) throw new Error(OPERATOR_STORAGE_ERROR);
  return { kind: 'custom', root: custom };
}

// 대상이 폴더인지 확인한다. 없으면(ENOENT) 나중에 만들 수 있는 상태로 통과시킨다.
async function inspectDir(dir: string): Promise<string | undefined> {
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) return OPERATOR_STORAGE_ERROR;
    return undefined;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    return OPERATOR_STORAGE_ERROR;
  }
}

// storage set에서 사용: 후보 경로가 절대 경로인지 확인하고, 없으면 폴더를 만든다.
// 접근 불가·폴더가 아닌 경우에는 오류를 던진다. 절대 경로를 오류 문구에 넣지 않는다.
export async function ensureOperatorStorageDir(candidate: string): Promise<void> {
  const target = candidate.trim();
  if (!path.isAbsolute(target)) {
    throw new Error('Session 저장 위치는 절대 경로로 입력해야 합니다.');
  }
  try {
    const stat = await fs.stat(target);
    if (!stat.isDirectory()) {
      throw new Error('Session 저장 위치를 사용할 수 없습니다. 폴더가 아닙니다.');
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('폴더가 아닙니다')) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw new Error('Session 저장 위치를 사용할 수 없습니다. 접근할 수 없습니다.');
    }
  }
  try {
    await fs.mkdir(target, { recursive: true });
  } catch {
    throw new Error('Session 저장 위치를 사용할 수 없습니다. 폴더를 만들 수 없습니다.');
  }
}

export async function writeOperatorStoragePath(targetRoot: string, storagePath: string): Promise<void> {
  const file = operatorStorageConfigFile(targetRoot);
  const content = `${JSON.stringify({ sessionStoragePath: storagePath }, null, 2)}\n`;
  await fs.writeFile(file, content, 'utf8');
}

export async function hasOperatorStorageConfig(targetRoot: string): Promise<boolean> {
  try {
    await fs.access(operatorStorageConfigFile(targetRoot));
    return true;
  } catch {
    return false;
  }
}

// 설정 파일만 제거한다. Session 기록 파일은 건드리지 않는다.
export async function removeOperatorStorageConfig(targetRoot: string): Promise<void> {
  try {
    await fs.unlink(operatorStorageConfigFile(targetRoot));
  } catch {
    // 이미 없는 경우 무시
  }
}
