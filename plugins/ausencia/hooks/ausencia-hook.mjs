#!/usr/bin/env node
// Ponto de entrada dos hooks do plugin ausencia. Lê o JSON do hook no stdin e imprime a decisão no stdout.
// Sempre termina com código 0: qualquer falha resulta em nenhuma saída, e nada é bloqueado (fail-open).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decidir, localizarAusente } from './logica.mjs';

const CAMINHO_REGRAS = fileURLToPath(new URL('../skills/ausente/SKILL.md', import.meta.url));

try {
  const entrada = JSON.parse(readFileSync(0, 'utf8'));
  const cwd = entrada.cwd || process.cwd();
  const arquivo = localizarAusente(cwd, process.env.CLAUDE_PROJECT_DIR, existsSync);
  const conteudo = arquivo ? readFileSync(arquivo, 'utf8') : null;
  const saida = decidir(entrada, conteudo, CAMINHO_REGRAS);
  if (saida) process.stdout.write(JSON.stringify(saida));
} catch {
  // fail-open: sem saída, sem bloqueio
}
