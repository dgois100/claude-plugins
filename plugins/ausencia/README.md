# ausencia

Plugin do Claude Code para quando você vai se ausentar e quer que o trabalho continue sem que decisões suas sejam tomadas de forma arriscada.

## Instalação

No Claude Code 2.1.275 ou mais recente, dentro de uma sessão:

```
/plugin install ausencia --marketplace dgois100/claude-plugins
```

Em qualquer versão, pelo terminal:

```bash
claude plugin marketplace add dgois100/claude-plugins
claude plugin install ausencia@dgois100
```

Para atualizar: `claude plugin marketplace update dgois100` e `claude plugin update ausencia@dgois100`.

## Como usar

1. **Antes de sair:** `/ausente [o que fazer enquanto você está fora]`
   - O Claude faz primeiro as perguntas que já sabe que vai precisar, uma de cada vez e com uma recomendação. Você pode responder todas, só as 3 mais importantes ou nenhuma.
   - Em seguida cria o `AUSENTE.md` na raiz do repositório e começa a trabalhar.
2. **Enquanto você está fora,** o Claude não pergunta nada no chat. Cada dúvida vai para o `AUSENTE.md`, com opções e recomendação:
   - **PROVISÓRIA:** decisão reversível. Ele segue com a opção recomendada e anota como desfazer.
   - **ESTACIONADA:** ação irreversível ou externa (push, merge na branch principal, deploy, publicação, apagar ou descartar o que não fez, reescrever histórico, escrever em banco ou mexer em arquivos fora do projeto, enviar mensagens, ações pagas, credenciais). Ele não executa e segue com o que não depende dela.
3. **Ao voltar:** `/voltei`
   - O Claude mostra o que foi feito e faz as dúvidas uma a uma: primeiro as estacionadas, depois as provisórias.
   - Depois aplica suas respostas, apaga o `AUSENTE.md` e retoma a tarefa.
   - Se você responder "chega" no meio, um novo `/voltei` continua de onde parou.

Os comandos também funcionam com o prefixo do plugin: `/ausencia:ausente` e `/ausencia:voltei`.

## O arquivo `AUSENTE.md`

Fica na raiz do repositório git (ou no diretório da sessão, fora do git). Além das dúvidas, guarda as decisões que você tomou antes de sair e o resumo do que foi feito. O frontmatter guarda o estado:

```markdown
---
status: ausente
desde: 2026-10-09 22:30
tarefa: Implementar o plano X a partir da Task 3
---
```

Os valores possíveis do `status` são `ausente` (perguntas bloqueadas) e `retomando` (durante o `/voltei`). Apagar o arquivo encerra o modo ausente. O `/ausente` acrescenta `AUSENTE.md` ao `.git/info/exclude`, um ignore só local, para o arquivo nunca entrar em commit.

## Como o modo é garantido

| Hook | O que faz no modo ausente |
|---|---|
| `PreToolUse` (`AskUserQuestion`) | Nega a pergunta e manda registrar no `AUSENTE.md`. Subagentes são orientados a devolver a dúvida no relatório. |
| `SessionStart` | Depois de uma compactação, relembra o modo e onde estão as regras (se for no meio do `/voltei`, manda perguntar se você quer continuar, em vez de retomar sozinho). Ao abrir, retomar, limpar ou bifurcar uma sessão, sugere `/voltei`, inclusive quando um `/voltei` ficou pela metade. |
| `UserPromptSubmit` | Se você digitar algo que não seja `/ausente` ou `/voltei`, lembra o Claude de sugerir `/voltei`. |
| `Stop` | Na primeira tentativa de encerrar o turno, cobra um checklist: nenhuma pergunta no texto, nada independente sobrando e resumo atualizado. |

Se algo der errado no hook, ele não bloqueia nada (fail-open).

## Requisitos e limitações

- **`node` 18 ou mais recente no PATH.** Sem ele, os hooks não rodam e o modo depende só das instruções das skills.
- **Prompts de permissão do Claude Code continuam existindo.** Se o seu modo de permissão pedir aprovação, a sessão para até você voltar. Antes de sair, use o auto mode ou uma allowlist adequada.
- **O estado é por diretório.** Duas sessões no mesmo projeto ficam as duas em modo ausente.
- **Qualquer `AUSENTE.md` com `status: ausente` ativa o modo,** inclusive um que venha versionado num repositório clonado. Para sair, rode `/voltei` ou apague o arquivo.

## Desenvolvimento

```bash
node --test plugins/ausencia/hooks/logica.test.mjs plugins/ausencia/hooks/ausencia-hook.test.mjs
node tests/smoke-headless.mjs   # usa claude -p com o modelo haiku
```

Para testar edições sem reinstalar, registre o marketplace pela pasta local (`claude plugin marketplace add <pasta do repositório>`) e rode `/reload-plugins` na sessão. Se a mudança não aparecer, rode `claude plugin update ausencia@dgois100` e `/reload-plugins` de novo.
