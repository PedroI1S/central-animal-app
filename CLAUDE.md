# CLAUDE.md — Central Animal

Notas de trabalho deste repositório: o que não está no `README.md` e custa caro descobrir sozinho.
O `README.md` explica **o que é** e **como rodar**; este arquivo explica **onde se erra**.

---

## ⚠️ A armadilha do rebuild

**Nunca rode `npm run build` com a API já no ar.** Rebuild + servidor antigo = página em branco.

Por quê: `api/src/server.ts` registra o `@fastify/static` com `wildcard: false`, e esse plugin
**indexa a pasta `web/dist` no momento do registro** — ou seja, uma única vez, quando a API sobe.
O Vite escreve os assets com hash no nome (`index-DdurwV8-.js`) e apaga os antigos. Depois de um
rebuild, o servidor continua conhecendo só os nomes velhos: os pedidos dos assets novos não casam
com nenhuma rota estática, caem no `setNotFoundHandler`, e recebem o `index.html` de volta.

O navegador então recusa o módulo (`Expected a JavaScript-or-Wasm module script but the server
responded with a MIME type of "text/html"`), o React nunca monta e `#root` fica vazio.

**O que torna isso perigoso é que falha em silêncio:** o servidor responde `200 OK` em tudo,
inclusive nos assets. Nada parece errado até a página renderizar vazia.

A ordem é sempre build, depois start:

```bash
npm run build && npm run start
```

Diagnóstico rápido (o tipo do conteúdo entrega na hora):

```bash
curl -s -o /dev/null -w "%{http_code} %{size_download} %{content_type}\n" \
  "http://localhost:3000$(curl -s http://localhost:3000/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js')"
```

- `200 529110 application/javascript` → certo.
- `200 862 text/html` → é isto aqui. Reinicie a API.

---

## Portas e instâncias

| O que | Porta | Banco | Quando |
|---|---|---|---|
| **Demo** (API + front de `web/dist`) | 3000 | `central` | No palco. **Não mexer durante a apresentação.** |
| api-teste | 3001 | `central_teste` | Testar sem tocar na demo |
| web-teste (Vite, proxy → 3001) | 5174 | — | Testar sem tocar na demo |
| web-dev (Vite, proxy → 3000) | 5173 | `central` | Hot reload contra a demo |

As três últimas estão em `.claude/launch.json` (na raiz do workspace, não deste repositório), junto
com uma entrada `demo` para a porta 3000. Para mexer em UI enquanto a demo roda, use **web-teste**:
ele fala com o `central_teste` e não encosta no banco da apresentação.

---

## Túnel e link fixo

O `README.md` já descreve o fluxo. O que vale reforçar:

- **O link fixo nunca muda.** `scripts/tunel.mjs` grava a URL do túnel da vez em `destino.json`
  no repositório, e o GitHub Pages redireciona. Túnel novo a cada execução, mesmo link no QR.
- **Reiniciar o túnel é seguro** — é só rodar `npm run tunnel:publicar` de novo.
- **Reiniciar a API por baixo do túnel é transparente:** o `cloudflared` aponta para
  `localhost:3000`, não para o processo. Trocar o processo não derruba o túnel.
- **Ctrl+C no terminal do túnel publica `destino.json` com `url: null`** e o link passa a mostrar
  "desligado". Não é a URL que se perdeu — o script desliga de propósito. Rode de novo para voltar.

Conferir se o caminho público está de pé, sem depender do navegador:

```bash
curl -s "https://pedroi1s.github.io/central-animal/destino.json?t=$(date +%s)"
curl -s --max-time 5 http://127.0.0.1:20241/ready     # métricas do cloudflared
```

`/ready` devolvendo `{"status":200,"readyConnections":N}` com `N ≥ 1` significa túnel registrado.

---

## Ambiente

- **Node vem do nvm** (`~/.nvm/versions/node/v24.21.0/bin`). Há symlinks em `/opt/homebrew/bin`
  para `node`, `npx` e `npm`, então os comandos funcionam direto no shell. **Não instalar Node pelo
  Homebrew:** um Node de verdade ali sombrearia o do nvm e trocaria a versão que roda a demo.
  Se os symlinks sumirem, recrie-os em vez de instalar:

  ```bash
  ln -sf ~/.nvm/versions/node/v24.21.0/bin/{node,npx,npm} /opt/homebrew/bin/
  ```

- `node_modules` é link para `node_modules.nosync` (iCloud ignora `.nosync`). Se um `npm install`
  trocar o link por uma pasta de verdade, mova a pasta para `node_modules.nosync` e recrie o link.

---

## Acessibilidade

O app está **sem violações** no AccessLint (WCAG 2.2 AA) em `/`, `/relatar`, `/acompanhar`,
`/painel` e no detalhe do caso. Vale manter assim — a base é pequena e as regras abaixo são as que
já quebraram uma vez.

### Contraste: os números que importam aqui

Medidos neste projeto, não estimados. `slate-500` é o limite e **depende do fundo**:

| Texto | sobre branco | sobre `slate-50` | sobre `slate-100` |
|---|---|---|---|
| `text-slate-500` | 4,76 ✓ | 4,55 ✓ (raspando) | **4,35 ✗** |
| `text-slate-600` | 7,58 ✓ | 7,25 ✓ | 6,92 ✓ |

O fundo do painel é o `slate-100` do `body`. **Texto secundário direto sobre ele precisa ser
`slate-600`.** Dentro de `Cartao` (que é branco) o `slate-500` passa.

Selos de prioridade — a cor do texto não é escolha estética:

| | fundo | texto branco | texto `slate-900` |
|---|---|---|---|
| P1 | `#dc2626` | **4,83 ✓** | 3,69 ✗ |
| P2 | `#ea580c` | 3,56 ✗ | **5,01 ✓** |
| P3 | `#ca8a04` | 2,94 ✗ | **6,07 ✓** |
| P4 | `#16a34a` | 3,30 ✗ | **5,41 ✓** |

Ou seja: **branco só no P1**; nos outros três, texto escuro. Está em `CLASSE_PRIORIDADE` (`web/src/ui.tsx`).

### Regras que já foram quebradas aqui

- **`opacity` em texto derruba o contraste.** Um `opacity-80` num rótulo sobre o `bg-p1` deu 3,53:1.
  Se precisa de hierarquia, use tamanho, peso ou uma cor mais clara de verdade — não opacidade.
- **Anel de foco precisa de 3:1** (WCAG 1.4.11). `focus:outline-none` só vale com substituto visível:
  `marca-600` dá 4,88:1 e serve; `marca-500` dá 2,49:1 e não serve.
- **Emoji é decoração** — vai em `<span aria-hidden="true">`, senão o leitor de tela anuncia
  "curativo adesivo" antes do rótulo. A exceção é emoji que carrega informação (o 📷 da fila,
  que indica "tem foto"): esse leva `aria-label`.
- **`autoFocus` só com ponteiro fino** (`FOCO_AUTOMATICO` em `web/src/ui.tsx`). No celular ele abre
  o teclado na hora e empurra a conversa para fora da tela.
- **Toda animação decorativa some em `prefers-reduced-motion`** (`web/src/index.css`). O giro do
  spinner fica de propósito: é o único sinal de que algo está carregando.
- **Telas de espera e de erro também precisam de `<main>` e `<h1>`** — enquanto o painel carregava,
  a página inteira ficava sem landmark (é o componente `Espera` em `web/src/painel/Painel.tsx`).

### Rodar o AccessLint

Este Mac não tem Chrome; o AccessLint usa um Chrome for Testing gerenciado, em
`~/.cache/accesslint-chrome`. **O `--download` é obrigatório em toda chamada de `ensure`**, não só
na primeira — sem ele o CLI diz "No Chrome/Chromium found" mesmo com o binário em cache.

```bash
npx -y @accesslint/chrome ensure --download   # sobe em CDP 127.0.0.1:9222
# … rodar as auditorias …
npx -y @accesslint/chrome stop
```

**O scanner só enxerga o que está renderizado.** O chat (`web/src/cidadao/Relatar.tsx`) é um fluxo
por etapas: no carregamento só existem dois botões, e uma varredura de `/relatar` volta limpa sem
ter visto nenhum campo. Para auditar de verdade, avance o fluxo e audite o HTML de cada etapa.
Pelo mesmo motivo, ao auditar `/painel` espere a fila aparecer (`wait_for: "select"`) — senão você
mede a tela de carregamento, não o painel.

---

## Convenções

- **Código e comentários em português**, como o resto do repositório.
- Comentário explica **por que**, não o que. O padrão do projeto é anotar a decisão e o motivo —
  veja `CLASSE_PRIORIDADE` ou o `@media (prefers-reduced-motion)` em `index.css`. Mantenha isso:
  boa parte das regras acima está documentada no ponto onde importa.
- `packages/triagem` é compartilhado entre front e API e tem testes (`npm test`, 101 casos).
  Mudou regra de prioridade ou roteamento? Rode os testes.
- Mudou prompt da IA? `node scripts/avaliar-ia.mjs` (63 casos) antes de confiar.

---

## Antes de subir no palco

```bash
npm run db                       # Postgres no Docker
npm run demo:reset               # banco limpo
npm run build && npm run start   # nesta ordem, terminal 1
npm run tunnel:publicar          # terminal 2 — deixe aberto
```

Conferir, nesta ordem:

1. `http://localhost:3000/` abre e mostra a tela do cidadão (não uma página em branco).
2. O console do navegador está sem erro de MIME type.
3. O link fixo responde: `curl -s https://pedroi1s.github.io/central-animal/destino.json`.
4. `/painel?modo=demo` mostra o QR e esconde texto livre.
