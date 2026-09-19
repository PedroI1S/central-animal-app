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

Desenvolvimento com hot reload do front: `npm -w api run dev` + `npm -w web run dev` (http://localhost:5173).

- Cidadão: `/` · Painel: `/painel` (login de teste: `ana@central.pb` / `central123`)
- Modo apresentação: `/painel?modo=demo` — esconde texto livre, mostra QR Code, bip a cada caso novo

## Demo com a plateia (QR Code)

```bash
npm run demo:reset        # banco limpo antes de subir no palco
npm run start
npm run tunnel            # cloudflared → URL https pública e aleatória
```

**Espere aparecer `Registered tunnel connection`** no terminal antes de abrir o endereço em qualquer aparelho: se o DNS da rede consultar o nome cedo demais, ele guarda um "não existe" em cache por alguns minutos (aconteceu no teste em casa; no 4G funciona).

Abra o painel **pela URL do túnel** (`https://…trycloudflare.com/painel?modo=demo`): o QR Code usa o endereço da própria página. Para um endereço fixo (QR impresso no slide), use ngrok com domínio estático ou defina `VITE_PUBLIC_URL` antes do build.

## Arquitetura

| Parte | Onde | Papel |
|---|---|---|
| Motor de triagem | `packages/triagem` | Árvore adaptativa + regras de prioridade + roteamento. Compartilhado por front e API; `npm test` |
| API | `api/` | Fastify + Drizzle + Postgres. Recalcula a prioridade no servidor; histórico por proximidade (200 m / 90 dias) |
| IA | `api/src/llm.ts` | Qwen local (Ollama): interpreta o relato (≈4 s), resume e descreve a foto em segundo plano. Fila com prioridade para quem está esperando; acima de 2 na fila, o chat segue por botões |
| Front | `web/` | React + Vite + Tailwind. Chat do cidadão, acompanhamento ao vivo (5 s), painel (3 s) |

**Regra do projeto:** a IA sugere, o cidadão confirma, as regras decidem. "Pessoa em risco" e perguntas de flagrante/filhotes nunca vêm da IA.

## Placeholders a validar antes de qualquer uso real

- `packages/triagem/src/orientacoes.ts` — orientações clínicas (validar com médico-veterinário)
- `packages/triagem/src/servicos.ts` — tabela de competência e contatos (pactuar com a Prefeitura)
- Botões "Ligar" não discam na demo; `VITE_LIGACOES_REAIS=true` ativa `tel:`

## Notas do ambiente

`node_modules` é um link para `node_modules.nosync` porque `~/Documents` sincroniza com o iCloud (pastas `.nosync` ficam de fora). Por isso o Vite usa `resolve.preserveSymlinks` e a API roda sem watcher.
