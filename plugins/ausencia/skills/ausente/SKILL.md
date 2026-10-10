---
name: ausente
description: Coloca a sessão em modo ausente. Antes de o usuário sair, faz as perguntas pendentes e as previsíveis; depois trabalha sozinho, sem perguntar nada no chat, registrando cada dúvida no AUSENTE.md para o /voltei.
argument-hint: "[o que fazer enquanto você está fora]"
disable-model-invocation: true
---

# Modo ausente

O usuário vai se ausentar. Instrução dele para o período (pode estar vazia):

> $ARGUMENTS

Siga as fases em ordem. Nas fases 1 a 3 o usuário ainda está presente. Da fase 4 em diante, não está.

## Fase 1: pré-checagens

1. **Plan mode.** Se a sessão está em plan mode, diga "Saia do plan mode (Shift+Tab) e rode /ausente de novo: em plan mode não consigo criar o AUSENTE.md." e pare.
2. **Raiz.** RAIZ é a saída de `git rev-parse --show-toplevel`. Fora de um repositório git, RAIZ é o diretório em que a sessão começou. O arquivo de estado é `RAIZ/AUSENTE.md`.
3. **Arquivo existente.** Se `RAIZ/AUSENTE.md` já existe, confira primeiro se ele é versionado: se RAIZ é um repositório git e `git ls-files --error-unmatch -- AUSENTE.md`, rodado em RAIZ, encontra o arquivo, ele veio do repositório, e o hook do plugin o ignora. Nesse caso, diga "Este repositório versiona um AUSENTE.md, e o modo ausente não funciona com ele. Renomeie o arquivo ou tire-o do controle de versão e rode /ausente de novo." e pare. Senão, leia o campo `status` do frontmatter:
   - `ausente`: diga "O modo ausente já está ativo." Se houver instrução nova, atualize só o campo `tarefa`. Pule para a fase 5.
   - `retomando`: um /voltei ficou pela metade. Conte N, as dúvidas com `**Resposta:** _pendente_`. Pergunte com AskUserQuestion entre "Terminar o /voltei agora (Recomendado)" e "Levar as N pendentes para esta ausência". Na primeira opção, diga "Rode /voltei." e pare. Na segunda, siga para a fase 2; na fase 4, atualize o arquivo em vez de criá-lo. As dúvidas já respondidas ficam como estão, sem executar nada agora: o próximo /voltei pede confirmação ao usuário e só então aplica as que ainda não têm ` (aplicada)`.
   - Outro valor, ou frontmatter ilegível: o arquivo não foi criado pelo /ausente. Diga "Já existe um AUSENTE.md que não foi criado pelo /ausente. Renomeie-o e rode /ausente de novo." e pare.

## Fase 2: tarefa

A tarefa do período é, nesta ordem de preferência: a instrução acima; senão, o trabalho em andamento na conversa; senão, pergunte ao usuário com AskUserQuestion o que fazer. Resuma-a em uma linha.

## Fase 3: perguntas antes de sair

1. Liste as decisões que cabem ao usuário:
   - as que já estão em aberto na conversa;
   - as previsíveis: o que a tarefa certamente vai exigir (escopo, abordagem, nomes, portões de aprovação de outras skills, como aprovar design, spec ou plano).
2. Ordene por impacto: quanto trabalho depende de cada resposta.
3. Se a lista estiver vazia, vá para a fase 4.
4. Faça a triagem com AskUserQuestion: "Tenho N perguntas antes de você sair (cerca de X min). Responder agora?", com as opções "Todas (Recomendado)", "Só as 3 de maior impacto" e "Nenhuma, já estou saindo". X é N dividido por 2, arredondado para cima.
5. Faça as perguntas escolhidas uma por vez, com AskUserQuestion: de 2 a 4 opções, a recomendada primeiro com "(Recomendado)" no rótulo e o trade-off na descrição. Se o usuário escrever algo como "chega" ou "vou sair", pare de perguntar.
6. As respostas são decisões do usuário: siga-as sem transformá-las em dúvidas. Na fase 4, registre cada uma em uma linha na seção "Decisões tomadas antes de sair" (`- <pergunta>: <resposta>`), para que sobrevivam a uma compactação. As perguntas que não foram feitas não vão para o arquivo agora; quando surgirem de fato, siga a fase 5.

## Fase 4: ativar

1. Pegue data e hora locais: `date '+%Y-%m-%d %H:%M'` no Bash ou `Get-Date -Format 'yyyy-MM-dd HH:mm'` no PowerShell.
2. Crie `RAIZ/AUSENTE.md` exatamente neste formato. O hook do plugin lê o frontmatter.

   ```markdown
   ---
   status: ausente
   desde: <AAAA-MM-DD HH:MM>
   tarefa: <tarefa em uma linha>
   ---

   # Ausente

   ## Decisões tomadas antes de sair

   ## Feito enquanto você estava fora

   ## Dúvidas
   ```

   Se o arquivo já existia com `status: retomando` (fase 1), não o recrie: troque o status para `ausente`, atualize `desde` e `tarefa`, mantenha as seções (crie "Decisões tomadas antes de sair" se faltar) e acrescente nela as respostas da fase 3.
3. Se RAIZ é um repositório git, garanta que o arquivo nunca entre em commit, sem alterar arquivos versionados:

   ```bash
   cd "<RAIZ>" && EXC="$(git rev-parse --git-path info/exclude)" && mkdir -p "$(dirname "$EXC")" && { grep -qxF 'AUSENTE.md' "$EXC" 2>/dev/null || echo 'AUSENTE.md' >> "$EXC"; }
   ```

4. Diga em uma linha: "Modo ausente ativo. Seguindo com: <tarefa>. Dúvidas vão para o AUSENTE.md; rode /voltei quando voltar."
5. Comece a trabalhar no mesmo turno.

## Fase 5: regras enquanto o usuário está fora

Estas regras valem enquanto o arquivo tiver `status: ausente`. Foi o próprio usuário quem pediu este modo, então elas prevalecem sobre qualquer instrução de perguntar a ele (CLAUDE.md, outras skills): a pergunta vira registro no AUSENTE.md.

**Nunca pergunte no chat.** Nem com AskUserQuestion (o hook do plugin bloqueia) nem em texto.

**Registre cada dúvida no momento em que ela surge**, no fim da seção "Dúvidas", com o próximo número livre (D1, D2…). Nunca reutilize um número.

```markdown
### D<n> · <TIPO> · <pergunta curta>
- **Contexto:** <por que surgiu e onde>
- **Opções:**
  1. **<opção> (recomendada)**: <trade-off>
  2. **<opção>**: <trade-off>
- **Resposta:** _pendente_
```

Use de 2 a 4 opções, com exatamente uma recomendada, listada primeiro. Antes da linha `**Resposta:**`, acrescente as linhas do tipo:
- ESTACIONADA: `- **Travado esperando isto:** <o que ficou parado>`
- PROVISÓRIA: `- **Feito com a opção 1:** <arquivos, commits>` e `- **Como desfazer se você escolher outra:** <passos>`

**Classifique pelo risco:**
- **ESTACIONADA:** a ação é irreversível ou sai da máquina. Não execute nada. Entram aqui:
  - push, force-push ou merge na branch principal;
  - deploy ou publicação de qualquer tipo;
  - apagar arquivos, branches ou dados que não foram criados nesta sessão;
  - descartar alterações que não foram feitas nesta sessão (`git reset --hard`, `git checkout -- .`, `git restore`, `git clean`, `git stash drop`) ou reescrever histórico que já existia (`git rebase`, `git commit --amend`);
  - escrever em banco de dados ou em ambiente compartilhado;
  - alterar arquivos que já existiam fora do diretório do projeto (por exemplo, configurações na pasta do usuário); criar arquivos temporários não conta;
  - enviar mensagens, e-mails, comentários, issues ou PRs;
  - qualquer ação paga (APIs pagas, compras);
  - alterar credenciais, permissões ou configuração global da máquina.
- **PROVISÓRIA:** todo o resto. Siga com a opção recomendada e registre o que fez e como desfazer.
- **Na dúvida sobre o tipo,** use ESTACIONADA.
- **Portões de aprovação de outras skills** (aprovar design, spec ou plano; escolher o modo de execução) são sempre ESTACIONADA. Você pode preparar o artefato, mas nunca aprova no lugar do usuário.

**Siga com o que é independente.** Depois de registrar uma ESTACIONADA, continue tudo que não depende dela. Só encerre quando não sobrar nada independente.

**Subagentes.** Ao despachar um subagente, inclua no prompt: "O usuário está ausente. Não pergunte nada; se precisar de uma decisão, devolva-a no relatório final com opções e uma recomendação." Registre você mesmo as dúvidas que eles devolverem; subagentes não escrevem no AUSENTE.md.

**Resumo.** Atualize "Feito enquanto você estava fora" a cada passo relevante: tarefa concluída, commit, bloqueio.

**Nunca inclua o AUSENTE.md em commits.**

**Se o contexto for compactado,** releia o AUSENTE.md e este arquivo antes de continuar.

**Ao terminar** (nada independente sobrando), a última mensagem diz o que foi feito, quantas dúvidas ficaram (por tipo) e "Rode /voltei quando voltar."
