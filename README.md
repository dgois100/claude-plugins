# claude-plugins

Marketplace de plugins do [Claude Code](https://code.claude.com) mantido por Danilo Gois.

## Instalação

```bash
claude plugin marketplace add dgois100/claude-plugins
claude plugin install ausencia@dgois100
```

Para atualizar depois:

```bash
claude plugin marketplace update dgois100
claude plugin update ausencia@dgois100
```

## Plugins

| Plugin | O que faz |
|---|---|
| [`ausencia`](plugins/ausencia/README.md) | Modo ausente: antes de sair você responde o que já se sabe; enquanto está fora, o modelo não pergunta nada e registra as dúvidas no `AUSENTE.md`; ao voltar, elas aparecem uma a uma com opções e recomendação. |

## English summary

A Claude Code plugin marketplace. Its first plugin, `ausencia` ("absence"), adds two commands:

- `/ausente` ("I'm away"): Claude first asks the questions it already knows it will need, then keeps working on its own. Instead of asking you anything, it logs every open decision in an `AUSENTE.md` file with options and a recommendation. Reversible decisions go ahead with the recommended option and are marked provisional. Irreversible or external actions (push, deploy, deletes, discarding uncommitted work, history rewrites, database writes, sending messages) are parked.
- `/voltei` ("I'm back"): Claude walks you through the logged decisions one at a time, applies your answers, and deletes the file.

Hooks enforce the mode: `AskUserQuestion` is denied while you are away, the mode survives context compaction, and Claude gets one checklist before ending its turn. Requires Node 18 or newer on the PATH for the hooks. The commands and docs are in Brazilian Portuguese; Claude answers in your language.

Install: `claude plugin marketplace add dgois100/claude-plugins`, then `claude plugin install ausencia@dgois100`.

## Licença

MIT.
