import { promises as fs } from 'node:fs';
import { codexScopedPaths, packageRoot } from '../config/paths.js';
import { readBridgeConfig, readCodexRegistration, readText, writeTextSafely } from '../config/managed.js';
import { ensureBridgeConfig } from '../installer/config.js';
import { readOpenCodeRegistration, registerOpenCodeMcp } from '../installer/opencode.js';
import { readClaudeRegistration } from '../installer/claude.js';
import { registerMcp } from '../config/managed.js';
import type { CliIo, CliOptions, ScopePaths } from '../types.js';

export async function migrateCommand(paths: ScopePaths, options: CliOptions, io: CliIo) {
  const clean = Boolean((options as Record<string, unknown>).clean || (options as Record<string, unknown>).cleanLegacy || options.removeData);
  const beforeConfig = await readBridgeConfig(paths);
  const codexReg = await readCodexRegistration(codexScopedPaths(paths), packageRoot(), true);
  const opencodeReg = await readOpenCodeRegistration(paths, packageRoot(), true);
  const claudeReg = await readClaudeRegistration(paths, packageRoot(), true);

  const legacyFileExists = (await readText(paths.legacyConfigFile)) !== undefined;
  const hasLegacyConfig = beforeConfig.source === 'legacy' || legacyFileExists;
  const hasLegacyCodex = codexReg.legacyRegistered && !codexReg.canonicalRegistered;
  const hasLegacyOpencode = opencodeReg.legacyRegistered && !opencodeReg.canonicalRegistered;
  const hasBothCodex = codexReg.bothRegistered;
  const hasBothOpencode = opencodeReg.bothRegistered;
  const hasAnyLegacy = hasLegacyConfig || hasLegacyCodex || hasLegacyOpencode || hasBothCodex || hasBothOpencode;

  if (!hasAnyLegacy && !clean) {
    io.write('이전 beginner_bridge 상태를 찾지 못했습니다.\n이미 canonical jutell 상태입니다.\n정리하려면 jutell migrate --clean 을 실행하세요 (canonical이 확인된 뒤에만 레거시를 제거합니다).');
    return { cancelled: false };
  }

  if (!clean) {
    // Safe migration: READ LEGACY, WRITE CANONICAL, keep legacy
    const lines: string[] = ['JuTell 마이그레이션을 준비합니다. (READ LEGACY → WRITE CANONICAL, keep legacy)'];
    if (hasLegacyConfig) {
      await ensureBridgeConfig(paths, undefined);
      const after = await readBridgeConfig(paths);
      lines.push(`- 설정: .beginner-bridge.json → .jutell.json 생성 (profile: ${after.config.profile}). 이전 파일은 보존했습니다.`);
    } else {
      lines.push('- 설정: .jutell.json 이미 존재 — 유지했습니다.');
    }

    // Codex legacy → canonical
    if (hasLegacyCodex) {
      await registerMcp(codexScopedPaths(paths), packageRoot(), true);
      lines.push('- Codex: 이전 beginner_bridge 항목을 보존하고 새 jutell 항목을 추가했습니다. (이전 항목 자동 삭제 안 함)');
    } else if (hasBothCodex) {
      lines.push('- Codex: canonical jutell과 legacy beginner_bridge가 모두 있어 그대로 두었습니다.');
    } else if (codexReg.canonicalRegistered) {
      lines.push('- Codex: 이미 canonical jutell — 유지했습니다.');
    } else {
      lines.push('- Codex: legacy 없음 — 건너뛰었습니다.');
    }

    // OpenCode legacy → canonical
    if (hasLegacyOpencode) {
      await registerOpenCodeMcp(paths, packageRoot(), true);
      lines.push('- OpenCode: 이전 beginner_bridge를 보존하고 새 jutell을 추가했습니다.');
    } else if (hasBothOpencode) {
      lines.push('- OpenCode: canonical+legacy 모두 있어 그대로 두었습니다.');
    } else if (opencodeReg.canonicalRegistered) {
      lines.push('- OpenCode: 이미 canonical jutell — 유지했습니다.');
    } else {
      lines.push('- OpenCode: legacy 없음 — 건너뛰었습니다.');
    }

    if (claudeReg.registered) lines.push('- Claude Code: 이미 canonical jutell — 유지했습니다.');
    else lines.push('- Claude Code: legacy 없음 (Claude는 신규 adapter, legacy 없음) — 건너뛰었습니다.');

    lines.push('레거시는 그대로 보존했습니다.');
    lines.push('다음: jutell status / jutell doctor 로 확인한 뒤, canonical이 활성화된 것을 확인하면 jutell migrate --clean 으로 레거시를 정리할 수 있습니다.');
    io.write(lines.join('\n'));
    return { cancelled: false };
  }

  // --clean : remove legacy only after safe verification
  const errors: string[] = [];
  if (hasLegacyConfig) {
    // Verify canonical exists and is valid before deleting legacy
    const canonicalExists = await readText(paths.configFile);
    if (!canonicalExists) errors.push('.jutell.json이 없어 레거시 .beginner-bridge.json을 삭제하지 않았습니다. 먼저 jutell migrate 를 실행하세요.');
    else {
      try {
        await fs.rm(paths.legacyConfigFile, { force: true });
        // also legacy local dir if empty? keep for safety, only remove file per spec (not auto delete all data)
      } catch (e) {
        errors.push(`레거시 설정 삭제 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Codex legacy clean: only if canonical exists
  if (hasBothCodex || hasLegacyCodex) {
    const afterCodex = await readCodexRegistration(codexScopedPaths(paths), packageRoot(), true);
    if (!afterCodex.canonicalRegistered) {
      errors.push('Codex에 canonical jutell이 없어 legacy beginner_bridge를 삭제하지 않았습니다.');
    } else {
      // Remove only legacy block: read file and strip legacy marker blocks
      const file = codexScopedPaths(paths).codexConfigFile;
      const text = (await readText(file)) ?? '';
      // Use managed.ts patterns: remove only legacy/beginner_bridge blocks, keep canonical and other
      // Direct patterns for legacy markers (keep canonical JUTELL_CLI_MCP_BEGIN/END)
      const legacyPattern = /# BEGINNER_BRIDGE_CLI_MCP_BEGIN[\s\S]*?# BEGINNER_BRIDGE_CLI_MCP_END\n?/m;
      const legacyPattern2 = /# BEGINNER_BRIDGE_MCP_BEGIN[\s\S]*?# BEGINNER_BRIDGE_MCP_END\n?/m;
      let next = text.replace(legacyPattern, '').replace(legacyPattern2, '');
      // Also remove unmarked legacy with heuristic: if beginner_bridge still present but not in managed block, check evidence
      if (/^\s*\[mcp_servers\.beginner_bridge\]/m.test(next) && /(?:assets|apps)[\\/]mcp-server/i.test(next.slice(next.search(/^\s*\[mcp_servers\.beginner_bridge\]/m), next.search(/^\s*\[mcp_servers\.beginner_bridge\]/m)+1200))) {
        // Remove that section (from header until next header/marker or end)
        const idx = next.search(/^\s*\[mcp_servers\.beginner_bridge\]/m);
        const after = next.slice(idx);
        const nextHeader = after.slice(1).search(/^\s*\[mcp_servers\./m);
        const nextMarker = after.search(/#\s*JUTELL_CLI_MCP_BEGIN/m);
        let cut = after.length;
        if (nextHeader >= 0) cut = Math.min(cut, nextHeader + 1);
        if (nextMarker >= 0) cut = Math.min(cut, nextMarker);
        next = next.slice(0, idx) + after.slice(cut);
      }
      next = next.replace(/\n{3,}/g, '\n\n').trim();
      await writeTextSafely(file, next ? `${next}\n` : '');
    }
  }

  // OpenCode legacy clean
  if (hasBothOpencode || hasLegacyOpencode) {
    const afterOpencode = await readOpenCodeRegistration(paths, packageRoot(), true);
    if (!afterOpencode.canonicalRegistered) {
      errors.push('OpenCode에 canonical jutell이 없어 legacy를 삭제하지 않았습니다.');
    } else {
      // For OpenCode, bothRegistered case: remove legacy key from mcp object
      const { file, text } = await (async () => {
        const { promises: fs2 } = await import('node:fs');
        const p = paths.opencodeConfigFile;
        // opencode may be .jsonc, resolve via readOpenCodeRegistration file
        const reg = await readOpenCodeRegistration(paths, packageRoot(), true);
        const t = (await readText(reg.file)) ?? '';
        return { file: reg.file, text: t };
      })();
      try {
        const parsed = JSON.parse(text.replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));
        if (parsed.mcp && parsed.mcp.beginner_bridge) {
          delete parsed.mcp.beginner_bridge;
          // Keep jutell, remove managed marker will be regenerated on next write? For clean, just remove legacy key and write plain json
          await writeTextSafely(file, `${JSON.stringify(parsed, null, 2)}\n`);
        }
      } catch {
        errors.push('OpenCode 설정 파싱 실패로 legacy 정리를 건너뛰었습니다.');
      }
    }
  }

  if (errors.length) {
    io.write(['정리 중 일부를 건너뛰었습니다:', ...errors.map(e => `- ${e}`), '남은 레거시는 jutell doctor 로 확인하세요.'].join('\n'));
  } else {
    io.write('레거시 정리가 끝났습니다.\n- .beginner-bridge.json (있었다면) 제거\n- Codex/OpenCode의 beginner_bridge 항목 제거\n관련 없는 설정은 보존했습니다.\njutell status / jutell doctor 로 확인하세요.');
  }
  return { cancelled: false };
}
