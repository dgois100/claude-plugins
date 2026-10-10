import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir } from './logica.mjs';

const HOOK = fileURLToPath(new URL('./ausencia-hook.mjs', import.meta.url));
const HOOKS_JSON = fileURLToPath(new URL('./hooks.json', import.meta.url));
const RAIZ_PLUGIN = fileURLToPath(new URL('..', import.meta.url));
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
    SessionStart: 'startup|resume|clear|compact|fork',
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

// Inicia o hook com o stdin aberto, para o teste controlar quando (e se) a entrada termina.
function iniciar() {
  const filho = spawn(process.execPath, [HOOK], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDE_PROJECT_DIR: '' },
  });
  let saida = '';
  filho.stdout.on('data', (parte) => {
    saida += parte;
  });
  const fim = new Promise((resolve) => filho.on('close', (codigo) => resolve({ codigo, saida })));
  return { filho, fim };
}

test('hook: lê a entrada mesmo quando ela chega aos poucos', async () => {
  const repo = novoRepo('lento', 'ausente');
  const json = JSON.stringify({ hook_event_name: 'Stop', cwd: repo, stop_hook_active: false });
  const { filho, fim } = iniciar();
  filho.stdin.write(json.slice(0, 10));
  setTimeout(() => filho.stdin.end(json.slice(10)), 300);
  const { codigo, saida } = await fim;
  assert.equal(codigo, 0);
  assert.equal(JSON.parse(saida).decision, 'block');
});

test('hook: stdin que nunca fecha não trava o hook', async () => {
  const inicio = Date.now();
  const { fim } = iniciar();
  const { codigo, saida } = await fim;
  const duracao = Date.now() - inicio;
  assert.equal(codigo, 0);
  assert.equal(saida, '');
  assert.ok(duracao < 4500, `demorou ${duracao} ms`);
});

test('contrato: skills, manifesto e hook usam os mesmos nomes e marcadores', () => {
  const ausente = readFileSync(join(RAIZ_PLUGIN, 'skills', 'ausente', 'SKILL.md'), 'utf8');
  const voltei = readFileSync(join(RAIZ_PLUGIN, 'skills', 'voltei', 'SKILL.md'), 'utf8');
  const plugin = JSON.parse(readFileSync(join(RAIZ_PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));

  // os marcadores que o hook e o /voltei leem aparecem nas skills exatamente assim
  assert.ok(ausente.includes('status: ausente'));
  assert.ok(ausente.includes('**Resposta:** _pendente_'));
  assert.ok(voltei.includes('status: retomando'));
  assert.ok(voltei.includes('**Resposta:** _pendente_'));
  assert.ok(voltei.includes(' (aplicada)'));
  assert.ok(voltei.includes('_dispensada pela D'));

  // portões de confirmação do /voltei: decisões antigas e retomada da tarefa
  assert.ok(voltei.includes('"Parar por agora"'));
  assert.ok(voltei.includes('Retomar: <tarefa>'));

  // o hook fica em silêncio para os próprios comandos do plugin, com e sem prefixo
  const nomes = [ausente, voltei].map((texto) => texto.match(/^name: (\S+)$/m)[1]);
  assert.deepEqual(nomes, ['ausente', 'voltei']);
  const conteudo = '---\nstatus: ausente\n---\n';
  for (const nome of nomes) {
    for (const comando of [`/${nome}`, `/${plugin.name}:${nome}`]) {
      assert.equal(decidir({ hook_event_name: 'UserPromptSubmit', prompt: comando }, conteudo), null, comando);
    }
  }
});

test('contrato: as mensagens do hook apontam para SKILL.md que existem', () => {
  const caminhoNa = (texto) => texto.match(/\(([^()]+SKILL\.md)\)/)[1];
  const ausente = novoRepo('contrato-ausente', 'ausente');
  const negacao = JSON.parse(rodar({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', cwd: ausente }).stdout);
  assert.ok(existsSync(caminhoNa(negacao.hookSpecificOutput.permissionDecisionReason)));
  const retomando = novoRepo('contrato-retomando', 'retomando');
  const lembrete = JSON.parse(rodar({ hook_event_name: 'SessionStart', source: 'compact', cwd: retomando }).stdout);
  assert.ok(existsSync(caminhoNa(lembrete.hookSpecificOutput.additionalContext)));
});
