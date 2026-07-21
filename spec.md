# SPEC — Finance App (manual-first, banco opcional via Pluggy)

## Objetivo

Transformar o dashboard cru atual em um app de finanças **pessoais**, mobile-first,
onde o usuário lança seus dados na mão e **opcionalmente** conecta um banco para
receber transações em tempo real.

O fluxo de conexão via Pluggy (sandbox) **já funciona** — não quebrar isso. Ele
deixa de ser o caminho principal e passa a ser um enriquecimento acionado pelo
usuário nas configurações.

---

## Antes de começar

> **Se o projeto está do zero (pasta vazia):** faça a **Tarefa −1 (Fundação)**
> primeiro. Ela cria os arquivos abaixo e reproduz o baseline que o resto desta
> spec pressupõe. Depois dela, tudo aqui vale como está escrito.

Leia estes arquivos antes de escrever qualquer código (existem após a Tarefa −1):

- `lib/pluggy.ts` — cliente Pluggy server-side (singleton).
- `app/page.tsx` — tela atual (client component) com o widget + dashboard cru.
- `app/api/connect-token/route.ts` — gera o connect token.
- `app/api/transactions/route.ts` — busca contas + transações do mês.
- `app/globals.css` — estilos atuais.
- `package.json` — versões travadas.

**Uma vez que o fluxo `connect-token` + `PluggyConnect` conecte no sandbox, ele
está congelado — não altere.** No resto do projeto ele só muda de lugar (sai da
tela inicial, vai pro popover de configurações).

---

## Stack e versões (não subir majors)

- `next` ^16 · `react` ^19 · `typescript` ^5
- `pluggy-sdk` ^0.88.0 — **é 0.x, NÃO existe versão 1.x**
- `react-pluggy-connect` ^2.12.0
- `tailwindcss` v4 — **pré-requisito do shadcn**. Ver Tarefa 0.
- `shadcn` (CLI) com **Base UI** como camada de primitivos, **não Radix**.
  Desde julho/2026 o Base UI é o padrão do shadcn. Radix não está depreciado,
  mas está em manutenção reduzida desde a aquisição pela WorkOS.
- `lucide-react` — ícones.
- `next-themes` — alternância de tema. Tema padrão: **escuro**.
- Fontes via `next/font/google` (ver seção de tipografia).

### Notas do shadcn que mudaram e valem saber
- O componente `toast` foi depreciado em favor do `sonner`.
- O style `default` foi depreciado; projetos novos usam `new-york`.
- Cores agora são geradas em OKLCH, não HSL.
- Não há mais `forwardRef`; cada primitivo tem um atributo `data-slot`.
- Tailwind v4 se configura **em CSS** (`@theme`), não em `tailwind.config.js`.

---

## Regras críticas (ler com atenção)

1. **NUNCA assuma a assinatura de métodos do `pluggy-sdk`.** Antes de usar
   qualquer método, confira os tipos reais em
   `node_modules/pluggy-sdk/dist/**/*.d.ts`. Em especial `fetchAccounts` e
   `fetchTransactions`: confirme se recebem `(accountId, options)` ou
   `({ itemId, ... })` na versão instalada, e ajuste o código conforme o tipo
   real — não conforme exemplos da internet, que estão desatualizados.
2. Toda route handler que usa o SDK precisa de `export const runtime = 'nodejs'`
   e `export const dynamic = 'force-dynamic'` (o SDK não roda em Edge).
3. `CLIENT_ID` / `CLIENT_SECRET` só no servidor (`lib/pluggy.ts`). Nunca expor
   no client. Não criar rota que devolva o secret.
4. **Código e comentários em inglês.** Textos de UI em português (pt-BR).
5. Sem `any` desnecessário. Tipar os dados do Pluggy com interfaces próprias.
6. Credenciais de teste do sandbox: usuário `user-ok`, senha `password-ok`,
   MFA (quando pedido) `123456`. Fluxo "Basic flow" no widget.
7. **NENHUM componente chama `localStorage` diretamente.** Todo acesso a dado
   persistido passa pela camada `lib/store/` (ver Tarefa 1). Violar isso
   transforma a migração pro banco numa reescrita.
   **Exceção única: o tema.** O `next-themes` escreve em `localStorage` direto e
   isso está correto — o tema precisa ser lido *antes* do React hidratar (senão
   pisca branco), e precisa existir na tela de login, onde ainda não há `userId`.
   Tema é preferência de UI do dispositivo, não dado de domínio do usuário. Não
   colocar tema no `FinanceStore`.
8. **Todo método do store recebe `userId`** — mesmo com o login mockado e mesmo
   sendo sempre o mesmo id. A fronteira multiusuário existe desde o dia 1.
9. Mobile-first. Desktop é progressive enhancement (largura máxima centralizada),
   não o contrário.
10. **Mapear os tokens ANTES de adicionar o primeiro componente shadcn.** Rodar
    `init` e sair fazendo `add` sem sobrescrever as variáveis entrega o visual
    default do shadcn — que é exatamente o visual genérico que esta spec existe
    pra evitar. A Tarefa 0 é bloqueante.
11. **Não definir paleta paralela.** As cores desta spec entram *dentro* do
    sistema de tokens do shadcn (`--primary`, `--background`, `--muted`,
    `--destructive`...). Definir os hexes por fora faz os dois sistemas
    brigarem e o componente ignorar o design.
12. **Só usar componentes do registry oficial do shadcn.** Nada de registry de
    terceiro — `shadcn add` é geração de código com acesso à rede escrevendo no
    repositório, e registries de terceiros não são auditados.
13. Todo componente shadcn adicionado é **código nosso** a partir do momento em
    que é copiado. Não existe upgrade automático. Adicionar só o que for usar.

---

## Modelo de dados

### `PluggyTransaction` (vem do SDK)
`id`, `description`, `amount`, `date`, `type` (`'CREDIT' | 'DEBIT'`),
`category` (string legível ou null), `categoryId` (string ou null).

- Entradas = `type === 'CREDIT'`; saídas = `type === 'DEBIT'`.
- Use `Math.abs(amount)` nos totais (não confie no sinal do valor).
- **Antes de mapear categorias, logue uma transação real do sandbox** para ver
  o shape exato de `category` / `categoryId` na versão atual, em vez de assumir.

### `Entry` (lançamento manual)
```ts
interface Entry {
  id: string;
  userId: string;
  description: string;
  amount: number;        // always positive
  date: string;          // ISO date
  direction: 'in' | 'out';
  category: string | null;
  source: 'manual' | 'bank';
  bankTransactionId?: string;  // set when source === 'bank'
  mergedWith?: string;         // id of the entry this was deduped against
}
```

### `Recurring` (a tela "Recorrentes" — antes "gastos fixos")
```ts
interface Recurring {
  id: string;
  userId: string;
  description: string;
  amount: number;
  dayOfMonth: number;    // 1-31
  type: string;          // user-defined enum, default 'gasto'
  direction: 'in' | 'out';
  url: string | null;    // link to cancel/manage the subscription
  priority: 1 | 2 | 3 | 4 | 5;  // 1 = essencial, 5 = cortável primeiro
  active: boolean;
}
```

### `RecurringType` (enum criável pelo usuário)
```ts
interface RecurringType {
  id: string;
  userId: string;
  label: string;         // 'gasto' (default, não deletável), 'salário', 'assinatura'...
  direction: 'in' | 'out';
}
```

### `Plan` e `Note`
```ts
interface Plan {
  id: string; userId: string; title: string;
  targetRecurringId: string | null;  // qual recorrente esse plano ataca
  monthlySaving: number | null;      // economia estimada
  done: boolean;
}

interface Note {
  id: string; userId: string; body: string; createdAt: string;
}
```

---

## Métricas derivadas (todas em `hooks/useFinance.ts`)

Fonte = `manual entries ∪ bank entries` (já deduplicados), nunca só um dos dois.

- `entradasDoMes` = soma de `direction === 'in'` já realizadas no mês.
- `aEntrarAindaNoMes` = soma dos `Recurring` com `direction === 'in'`,
  `active`, e `dayOfMonth > hoje`. **Não é derivável de transação observada** —
  o salário do dia 30 não existe no dia 16.
- `recorrentesDeGasto` = soma dos `Recurring` com `direction === 'out'` e `active`.
- `sobraPlanejada` = (`entradasDoMes` + `aEntrarAindaNoMes`) − `recorrentesDeGasto`.
- `gastoVariavel` ("quanto gastou a mais") = gastos do mês que **não** batem com
  nenhum `Recurring` ativo.
- `gastosPorCategoria` = agrupamento dos gastos por `category`, fallback "Outros",
  ordenado desc.

---

## Regra de dedup (banco × manual)

Quando o banco está conectado, uma transação vinda da Pluggy pode ser o mesmo
evento que o usuário já lançou na mão. Nunca somar os dois em silêncio.

Candidato a duplicata quando **todas** batem:
- mesma `direction`;
- `|amountA − amountB| <= 0.01` (ou tolerância de 2% para o caso de gorjeta/IOF);
- `|dateA − dateB| <= 3 dias`;
- ainda não foi resolvido antes (`mergedWith` vazio nos dois).

Comportamento: o par entra numa fila de revisão. Banner discreto na Home:
"2 lançamentos parecem duplicados". O usuário decide — **nunca merge automático**.
Ao confirmar, mantém a entry do banco (dado mais confiável), marca a manual com
`mergedWith` e ela sai dos totais. Ao recusar, marca `mergedWith = 'rejected'`
pra não perguntar de novo.

---

## Tarefas

### −1. Fundação (só se do zero — recria o baseline que a spec assume)

Esta tarefa não é feita pelo loop do superpowers. É uma sessão manual e
cuidadosa, porque o trabalho central é **ler os tipos reais do SDK**, não
escrever teste vermelho/verde (a chamada é a uma API externa).

1. **Scaffold** — Next 16 + TypeScript + Tailwind v4 + App Router (feito):
   `npx create-next-app@latest .` com os defaults recomendados. Estrutura é
   **`app/` na raiz, NÃO `src/app/`** — todos os caminhos abaixo são relativos
   à raiz (`lib/`, `app/`, `components/`, `hooks/`). O scaffold já traz Tailwind
   v4 e um `CLAUDE.md`/`AGENTS.md` gerados — ver nota no fim desta tarefa.
2. **Conta Pluggy** — criar conta no dashboard da Pluggy e pegar `CLIENT_ID` e
   `CLIENT_SECRET` (tier sandbox é grátis). Isto é **dependência externa** — sem
   isso nada conecta.
3. **`.env.local`** — `PLUGGY_CLIENT_ID=...` e `PLUGGY_CLIENT_SECRET=...`.
   Confirmar que `.env*` está no `.gitignore` (o create-next-app já põe).
   **Nunca commitar o secret.**
4. **`lib/pluggy.ts`** — client server-side singleton. Instanciar o
   `PluggyClient` com as credenciais do `.env`. **Antes de escrever qualquer
   chamada, abrir `node_modules/pluggy-sdk/dist/**/*.d.ts` e ler as assinaturas
   reais** de `createConnectToken`, `fetchAccounts`, `fetchTransactions`. Não
   escrever de memória nem de exemplo de internet (é 0.88.0, não 1.x).
5. **`app/api/connect-token/route.ts`** — POST que devolve o connect token.
   `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`.
6. **`app/api/transactions/route.ts`** — busca contas + transações do mês do
   `itemId`. Mesmos dois exports. Tipar o retorno com interface própria.
7. **`app/page.tsx`** — client component mínimo: chama `/api/connect-token`,
   abre o `PluggyConnect` (Basic flow), e ao conectar dá `fetch` em
   `/api/transactions` e joga o JSON cru na tela. **Cru mesmo** — é só o
   baseline. A UI de verdade vem nas Tarefas 2+.

**Done da Tarefa −1:** `npm run dev` sobe, o widget abre, logar com
`user-ok` / `password-ok` (MFA `123456`, Basic flow) conecta e a página mostra
as transações do sandbox em JSON cru. Commitar. A partir daqui a spec vale
inteira e o fluxo Pluggy está **congelado**.

> **Nota — `CLAUDE.md` e `AGENTS.md` gerados pelo scaffold:** o Next 16 cria os
> dois automaticamente. Não sobrescrever cegamente. Abrir, manter o que houver
> de útil (comandos de build, convenções) e **mesclar** por cima as regras
> invioláveis do projeto. O superpowers lê o `CLAUDE.md`.

> **Atenção ao ponto que mais confunde:** existem *dois* pares de credencial.
> `CLIENT_ID` / `CLIENT_SECRET` são as chaves da **sua conta** Pluggy, vão no
> `.env`, só no servidor — autenticam seu app na Pluggy. `user-ok` /
> `password-ok` são o **login do banco falso** que você digita *dentro* do
> widget pra simular a conexão. Trocar um pelo outro é o erro clássico.

### 0. Setup shadcn + tokens (bloqueante — antes de qualquer UI)

**Primeiro, checar o que já existe:** o projeto tem Tailwind? Qual versão?
`package.json` + presença de `tailwind.config.*` ou `@import "tailwindcss"` no
`globals.css`. A spec original não listava Tailwind — se não estiver lá, instalar
Tailwind v4 é pré-requisito, não detalhe.

1. Inicializar o shadcn escolhendo **Base UI** como primitivo.
2. Sobrescrever os tokens em `globals.css` com a paleta e o raio da seção Design
   **antes** de adicionar qualquer componente.
3. Definir **os dois** blocos de tokens (`:root` e `.dark`) de uma vez, não só
   o escuro. Instalar `next-themes`, envolver o app no `ThemeProvider`
   (`attribute="class"`, `defaultTheme="dark"`, `enableSystem`) e pôr
   `suppressHydrationWarning` no `<html>` — sem isso o Next reclama de mismatch
   e o app pisca claro antes de escurecer.
4. Só então adicionar, um a um, apenas os componentes usados:
   `button`, `input`, `select`, `checkbox`, `tabs`, `popover`, `sheet`,
   `dialog`, `sonner`, `progress`, `badge`, `chart`.
5. Componentes específicos do Base UI que o Radix não tem e que esta spec usa:
   - `NumberField` — campo de valor na tela Adicionar (Tarefa 10).
   - `Combobox` — seleção de categoria com busca.
6. Verificar visualmente **nos dois temas** que Button/Input renderizam com o
   raio e o verde desta spec, **não** com o default do shadcn. Se estiver
   arredondado demais ou cinza-neutro, os tokens não pegaram — parar e corrigir
   antes de seguir. Checar em especial o texto dentro do botão primário no
   escuro: se estiver branco, a regra 2 de tema foi ignorada.

**Mapa de uso** (o que vai onde — não adicionar nada além disto):

| Componente | Onde |
|---|---|
| `Popover` | Config no header (Tarefa 4) |
| `Toggle Group` | Seletor de tema Claro/Escuro/Sistema no popover (Tarefa 4) |
| `Sheet` | Widget de conectar banco (Tarefa 12) |
| `Tabs` | Planos / Anotações na Home (Tarefas 7 e 8) |
| `Progress` | Barra de sobra (Tarefa 5) |
| `NumberField` (Base UI) | Campo de valor em Adicionar (Tarefa 10) |
| `Combobox` (Base UI) | Categoria em Adicionar (Tarefa 10) |
| `Select` | Tipo em Recorrentes (Tarefa 9) |
| `Chart` | Barras dos últimos 6 meses (Tarefa 11) |
| `Button`, `Input`, `Checkbox`, `Badge` | geral |
| `Sonner` | confirmações de salvar — **não** para o banner de dedup |

Sem componente shadcn: hero, linha do mês, StatCard, CategoryList, BottomNav,
banner de dedup. São CSS/SVG custom — não force um componente a virar isso.

### 1. Camada de dados (`lib/store/`)
- `lib/store/types.ts` — interface `FinanceStore` com todos os métodos, todos
  recebendo `userId` como primeiro argumento:
  `getEntries(userId, month)`, `createEntry(userId, entry)`, `getRecurrings(userId)`,
  `saveRecurring(...)`, `getPlans(...)`, `getNotes(...)`, `getRecurringTypes(...)` etc.
- `lib/store/localStorageStore.ts` — implementação atual. Chaves prefixadas:
  `finance:{userId}:entries`, `finance:{userId}:recurrings`, etc.
  `// TODO: replace with SupabaseStore`
- `lib/store/index.ts` — exporta a instância única. Trocar a impl aqui deve ser
  a **única** mudança necessária quando o banco entrar.

### 2. Refatorar `page.tsx` em componentes
Quebrar o arquivo monolítico atual em:
- `app/login/page.tsx` — tela de login.
- `components/AppShell.tsx` — layout com `BottomNav` + header com botão de config.
- `components/Home.tsx`, `Historico.tsx`, `Recorrentes.tsx`, `AddEntry.tsx`.
- `components/StatCard.tsx`, `CategoryList.tsx`, `TxList.tsx`, `BottomNav.tsx`,
  `MonthLine.tsx`, `SettingsPopover.tsx`, `ConnectBankSheet.tsx`.
- `hooks/useCountUp.ts` — animação de contagem (respeitar `prefers-reduced-motion`).
- `hooks/useFinance.ts` — merge manual+banco, dedup, métricas derivadas.
- `hooks/useAuth.ts` — sessão mockada.

### 3. Login (mockado)
- Tela simples: e-mail + senha, botão "Entrar".
- **Sem validação real.** Qualquer input loga e grava
  `{ id: 'local-user', email }` em `finance:session`. `// TODO: real auth`
- Middleware/guard: sem sessão → redireciona pra `/login`.
- A UI não pode saber que é mock — o dia que virar Supabase Auth, só `useAuth` muda.

### 4. Navegação
- Bottom nav fixa, 4 abas com ícones `lucide-react`:
  - `Home` — Home
  - `History` (ou `CalendarRange`) — Histórico
  - `Plus` — Adicionar (destacado, ação primária)
  - `Table` (ou `Repeat`) — Recorrentes
- Header com `Settings` → popover contendo:
  - "Conectar banco" (abre o widget Pluggy) / "Banco conectado · desconectar"
  - Toggle de tema: Claro · Escuro · Sistema (`Sun` / `Moon` / `Monitor`)
  - "Sair"

### 5. Home
Ordem vertical:
1. **Hero** (fundo `var(--secondary)`, cantos retos embaixo): "Saldo do mês" grande com
   count-up, `tabular-nums`. **Sem gradiente.**
2. **Linha do mês** — ver Tarefa 6.
3. **Quatro números** em grid 2×2 (`StatCard`):
   - Entradas do mês · A entrar ainda (`aEntrarAindaNoMes`)
   - Gastos fixos (`recorrentesDeGasto`) · Gastou a mais (`gastoVariavel`)
4. **Barra de sobra**: `gastoVariavel / sobraPlanejada`.
   Verde `<80%`, âmbar `80–100%`, vermelho `>100%`.
   Texto: "Gastou R$ X dos R$ Y que sobram · faltam R$ Z"
   (ou "passou R$ Z da sobra" quando estourar).
5. **Gastos por categoria** — barras horizontais, ícone + nome + valor + % do
   total gasto, cor e ícone por categoria, ordenado desc.
6. **Abas internas**: Planos · Anotações (ver Tarefas 7 e 8).

### 6. Linha do mês (elemento signature)
Régua horizontal do dia 1 ao último dia do mês:
- Marcador vertical em "hoje", separando **realizado** (à esquerda, preenchido
  `var(--primary)`) de **previsto** (à direita, `var(--forecast)`).
- **Não usar `opacity` para o "previsto".** Opacidade baixa sobre fundo escuro
  some — o que funciona no claro desaparece no escuro. Usar o token `--forecast`,
  que tem valor próprio em cada tema, mais um tracejado (`stroke-dasharray`) como
  segundo sinal. O tracejado é o que carrega o significado nos dois temas; a cor
  só reforça.
- Pontos nos `dayOfMonth` dos `Recurring` ativos: entrada = ponto `income`,
  gasto = ponto `expense`. Tap no ponto mostra descrição + valor.
- É isto que torna "quanto ainda vai entrar no mês" legível de relance, em vez
  de ser só mais um número num card.

### 7. Aba Planos (foco em corte de custo)
- Lista os `Recurring` de gasto **ordenados por `priority` desc** (o mais
  cortável primeiro) com o valor e o `url` como botão "Gerenciar".
- Usuário cria `Plan` amarrado a um recorrente, com economia mensal estimada.
- Topo: "Cortando estes N, você economiza R$ X por mês."
- Empty state: "Nenhum plano ainda. Comece pelo que tem prioridade mais baixa."

### 8. Aba Anotações
- Lista simples de `Note` com textarea + "Salvar". Sem markdown, sem rich text.
- Ordenado por `createdAt` desc.

### 9. Tela Recorrentes (tabela)
- Tabela com colunas: **Dia** · **Descrição** · **Tipo** · **Valor** ·
  **Prioridade** · **Link**.
- `Tipo`: select alimentado por `RecurringType`. Default `'gasto'`.
  Opção "+ Novo tipo" no fim do select abre input inline.
- `Prioridade`: 1–5, exibida como 5 barrinhas (não estrelas). 1 = essencial.
- `Link`: ícone `ExternalLink` quando tem `url`, abre em nova aba. É o atalho
  pra cancelar/verificar depois.
- Linha inativa (`active: false`) fica com opacidade reduzida, não some.
- Em mobile a tabela vira cards empilhados — **não** faça scroll horizontal.

### 10. Tela Adicionar
- Toggle Entrada / Saída no topo (a cor do formulário acompanha).
- Campos: valor (teclado numérico, `inputMode="decimal"`), descrição, data
  (default hoje), categoria.
- Checkbox "Repetir todo mês" → cria um `Recurring` em vez de um `Entry`.
- Salvar volta pra Home.

### 11. Tela Histórico
- Lista de meses (mais recente primeiro), cada um com entradas, gastos e saldo.
- Tap abre o detalhe do mês reusando os componentes da Home em modo read-only.
- Mini gráfico de barras: saldo dos últimos 6 meses.

### 12. Conectar banco (config → popover)
- Botão "Conectar banco" chama `/api/connect-token` e abre o `PluggyConnect`
  **exatamente como funciona hoje**. Não reescrever esse fluxo.
- Sucesso: guarda o `itemId` via store, faz o fetch das transações, converte
  pra `Entry` com `source: 'bank'`, roda o dedup (ver regra acima).
- Label é **"Conectar banco"**, não "Open Finance" — a Pluggy conecta tanto via
  Open Finance regulado quanto por conectores diretos; "banco" cobre os dois e
  é o que o usuário reconhece.
- Estado desconectado é o padrão e não pode parecer um erro. O app é completo
  sem isso.

---

## Design

Direção: calmo, claro, geométrico. Verde suave predominante. **Poucas curvas** —
o raio é discreto e constante, nada de pílulas ou blobs. Sem gradiente.

**O tema padrão é escuro.** Claro existe e é alternável, mas escuro é o default
e é o tema que recebe o cuidado.

### Tokens (em `globals.css`, dentro do sistema do shadcn)

Mapear a paleta nas variáveis semânticas que os componentes já leem. Não criar
um segundo conjunto de nomes por fora.

```
--radius: 6px          ← teto do projeto. Nada acima de 8px em lugar nenhum.
```

**`:root` (claro)**
```
--background   #F1F4F0
--foreground   #14201A
--card         #FFFFFF
--primary      #4F7D63     --primary-foreground   #FFFFFF
--secondary    #DCE8DF     --secondary-foreground #14201A
--muted        #DCE8DF     --muted-foreground     #6E7A72
--border       #DFE5DF     --input                #DFE5DF
--ring         #4F7D63
--destructive  #A84A2C
--income       #3F7A5E
--expense      #A84A2C
--amber        #C08A2E
--forecast     #A9B7AE
```

**`.dark` (padrão)**
```
--background   #111612
--foreground   #E4EAE5
--card         #171E19
--primary      #6FA383     --primary-foreground   #0D120F   ← inverte
--secondary    #1E2721     --secondary-foreground #E4EAE5
--muted        #1E2721     --muted-foreground     #8A968F
--border       #2A332D     --input                #2A332D
--ring         #6FA383
--destructive  #C85A47
--income       #74B492
--expense      #C85A47
--amber        #DDA544
--forecast     #46554C
```

### Regras de tema (o que quase todo mundo erra)

1. **Escuro não é o claro invertido.** Os valores acima foram derivados por
   luminosidade, não por inversão.
2. **`--primary-foreground` inverte.** No claro, `--primary` é verde escuro →
   texto branco. No escuro, `--primary` é verde claro → **texto quase preto**.
   Manter branco entrega botão ilegível.
3. **A elevação NÃO inverte.** O card é mais claro que o fundo nos dois temas
   (`#FFFFFF` sobre `#F1F4F0`; `#171E19` sobre `#111612`). No claro a elevação
   se lê por sombra; no escuro, por superfície mais clara. Não colocar card
   preto sobre fundo cinza.
4. **Nada de preto puro nem branco puro.** `#000` no fundo e `#FFF` no texto
   causam halação (o texto "vibra"). Por isso `#111612` e `#E4EAE5`, ambos com
   um leve viés verde pra amarrar com a marca.
5. **Não comunicar nada só por opacidade.** Ver a Tarefa 6 — o que atenua no
   claro some no escuro. Todo estado atenuado tem token próprio por tema.
6. **Os valores acima são ponto de partida, não evangelho.** Foram derivados a
   olho e precisam ser conferidos com um medidor de contraste (alvo: 4.5:1 pra
   texto, 3:1 pra elementos gráficos). Se algo reprovar, corrigir aqui na spec
   antes de codar.

Nota: o shadcn gera as cores dele em OKLCH. Converter ou deixar em hex, tanto
faz — mas **um formato só** no arquivo inteiro.

### Tipografia
- **Display / números** — `Familjen Grotesk` (600/700). Hero, valores, títulos.
- **Corpo / UI** — `Inter` (400/500).
- **Dados** — `IBM Plex Mono` (400/500). Coluna de valores da tabela Recorrentes
  e da lista de transações.
- Todo número monetário: `font-variant-numeric: tabular-nums`.
- Labels de seção em maiúsculas com `letter-spacing: 0.08em`, tamanho 11–12px,
  cor `--muted-foreground`.

### Regras
- Espaçamento em múltiplos de 4px.
- Sombra: no máximo uma, sutil. Preferir `1px solid var(--border)` a sombra.
- Alvo de toque mínimo 44×44px.
- Respeitar `prefers-reduced-motion` (count-up e linha do mês).
- A **linha do mês** (Tarefa 6) é CSS/SVG custom. Não existe componente shadcn
  pra isso e não force um a virar isso.
- O banner de dedup é **inline e persistente**, não um toast. Toast some, e o
  usuário precisa poder resolver depois.

---

## Definition of done

- `npm run dev` sobe sem erro de TypeScript.
- Login mockado → Home funcional **sem nunca conectar banco**, com dados
  lançados na mão.
- Home mostra: saldo, linha do mês, os 4 números, barra de sobra, gastos por
  categoria, abas Planos e Anotações.
- Recorrentes: criar, editar, criar tipo novo, definir prioridade e link.
- Adicionar entrada/saída funciona e reflete na Home na hora.
- Histórico lista meses anteriores.
- Config → "Conectar banco" abre o widget e conecta no sandbox
  (`user-ok` / `password-ok`). Transações do banco entram, dedup pergunta antes
  de mesclar.
- Nenhum componente toca `localStorage` direto — tudo via `lib/store/`.
- Todo método do store recebe `userId`.
- Nenhuma credencial no client; rotas de API com `runtime = 'nodejs'`.
- Sem `any` solto; dados do Pluggy tipados.
- App abre no **escuro** por padrão, sem piscar claro no carregamento.
- Alternar tema no popover funciona e persiste após reload.
- Nos dois temas: card mais claro que o fundo, texto do botão primário legível,
  linha do mês com "previsto" visível.
- Contraste conferido: 4.5:1 texto, 3:1 gráfico.
- **Nenhum raio acima de 8px. O app não parece o shadcn default** — se um
  screenshot da tela puder ser confundido com qualquer outro app shadcn
  genérico, os tokens não foram aplicados.
- Só componentes do registry oficial; nenhum componente adicionado sem uso.

---

## Fora de escopo (não fazer agora)

- Auth real / multiusuário de verdade (o login é mock, a fronteira `userId` não).
- Banco de dados real — `LocalStorageStore` por enquanto, interface pronta pro
  Supabase.
- Plano comercial / Meu Pluggy — seguir no sandbox.
- Import de OFX.
- Categorização automática dos lançamentos manuais.
- Notificações / lembretes de vencimento dos recorrentes.
