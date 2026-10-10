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

const COMANDO_DO_PLUGIN = /^\s*\/(?:ausencia:)?(?:ausente|voltei)(?:\s|$)/;

const MSG_STOP =
  "Modo ausente: antes de encerrar, (1) se esta resposta tem pergunta ao usuário, mova-a para o AUSENTE.md; " +
  "(2) se sobra trabalho que não depende de dúvida ESTACIONADA, continue; " +
  "(3) atualize 'Feito enquanto você estava fora'. Se tudo estiver em ordem, pode encerrar.";

const MSG_SUBAGENTE =
  'Usuário ausente. Não pergunte. Devolva a dúvida, com opções e recomendação, ' +
  'no seu relatório final para o agente principal registrar.';

const pendentes = (n) => `${n} dúvida${n === 1 ? '' : 's'} pendente${n === 1 ? '' : 's'}`;
const skill = (nome, caminho) => `a skill ausencia:${nome}${caminho ? ` (${caminho})` : ''}`;
const contexto = (evento, texto) => ({ hookSpecificOutput: { hookEventName: evento, additionalContext: texto } });

export function decidir(entrada, conteudo, caminhoRegras, caminhoRetorno) {
  const frontmatter = lerFrontmatter(conteudo);
  if (!entrada || !frontmatter) return null;
  const evento = entrada.hook_event_name;
  const n = contarPendentes(conteudo);

  if (frontmatter.status === 'retomando') {
    if (evento !== 'SessionStart') return null;
    if (entrada.source === 'compact') {
      return contexto(
        'SessionStart',
        `Há um /voltei em andamento, com ${pendentes(n)} no AUSENTE.md. Releia o AUSENTE.md e siga ${skill('voltei', caminhoRetorno)} ` +
          'a partir da primeira dúvida pendente (ou da fase 5, se só faltar aplicar).',
      );
    }
    return contexto('SessionStart', `Há um /voltei interrompido com ${pendentes(n)} no AUSENTE.md; sugira /voltei para terminar.`);
  }
  if (frontmatter.status !== 'ausente') return null;

  switch (evento) {
    case 'PreToolUse':
      if (entrada.tool_name !== 'AskUserQuestion') return null;
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: entrada.agent_id
            ? MSG_SUBAGENTE
            : `Usuário ausente (AUSENTE.md, status: ausente). Não pergunte. Registre esta dúvida no AUSENTE.md como PROVISÓRIA ou ESTACIONADA, conforme ${skill('ausente', caminhoRegras)}, e siga com o trabalho independente. ` +
              'Se o usuário voltou e você está no /voltei, troque o status para retomando antes de perguntar.',
        },
      };
    case 'SessionStart':
      if (entrada.source === 'compact') {
        return contexto(
          'SessionStart',
          `Modo ausente ativo desde ${frontmatter.desde ?? '(sem data)'}. Tarefa: ${frontmatter.tarefa ?? '(não informada)'}. ` +
            `Releia o AUSENTE.md e siga ${skill('ausente', caminhoRegras)}: nenhuma pergunta no chat, registre dúvidas no arquivo.`,
        );
      }
      return contexto('SessionStart', `Há um AUSENTE.md com status ausente e ${pendentes(n)}. O usuário provavelmente voltou: sugira /voltei.`);
    case 'UserPromptSubmit':
      if (COMANDO_DO_PLUGIN.test(entrada.prompt ?? '')) return null;
      return contexto(
        'UserPromptSubmit',
        `O usuário está interagindo, mas o modo ausente continua ativo, com ${pendentes(n)} no AUSENTE.md. Responda ao que ele pediu e sugira /voltei.`,
      );
    case 'Stop':
      if (entrada.stop_hook_active) return null;
      return { decision: 'block', reason: MSG_STOP };
    default:
      return null;
  }
}
