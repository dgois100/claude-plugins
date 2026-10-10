import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { contarPendentes, lerFrontmatter, localizarAusente } from './logica.mjs';

const FM = (status) => `---\nstatus: ${status}\ndesde: 2026-10-09 22:30\ntarefa: Tarefa X\n---\n\n# Ausente\n`;

test('lerFrontmatter: lê status, desde e tarefa', () => {
  assert.deepEqual(lerFrontmatter(FM('ausente')), { status: 'ausente', desde: '2026-10-09 22:30', tarefa: 'Tarefa X' });
});

test('lerFrontmatter: aceita CRLF', () => {
  assert.equal(lerFrontmatter(FM('ausente').replace(/\n/g, '\r\n')).status, 'ausente');
});

test('lerFrontmatter: aceita BOM', () => {
  assert.equal(lerFrontmatter('﻿' + FM('retomando')).status, 'retomando');
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
