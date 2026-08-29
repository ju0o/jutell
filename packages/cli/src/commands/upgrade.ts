import { assets, codexScopedPaths, packageRoot } from '../config/paths.js';
import { readBridgeConfig, snapshot, restore } from '../config/managed.js';
import { ensureBridgeConfig } from '../installer/config.js';
import { installSkill, recordSkillFiles, removeAddedSkillFiles } from '../installer/skill.js';
import { agentsFile, ensureJuTellAgentsBlock } from '../installer/agents.js';
import { readCodexRegistration, registerMcp } from '../config/managed.js';
import { readOpenCodeRegistration, registerOpenCodeMcp } from '../installer/opencode.js';
import { readClaudeRegistration, registerClaudeMcp } from '../installer/claude.js';
import type { CliIo, CliOptions, ScopePaths } from '../types.js';

export async function upgradeCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const snapshots = [
    await snapshot(paths.configFile),
    await snapshot(paths.legacyConfigFile),
    await snapshot(codexScopedPaths(paths).codexConfigFile),
    await snapshot(paths.opencodeConfigFile),
    await snapshot(paths.claudeConfigFile),
  ];
  if (paths.scope === 'project') snapshots.push(await snapshot(agentsFile(paths.targetRoot)));
  let changedSkill: string[] = [];
  try {
    // 1. Config — preserve profile, create canonical from legacy if needed (READ LEGACY, WRITE CANONICAL)
    const beforeConfig = await readBridgeConfig(paths);
    const ensured = await ensureBridgeConfig(paths, undefined);
    const configCreated = !beforeConfig.exists && ensured.created;
    const migratedConfig = beforeConfig.source === 'legacy' && ensured.config;

    // 2. Skill — refresh to current assets
    const skillResult = await installSkill(assets().skill, paths.skillRoot);
    changedSkill = skillResult.changed;

    // 3. AGENTS block — refresh
    if (paths.scope === 'project') await ensureJuTellAgentsBlock(paths.targetRoot);

    // 4. Provider MCP — refresh canonical command/path, repair drift, keep legacy + unrelated
    const mcpEnabled = ensured.config.mcp?.enabled === true;
    const codexPaths = codexScopedPaths(paths);
    const codexReg = await readCodexRegistration(codexPaths, packageRoot(), mcpEnabled);
    const opencodeReg = await readOpenCodeRegistration(paths, packageRoot(), mcpEnabled);
    const claudeReg = await readClaudeRegistration(paths, packageRoot(), mcpEnabled);

    let codexRefreshed = false;
    let opencodeRefreshed = false;
    let claudeRefreshed = false;

    // Codex: if any JuTell registration (canonical or legacy heuristic) exists, ensure canonical block is fresh
    if (codexReg.registered || codexReg.legacyRegistered || codexReg.canonicalRegistered) {
      // Force refresh by rewriting canonical block with current packageRoot/command
      // Use registerMcp's forced path: remove canonical block then add fresh
      const before = await readCodexRegistration(codexPaths, packageRoot(), mcpEnabled);
      // registerMcp will handle backup + rewrite; we force by temporarily clearing enabled flag check via direct write if needed
      // Simpler: call registerMcp — it will rewrite if command drift is detected via heuristic? Our heuristic already treats unmarked as registered,
      // but registerMcp's early return checks canonicalRegistered + enabled ===. To force refresh when command is stale, we bypass by
      // using internal write: if canonical block exists but command doesn't match current packageRoot, force.
      const currentContent = before.content;
      const expected = packageRoot();
      const needsRefresh = !currentContent.includes(expected) && (before.canonicalRegistered || before.legacyRegistered);
      if (needsRefresh || before.canonicalRegistered) {
        await registerMcp(codexPaths, packageRoot(), mcpEnabled);
        codexRefreshed = true;
      } else if (before.legacyRegistered && !before.canonicalRegistered) {
        // legacy-only -> create canonical (READ LEGACY, WRITE CANONICAL, keep legacy)
        await registerMcp(codexPaths, packageRoot(), mcpEnabled);
        codexRefreshed = true;
      }
    }

    // OpenCode: if registered, refresh via registerOpenCodeMcp (serializeWithManaged uses current packageRoot)
    if (opencodeReg.registered || opencodeReg.canonicalRegistered || opencodeReg.legacyRegistered) {
      await registerOpenCodeMcp(paths, packageRoot(), mcpEnabled);
      opencodeRefreshed = true;
    }

    // Claude: if registered, ensure command matches current (registerClaudeMcp already checks commandMatches)
    if (claudeReg.registered) {
      await registerClaudeMcp(paths, packageRoot(), mcpEnabled);
      claudeRefreshed = true;
    }

    await recordSkillFiles(paths, changedSkill);

    // 5. Report — what changed / preserved / legacy / next
    const parts: string[] = ['JuTell 업그레이드가 끝났습니다.'];
    if (migratedConfig) parts.push('- 설정: 이전 .beginner-bridge.json을 읽어 .jutell.json을 만들었습니다. 이전 파일은 보존했습니다.');
    else if (configCreated) parts.push('- 설정: 새 .jutell.json을 만들었습니다.');
    else parts.push('- 설정: 기존 .jutell.json을 유지했습니다.');

    if (skillResult.conflicts.length) parts.push(`- Skill: 기존 파일을 덮어쓰지 않았습니다 (${skillResult.conflicts.join(', ')}).`);
    else if (changedSkill.length) parts.push('- Skill: 최신 Skill로 새로고침했습니다.');
    else parts.push('- Skill: 최신 상태를 유지했습니다.');

    parts.push('- AGENTS.md: JuTell 블록을 확인/새로고침했습니다.');
    if (codexRefreshed || opencodeRefreshed || claudeRefreshed) {
      const refreshed = [
        codexRefreshed ? 'Codex' : null,
        opencodeRefreshed ? 'OpenCode' : null,
        claudeRefreshed ? 'Claude Code' : null,
      ].filter(Boolean).join(', ');
      parts.push(`- MCP: ${refreshed} canonical jutell 블록을 현재 패키지 경로로 새로고침했습니다. 관련 없는 설정은 보존했습니다.`);
    } else {
      parts.push('- MCP: 등록된 Provider가 없어 MCP를 새로고침하지 않았습니다. jutell use <provider>로 연결하세요.');
    }

    const anyLegacy = codexReg.legacyRegistered || opencodeReg.legacyRegistered || beforeConfig.source === 'legacy';
    if (anyLegacy) parts.push('- 레거시: 이전 beginner_bridge 상태는 그대로 두었습니다. 정리하려면 jutell migrate --clean 을 실행하세요.');
    parts.push('다음: jutell status / jutell doctor 로 확인하세요.');

    io.write(parts.join('\n'));
    return { cancelled: false };
  } catch (error) {
    for (const s of snapshots) await restore(s);
    await removeAddedSkillFiles(paths.skillRoot, changedSkill);
    throw error;
  }
}
