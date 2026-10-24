import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveScope } from '../src/config/paths.js';
import { applyRulesWithoutFetch, rulesFetchedForThisWork, RULES_STAMP_FILE } from '../src/commands/receipt/rules.js';
import { RECEIPT_STATE_FILE } from '../src/commands/receipt/before.js';

// #37 BLOCKER B: the AI skipped get_beginner_report_rules in 1 of 5 runs; receipt notices and applies the rules.
describe('receipt applies the report rules when they were not fetched for this work', () => {
  const setup = async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jutell-rules-'));
    const paths = resolveScope('project', dir);
    await fs.mkdir(paths.dataRoot, { recursive: true });
    const touch = async (name: string, seconds: number) => {
      const file = path.join(paths.dataRoot, name);
      await fs.writeFile(file, name === RULES_STAMP_FILE ? JSON.stringify({ at: new Date(seconds * 1000).toISOString() }) : '{}');
      await fs.utimes(file, seconds, seconds);
    };
    return { paths, touch };
  };

  it('fetched = a stamp newer than the last receipt', async () => {
    const { paths, touch } = await setup();
    expect(await rulesFetchedForThisWork(paths)).toBe(false); // never fetched
    await touch(RULES_STAMP_FILE, 1000);
    expect(await rulesFetchedForThisWork(paths)).toBe(true); // fetched, no receipt yet
    await touch(RECEIPT_STATE_FILE, 2000);
    expect(await rulesFetchedForThisWork(paths)).toBe(false); // fetched only for an earlier task
    await touch(RULES_STAMP_FILE, 3000);
    expect(await rulesFetchedForThisWork(paths)).toBe(true);
    // A forged stamp (empty `touch`, wrong content, a folder) never counts.
    await fs.writeFile(path.join(paths.dataRoot, RULES_STAMP_FILE), '');
    expect(await rulesFetchedForThisWork(paths)).toBe(false);
    await fs.writeFile(path.join(paths.dataRoot, RULES_STAMP_FILE), '{"at":"nope"}');
    expect(await rulesFetchedForThisWork(paths)).toBe(false);
    await fs.rm(path.join(paths.dataRoot, RULES_STAMP_FILE));
    await fs.mkdir(path.join(paths.dataRoot, RULES_STAMP_FILE));
    expect(await rulesFetchedForThisWork(paths)).toBe(false);
  });

  it('removes JuTell\'s own steps from the work list in place', () => {
    const receipt = { done: ['제목을 바꿨어요', 'get_beginner_report_rules로 보고 규칙을 받았어요'], summary: 'JuTell 규칙 적용 완료' };
    expect(applyRulesWithoutFetch(receipt)).toBe(2);
    expect(receipt).toEqual({ done: ['제목을 바꿨어요'] });
  });
});
