import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { contarPendentes, decidir, lerFrontmatter, localizarAusente } from './logica.mjs';

const FM = (status) => `---\nstatus: ${status}\ndesde: 2026-10-09 22:30\ntarefa: Tarefa X\n---\n\n# Ausente\n`;

test('lerFrontmatter: lê status, desde e tarefa', () => {
  assert.deepEqual(lerFrontmatter(FM('ausente')), { status: 'ausente', desde: '2026-10-09 22:30', tarefa: 'Tarefa X' });
});

test('lerFrontmatter: aceita CRLF', () => {
  assert.equal(lerFrontmatter(FM('ausente').replace(/\n/g, '\r\n')).status, 'ausente');
});

test('lerFrontmatter: aceita BOM', () => {
  assert.equal(lerFrontmatter('\uFEFF' + FM('retomando')).status, 'retomando');
});

test('lerFrontmatter: status tolera aspas e texto depois do primeiro termo', () => {
  assert.equal(lerFrontmatter(FM('"ausente"')).status, 'ausente');
  assert.equal(lerFrontmatter(FM("'ausente'")).status, 'ausente');
  assert.equal(lerFrontmatter(FM('ausente   # comentário')).status, 'ausente');
  assert.equal(lerFrontmatter(FM('"ausente" # comentário')).status, 'ausente');
});

test('lerFrontmatter: tarefa mantém # e espaços internos', () => {
  const texto = '---\nstatus: ausente\ntarefa: Corrigir issue #12 no módulo X\n---\n';
  assert.equal(lerFrontmatter(texto).tarefa, 'Corrigir issue #12 no módulo X');
});

test('lerFrontmatter: campos ausentes viram null', () => {
  assert.deepEqual(lerFrontmatter('---\nstatus: ausente\n---\n'), { status: 'ausente', desde: null, tarefa: null });
  assert.equal(lerFrontmatter('---\ndesde: x\n---\n').status, null);
});

test('lerFrontmatter: sem frontmatter, sem fechamento, vazio ou não-string retorna null', () => {
  assert.equal(lerFrontmatter('# Ausente\nstatus: ausente\n'), null);
  assert.equal(lerFrontmatter('---\nstatus: ausente\n'), null);
  assert.equal(lerFrontmatter(''), null);
  assert.equal(lerFrontmatter(null), null);
  assert.equal(lerFrontmatter(undefined), null);
  assert.equal(lerFrontmatter(42), null);
});

test('contarPendentes: conta só as respostas pendentes', () => {
  const texto = [
    '- **Resposta:** _pendente_',
    '- **Resposta:** Push + PR em draft',
    '- **Resposta:** _dispensada pela D1_',
    '- **Resposta:**   _pendente_',
  ].join('\r\n');
  assert.equal(contarPendentes(texto), 2);
});

test('contarPendentes: zero para vazio ou não-string', () => {
  assert.equal(contarPendentes(''), 0);
  assert.equal(contarPendentes(null), 0);
});

const BASE = resolve('/fake/home');
const REPO = join(BASE, 'repo');
const SUB = join(REPO, 'src', 'modulo');
const existeEm = (...caminhos) => {
  const conjunto = new Set(caminhos);
  return (caminho) => conjunto.has(caminho);
};

test('localizarAusente: acha no próprio cwd', () => {
  const existe = existeEm(join(REPO, '.git'), join(REPO, 'AUSENTE.md'));
  assert.equal(localizarAusente(REPO, undefined, existe), join(REPO, 'AUSENTE.md'));
});

test('localizarAusente: sobe de um subdiretório até a raiz do repositório git', () => {
  const existe = existeEm(join(REPO, '.git'), join(REPO, 'AUSENTE.md'));
  assert.equal(localizarAusente(SUB, undefined, existe), join(REPO, 'AUSENTE.md'));
});

test('localizarAusente: não passa da raiz do repositório git', () => {
  const existe = existeEm(join(REPO, '.git'), join(BASE, 'AUSENTE.md'));
  assert.equal(localizarAusente(SUB, undefined, existe), null);
});

test('localizarAusente: fora de repositório git, olha só o cwd', () => {
  const existe = existeEm(join(BASE, 'AUSENTE.md'));
  assert.equal(localizarAusente(join(BASE, 'pasta'), undefined, existe), null);
  assert.equal(localizarAusente(BASE, undefined, existe), join(BASE, 'AUSENTE.md'));
});

test('localizarAusente: o diretório do projeto tem prioridade', () => {
  const OUTRO = join(BASE, 'outro');
  const existe = existeEm(join(REPO, 'AUSENTE.md'), join(OUTRO, 'AUSENTE.md'));
  assert.equal(localizarAusente(OUTRO, REPO, existe), join(REPO, 'AUSENTE.md'));
});

test('localizarAusente: diretório do projeto vazio é ignorado e sem arquivo retorna null', () => {
  assert.equal(localizarAusente(REPO, '', existeEm(join(REPO, '.git'))), null);
  assert.equal(localizarAusente(undefined, undefined, existeEm()), null);
});
const REGRAS = '/plugin/skills/ausente/SKILL.md';
const RETORNO = '/plugin/skills/voltei/SKILL.md';
const ARQ = (status, pendentes = 1) =>
  `---\nstatus: ${status}\ndesde: 2026-10-09 22:30\ntarefa: Tarefa X\n---\n\n# Ausente\n\n## Dúvidas\n` +
  '\n- **Resposta:** _pendente_'.repeat(pendentes) +
  '\n';
const pre = (extra = {}) => ({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', ...extra });
const sessao = (source) => ({ hook_event_name: 'SessionStart', source });
const prompt = (texto) => ({ hook_event_name: 'UserPromptSubmit', prompt: texto });
const stop = (ativo) => ({ hook_event_name: 'Stop', stop_hook_active: ativo });
const EVENTOS = [pre(), sessao('startup'), sessao('compact'), prompt('oi'), stop(false)];

test('decidir: sem arquivo, nada acontece', () => {
  for (const entrada of EVENTOS) assert.equal(decidir(entrada, null, REGRAS), null);
});

test('decidir: status desconhecido ou frontmatter corrompido, nada acontece', () => {
  for (const entrada of EVENTOS) {
    assert.equal(decidir(entrada, ARQ('pausado'), REGRAS), null);
    assert.equal(decidir(entrada, '# Ausente\nstatus: ausente\n', REGRAS), null);
  }
});

test('decidir: entrada nula ou evento desconhecido retorna null', () => {
  assert.equal(decidir(null, ARQ('ausente'), REGRAS), null);
  assert.equal(decidir({ hook_event_name: 'PostToolUse' }, ARQ('ausente'), REGRAS), null);
});

test('PreToolUse: nega o AskUserQuestion do agente principal apontando as regras', () => {
  const saida = decidir(pre(), ARQ('ausente'), REGRAS).hookSpecificOutput;
  assert.equal(saida.hookEventName, 'PreToolUse');
  assert.equal(saida.permissionDecision, 'deny');
  assert.match(saida.permissionDecisionReason, /Registre esta dúvida no AUSENTE\.md como PROVISÓRIA ou ESTACIONADA/);
  assert.ok(saida.permissionDecisionReason.includes(REGRAS));
});

test('PreToolUse: sem caminho das regras, a mensagem não mostra undefined', () => {
  const motivo = decidir(pre(), ARQ('ausente')).hookSpecificOutput.permissionDecisionReason;
  assert.ok(!motivo.includes('undefined'));
});

test('PreToolUse: subagente recebe instrução de devolver no relatório final', () => {
  const saida = decidir(pre({ agent_id: 'a1', agent_type: 'executor' }), ARQ('ausente'), REGRAS).hookSpecificOutput;
  assert.equal(saida.permissionDecision, 'deny');
  assert.match(saida.permissionDecisionReason, /relatório final/);
});

test('PreToolUse: outras ferramentas e status retomando passam', () => {
  assert.equal(decidir(pre({ tool_name: 'Bash' }), ARQ('ausente'), REGRAS), null);
  assert.equal(decidir(pre(), ARQ('retomando'), REGRAS), null);
});

test('SessionStart compact: relembra o modo com desde, tarefa e regras', () => {
  const saida = decidir(sessao('compact'), ARQ('ausente'), REGRAS).hookSpecificOutput;
  assert.equal(saida.hookEventName, 'SessionStart');
  assert.match(saida.additionalContext, /Modo ausente ativo desde 2026-10-09 22:30\. Tarefa: Tarefa X\./);
  assert.ok(saida.additionalContext.includes(REGRAS));
});

test('SessionStart startup, resume, clear e fork: sugere /voltei com a contagem', () => {
  for (const source of ['startup', 'resume', 'clear', 'fork']) {
    const texto = decidir(sessao(source), ARQ('ausente', 2), REGRAS).hookSpecificOutput.additionalContext;
    assert.match(texto, /2 dúvidas pendentes/, source);
    assert.match(texto, /sugira \/voltei/, source);
  }
});

test('SessionStart com retomando: avisa o /voltei interrompido e, na compactação, aponta as regras do retorno', () => {
  const texto = decidir(sessao('startup'), ARQ('retomando', 1), REGRAS, RETORNO).hookSpecificOutput.additionalContext;
  assert.match(texto, /\/voltei interrompido com 1 dúvida pendente/);
  const compactado = decidir(sessao('compact'), ARQ('retomando', 2), REGRAS, RETORNO).hookSpecificOutput.additionalContext;
  assert.match(compactado, /\/voltei em andamento, com 2 dúvidas pendentes/);
  assert.ok(compactado.includes(RETORNO));
  assert.ok(!compactado.includes(REGRAS));
});

test('mensagens: singular e plural da contagem', () => {
  const texto = (n) => decidir(sessao('startup'), ARQ('ausente', n), REGRAS).hookSpecificOutput.additionalContext;
  assert.match(texto(0), /0 dúvidas pendentes/);
  assert.match(texto(1), /1 dúvida pendente\./);
});

test('UserPromptSubmit: lembra do /voltei quando o usuário digita outra coisa', () => {
  for (const texto of ['oi, tudo certo?', 'pode rodar /voltei?', '/volteiX', '/outra-coisa']) {
    const saida = decidir(prompt(texto), ARQ('ausente'), REGRAS).hookSpecificOutput;
    assert.equal(saida.hookEventName, 'UserPromptSubmit', texto);
    assert.match(saida.additionalContext, /sugira \/voltei/, texto);
  }
});

test('UserPromptSubmit: silencioso para os comandos do plugin', () => {
  for (const texto of ['/voltei', '/ausencia:voltei', '/ausente faça X', '  /ausencia:ausente', '/voltei\n']) {
    assert.equal(decidir(prompt(texto), ARQ('ausente'), REGRAS), null, texto);
  }
});

test('Stop: bloqueia uma vez com o checklist', () => {
  for (const ativo of [false, undefined]) {
    const saida = decidir(stop(ativo), ARQ('ausente'), REGRAS);
    assert.equal(saida.decision, 'block');
    assert.match(saida.reason, /^Modo ausente: antes de encerrar/);
  }
  assert.equal(decidir(stop(true), ARQ('ausente'), REGRAS), null);
  assert.equal(decidir(stop(false), ARQ('retomando'), REGRAS), null);
});

test('PreToolUse: a negação ensina a destravar quando o usuário já voltou', () => {
  const motivo = decidir(pre(), ARQ('ausente'), REGRAS).hookSpecificOutput.permissionDecisionReason;
  assert.match(motivo, /troque o status para retomando antes de perguntar/);
});

test('mensagens: sem os caminhos das skills, nada mostra undefined', () => {
  const textos = [
    decidir(pre(), ARQ('ausente')).hookSpecificOutput.permissionDecisionReason,
    decidir(sessao('compact'), ARQ('ausente')).hookSpecificOutput.additionalContext,
    decidir(sessao('compact'), ARQ('retomando')).hookSpecificOutput.additionalContext,
  ];
  for (const texto of textos) assert.ok(!texto.includes('undefined'), texto);
});
