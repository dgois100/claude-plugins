// Lógica pura dos hooks do plugin ausencia. Sem I/O: tudo que vem de fora chega por parâmetro.
import { dirname, join } from 'node:path';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const RESPOSTA_PENDENTE = /\*\*Resposta:\*\*\s*_pendente_/g;

const semAspas = (valor) => valor.replace(/^(["'])(.*)\1$/, '$2');

export function lerFrontmatter(conteudo) {
  if (typeof conteudo !== 'string') return null;
  const bloco = conteudo.replace(/^\uFEFF/, '').match(FRONTMATTER);
  if (!bloco) return null;
  const campos = {};
  for (const linha of bloco[1].split(/\r?\n/)) {
    const par = linha.match(/^([A-Za-z_]+):\s*(.*?)\s*$/);
    if (par) campos[par[1]] = par[2];
  }
  const status = campos.status ? semAspas(campos.status.split(/\s+/)[0]) : null;
  return {
    status: status || null,
    desde: campos.desde ? semAspas(campos.desde) : null,
    tarefa: campos.tarefa ? semAspas(campos.tarefa) : null,
  };
}

export function contarPendentes(conteudo) {
  if (typeof conteudo !== 'string') return 0;
  return (conteudo.match(RESPOSTA_PENDENTE) ?? []).length;
}

// Procura o AUSENTE.md: primeiro no diretório do projeto da sessão; depois no cwd,
// subindo até a raiz do repositório git. Fora de um repositório, só o próprio cwd conta.
export function localizarAusente(cwd, projectDir, existe) {
  const cadeia = [];
  let dentroDeRepo = false;
  let dir = cwd;
  while (dir) {
    cadeia.push(dir);
    if (existe(join(dir, '.git'))) {
      dentroDeRepo = true;
      break;
    }
    const pai = dirname(dir);
    if (pai === dir) break;
    dir = pai;
  }
  const candidatos = [projectDir, ...(dentroDeRepo ? cadeia : [cwd])].filter(Boolean);
  for (const pasta of candidatos) {
    const arquivo = join(pasta, 'AUSENTE.md');
    if (existe(arquivo)) return arquivo;
  }
  return null;
}
