# Central Animal · Pato Branco

Porta única para ocorrências com animais: o cidadão relata (texto livre ou botões), a IA local sugere a classificação, o cidadão confirma, **as regras decidem a prioridade** e o caso chega ao serviço certo, com protocolo e acompanhamento até o desfecho.

Ideathon GovTech Pato Branco 2026 · desafio GT-04.

## Rodar

Pré-requisitos: Docker, Node 24 (`nvm install --lts`), Ollama com `qwen3.5:9b`.

```bash
npm install
npm run db                                    # Postgres no Docker (porta 5432)
npm run db:push && npm run demo:reset         # schema + dados fictícios
npm run build                                 # front em web/dist
npm run start                                 # API + front em http://localhost:3000
```

> ⚠️ **`build` sempre antes de `start`, nunca com a API no ar.** O `@fastify/static` indexa
> `web/dist` quando a API sobe; um rebuild depois disso troca o hash dos assets e o servidor passa a
> devolver `index.html` no lugar do JS — página em branco, com `200 OK` em tudo. Se já estiver
> rodando, reinicie a API. Detalhes e diagnóstico em [`CLAUDE.md`](CLAUDE.md).

Desenvolvimento com hot reload do front: `npm -w api run dev` + `npm -w web run dev` (http://localhost:5173).
Para mexer na UI **sem encostar na demo**, use a instância de teste (`api-teste` :3001 + `web-teste` :5174,
banco `central_teste`) — veja [`CLAUDE.md`](CLAUDE.md).

- Cidadão: `/` · Painel: `/painel` — **sem login no próprio notebook** (quem abre age como Ana Souza); **pelo túnel o login continua** (a plateia chega ao mesmo endereço). Para exigir login também no notebook: `PAINEL_SEM_LOGIN = false` em `api/src/auth.ts` (login de teste: `ana@central.pb` / `central123`)
- Modo apresentação: `/painel?modo=demo` — esconde texto livre, mostra QR Code, bip a cada caso novo

## Demo com a plateia — link fixo

**Link fixo (vai no QR e no material):** https://pedroi1s.github.io/central-animal/ · QR em `pages/qr-central-animal.svg`

```bash
npm run demo:reset        # banco limpo antes de subir no palco
npm run start             # terminal 1
npm run tunnel:publicar   # terminal 2 — deixe aberto
```

O `tunnel:publicar` sobe um túnel da Cloudflare, confere que ele responde pela internet (via DNS público, imune ao cache da rede) e aponta o link fixo para ele (`destino.json` no repositório privado `PedroI1S/central-animal`, publicado pelo GitHub Pages). Leva ~1 min.

- **Ctrl+C** derruba o túnel e marca o link como desligado.
- **Túnel caiu?** Rode `npm run tunnel:publicar` de novo — túnel novo, mesmo link.
- **Notebook desligado / túnel morto:** o link mostra "O protótipo está desligado no momento" em vez de erro.
- Caminhos são preservados: `…/central-animal/painel?modo=demo` abre o painel no túnel.

## Arquitetura

| Parte | Onde | Papel |
|---|---|---|
| Motor de triagem | `packages/triagem` | Árvore adaptativa + regras de prioridade + roteamento. Compartilhado por front e API; `npm test` |
| API | `api/` | Fastify + Drizzle + Postgres. Recalcula a prioridade no servidor; histórico por proximidade (200 m / 90 dias) |
| IA | `api/src/llm.ts` | Qwen local (Ollama): interpreta o relato (≈5 s), **pergunta de volta quando está em dúvida** (+≈6 s), resume e descreve a foto em segundo plano. Fila com prioridade para quem está esperando; acima de 3 na fila, ou esperando mais de 20 s, o chat segue por botões |
| Front | `web/` | React + Vite + Tailwind. Chat do cidadão, acompanhamento ao vivo (5 s), painel (3 s) |

**Regra do projeto:** a IA sugere, o cidadão confirma, as regras decidem. "Pessoa em risco" e perguntas de flagrante/filhotes nunca vêm da IA.

### Quando a IA pergunta de volta

- **Dúvida medida, não opinada:** a confiança vem dos logprobs do Ollama (a probabilidade que o modelo deu ao caso escolhido). Abaixo de 0,8 — e só se as hipóteses concorrentes levariam a **prioridade ou rota diferentes** nas regras — a IA escreve uma pergunta curta com uma opção por hipótese + "Não sei" (o cidadão também pode responder com as próprias palavras). Máximo de 2 rodadas por relato (perguntas + correções); depois, botões. Com pessoa em risco não há perguntas extras.
- **Perguntas fixas, disparadas pelo texto:** relato cita pessoa mordida/atacada/em perigo depois de "Não" na primeira pergunta → o chat pergunta de novo "pessoa em risco" (a resposta é sempre do cidadão). Relato diz "morto" mas há sinal de vida (ou "parece morto") → "O animal ainda está vivo?".
- **Corrigir** abre "O que não está certo?" em texto livre, e a IA reinterpreta com a correção.
- **Sinais:** o que o cidadão escreveu vem marcado; o que só a IA deduziu vem destacado com ✨ e **desmarcado** — "sarna" não vira sangramento sem o cidadão confirmar.
- A conversa inteira (perguntas da Central e respostas) vai junto com o relato para o painel.
- Bateria: `node scripts/avaliar-ia.mjs` (63 casos: originais, adversariais e conversas; `API=…` para outra instância). Regras determinísticas: `npm test`.

## Quem pode atender

Para ocorrência **P1/P2 com local conhecido**, o painel mostra quem consegue atender aquele animal,
do mais capaz e mais perto para o menos — um cão atropelado puxa clínica veterinária, uma cobra
dentro de casa puxa quem tem manejo de serpente, ainda que a clínica esteja mais perto.

A competência sai de resposta confirmada pelo cidadão (`capacidadesPara`, em `packages/triagem`),
nunca de texto livre: a IA sugere, as regras decidem. Ordena por capacidades atendidas e só então
por distância em linha reta. Sem local ou abaixo de P2, o cartão não aparece.

**Só recomenda** — quem aciona é o operador. Não é visível ao cidadão: indicar clínica privada em
nome da Prefeitura é decisão a tomar antes, não um detalhe de tela.

## Placeholders a validar antes de qualquer uso real

- `packages/triagem/src/orientacoes.ts` — orientações clínicas (validar com médico-veterinário)
- `packages/triagem/src/servicos.ts` — tabela de competência e contatos (pactuar com a Prefeitura)
- **`profissionais` (tabela, semeada em `api/src/db/seed.ts`) — cadastro FICTÍCIO de quem atende.
  Nomes de clínicas e coordenadas são inventados; só 193 é telefone real. Nada disso pode ir ao ar
  sem cadastro pactuado e consentimento dos profissionais.** Re-semear sem apagar ocorrências:
  `npm -w api run db:seed -- --somente-profissionais`
- Botões "Ligar" não discam na demo; `VITE_LIGACOES_REAIS=true` ativa `tel:`

## Acessibilidade

Sem violações no AccessLint (WCAG 2.2 AA) nas quatro rotas e no detalhe do caso. As regras que
sustentam isso — contraste por fundo, cor de texto dos selos P1–P4, foco, emoji decorativo,
`prefers-reduced-motion` — estão em [`CLAUDE.md`](CLAUDE.md), com os números medidos.

## Notas do ambiente

`node_modules` é um link para `node_modules.nosync` porque `~/Documents` sincroniza com o iCloud (pastas `.nosync` ficam de fora). Por isso o Vite usa `resolve.preserveSymlinks` (e exclui `@ca/triagem` do pré-empacotamento, senão mudanças no pacote não chegavam ao dev server) e a API roda sem watcher.
