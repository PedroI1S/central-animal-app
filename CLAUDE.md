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

O app está **sem violações** no AccessLint (WCAG 2.2 AA) em `/`, `/relatar` (todas as etapas do chat),
`/acompanhar`, `/painel` e no detalhe do caso, inclusive no modo demo. Vale manter assim — a base é
pequena e as regras abaixo são as que já quebraram uma vez.

### O sistema "Plantão" e os números que importam

A interface usa o sistema visual do deck do pitch (tokens em `web/src/index.css`, `@theme`). Cada voz
tem uma cor: **P1–P4 são só das regras**, **anil é só da IA**, **tinta/claro é de quem confirma**.
Dois chãos: **papel** (celular do cidadão) e **noite** (painel e telão). Contrastes medidos:

| Texto | sobre `papel` #f2f4f3 | sobre branco | sobre `noite-1` #0d1b26 | sobre `noite-2` #132634 |
|---|---|---|---|---|
| `tinta` #0d1b26 | 15,8 ✓ | 17,5 ✓ | — | — |
| `suave` #5b6b78 | 5,0 ✓ | 5,5 ✓ | — | — |
| `claro` #eef2f1 | — | — | 15,5 ✓ | 13,7 ✓ |
| `nevoa` #8fa3b3 | — | — | 6,7 ✓ | 6,0 ✓ |
| `cinza` #6f8799 | 3,4 ✗ texto | 3,8 (só borda) | 4,7 ✓ | **4,1 ✗** |
| `ia` #4b55c9 | 5,5 ✓ | 6,1 ✓ | — | — |
| `ia-noite` #9aa8ff | — | — | 7,8 ✓ | 7,0 ✓ |
| `alerta` #c4262e | 5,2 ✓ | 5,7 ✓ | — | — |

- **`cinza` é traiçoeiro:** serve de texto terciário só sobre `noite-0`/`noite-1`. Sobre `noite-2` (cartão
  selecionado da fila) reprova — use `nevoa`. No papel ele é **borda de campo** (3,8:1 ≥ 3:1), nunca texto.
- **P1–P4 como texto na noite passam** (P1 5,7 · P2 5,9 · P3 11,1 · P4 5,5 sobre `noite-1`), por isso
  a escada de prioridade e a legenda do mapa podem usar a própria cor.

Selos e fundos de prioridade — a cor do texto não é escolha estética:

| | fundo | texto `tinta` | texto branco |
|---|---|---|---|
| P1 | `#ff5a60` | **5,7 ✓** | 3,1 ✗ |
| P2 | `#f76b15` | **5,9 ✓** | 3,0 ✗ |
| P3 | `#ffc53d` | **11,1 ✓** | 1,6 ✗ |
| P4 | `#2fa36b` | **5,5 ✓** | 3,2 ✗ |

Ou seja: **sobre prioridade o texto é sempre tinta, branco nunca.** Está em `CLASSE_PRIORIDADE`
(`web/src/ui.tsx`) e as cores em `PRIORIDADES` (`packages/triagem/src/regras.ts`).

### Regras que já foram quebradas aqui

- **`opacity` em texto derruba o contraste.** Um `opacity-80` num rótulo sobre a cor de prioridade deu 3,53:1.
  Se precisa de hierarquia, use tamanho, peso ou uma cor medida da tabela — não opacidade.
- **Anel de foco precisa de 3:1** (WCAG 1.4.11). O foco é global em `index.css`: anil de 2 px no papel,
  `ia-noite` dentro de `.noite`. Não remova o `outline` sem substituto visível.
- **Sem emoji na interface.** Os ícones são SVG de traço em `web/src/icones.tsx`, decorativos por padrão
  (`aria-hidden`); o que carrega informação (a câmera da fila = "tem foto", a estrela da IA) recebe `rotulo`
  e vira `role="img"`. Emoji muda de desenho a cada celular e o leitor de tela anuncia o nome dele.
- **`autoFocus` só com ponteiro fino** (`FOCO_AUTOMATICO` em `web/src/ui.tsx`). No celular ele abre
  o teclado na hora e empurra a conversa para fora da tela.
- **Região que rola precisa de foco próprio.** A conversa do chat (`role="log"`) e o briefing têm
  `tabIndex={0}`: quando a conversa passa da tela e não há nada focável dentro, o teclado não chega nela.
- **Toda animação decorativa some em `prefers-reduced-motion`** (`web/src/index.css`). O que carrega
  informação fica parado no lugar: o pulso do P1 sem responsável vira halo fixo, o "novo" vira anel.
  O giro do spinner fica de propósito: é o único sinal de que algo está carregando.
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
Pelo mesmo motivo, ao auditar `/painel` espere a fila aparecer (`wait_for: ".cartao-fila"`) — senão você
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
