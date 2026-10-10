#!/usr/bin/env node
// Smoke test dos hooks do plugin ausencia numa sessão real do Claude Code (claude -p).
// Faz duas chamadas curtas ao modelo haiku. Uso: node tests/smoke-headless.mjs
// O AskUserQuestion não existe no modo -p; a negação dele é testada na sessão interativa.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = fileURLToPath(new URL('../plugins/ausencia', import.meta.url));

const arquivo = (status) =>
  `---\nstatus: ${status}\ndesde: 2026-10-09 22:30\ntarefa: Smoke test\n---\n\n# Ausente\n\n` +
  `## Feito enquanto você estava fora\n\n## Dúvidas\n\n### D1 · ESTACIONADA · Push?\n- **Resposta:** _pendente_\n`;

function sessao(dir) {
  const r = spawnSync(
    'claude',
    ['-p', 'Responda apenas: ok', '--plugin-dir', PLUGIN, '--model', 'haiku', '--output-format', 'stream-json', '--verbose'],
    { cwd: dir, input: '', encoding: 'utf8', timeout: 180_000 },
  );
  if (r.error) throw r.error;
  return `${r.stdout}\n${r.stderr}`;
}

const resultados = [];
function verificar(nome, ok) {
  resultados.push(ok);
  console.log(`${ok ? 'OK    ' : 'FALHOU'} ${nome}`);
}

const dir = mkdtempSync(join(tmpdir(), 'ausencia-smoke-'));
try {
  spawnSync('git', ['init', '-q'], { cwd: dir });

  writeFileSync(join(dir, 'AUSENTE.md'), arquivo('ausente'));
  const ausente = sessao(dir);
  verificar('SessionStart com status ausente sugere /voltei', ausente.includes('sugira /voltei'));
  verificar('Stop com status ausente bloqueia com o checklist', ausente.includes('Modo ausente: antes de encerrar'));

  writeFileSync(join(dir, 'AUSENTE.md'), arquivo('retomando'));
  const retomando = sessao(dir);
  verificar('SessionStart com status retomando avisa o /voltei interrompido', retomando.includes('/voltei interrompido'));
  verificar('Stop com status retomando não bloqueia', !retomando.includes('Modo ausente: antes de encerrar'));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
process.exitCode = resultados.every(Boolean) ? 0 : 1;
