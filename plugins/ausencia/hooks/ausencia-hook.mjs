#!/usr/bin/env node
// Ponto de entrada dos hooks do plugin ausencia. Lê o JSON do hook no stdin e imprime a decisão no stdout.
// Sempre termina com código 0: qualquer falha resulta em nenhuma saída, e nada é bloqueado (fail-open).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { decidir, localizarAusente } from './logica.mjs';

const CAMINHO_REGRAS = fileURLToPath(new URL('../skills/ausente/SKILL.md', import.meta.url));
const CAMINHO_RETORNO = fileURLToPath(new URL('../skills/voltei/SKILL.md', import.meta.url));
const LIMITE_STDIN_MS = 2000;

// Lê o stdin por eventos e com limite de tempo: readFileSync(0) pode falhar com EAGAIN
// num pipe não bloqueante (POSIX) e travaria se o stdin fosse um terminal.
function lerStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }
    let dados = '';
    const terminar = () => {
      clearTimeout(limite);
      process.stdin.destroy();
      resolve(dados);
    };
    const limite = setTimeout(terminar, LIMITE_STDIN_MS);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (parte) => {
      dados += parte;
    });
    process.stdin.on('end', terminar);
    process.stdin.on('error', terminar);
  });
}

try {
  const entrada = JSON.parse(await lerStdin());
  const cwd = entrada.cwd || process.cwd();
  const arquivo = localizarAusente(cwd, process.env.CLAUDE_PROJECT_DIR, existsSync);
  const conteudo = arquivo ? readFileSync(arquivo, 'utf8') : null;
  const saida = decidir(entrada, conteudo, CAMINHO_REGRAS, CAMINHO_RETORNO);
  if (saida) process.stdout.write(JSON.stringify(saida));
} catch {
  // fail-open: sem saída, sem bloqueio
}
