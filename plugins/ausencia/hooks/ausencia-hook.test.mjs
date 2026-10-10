import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./ausencia-hook.mjs', import.meta.url));
const HOOKS_JSON = fileURLToPath(new URL('./hooks.json', import.meta.url));
const ARQ = (status) =>
  `---\nstatus: ${status}\ndesde: 2026-10-09 22:30\ntarefa: Tarefa X\n---\n\n## Dúvidas\n- **Resposta:** _pendente_\n`;

let base;
before(() => {
  base = mkdtempSync(join(tmpdir(), 'ausencia-hook-'));
});
after(() => {
  rmSync(base, { recursive: true, force: true });
});

function novoRepo(nome, status) {
  const repo = join(base, nome);
  mkdirSync(join(repo, '.git'), { recursive: true });
  mkdirSync(join(repo, 'src', 'modulo'), { recursive: true });
  if (status) writeFileSync(join(repo, 'AUSENTE.md'), ARQ(status));
  return repo;
}

function rodar(entrada, env = {}) {
  const input = typeof entrada === 'string' ? entrada : JSON.stringify(entrada);
  return spawnSync(process.execPath, [HOOK], {
    input,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', ...env },
  });
}

test('hook: Stop em modo ausente imprime o bloqueio e sai com 0', () => {
  const repo = novoRepo('stop', 'ausente');
  const r = rodar({ hook_event_name: 'Stop', cwd: repo, stop_hook_active: false });
  assert.equal(r.status, 0);
  assert.equal(JSON.parse(r.stdout).decision, 'block');
});

test('hook: acha o AUSENTE.md subindo de um subdiretório', () => {
  const repo = novoRepo('sub', 'ausente');
  const r = rodar({ hook_event_name: 'Stop', cwd: join(repo, 'src', 'modulo'), stop_hook_active: false });
  assert.equal(JSON.parse(r.stdout).decision, 'block');
});

test('hook: usa CLAUDE_PROJECT_DIR quando o cwd está fora do projeto', () => {
  const repo = novoRepo('projdir', 'ausente');
  const fora = novoRepo('fora', null);
  const r = rodar({ hook_event_name: 'Stop', cwd: fora, stop_hook_active: false }, { CLAUDE_PROJECT_DIR: repo });
  assert.equal(JSON.parse(r.stdout).decision, 'block');
});

test('hook: nega AskUserQuestion apontando o SKILL.md do plugin', () => {
  const repo = novoRepo('pre', 'ausente');
  const r = rodar({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', cwd: repo });
  const saida = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(saida.permissionDecision, 'deny');
  assert.ok(saida.permissionDecisionReason.includes(join('skills', 'ausente', 'SKILL.md')));
});

test('hook: sem AUSENTE.md, sai com 0 e sem saída', () => {
  const repo = novoRepo('vazio', null);
  const r = rodar({ hook_event_name: 'Stop', cwd: repo, stop_hook_active: false });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('hook: entrada vazia, inválida, nula ou sem campos sai com 0 e sem saída', () => {
  for (const entrada of ['', 'isto não é json', '{}', '[]', 'null']) {
    const r = rodar(entrada);
    assert.equal(r.status, 0, entrada);
    assert.equal(r.stdout, '', entrada);
  }
});

test('hooks.json: registra os quatro eventos com node e o script', () => {
  const config = JSON.parse(readFileSync(HOOKS_JSON, 'utf8'));
  const esperado = {
    PreToolUse: 'AskUserQuestion',
    SessionStart: 'startup|resume|clear|compact',
    UserPromptSubmit: undefined,
    Stop: undefined,
  };
  assert.deepEqual(Object.keys(config.hooks).sort(), Object.keys(esperado).sort());
  for (const [evento, matcher] of Object.entries(esperado)) {
    assert.equal(config.hooks[evento].length, 1, evento);
    const [grupo] = config.hooks[evento];
    assert.equal(grupo.matcher, matcher, evento);
    assert.deepEqual(
      grupo.hooks,
      [{ type: 'command', command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/hooks/ausencia-hook.mjs'], timeout: 5 }],
      evento,
    );
  }
});
