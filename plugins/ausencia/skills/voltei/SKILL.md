---
name: voltei
description: Encerra o modo ausente. Mostra o que foi feito, faz uma a uma as dúvidas registradas no AUSENTE.md com opções e recomendação, aplica as respostas e apaga o arquivo.
disable-model-invocation: true
---

# Retorno do modo ausente

O usuário voltou. Siga as fases em ordem.

## Fase 1: localizar

RAIZ é a saída de `git rev-parse --show-toplevel`. Fora de um repositório git, RAIZ é o diretório em que a sessão começou. Se `RAIZ/AUSENTE.md` não existe, diga "Nenhum modo ausente ativo neste diretório." e pare.

## Fase 2: destravar

Antes de qualquer pergunta, troque no frontmatter `status: ausente` por `status: retomando`. Enquanto o status for `ausente`, o hook do plugin bloqueia o AskUserQuestion. Se já estiver `retomando` (um /voltei anterior foi interrompido), mantenha. Se o frontmatter estiver ilegível, siga assim mesmo: nesse caso o hook não bloqueia.

## Fase 3: resumo

Mostre a seção "Feito enquanto você estava fora" (resuma se for longa) e a contagem: "N dúvidas pendentes: X estacionadas, Y provisórias." Pendente é toda dúvida com `**Resposta:** _pendente_`. Conte também A, as respondidas que ainda não foram aplicadas: linha `**Resposta:**` preenchida, sem `_dispensada pela D<n>_` e sem o sufixo ` (aplicada)`; elas sobram de um /voltei anterior que parou antes de aplicar tudo.

Se A for maior que 0, liste essas decisões (D<n>, pergunta e resposta registrada) e, antes de qualquer outra coisa, pergunte com AskUserQuestion:
- "Aplicar como estão (Recomendado)": siga em frente; elas serão aplicadas na fase 5.
- "Perguntar de novo": troque por `_pendente_` a resposta delas e também a das dúvidas que elas tinham dispensado (`_dispensada pela D<n>_` com o número de uma delas), recalcule N e A, e siga.
- "Parar por agora": mantenha `status: retomando`, não aplique nada e diga "Rode /voltei quando quiser continuar." Pare aqui.

Se a resposta vier em "Other": um pedido para parar conta como "Parar por agora"; qualquer outra coisa que não seja um pedido claro para aplicar todas, não aplique nada e pergunte de novo.

Depois: se N for maior que 0, vá para a fase 4; se N for 0 e A for maior que 0, vá para a fase 5; se N e A forem 0, vá para a fase 6.

## Fase 4: perguntas, uma por vez

1. **Ordem:** primeiro as ESTACIONADA, depois as PROVISÓRIA; dentro de cada grupo, pelo número (D1, D2…). Pule as já respondidas ou dispensadas.
2. **Cada pergunta** é um AskUserQuestion com `header` "D<n>" e, na `question`, a pergunta e o contexto em uma ou duas frases:
   - ESTACIONADA: as opções registradas, a recomendada primeiro com "(Recomendado)" no rótulo; na descrição, o trade-off e o que está travado.
   - PROVISÓRIA: a primeira opção é "Manter: <opção aplicada> (Recomendado)", com o que foi feito na descrição; depois as demais, com o custo de desfazer na descrição.
   - Se houver mais de 4 opções registradas, use as 4 primeiras; o "Other" cobre o resto.
3. **Grave cada resposta antes da próxima pergunta,** para nada se perder numa compactação: troque o `_pendente_` daquela dúvida pelo rótulo escolhido, sem o "(Recomendado)", ou pelo texto livre se o usuário usou "Other". Se o texto livre for um pedido para parar (item 5), não grave nada nessa dúvida.
4. **Dispensa:** se uma resposta deixa outra dúvida pendente sem sentido, troque o `_pendente_` dela por `_dispensada pela D<n>_` e não a pergunte.
5. **Interrupção:** se o usuário responder algo como "chega" ou "depois", pare. Mantenha `status: retomando`, não aplique nada nem apague o arquivo, e diga: "Faltam N dúvidas. Rode /voltei para continuar de onde parou."

## Fase 5: aplicar

Com todas as dúvidas respondidas ou dispensadas, percorra as respondidas que ainda não têm o sufixo ` (aplicada)`, na mesma ordem da fase 4. As que já têm o sufixo foram aplicadas por um /voltei anterior: não as repita.
- PROVISÓRIA mantida (resposta que começa com "Manter"): nada a fazer.
- PROVISÓRIA com outra escolha: desfaça seguindo "Como desfazer" e refaça com a escolha. Rode os testes do projeto, se houver.
- ESTACIONADA aprovada: execute agora, normalmente. As permissões da sessão continuam valendo.
- ESTACIONADA recusada ou adiada: nada a fazer; registre no resumo final.

Logo depois de concluir cada uma, inclusive as que não exigem nada, acrescente ` (aplicada)` ao fim da linha `**Resposta:**` dela e grave o arquivo antes de passar à próxima. Assim um /voltei interrompido nunca repete nem pula uma decisão.

Se algo falhar ao aplicar, pare, mostre o erro e **não apague o arquivo**: ele ainda é o registro das decisões.

## Fase 6: encerrar

1. Guarde o valor do campo `tarefa` e apague `RAIZ/AUSENTE.md`. Não mexa no `info/exclude` do git; a linha é reaproveitada na próxima ausência.
2. Mostre no chat uma tabela `Dúvida | Decisão | O que foi feito`, já que o arquivo deixou de existir.
3. Mostre a tarefa guardada e pergunte com AskUserQuestion se quer retomá-la agora: "Retomar: <tarefa> (Recomendado)" ou "Não retomar". Só retome se o usuário escolher retomar, agora em modo normal: perguntas voltam a ser feitas no chat. Se a tarefa já estava concluída, diga isso em vez de perguntar.
