# Plugin `ausencia`: design

- **Data:** 2026-10-09
- **Estado:** aprovada e implementada na branch `feat/ausencia`. Os ajustes feitos no plano e na implementação já estão incorporados neste texto.
- **Repositório:** `<pasta do repositório>` (será publicado em `github.com/dgois100/claude-plugins`, público).

## Objetivo

Permitir que o usuário avise o Claude Code de que vai se ausentar, sem que o trabalho pare e sem que decisões dele sejam tomadas no lugar dele de forma arriscada.

- **Na saída** (`/ausente`): o modelo resolve com o usuário, ainda presente, as decisões já conhecidas e as previsíveis; depois entra em modo ausente e continua trabalhando.
- **Durante a ausência:** nenhuma pergunta vai para o chat. Toda dúvida é registrada em `AUSENTE.md`, com opções e uma recomendação.
- **No retorno** (`/voltei`): as dúvidas aparecem uma a uma, com opções e recomendação, no mesmo estilo do brainstorming. As respostas são aplicadas e o `AUSENTE.md` é apagado.

## Critérios de sucesso

1. Em modo ausente, o `AskUserQuestion` é negado e nenhum turno termina sem passar pela checagem de "pergunta no texto".
2. Toda dúvida surgida na ausência termina no `AUSENTE.md` com tipo, contexto, opções e recomendação.
3. Nenhuma ação irreversível ou externa (lista na seção 3) é executada em modo ausente.
4. O modo ausente sobrevive a uma compactação de contexto e a fechar e reabrir a sessão.
5. O `/voltei` apresenta todas as dúvidas pendentes uma a uma, aplica as respostas e só então apaga o arquivo.
6. Outra pessoa instala o plugin a partir do GitHub com dois comandos.

## Fora de escopo

- Prompts de permissão do próprio Claude Code. Se o modo de permissão pedir aprovação, a sessão fica parada até o usuário voltar; o README recomenda auto mode ou allowlist antes de sair.
- Isolamento entre duas sessões no mesmo diretório. O estado é por diretório (limitação documentada).
- Notificações externas (Telegram, e-mail etc.).
- Tradução para outros idiomas além do resumo em inglês do README.

## 1. Estrutura, instalação e publicação

```
claude-plugins/                               ← repo git; marketplace "dgois100"
├─ .claude-plugin/marketplace.json
├─ README.md                                  ← PT-BR + seção "English summary"
├─ LICENSE                                    ← MIT
├─ tests/smoke-headless.mjs                   ← smoke test com claude -p
├─ docs/superpowers/specs/2026-10-09-ausencia-design.md
├─ docs/superpowers/plans/2026-10-09-ausencia.md
└─ plugins/ausencia/
   ├─ .claude-plugin/plugin.json              ← name "ausencia", version "0.1.0"
   ├─ README.md                               ← uso detalhado do plugin
   ├─ skills/ausente/SKILL.md                 ← fluxo de saída
   ├─ skills/voltei/SKILL.md                  ← fluxo de retorno
   └─ hooks/
      ├─ hooks.json
      ├─ logica.mjs                           ← funções puras
      ├─ logica.test.mjs
      ├─ ausencia-hook.mjs                    ← entrada e saída do hook
      └─ ausencia-hook.test.mjs
```

- **Marketplace:** `.claude-plugin/marketplace.json` com `name: "dgois100"` e o plugin `ausencia` com `source: "./plugins/ausencia"` (caminho relativo à raiz do marketplace).
- **Comandos:** `/ausencia:ausente` e `/ausencia:voltei`. As formas curtas `/ausente` e `/voltei` também funcionam (confirmado no teste interativo).
- **Uso pelo autor:** marketplace registrado pela pasta local (`claude plugin marketplace add "<pasta do repositório>"` e `claude plugin install ausencia@dgois100`). Plugin com caminho relativo em marketplace local é carregado direto da pasta: edições valem após `/reload-plugins`, sem reinstalar.
- **Uso por terceiros:** `claude plugin marketplace add dgois100/claude-plugins` e `claude plugin install ausencia@dgois100`. Atualizações: `claude plugin marketplace update dgois100` e `claude plugin update ausencia@dgois100`. O `version` do `plugin.json` sobe a cada versão publicada.
- **Publicação:** criar o repositório público e fazer o push é o último passo do plano e exige confirmação explícita do usuário no momento.
- **Conteúdo público:** nada específico do ambiente do autor (caminhos pessoais, regras de outros projetos). A lista de ações de risco é genérica.
- **Idioma:** comandos, arquivo de estado, skills e README em PT-BR; README com seção curta "English summary".
- **Pré-requisito:** `node` 18 ou mais recente no PATH, para os hooks. Sem node, os hooks falham sem bloquear nada e o plugin funciona só pelas instruções das skills, com menos garantia. Documentado no README.

## 2. Formato do `AUSENTE.md`

Fica na raiz do repositório git (`git rev-parse --show-toplevel`); fora de um repositório, no diretório em que a sessão começou. Exemplo:

```markdown
---
status: ausente
desde: 2026-10-09 22:30
tarefa: Implementar o plano X a partir da Task 3
---

# Ausente

## Decisões tomadas antes de sair
- Escopo: só as Tasks 3 a 6

## Feito enquanto você estava fora
- Task 3 concluída (commit abc123)
- Task 4 parcial: falta a validação do formulário (aguarda D1)

## Dúvidas

### D1 · ESTACIONADA · Fazer push da branch para o remoto?
- **Contexto:** a Task 4 pede abrir PR; push é ação externa.
- **Opções:**
  1. **Push + PR em draft (recomendada)**: ...
  2. **Só commit local**: ...
- **Travado esperando isto:** abertura do PR e Task 6.
- **Resposta:** _pendente_

### D2 · PROVISÓRIA · Nome da tabela de logs
- **Contexto:** ...
- **Opções:**
  1. **`log_eventos` (recomendada)**: ...
  2. **`eventos_log`**: ...
- **Feito com a opção 1:** migration 012, model LogEvento.
- **Como desfazer se você escolher outra:** renomear em 2 arquivos.
- **Resposta:** _pendente_
```

Regras do formato:

- **Cabeçalho:** frontmatter YAML com `status` (`ausente` ou `retomando`), `desde` (data e hora local) e `tarefa` (uma linha).
- **Numeração:** `D1`, `D2`… em ordem de registro, nunca reutilizada.
- **Tipos:**
  - `ESTACIONADA`: ação irreversível ou externa. Nada foi feito; o campo "Travado esperando isto" diz o que ficou parado.
  - `PROVISÓRIA`: decisão reversível. O modelo seguiu com a recomendada; os campos "Feito com a opção N" e "Como desfazer" dizem o que foi feito e como reverter.
- **Opções:** de 2 a 4, com exatamente uma marcada "(recomendada)", listada primeiro. Mesmo formato do `AskUserQuestion`, para virar pergunta direto no retorno.
- **Resposta:** `_pendente_` até ser respondida no `/voltei`. Valores possíveis depois: o texto da escolha, ou `_dispensada pela Dn_`. Quando o `/voltei` aplica a decisão, acrescenta ` (aplicada)` ao fim da linha.
- **Decisões tomadas antes de sair:** seção com uma linha por resposta dada no `/ausente` (`- <pergunta>: <resposta>`), para sobreviver a uma compactação. O hook não lê essa seção.
- **Leitura pelo hook:** o hook ignora um `AUSENTE.md` versionado (seção 4). Nos demais, decide pelo frontmatter; do corpo, só conta as pendentes. Bloqueia apenas quando o primeiro termo de `status`, sem aspas, é `ausente` (então `"ausente"` e `ausente # nota` também contam). Arquivo ausente, frontmatter ilegível ou qualquer outro valor: o hook não bloqueia nada (fail-open); com `retomando`, só o `SessionStart` avisa. O pior caso de erro é o modelo voltar a perguntar, nunca o usuário ficar impedido de responder.

## 3. `/ausente` e o comportamento durante a ausência

### Fluxo do `/ausente [instrução opcional]` (usuário ainda presente)

1. **Pré-checagens:**
   - Em plan mode: pede para o usuário sair do plan mode antes (o modelo não consegue escrever o `AUSENTE.md` nele) e termina.
   - `AUSENTE.md` versionado no repositório (o caminho está no índice do git, mesmo que o arquivo não exista mais no disco): o hook o ignora. Avisa, pede para renomeá-lo com `git mv` (ou, se já foi renomeado sem o git, tirá-lo do índice com `git rm --cached AUSENTE.md`) e termina.
   - `AUSENTE.md` com `status: ausente`: avisa que o modo já está ativo e só atualiza `tarefa` se houver instrução nova.
   - `AUSENTE.md` com `status: retomando` (um `/voltei` ficou pela metade): pergunta se o usuário quer terminar o `/voltei` antes ou levar as dúvidas pendentes para a nova ausência.
   - `AUSENTE.md` com outro `status` ou frontmatter ilegível: não parece ser de uma ausência em andamento. Avisa (se for de uma ausência anterior, o caminho é o `/voltei`; senão, renomeá-lo) e termina, sem sobrescrevê-lo.
2. **Define a tarefa:** a instrução passada; senão, o trabalho em andamento na conversa; senão, pergunta ao usuário o que fazer.
3. **Pergunta de triagem:** "Tenho N perguntas (~X min). Responder agora?" com as opções "Todas", "Só as 3 de maior impacto" e "Nenhuma, já estou saindo". N inclui as pendentes da conversa e as previsíveis da tarefa (escopo, abordagem, nomes, portões de aprovação que certamente virão). Se N = 0, pula para o passo 5.
4. **Perguntas, uma por vez,** via `AskUserQuestion`, da de maior para a de menor impacto, com a recomendação primeiro. As não respondidas serão tratadas pela regra de risco quando surgirem. As respondidas são registradas no passo 5, na seção "Decisões tomadas antes de sair".
5. **Cria o `AUSENTE.md`** com `status: ausente`, `desde`, `tarefa`, a seção "Decisões tomadas antes de sair" com as respostas do passo 4, a seção "Feito enquanto você estava fora" vazia e a seção "Dúvidas" vazia.
6. **Exclusão local do git:** se o diretório estiver num repositório git, acrescenta `AUSENTE.md` ao arquivo indicado por `git rev-parse --git-path info/exclude` (funciona também em worktrees), sem duplicar a linha. Não altera nenhum arquivo versionado.
7. **Confirma numa linha** ("Modo ausente ativo, seguindo com X") e começa a trabalhar no mesmo turno.

### Regras durante a ausência

- **Nada de perguntas no chat:** nem `AskUserQuestion` nem pergunta em texto.
- **Registro imediato:** cada dúvida é escrita no `AUSENTE.md` no momento em que surge.
- **Classificação por risco:**
  - **`ESTACIONADA`** se a ação for irreversível ou externa:
    - push, force-push ou merge na branch principal;
    - deploy ou publicação de qualquer tipo;
    - apagar arquivos, branches ou dados que não foram criados nesta sessão;
    - descartar alterações que não foram feitas nesta sessão (`git reset --hard`, `git checkout -- .`, `git restore`, `git clean`, `git stash drop`) ou reescrever histórico que já existia (`git rebase`, `git commit --amend`);
    - escrever em banco de dados ou em ambiente compartilhado;
    - alterar arquivos que já existiam fora do diretório do projeto (por exemplo, configurações na pasta do usuário); criar arquivos temporários não conta;
    - enviar mensagens, e-mails, comentários, issues ou PRs;
    - qualquer ação paga (APIs pagas, compras);
    - alterar credenciais, permissões ou configuração global da máquina.
  - **`PROVISÓRIA`** em todos os outros casos: segue com a opção recomendada e registra o que fez e como desfazer.
  - **Na dúvida sobre a classificação:** `ESTACIONADA`.
- **Portões de aprovação de outras skills** (aprovar design, spec ou plano; escolher o modo de execução) são sempre `ESTACIONADA`. O modelo pode preparar o artefato, mas nunca aprova no lugar do usuário.
- **Continuar no que é independente:** após registrar uma `ESTACIONADA`, o modelo segue com todo trabalho que não depende dela. Só encerra quando não sobrar nada independente.
- **Subagentes** não escrevem no `AUSENTE.md`. Se precisarem de uma decisão, devolvem a dúvida (com opções e recomendação) no relatório final, e o agente principal registra.
- **Resumo:** a seção "Feito enquanto você estava fora" é atualizada a cada passo relevante (tarefa concluída, commit, bloqueio).
- **O arquivo nunca entra em commit.**

## 4. Hooks

O hook é o script `hooks/ausencia-hook.mjs`, sem dependências. Ele lê o JSON da entrada padrão por eventos, com limite de 2 s, para que um stdin que nunca fecha (ou que é um terminal) não trave a sessão. Procura o `AUSENTE.md` primeiro em `CLAUDE_PROJECT_DIR` e depois no `cwd`, subindo até a raiz do repositório git; fora de um repositório, só o próprio `cwd` conta. Se o arquivo encontrado é versionado (`git -C <pasta dele> ls-files --error-unmatch -- AUSENTE.md`, com limite de 1,5 s), o hook o ignora: o `/ausente` nunca o põe em commit, então ele veio do repositório ou foi adicionado ao git por engano. O processo do git roda com o cwd na pasta do plugin, porque no Windows o executável é procurado primeiro no cwd, e um `git.exe` plantado no repositório rodaria. Sem git, fora de um repositório ou com erro, o arquivo conta como não versionado. Escreve no máximo um JSON na saída padrão e sai sempre com código 0; qualquer exceção resulta em saída silenciosa (fail-open).

**Organização para teste:** a lógica fica em funções puras exportadas por `hooks/logica.mjs`; o `hooks/ausencia-hook.mjs` só lê a entrada e o arquivo, confere se ele é versionado e escreve a saída.

- `lerFrontmatter(conteudo)` → `{ status, desde, tarefa }` ou `null`.
- `contarPendentes(conteudo)` → número de ocorrências de `**Resposta:** _pendente_`.
- `localizarAusente(cwd, projectDir, existe)` → caminho do `AUSENTE.md` ou `null`.
- `decidir(entrada, conteudo, caminhoRegras, caminhoRetorno)` → objeto de saída do hook ou `null`. As mensagens citam o caminho absoluto do `SKILL.md` de cada skill, porque as duas têm `disable-model-invocation: true` e o modelo precisa relê-las pelo caminho depois de uma compactação.

**Regra geral:** se `conteudo` é `null` (sem arquivo, ou com arquivo versionado) ou `status` não é `ausente`, `decidir` retorna `null` para todos os eventos. Exceção: com `status: retomando`, o `SessionStart` age. Na compactação (`compact`), injeta "Há um /voltei pela metade, com {n} dúvida(s) pendente(s) no AUSENTE.md. Não retome sozinho: pergunte ao usuário se quer continuar o /voltei; se ele confirmar, releia o AUSENTE.md e siga a skill ausencia:voltei ({caminho})."; nas demais origens (`startup|resume|clear|fork`), injeta "Há um /voltei interrompido com {n} dúvida(s) pendente(s) no AUSENTE.md; sugira /voltei para terminar.", para o arquivo não ficar esquecido.

| Evento (matcher) | Condição extra | Saída |
|---|---|---|
| `PreToolUse` (`AskUserQuestion`), agente principal | nenhuma | `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Usuário ausente (AUSENTE.md, status: ausente). Não pergunte. Registre esta dúvida no AUSENTE.md como PROVISÓRIA ou ESTACIONADA, conforme a skill ausencia:ausente ({caminho}), e siga com o trabalho independente. Se o usuário voltou e você está no /voltei, troque o status para retomando antes de perguntar."}}` |
| `PreToolUse` (`AskUserQuestion`), subagente | entrada tem `agent_id` | Mesmo formato, com o motivo: "Usuário ausente. Não pergunte. Devolva a dúvida, com opções e recomendação, no seu relatório final para o agente principal registrar." |
| `SessionStart` (`compact`) | nenhuma | `additionalContext`: "Modo ausente ativo desde {desde}. Tarefa: {tarefa}. Releia o AUSENTE.md e siga a skill ausencia:ausente ({caminho}): nenhuma pergunta no chat, registre dúvidas no arquivo." |
| `SessionStart` (`startup\|resume\|clear\|fork`) | nenhuma | `additionalContext`: "Há um AUSENTE.md com status ausente e {n} dúvida(s) pendente(s). O usuário provavelmente voltou: sugira /voltei." |
| `UserPromptSubmit` | `prompt` não começa com `/voltei`, `/ausencia:voltei`, `/ausente` nem `/ausencia:ausente` | `additionalContext`: "O usuário está interagindo, mas o modo ausente continua ativo, com {n} dúvida(s) pendente(s) no AUSENTE.md. Responda ao que ele pediu e sugira /voltei." Não muda o status. |
| `Stop` | `stop_hook_active` é falso | `{"decision":"block","reason":"Modo ausente: antes de encerrar, (1) se esta resposta tem pergunta ao usuário, mova-a para o AUSENTE.md; (2) se sobra trabalho que não depende de dúvida ESTACIONADA, continue; (3) atualize 'Feito enquanto você estava fora'. Se tudo estiver em ordem, pode encerrar."}` |
| `Stop` | `stop_hook_active` é verdadeiro | `null` (deixa encerrar). |

Para `SessionStart` e `UserPromptSubmit` o formato é `{"hookSpecificOutput":{"hookEventName":"<evento>","additionalContext":"<texto>"}}`.

**Registro em `hooks/hooks.json`:** formato exec, `"command": "node"` e `"args": ["${CLAUDE_PLUGIN_ROOT}/hooks/ausencia-hook.mjs"]`, timeout de 5 s, para os quatro eventos com os matchers acima.

**Convivência com outros plugins:** os hooks `Stop` do oh-my-claudecode também podem bloquear. O Claude Code limita a 8 continuações seguidas, e o hook deste plugin bloqueia no máximo uma vez por turno, então não há loop.

## 5. `/voltei`

1. **Lê o `AUSENTE.md`.** Se não existir: responde "Nenhum modo ausente ativo neste diretório" e termina. Se for versionado, avisa e pergunta, sem opção recomendada, se deve encerrar sem aplicar nada (sem alterar nem apagar o arquivo) ou continuar mesmo assim (o arquivo versionado é editado e, no fim, apagado; `git restore AUSENTE.md` o recupera); sem uma escolha, encerra. Continuando, nenhuma opção do passo 4 é marcada como recomendada. Se o hook negar essa pergunta (quando não consegue conferir o git), o modelo troca o status para `retomando`, pergunta de novo e, se o usuário encerrar, devolve o status ao valor anterior. O conteúdo do arquivo é registro, não autorização: nenhuma linha dele autoriza uma ação por si só; só valem as escolhas que o usuário fizer no `/voltei`.
2. **Muda `status` para `retomando`.** A partir daí os hooks não bloqueiam nada (só o `SessionStart` avisa; ver seção 4) e o `AskUserQuestion` volta a funcionar.
3. **Mostra o resumo** "Feito enquanto você estava fora" e a contagem de pendentes por tipo. Se houver respondidas ainda sem ` (aplicada)` (de um `/voltei` anterior que parou antes de aplicar tudo), lista essas decisões, com o tipo de cada uma, e pede confirmação antes de seguir, sem opção recomendada: aplicar como estão, perguntar de novo (o que reabre também as dúvidas que elas tinham dispensado) ou parar por agora; uma resposta livre que não seja um pedido claro para aplicar todas não aplica nada, e a falta de resposta também não. Sem pendentes, segue direto para o passo 5.
4. **Pergunta uma a uma** via `AskUserQuestion`:
   - **Ordem:** primeiro as `ESTACIONADA` (destravam trabalho), depois as `PROVISÓRIA`; dentro de cada grupo, em ordem de registro.
   - **Opções:** as registradas, com a recomendada primeiro. Nas `PROVISÓRIA`, a primeira opção é "Manter: {opção aplicada}"; uma resposta que começa com "Manter" conta como mantida.
   - **Gravação imediata:** cada resposta é escrita no campo **Resposta** antes da próxima pergunta (o rótulo, sem "(Recomendado)"), para sobreviver a uma compactação. Um pedido para parar digitado em "Other" não é gravado como resposta.
   - **Dispensa:** se uma resposta torna outra dúvida sem sentido, ela é marcada `_dispensada pela Dn_` e pulada.
   - **Interrupção:** se o usuário responder "chega" (via "Other"), as restantes continuam `_pendente_`, o status continua `retomando` e o fluxo termina. Sem uma escolha do usuário (pergunta negada pelo usuário, sem resposta ou ferramenta indisponível), vale o mesmo: nada é gravado nessa dúvida. Um novo `/voltei` retoma da primeira pendente; ao abrir uma nova sessão, o `SessionStart` lembra disso, e, se o contexto for compactado no meio do `/voltei`, o `SessionStart` manda o modelo perguntar se o usuário quer continuar, em vez de retomar sozinho.
5. **Aplica as decisões** que ainda não têm ` (aplicada)`, marcando cada uma com esse sufixo logo depois de concluí-la, para um `/voltei` interrompido nunca repetir nem pular uma decisão:
   - `PROVISÓRIA` com escolha diferente da aplicada: desfaz e refaz conforme a escolha. Texto livre só conta como outra escolha se pedir com clareza uma alternativa específica; senão, conta como mantida.
   - `ESTACIONADA` aprovada: executa agora, passando pelas permissões normais. Texto livre só conta como aprovação se pedir com clareza uma ação específica; senão, conta como adiada.
   - Se houver algo a executar, antes de rodar qualquer coisa mostra todos os comandos (os das ESTACIONADA aprovadas, os passos de desfazer e de refazer das PROVISÓRIA trocadas e o comando de testes), com os irreversíveis ou externos em destaque, e pede uma única confirmação, sem opção recomendada: "Parar por agora" ou "Executar", nesta ordem, para que um Enter acidental não execute nada. Só com "Executar" roda o que mostrou; um comando irreversível ou externo que não foi mostrado (inclusive outra forma de um comando mostrado; na dúvida, conta como irreversível) conta como falha ao aplicar. Com "Parar por agora", sem resposta ou com uma resposta livre que não seja um sim claro, nada roda: o status continua `retomando` e o arquivo fica.
6. **Resume no chat** as decisões tomadas (o arquivo vai deixar de existir), mostra a tarefa registrada e, como registro, as decisões tomadas antes de sair, e pergunta, sem opção recomendada, se deve retomá-la; se ela já estava concluída, só avisa. Sem uma escolha do usuário, conta como "não retomar".
7. **Apaga o `AUSENTE.md`** só depois de todas as decisões aplicadas e da resposta sobre a tarefa; assim, uma compactação antes dessa resposta ainda encontra o arquivo e o hook avisa que há um `/voltei` pela metade. A linha em `info/exclude` permanece (inofensiva e reaproveitada na próxima ausência). Se o usuário escolheu retomar, a tarefa segue em modo normal.

## 6. Casos de borda

| Situação | Comportamento |
|---|---|
| `/ausente` em plan mode | Pede para sair do plan mode antes. |
| `/ausente` com `status: ausente` | Avisa que já está ativo; atualiza `tarefa` se houver instrução nova. |
| `/ausente` com `status: retomando` | Pergunta: terminar o `/voltei` antes ou levar as pendentes para a nova ausência (nesse caso, volta o status para `ausente`; as dúvidas já respondidas ficam para o próximo `/voltei`, que pede confirmação antes de aplicá-las). |
| `/voltei` sem arquivo | "Nenhum modo ausente ativo neste diretório." |
| `/voltei` sem dúvidas | Mostra o resumo, pergunta se deve retomar a tarefa (se ela não estava concluída) e apaga o arquivo. |
| Frontmatter corrompido | Hooks não agem (fail-open). O `/voltei` lê as dúvidas pelo corpo do arquivo mesmo assim. |
| Usuário apaga o arquivo à mão | O modo ausente acaba. |
| Duas sessões no mesmo diretório | Ambas ficam em modo ausente (estado por diretório). Limitação documentada. |
| Sem `node` no PATH | Hooks falham sem bloquear; plugin funciona só pelas instruções. Documentado. |
| `AUSENTE.md` versionado no repositório (por exemplo, de um clone) | O hook o ignora. O `/ausente` se recusa a usar o caminho enquanto ele estiver no índice do git, mesmo que o arquivo tenha sido renomeado sem o git. O `/voltei` avisa e pergunta, sem recomendação, se deve encerrar sem aplicar nada ou continuar; continuando, não marca recomendação nas perguntas, trata o conteúdo como registro, não autorização, e pede confirmação antes de executar e antes de retomar a tarefa. |
| `/ausente` com um `AUSENTE.md` de `status` desconhecido ou frontmatter ilegível | Avisa (se for de uma ausência anterior, sugere o `/voltei`) e termina, sem sobrescrever o arquivo. |
| Usuário digita algo durante a ausência | `UserPromptSubmit` lembra o modelo de sugerir `/voltei`; o modo continua ativo. O `Stop` ainda bloqueia uma vez nesse turno (efeito aceito). |

## 7. Testes

- **Unitários** (`node --test`), escritos antes do código (TDD), sobre as funções puras:
  - `lerFrontmatter`: sem frontmatter, `ausente`, `retomando`, valor desconhecido, conteúdo lixo, CRLF, BOM, aspas e comentário depois do valor.
  - `contarPendentes`: zero, várias, respostas preenchidas e dispensadas.
  - `decidir`, para cada evento × estado (sem arquivo, `ausente`, `retomando`, corrompido): agente principal versus subagente no `PreToolUse`; cada matcher de `SessionStart`, incluindo a exceção de `retomando`; prompts que começam com os comandos do plugin versus outros no `UserPromptSubmit`; `stop_hook_active` verdadeiro e falso no `Stop`.
  - Execução do script de ponta a ponta com stdin simulado: JSON válido na saída, código 0, e código 0 sem saída quando o stdin é inválido; entrada que chega aos poucos; stdin que nunca fecha (o hook desiste de ler após 2 s e termina sem saída); `AUSENTE.md` versionado num repositório git real (antes do `git add`, ativa o modo; depois, o hook não age); sem git no PATH, o versionado conta como não versionado; um `git.exe` plantado ao lado do `AUSENTE.md` nunca roda.
- **Contrato entre arquivos:** um teste lê as duas skills e o `plugin.json` e confere os marcadores e os nomes de comando que o hook usa, e que os caminhos citados nas mensagens existem.
- **Validação estrutural:** `claude plugin validate` no marketplace.
- **Smoke test headless** (`tests/smoke-headless.mjs`, com `claude -p`): `SessionStart` e `Stop` numa sessão real. O `AskUserQuestion` não existe no modo `-p`, então o resto é coberto pelo teste interativo.
- **Teste interativo** num repositório git descartável:
  1. instalar pelo marketplace local;
  2. rodar `/ausente` com uma tarefa de brinquedo que force uma dúvida de cada tipo;
  3. confirmar que o `AskUserQuestion` é negado, que o arquivo é preenchido corretamente, que `AUSENTE.md` está em `info/exclude` e que o `Stop` bloqueia uma vez;
  4. rodar `/voltei`, ver as perguntas uma a uma e o arquivo apagado no fim;
  5. testar as formas curtas `/ausente` e `/voltei`.
