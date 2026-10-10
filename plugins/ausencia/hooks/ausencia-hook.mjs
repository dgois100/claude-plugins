#!/usr/bin/env node
// Ponto de entrada dos hooks do plugin ausencia. Lê o JSON do hook no stdin e imprime a decisão no stdout.
// Sempre termina com código 0: qualquer falha resulta em nenhuma saída, e nada é bloqueado (fail-open).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decidir, localizarAusente } from './logica.mjs';

const CAMINHO_REGRAS = fileURLToPath(new URL('../skills/ausente/SKILL.md', import.meta.url));
const CAMINHO_RETORNO = fileURLToPath(new URL('../skills/voltei/SKILL.md', import.meta.url));
const LIMITE_STDIN_MS = 2000;
const LIMITE_GIT_MS = 1500;
const PASTA_DO_HOOK = dirname(fileURLToPath(import.meta.url));

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

// O /ausente nunca põe o AUSENTE.md em commit (ele fica no info/exclude): um arquivo versionado não veio
// dele, e o hook o ignora. Sem git, fora de um repositório ou com erro, conta como não versionado.
// O git recebe a pasta do arquivo por -C e roda com o cwd na pasta do plugin: no Windows, o executável
// é procurado primeiro no cwd, e um git.exe plantado num repositório clonado rodaria.
function versionado(arquivo) {
  const git = spawnSync('git', ['-C', dirname(arquivo), 'ls-files', '--error-unmatch', '--', 'AUSENTE.md'], {
    cwd: PASTA_DO_HOOK,
    stdio: 'ignore',
    timeout: LIMITE_GIT_MS,
    windowsHide: true,
  });
  return git.status === 0;
}

try {
  const entrada = JSON.parse(await lerStdin());
  const cwd = entrada.cwd || process.cwd();
  const arquivo = localizarAusente(cwd, process.env.CLAUDE_PROJECT_DIR, existsSync);
  const conteudo = arquivo && !versionado(arquivo) ? readFileSync(arquivo, 'utf8') : null;
  const saida = decidir(entrada, conteudo, CAMINHO_REGRAS, CAMINHO_RETORNO);
  if (saida) process.stdout.write(JSON.stringify(saida));
} catch {
  // fail-open: sem saída, sem bloqueio
}
