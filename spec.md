# SPEC — Finance App (manual-first, banco opcional via Pluggy)

## Objetivo

Transformar o dashboard cru atual em um app de finanças **pessoais**, mobile-first,
onde o usuário lança seus dados na mão e **opcionalmente** conecta um banco para
receber transações em tempo real.

O fluxo de conexão via Pluggy (sandbox) é o baseline (criado na Tarefa −1 se do
zero; **uma vez conectando, não quebrar**). Ele
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
- `@supabase/supabase-js` e `@supabase/ssr` — cliente Supabase (browser + server,
  auth + Postgres). Conferir no npm a versão estável atual antes de instalar —
  não assumir a mais recente do dia em que esta linha foi escrita.
- `tailwindcss` v4 — **pré-requisito do shadcn**. Ver Tarefa 0.
- `shadcn` (CLI) com **Base UI** como camada de primitivos, **não Radix**.
  Desde julho/2026 o Base UI é o padrão do shadcn (verificado via docs do shadcn
  e do Base UI em jul/2026; confirmar na doc atual antes de codar, pode ter mudado).
  Radix não está depreciado, mas está em manutenção reduzida.
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
1b. **A mesma regra vale para `@supabase/supabase-js` e `@supabase/ssr`.** Não
   assumir a API de exemplos/tutoriais (muda entre major versions, em especial
   como o client de servidor lida com cookies/sessão). Ler
   `node_modules/@supabase/*/dist/**/*.d.ts` antes de escrever
   `lib/supabase/client.ts` e `lib/supabase/server.ts`.
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
   isso está correto — o tema precisa ser lido _antes_ do React hidratar (senão
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
11. **Não definir paleta paralela para o que o shadcn já nomeia.** Cor de
    superfície, texto, borda, primário, destrutivo etc. entram _dentro_ dos
    tokens do shadcn — nunca um segundo nome pra mesma coisa. **Exceção
    legítima:** `--income`, `--expense`, `--amber`, `--forecast` são conceitos
    de domínio que o shadcn não tem vocabulário pra representar. Esses quatro
    (e só esses) vivem como tokens próprios. A regra proíbe _duplicar_ o que já
    existe, não _estender_ pro que não existe.
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

### `Entry` (lançamento manual ou do banco)

```ts
interface Entry {
  id: string;
  userId: string;
  description: string;
  amount: number; // always positive
  date: string; // ISO date
  direction: "in" | "out";
  category: string | null;
  source: "manual" | "bank";
  bankTransactionId?: string; // set when source === 'bank'; upsert key (idempotência)
  // dedup manual×banco:
  dedupStatus: "pending" | "merged" | "rejected" | null; // null = não é duplicata
  //   pending = par candidato aguardando o usuário (netado, ver métricas)
  dedupPartnerId?: string; // o Entry com que foi comparado
  // realização de recorrente (ver "Recorrentes como previsão"):
  realizesRecurringId?: string; // qual Recurring este gasto real concretiza
}
```

- **`dedupStatus` é campo próprio, não sentinela num id.** Só `'merged'` e
  `'pending'` saem dos totais; `'rejected'` e `null` contam (lançamento real).
- **Precedência dos dois matchings:** o dedup banco×manual roda **antes** da
  realização de recorrente. Uma `Entry` só é candidata a realizar um recorrente
  depois de resolvida como não-duplicata (`dedupStatus` `null` ou `'rejected'`).
  Assim uma `Entry` nunca está `merged`/`pending` de dedup e realizando recorrente
  ao mesmo tempo.

### `Recurring` (a tela "Recorrentes" — antes "gastos fixos")

```ts
// Como o recorrente termina. Três formas, mutuamente exclusivas.
type RecurringEnd =
  | { kind: "never" } // aluguel, salário, assinatura sem prazo
  | { kind: "after"; occurrences: number } // parcelamento: "12x"
  | { kind: "on"; date: string }; // acaba numa data conhecida

interface Recurring {
  id: string;
  userId: string;
  description: string;
  amount: number;
  typeId: string; // FK → RecurringType. A DIREÇÃO VEM DO TIPO, não daqui.
  category: string | null; // mesma categoria livre da Entry (ver nota abaixo)
  url: string | null; // link to cancel/manage the subscription
  priority: 1 | 2 | 3 | 4 | 5; // 1 = essencial, 5 = cortável primeiro
  active: boolean; // pausado/cancelado pelo usuário — diferente de terminado
  // ritmo e vigência:
  frequency: "monthly" | "yearly";
  startDate: string; // ISO. ÂNCORA: o dia (e, se anual, o mês) saem daqui.
  end: RecurringEnd;
}
```

- **`Recurring` não tem `direction` nem `type` string.** A direção é lida via
  `typeId → RecurringType.direction`. Isso torna impossível um "aluguel" marcado
  como entrada por engano — estado inválido deixa de ser representável.
- **`dayOfMonth` não é mais campo — é derivado de `startDate`.** Guardar os dois
  permite que discordem ("começa dia 5" + "vence dia 10"). Uma função
  `dayOfMonthOf(recurring)` extrai o dia da âncora e aplica o mesmo clamp de
  sempre (dia 31 em fevereiro cai no 28/29). O modelo e a linha do mês
  continuam usando a **mesma** função — essa regra não muda.
- **Parcelamento é um `Recurring` com `end.kind === 'after'`**, não uma entidade
  nova. "12x de R$ 250" é uma previsão mensal que se esgota — exatamente o que o
  `Recurring` já é, com fim. **"Parcela 3 de 12" é derivado** (meses decorridos
  desde `startDate` + `occurrences`), nunca armazenado — não existe contador pra
  sair de sincronia.
- **Vigência:** um recorrente só entra nas métricas e na linha do mês se estiver
  `active` **e** vigente no mês (já começou, ainda não terminou). São duas
  condições diferentes: `active: false` é o usuário pausando; terminado é o
  compromisso acabando sozinho. A última parcela some sem ninguém lembrar de
  desligar nada.
- **`category` foi adicionada** porque sem ela todo gasto fixo realizado cai em
  "Outros" no gráfico de categorias — o aluguel nunca conta como Moradia. É a
  mesma string livre da `Entry`, com o mesmo fallback de `lib/categories.ts`.
- **`weekly`/`biweekly` ficaram fora de propósito.** O app é mês-cêntrico
  (`month: 'YYYY-MM'`, métricas mensais, régua de 1 a 31); frequência semanal
  significa 4 ou 5 ocorrências no mesmo mês e um `dayOfMonth` que deixa de
  descrever o recorrente. `monthly` + `yearly` cobrem IPVA, anuidade, seguro e
  tudo que existe hoje. Decisão adiada, não esquecida.

### `RecurringRealization` (um recorrente concretizado num mês)

Um recorrente de gasto é uma **previsão** (linha fantasma) que some do "previsto"
quando o gasto real chega. Este registro guarda esse casamento, por mês.

```ts
interface RecurringRealization {
  id: string;
  userId: string;
  recurringId: string;
  month: string; // 'YYYY-MM'
  status: "pending" | "confirmed" | "assumed";
  entryId?: string; // a transação real que casou (pending/confirmed)
}
```

- `pending` — heurística achou um gasto real candidato; **os dois ficam netados**
  (o recorrente sai do previsto, a `Entry` sai do variável) esperando o usuário.
- `confirmed` — usuário confirmou o casamento. O recorrente está realizado; conta
  **uma vez**, como a `Entry` real (não como previsto, não como variável).
- `assumed` — mês virou e nunca casou. Gasto: assumido pago. Entrada: assumida
  recebida. Sai do previsto sem `Entry`. Transição preguiçosa (ver Regra de matching).
- Sem realização no mês → o recorrente é **previsto** (conta em `recorrentesDeGasto`).

### `RecurringType` (enum criável pelo usuário)

```ts
interface RecurringType {
  id: string;
  userId: string;
  label: string; // 'gasto' (default, não deletável), 'salário', 'assinatura'...
  direction: "in" | "out"; // FONTE DA VERDADE da direção de todo Recurring deste tipo
}
```

- Ao criar um tipo novo, o usuário escolhe a direção **uma vez**. Todo `Recurring`
  daquele tipo herda. O default `'gasto'` é `direction: 'out'`.

### `Plan`, `Goal` e `Note`

```ts
interface Plan {
  id: string;
  userId: string;
  title: string;
  targetRecurringId: string; // obrigatório: todo plano ataca um recorrente
  monthlySaving: number; // economia mensal; default = Recurring.amount do alvo
  goalId: string | null; // opcional: pra onde vai o dinheiro economizado
  doneAt: string | null; // ISO date; null = plano ainda não concluído
}

interface Goal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  targetDate: string | null; // ISO date; opcional
  doneAt: string | null;
}

interface Note {
  id: string;
  userId: string;
  body: string;
  createdAt: string;
}
```

- `monthlySaving` começa igual ao `amount` do recorrente alvo (cortar 100% dele),
  editável se o plano é reduzir e não eliminar. "Economia total" = soma dos
  `monthlySaving` dos planos não concluídos, **contando cada `targetRecurringId`
  uma vez**. "Estes N" = a contagem desses planos.
- **`done: boolean` virou `doneAt: string | null`.** Um booleano não diz _quando_
  o corte aconteceu, e sem isso não dá pra calcular quanto a meta já acumulou.
  `null` = não concluído; com data = concluído naquele dia. Impossível estar
  "concluído sem data".
- **`Goal` fecha o ciclo que o `Plan` deixava aberto.** Cortar R$ 80/mês e o
  dinheiro sumir do modelo não ensina nada; cortar R$ 80/mês _rumo a algo_ é o
  que sustenta o hábito. O vínculo é opcional — cortar por cortar continua válido.
- **O progresso da `Goal` é derivado, não armazenado:** soma de
  `monthlySaving × meses decorridos desde doneAt` dos planos concluídos que
  apontam pra ela. Nada de um `currentAmount` que precisa ser atualizado na mão e
  silenciosamente diverge.
  `// TODO: derivar progresso assume que o dinheiro cortado foi de fato guardado.`
  `// Revisitar quando a Tarefa 15 for desenhada — talvez precise de confirmação`
  `// do usuário, no mesmo espírito do dedup (o app nunca decide sozinho).`

---

## Métricas derivadas (todas em `hooks/useFinance.ts`)

Fonte = `Entry[]` (manual ∪ banco, deduplicados) + `Recurring[]` + as
`RecurringRealization` do mês. Um recorrente de gasto é **previsão que some quando
o real chega** — logo, nunca somar previsto + realizado do mesmo recorrente.

Estado de cada `Recurring` no mês corrente (deriva das realizations):

- **previsto** — sem realization, ou realization `assumed` já saiu. Conta no previsto.
- **pendente** — realization `pending`: o **fantasma** (recorrente) sai do previsto;
  a **`Entry` real permanece no realizado** (o dinheiro saiu de fato). O que o
  netting evita é a _dupla contagem_, não o gasto real. Ver a nota crítica abaixo.
- **realizado** — realization `confirmed`: representado pela `Entry` real.
- **assumido** — realization `assumed`: fora do previsto, sem `Entry`.

> **Nota crítica sobre o netting (não errar a direção):** quando um gasto real casa
> (pendente) com um recorrente previsto, o dinheiro **já saiu** — logo a `Entry`
> conta em `gastosRealizadosDoMes` e no `saldoDoMes` normalmente. O que sai é o
> **fantasma** do `aSairAindaNoMes` (senão o mesmo gasto contaria duas vezes: uma
> como real, outra como previsto). Netar a `Entry` real _para fora_ do realizado
> faria o `saldoDoMes` **superestimar** — o hero mostraria mais dinheiro do que
> existe. A `Entry` pendente só muda de balde _dentro_ dos gastos (de `gastoVariavel`
> para "fixo realizado"), nunca sai do total realizado.

Definições (gasto = `direction 'out'`, entrada = `'in'`; sempre `Math.abs`):

- `gastosRealizadosDoMes` = soma das `Entry` de saída do mês com
  `dedupStatus !== 'merged'` e `dedupStatus !== 'pending'`. **Inclui** as `Entry`
  com realization `pending`/`confirmed` (são gastos reais).
- `entradasDoMes` = idem para entradas realizadas (mesma exclusão de dedup).
- `saldoDoMes` = `entradasDoMes − gastosRealizadosDoMes`. **(esta é a métrica do hero.)**
- `aEntrarAindaNoMes` = soma dos `Recurring` de entrada, `active`, **vigentes no
  mês** (já começaram, ainda não terminaram — ver `RecurringEnd`), ainda
  **previstos**, com `dayOfMonthOf(recurring) >= hoje`.
  (>= inclui o dia corrente — corrige o buraco do dia de hoje.)
  **"hoje" = data local do usuário (dia do mês), comparada só por dia**, não por
  timestamp UTC — senão a virada de dia por fuso desloca o corte. `Entry.date` é
  ISO; normalizar pra data local antes de comparar.
- `aSairAindaNoMes` (= `recorrentesDeGasto`) = soma dos `Recurring` de saída,
  `active`, **vigentes no mês**, ainda **previstos** (não pendentes, não
  realizados, não assumidos). Parcelamento entra aqui como qualquer fixo: a
  parcela do mês é um recorrente previsto igual aos outros.
- `gastoVariavel` = `Entry` de saída realizadas que **não** têm `realizesRecurringId`.
  (Gasto real que não concretiza nenhum recorrente. Um pendente já saiu daqui —
  virou fixo realizado — mas continua no total realizado.)
- `sobraPlanejada` = (`entradasDoMes` + `aEntrarAindaNoMes`)
  − (`gastosRealizadosDoMes` + `aSairAindaNoMes`).
- `gastosPorCategoria` = agrupa `gastoVariavel` + gastos realizados por `category`,
  fallback `"Outros"`, ordenado desc. Cor/ícone via `lib/categories.ts` (ver Tarefa 5).

**Casos de borda (o red-team achou, agora cobertos):**

- `sobraPlanejada <= 0` (fixos ≥ entradas): a barra fica **vermelha cheia** e o
  texto vira "Seus fixos já passam do que entra este mês" — sem divisão, sem "faltam".
- Barra normal: `progress = gastoVariavel / sobraPlanejada`. `Z = |sobraPlanejada −
gastoVariavel|`. Texto: "faltam R$ Z" se `<100%`, "passou R$ Z" se `>100%`.
- **Histórico (mês passado):** não existe "hoje". Todo recorrente do mês fechado já
  está `confirmed` ou `assumed` — logo `aEntrar`/`aSair` = 0 e não há metade "prevista".
  O componente da Home roda em modo `closed`, que esconde a régua de previsto e os
  números "a entrar/a sair ainda". Ver Tarefa 11.

---

## Regra de matching (banco×manual E real×previsto)

Um mesmo mecanismo de casamento serve a dois usos: dedup (banco × manual) e
realização de recorrente (gasto real × previsão). **Nunca casa sozinho — sempre
pergunta.** Nada é decidido sem o usuário.

**Quando roda:** a detecção dispara a cada **`Entry` nova, venha de onde vier** —
tanto no fetch do banco quanto ao criar um lançamento manual na tela Adicionar.
Um gasto lançado na mão (ex: você pagou o aluguel e digitou) tem que casar com o
recorrente previsto igual a um do banco, senão o fantasma nunca dissolve e conta
dobrado. **Não** limitar o matching ao fetch do banco.

Candidato a casar quando **todas** batem:

- mesma `direction`;
- valores próximos: `|amountA − amountB| <= max(0.01, 0.02 × maior)` — o `0.01`
  cobre centavos idênticos; os `2%` cobrem variação real (IOF, gorjeta, conta que
  oscila). Usa-se o maior dos dois limiares, nunca ambíguo.
- `|dateA − dateB| <= 3 dias` (janela típica entre compra e compensação);
- nenhum dos dois já resolvido antes.

Banner inline e persistente (nunca toast): "2 lançamentos parecem duplicados" /
"Aluguel previsto casou com uma transação?". O usuário resolve:

- **Dedup banco×manual (pendente enquanto aguarda):** o par pendente é **netado**
  — a `Entry` manual fica `dedupStatus='pending'` e sai dos totais, a do banco
  permanece (uma cópia conta, não duas). Confirmar: manual vira `'merged'` (sai de
  vez). Recusar: `'rejected'`, volta a contar, não pergunta de novo.
- **Recorrente×real, confirmar:** cria/atualiza `RecurringRealization` para
  `confirmed`, a `Entry` real recebe `realizesRecurringId`. Enquanto pendente, o
  **fantasma** sai do previsto mas a `Entry` real continua no realizado (ver Nota
  crítica nas métricas). Recusar → realization descartada; recorrente volta a
  previsto e a `Entry` volta a `gastoVariavel`.

**Fechamento de mês (`assumed`) — sem job de background.** O app é client-side; não
há cron. A transição pra `assumed` é **preguiçosa, calculada na leitura**: quando o
`useFinance` carrega e detecta que o mês de um recorrente previsto **já virou**
(mês corrente > mês do recorrente) e ele nunca casou, marca `assumed` naquele
momento e persiste. Vale **nos dois sentidos**: gasto previsto não casado = assumido
pago; entrada prevista não casada = assumida recebida. Isso fecha o buraco da
entrada (salário do dia 5 não lançado, hoje 20) — no fim do mês ela resolve como
assumida, não fica invisível.
`// TODO (contra a missão do app): "assumido" não distingue pago-em-dinheiro de`
`// conta-esquecida, nem salário-atrasado de salário-que-não-veio. Revisitar:`
`// talvez alertar em vez de assumir, ao menos para prioridade alta.`

---

## Tarefas

### −1. Fundação (só se do zero — recria o baseline que a spec assume)

Esta tarefa não é feita pelo loop do superpowers. É uma sessão manual e
cuidadosa, porque o trabalho central é **ler os tipos reais do SDK**, não
escrever teste vermelho/verde (a chamada é a uma API externa).

1. **Scaffold** — Next 16 + TypeScript + Tailwind v4 + App Router (já rodado nesta
   máquina; se refazendo do zero em outra, repetir):
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
   chamada, abrir `node_modules/pluggy-sdk/dist/**/\*.d.ts`e ler as assinaturas
reais** de`createConnectToken`, `fetchAccounts`, `fetchTransactions`. Não
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

> **Atenção ao ponto que mais confunde:** existem _dois_ pares de credencial.
> `CLIENT_ID` / `CLIENT_SECRET` são as chaves da **sua conta** Pluggy, vão no
> `.env`, só no servidor — autenticam seu app na Pluggy. `user-ok` /
> `password-ok` são o **login do banco falso** que você digita _dentro_ do
> widget pra simular a conexão. Trocar um pelo outro é o erro clássico.

### 0. Setup shadcn + tokens (bloqueante — antes de qualquer UI)

**Primeiro, checar o que já existe:** o projeto tem Tailwind? Qual versão?
`package.json` + presença de `tailwind.config.*` ou `@import "tailwindcss"` no
`globals.css`. O scaffold do Next 16 já traz Tailwind v4; se por algum motivo não estiver, instalar
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
   `toggle-group`, `sonner`, `progress`, `chart`.
   (Sem `dialog` nem `badge`: não há uso — regra 13. O sheet cobre o overlay.)
5. Campo de valor e seleção de categoria da tela Adicionar (Tarefa 10):
   - Tentar `number-field` e `combobox` no **registry oficial** do shadcn primeiro.
   - **Se o registry não expuser** (o `combobox` costuma ser um padrão composto,
     e o `number-field` pode não existir como add): construir a partir do
     primitivo do **Base UI** direto (`@base-ui-components/react`). NUNCA puxar de
     registry de terceiro (regra 12). Cair pra `input` + máscara é aceitável.
6. Verificar visualmente **nos dois temas** que Button/Input renderizam com o
   raio e o verde desta spec, **não** com o default do shadcn. Se estiver
   arredondado demais ou cinza-neutro, os tokens não pegaram — parar e corrigir
   antes de seguir. Checar em especial o texto dentro do botão primário no
   escuro: se estiver branco, a regra 2 de tema foi ignorada.

**Mapa de uso** (o que vai onde — não adicionar nada além disto):

| Componente                    | Onde                                                                    |
| ----------------------------- | ----------------------------------------------------------------------- |
| `Popover`                     | Config no header (Tarefa 4)                                             |
| `Toggle Group`                | Seletor de tema Claro/Escuro/Sistema no popover (Tarefa 4)              |
| `Sheet`                       | Widget de conectar banco (Tarefa 12)                                    |
| `Tabs`                        | Planos / Anotações na Home (Tarefas 7 e 8)                              |
| `Progress`                    | Barra de sobra (Tarefa 5)                                               |
| `number-field`\*              | Valor em Adicionar (Tarefa 10) — \*fallback Base UI/input, ver Tarefa 0 |
| `combobox`\*                  | Categoria em Adicionar (Tarefa 10) — \*fallback Base UI, ver Tarefa 0   |
| `Select`                      | Tipo em Recorrentes (Tarefa 9) e no Adicionar (Tarefa 10)               |
| `Chart`                       | Barras de saldo por mês, até 6 (Tarefa 11)                              |
| `Button`, `Input`, `Checkbox` | geral                                                                   |
| `Sonner`                      | confirmações de salvar — **não** para o banner de dedup                 |

Sem componente shadcn: hero, linha do mês, StatCard, CategoryList, BottomNav,
banner de dedup. São CSS/SVG custom — não force um componente a virar isso.

### 1. Camada de dados (`lib/store/`)

- `lib/store/types.ts` — interface `FinanceStore` com todos os métodos, todos
  recebendo `userId` como primeiro argumento:
  `getEntries(userId, month)`, `createEntry(userId, entry)`,
  `updateEntry(userId, id, patch)` (dedup seta `dedupStatus`/`realizesRecurringId`),
  `deleteEntry(userId, id)`, `getRecurrings(userId)`,
  `saveRecurring(...)`, `deleteRecurring(...)`, `getRecurringTypes(...)`,
  `saveRecurringType(...)`, `deleteRecurringType(...)` (bloquear se algum
  `Recurring` ainda usa o `typeId`; o default `'gasto'` nunca é deletável),
  `getRealizations(userId, month)`, `saveRealization(...)`,
  `getPlans(...)`, `savePlan(...)`, `getNotes(...)`, `saveNote(...)`,
  `getConnection(userId)`, `saveConnection(userId, itemId)`,
  `removeConnection(userId)` (desconectar banco) etc.
- **Sessão NÃO é método do store.** `finance:session` é preferência de
  dispositivo, como o tema — vive no `useAuth`, não no `FinanceStore`. O `userId`
  que todo método recebe **sai** da sessão. Isso resolve o paradoxo "método precisa
  de userId, mas login acontece antes de existir userId": login é fora do store.
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
   - Fixos a sair (`aSairAindaNoMes` — encolhe conforme os fixos caem no mês;
     o rótulo é "a sair", não "total de fixos") · Gastou a mais (`gastoVariavel`)
4. **Barra de sobra**: `gastoVariavel / sobraPlanejada` (ver Métricas para as
   fórmulas e o caso `sobraPlanejada <= 0`). Verde `<80%`, âmbar `80–100%`,
   vermelho `>100%`. `Z = |sobraPlanejada − gastoVariavel|`. Texto: "Gastou R$ X
   dos R$ Y que sobram · faltam R$ Z" / "passou R$ Z da sobra" / (sobra ≤ 0)
   "Seus fixos já passam do que entra este mês".
5. **Gastos por categoria** — barras horizontais, ícone + nome + valor + % do
   total gasto, ordenado desc. Cor e ícone vêm de `lib/categories.ts` (ver nota abaixo).
6. **Abas internas**: Planos · Anotações (ver Tarefas 7 e 8).

> `lib/categories.ts` — **a categoria é string livre** (o usuário digita, o banco
> manda o que quiser), então não dá pra ter um enum fechado. Solução: um mapa dos
> rótulos conhecidos (`Alimentação`, `Transporte`, `Compras`, `Moradia`, `Saúde`,
> `Lazer`, `Outros`...) → `{ icon: LucideIcon, color: string }`, mais um **fallback
> determinístico** para rótulos desconhecidos: hash do nome → índice numa paleta
> fixa de ~8 cores + ícone genérico (`Tag`). Determinístico = a mesma categoria
> sempre cai na mesma cor, sem persistir nada.

### 6. Linha do mês (elemento signature)

Régua horizontal do dia 1 ao último dia do mês:

- Marcador vertical em "hoje", separando **realizado** (à esquerda, preenchido
  `var(--primary)`) de **previsto** (à direita, `var(--forecast)`).
- **Não usar `opacity` para o "previsto".** Opacidade baixa sobre fundo escuro
  some — o que funciona no claro desaparece no escuro. Usar o token `--forecast`,
  que tem valor próprio em cada tema, mais um tracejado (`stroke-dasharray`) como
  segundo sinal. O tracejado é o que carrega o significado nos dois temas; a cor
  só reforça.
- Pontos nos dias dos `Recurring` ativos **e vigentes no mês**: entrada = ponto
  `income`, gasto = ponto `expense`. O dia vem de `dayOfMonthOf(recurring)`
  (derivado de `startDate`, ver Modelo de dados). **Dia além do último dia do mês
  faz clamp no último dia** (dia 31 em fevereiro cai no 28/29) — o modelo e a
  régua usam a mesma função de clamp, senão o ponto some fora da barra.
- **Vários recorrentes no mesmo dia** viram um ponto só, com um contador
  (ex: `•3`). Tap abre a lista dos três, não some com dois deles.
- Recorrente já `realizado`/`assumido` no mês aparece esmaecido (cor própria,
  não opacity), pra distinguir de previsto — coerente com a régua.
- É isto que torna "quanto ainda vai entrar no mês" legível de relance, em vez
  de ser só mais um número num card.

### 7. Aba Planos (foco em corte de custo)

- Lista os `Recurring` de gasto **ordenados por `priority` desc** (o mais
  cortável primeiro) com o valor e o `url` como botão "Gerenciar".
- Usuário cria `Plan` amarrado a um recorrente, com economia mensal estimada.
- Topo: "Cortando estes N, você economiza R$ X por mês." X = soma dos
  `monthlySaving` dos planos não-`done`, **contando cada `targetRecurringId` uma
  vez** (dois planos no mesmo recorrente não somam a economia duas vezes).
- **Integridade:** ao deletar/inativar um `Recurring`, os `Plan` que o miram são
  removidos junto (ou marcados órfãos e escondidos) — nunca ficam apontando pra
  um alvo que sumiu.
- Empty state: "Nenhum plano ainda. Comece pelos de prioridade mais alta — os
  mais cortáveis (prioridade 5)." (prioridade 5 = cortável primeiro; 1 = essencial.)

### 8. Aba Anotações

- Lista simples de `Note` com textarea + "Salvar". Sem markdown, sem rich text.
- Ordenado por `createdAt` desc.

### 9. Tela Recorrentes (tabela)

- Tabela com colunas: **Dia** · **Descrição** · **Tipo** · **Valor** ·
  **Prioridade** · **Link**.
- `Tipo`: select alimentado por `RecurringType`. Default `'gasto'`.
  Opção "+ Novo tipo" no fim do select abre input inline com **label + escolha
  de direção** (entrada/saída) — a direção é obrigatória no `RecurringType` e é
  a fonte da verdade, então não dá pra criar tipo sem ela.
- `Prioridade`: 1–5, exibida como 5 barrinhas (não estrelas). 1 = essencial.
- `Link`: ícone `ExternalLink` quando tem `url`, abre em nova aba. É o atalho
  pra cancelar/verificar depois.
- Linha inativa (`active: false`) fica esmaecida, não some. **Alternar `active`**:
  toggle/switch na própria linha (ou swipe no card mobile). Recorrente inativo
  não entra em nenhuma métrica nem na linha do mês.
- **Editar** um recorrente: tap na linha abre o mesmo formulário da criação.
- Em mobile a tabela vira cards empilhados — **não** faça scroll horizontal.

### 10. Tela Adicionar

- Toggle Entrada / Saída no topo (a cor do formulário acompanha). Esse toggle
  define a `direction` do `Entry` avulso.
- Campos base: valor (`inputMode="decimal"`), descrição, data (default hoje),
  categoria (combobox — opções = os rótulos conhecidos de `lib/categories.ts`
  ∪ categorias já usadas pelo usuário; digitar livre também cria categoria nova).
- Checkbox **"Repetir todo mês"** → o form vira criação de `Recurring`, não de
  `Entry`. Isso **exige campos que o Entry não tem** — revelar ao marcar:
  - `tipo` (`Select` de `RecurringType`; a direção passa a vir do tipo, o toggle
    Entrada/Saída sai de cena);
  - `data de início` (`startDate` — é dela que sai o dia de vencimento);
  - `prioridade` (1–5);
  - `link` (`url`, opcional);
  - `frequência` e `fim` — ver Tarefa 14 (o schema já comporta desde a 13).
    Sem esses, cria-se um `Recurring` inválido — por isso o checkbox **transforma**
    o formulário, não só marca uma flag. A `category` escolhida nos campos base
    **continua valendo** e vai junto pro `Recurring` (ele passou a ter esse campo
    — ver Modelo de dados).
- Salvar volta pra Home.

### 11. Tela Histórico

- Lista de meses (mais recente primeiro), cada um com entradas, gastos e saldo.
- Tap abre o detalhe do mês reusando os componentes da Home em **modo `closed`**:
  mês fechado não tem "hoje", então `aEntrar`/`aSair ainda` = 0, a metade
  "prevista" da régua some e os cards "a entrar/a sair ainda" não aparecem. Só o
  realizado. Isso evita a lógica de "hoje" quebrar sobre um mês passado.
- Mini gráfico de barras: saldo dos meses disponíveis, **até 6**. Com menos de 6
  meses de uso, mostra só os que existem (1, 2, 3...) — nunca inventa barra vazia.
  Zero meses: esconde o gráfico e mostra "Ainda sem histórico".

### 12. Conectar banco (config → popover)

- Botão "Conectar banco" chama `/api/connect-token` e abre o `PluggyConnect`
  **exatamente como funciona hoje**. Não reescrever esse fluxo.
- Sucesso: `saveConnection(userId, itemId)`, faz o fetch das transações, converte
  pra `Entry` com `source: 'bank'`, roda o matching (ver regra acima).
- **Idempotência:** cada `Entry` de banco é upsert por `bankTransactionId`. Uma
  reconexão ou re-fetch **não** cria duplicata da mesma transação — atualiza a
  existente. Sem isso, cada reconexão re-importa tudo (o red-team pegou isso).
- Label é **"Conectar banco"**, não "Open Finance" — a Pluggy conecta tanto via
  Open Finance regulado quanto por conectores diretos; "banco" cobre os dois e
  é o que o usuário reconhece.
- Estado desconectado é o padrão e não pode parecer um erro. O app é completo
  sem isso.

### 13. Migração para Supabase (dados reais + auth real)

> Muda o "fora de escopo" original: banco de dados real e auth real deixam de
> ser adiados. Decisão registrada em sessão: a migração troca **dados e
> autenticação juntos**, não só o armazenamento — e o `FinanceStore` deixa de
> ser síncrono (ver ponto 3 abaixo), então esta tarefa toca `hooks/useFinance.ts`
> e os componentes que chamam o store, não só `lib/store/`.

1. **Criar o projeto no Supabase** (dashboard) — dependência externa, como a
   conta Pluggy na Tarefa −1. Sem isso nada dos passos seguintes roda.
2. **`.env.local`**: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (client-safe — a proteção é a RLS, não o segredo da chave) +
   `SUPABASE_SERVICE_ROLE_KEY` (**só servidor, nunca no client** — mesma regra
   do `CLIENT_SECRET` da Pluggy). Confirmar `.env*` no `.gitignore`.
3. **Schema (SQL) + RLS** — uma tabela por entidade de `lib/store/types.ts`
   (`entries`, `recurrings`, `recurring_types`, `recurring_realizations`,
   `plans`, `goals`, `notes`, `bank_connections`), todas com `user_id uuid
   references auth.users(id)`. Política de RLS em cada tabela:
   `auth.uid() = user_id` para `select`/`insert`/`update`/`delete`. Sem RLS, um
   usuário lê o dado do outro pela `anon key` — não é opcional.
   - **O `RecurringEnd` vira três colunas + `CHECK`:** `end_kind`
     (`'never' | 'after' | 'on'`), `end_occurrences int`, `end_date date`. A
     constraint garante que só a coluna do `kind` escolhido está preenchida —
     é a versão em banco da regra "estado inválido não é representável", e
     impede que um dado quebrado entre por fora do app (SQL no dashboard,
     script, bug futuro).
   - As tabelas já nascem com os campos decididos nesta rodada (`frequency`,
     `start_date`, vigência, `category` no recorrente, `goal_id`/`done_at` no
     plano) **mesmo sem UI ainda** — coluna no `CREATE TABLE` é grátis, migração
     com backfill depois não é.
4. **`lib/supabase/client.ts`** (browser) — ver regra 1b. O
   **`lib/supabase/server.ts`** e o middleware ficam **condicionais**: o app é
   client-side inteiro e não tem página server-side lendo dado do usuário. Os
   próprios tipos do `@supabase/ssr` avisam que um `setAll` mal implementado
   causa "logouts aleatórios e difíceis de debugar" — superfície de bug que só
   vale pagar quando existir server rendering de dado autenticado.
5. **`FinanceStore` vira assíncrono.** Toda assinatura em `lib/store/types.ts`
   passa a retornar `Promise<T>` (ex.: `getEntries(userId, month):
   Promise<Entry[]>`). `userId` continua o primeiro argumento (regra 8 não
   muda). Ajustar `hooks/useFinance.ts` e os componentes que leem o store
   (`Home`, `Recorrentes`, `AddEntry`, `Historico` etc.) para lidar com estado
   de carregamento — não dá pra fingir que a leitura é instantânea.
6. **`lib/store/supabaseStore.ts`** — implementa `FinanceStore` (já async)
   contra as tabelas do passo 3.
7. **`lib/store/index.ts`** passa a exportar a `SupabaseStore`. Esta troca já
   não é mais "a única mudança necessária" sozinha — depende dos passos 5 e 6
   estarem prontos primeiro.
8. **`hooks/useAuth.tsx` sai do mock.** Usa Supabase Auth
   (`signUp`/`signInWithPassword`/`onAuthStateChange`) em vez de gravar
   `{ id: 'local-user', email }` em `localStorage`. O `userId` que os métodos
   do store recebem passa a ser o `uuid` real de `session.user.id`. `// TODO:
   real auth` (regra crítica 8 do topo) é removido depois deste passo.
9. **`AuthGuard.tsx`** revisado para checar sessão real (e, se a proteção
   precisar ser server-side, `middleware.ts` com `@supabase/ssr`).

10. **Migrar os dados que já existem no `localStorage`.** Quem já usou o app
    tem lançamentos gravados no navegador; ao entrar pela primeira vez com
    conta real, oferecer importar (uma vez, com confirmação). Sem isso a
    migração apaga o histórico de uso na prática. Os `Recurring` antigos não
    têm `startDate`/`frequency`/`end` — derivar: `frequency: 'monthly'`,
    `end: { kind: 'never' }`, e `startDate` reconstruído do `dayOfMonth` antigo.

**Done da Tarefa 13:** cadastro e login reais funcionam (sem senha mock);
dados de cada usuário ficam isolados por RLS no Postgres (testar com duas
contas diferentes); todos os fluxos existentes (Home, Recorrentes, Adicionar,
Histórico) continuam funcionando, agora lendo/escrevendo via Supabase em vez
de `localStorage`. `.env.local` fora do git; nenhuma chave de servidor no
client.

### 14. Dívidas (depois da 13)

> Motivação registrada pelo usuário: o app precisa responder, de forma direta,
> **"pra quem eu devo, quanto devo, qual a parcela deste mês e em quantas
> vezes"**. Esta tarefa existe pra isso — não é enfeite, é a dor central.

#### O que é uma dívida aqui

Duas formas, exibidas na mesma lista:

1. **Parcelada** — já representável: um `Recurring` com `end.kind === 'after'`.
   "12x de R$ 350" é uma previsão mensal que se esgota. Nada novo no modelo
   além do credor.
2. **Aberta** — entidade nova `Debt`: você deve um valor a alguém, sem parcela
   fixa nem prazo ("R$ 2.000 pro meu irmão"). Não é recorrente — não há
   cobrança mensal — então forçá-la a virar `Recurring` criaria uma previsão
   de gasto que não existe.

#### Mudanças no modelo

```ts
// Recurring ganha UM campo:
creditor: string | null; // "Magalu", "Nubank", "meu irmão"

interface Debt {
  id: string;
  userId: string;
  creditor: string;
  description: string;
  totalAmount: number;
  dueDate: string | null; // prazo opcional
  settledAt: string | null; // quitada em
}

// Entry ganha o vínculo de pagamento:
paysDebtId?: string; // este lançamento abateu qual dívida aberta
```

- **`creditor` é campo próprio, não a `description`.** `description` é o _quê_
  ("sofá"); `creditor` é o _pra quem_ ("Magalu"). Sem separar, não dá pra
  agrupar por credor — que é literalmente a pergunta.
- Texto livre com autocomplete dos credores já usados, mesmo padrão de
  `category`. Sem tabela de credores: cadastro prévio pra registrar dívida é
  atrito que garante que ninguém registra.
- **Tudo o mais é derivado**, nada armazenado: valor cheio
  (`amount × occurrences`), parcela atual (`installmentOf`), quanto falta,
  data de vencimento (`dayOfMonthOf`), saldo da `Debt`
  (`totalAmount − Σ Entry.paysDebtId`).

#### Quando uma parcela conta como paga (regra rigorosa)

Decisão do usuário: **rigorosa**, não "venceu = pago". Uma ocorrência do mês
`M` conta como paga quando:

- existe `RecurringRealization` com status `confirmed` **ou** `assumed`; **ou**
- `M` é anterior ao mês corrente e **não existe** realization — assumida paga,
  mesma semântica do fechamento preguiçoso.

**Não** conta como paga quando a realization está `pending` (casamento
aguardando o usuário) ou quando `M` é o mês corrente sem realization.

> **Derivar, não persistir.** O fechamento preguiçoso de hoje só roda para o mês
> que o usuário abre no Histórico. Se a contagem de parcelas dependesse das
> linhas existirem, o número mudaria conforme os meses que ele navegou —
> instável e inexplicável. A contagem é calculada na leitura.

> Vale aqui o mesmo `// TODO` já registrado na Regra de matching: "assumido" não
> distingue pago-de-verdade de conta-esquecida. Para dívida isso importa mais do
> que para um gasto comum — revisitar.

#### A linha da dívida

```
Sofá · Magalu                              vence dia 10
R$ 350,00   ×12          total R$ 4.200,00
███████░░░░░░░░   5 de 12 pagas · faltam R$ 2.450,00
```

Uma linha responde as quatro perguntas. Dívida aberta usa a mesma linha sem o
`×N` e sem vencimento: só credor, total e quanto falta.

#### Onde vive

Seção **"Dívidas" na Home**, abaixo das métricas, com cabeçalho-resumo:

```
DÍVIDAS
Devendo R$ 7.180 ao todo · R$ 1.120 este mês
```

- **Sem quinta aba.** A bottom nav já tem quatro; cinco aperta no celular.
  A edição continua na tela Recorrentes.
- **Isto é uma vista, não uma métrica nova.** A parcela do mês já entra em
  `fixosDoMes`. Nada é somado duas vezes.
- Agrupar por `creditor` dá, de graça, uma visão parecida com fatura de cartão
  (quatro parcelamentos no "Nubank" aparecem juntos) — sem o app precisar
  conhecer o conceito de fatura (decisão do usuário: cada parcelamento é um
  compromisso solto).

#### Cadastro

Na tela Adicionar, "Repetir todo mês" passa a perguntar **por quanto tempo**:
**sempre** · **por N vezes** · **até certa data**. Escolher "por N vezes"
revela o campo de credor.

O valor digitado é o **da parcela**, não o total — é assim que se anuncia no
Brasil ("12x de R$ 350"), e evita erro de arredondamento ao dividir. O total
aparece calculado ao lado, para conferência.

Dívida aberta é criada pela seção Dívidas, não pelo Adicionar: ela não é um
lançamento nem um recorrente.

#### Navegar no tempo

`installmentOf()` vale para qualquer mês, então isso sai quase de graça:

- O `PeriodDetailSheet` (já existe, abre ao clicar numa barra do gráfico) ganha
  o bloco **"Dívidas vencendo neste período"**, com data e quanto faltava
  naquele ponto.
- Navegar para um mês futuro mostra corretamente "parcela 8 de 12 · faltam
  R$ 1.750".

#### Migração

O schema da Tarefa 13 **já está rodando no Supabase**. Esta tarefa entra como
um arquivo de migração (`ALTER TABLE` + `CREATE TABLE debts`), nunca editando
`supabase/schema.sql` como se fosse criação nova.

### 15. Metas (depois da 13)

- Aba Planos (Tarefa 7) ganha o vínculo opcional plano → `Goal`.
- Lista de metas com alvo, progresso derivado e prazo opcional.
- Resolver antes de codar o `// TODO` do progresso derivado (ver `Goal` no
  Modelo de dados): assumir que o dinheiro cortado foi guardado contradiz
  "o app nunca decide sozinho".

### 16. Blindar as rotas de API (bloqueia o deploy)

> Decisão registrada em sessão, depois de auditar o código: `/api/connect-token`
> e `/api/transactions` não verificam **ninguém**. Isso não tem relação com o
> repositório ser público — o buraco existe igual com repo privado, porque quem
> acha a URL do site acha as rotas. Tornar público só facilita descobrir que
> elas existem.

1. **`lib/supabase/server.ts`** — deixa de ser condicional. A Tarefa 13 adiou
   esse arquivo até "existir server rendering de dado autenticado"; a condição
   agora é outra e é mais forte: uma rota precisa saber **quem** está chamando.
2. **`/api/connect-token`**: sem sessão válida, não emite token. Sem isso,
   qualquer um gera token na **sua** conta Pluggy e queima as 5 conexões do
   Meu Pluggy.
3. **`/api/transactions`**: exige sessão **e** confere que o `itemId` pertence
   ao usuário da sessão (consultar `bank_connections` pelo `user_id`). Hoje
   qualquer `itemId` serve — o id é um uuid, mas isso é obscuridade, não
   proteção.
4. **Cadastro público desligado** no Supabase (Authentication → Sign Ups).
   Defesa em profundidade: sem conta, não há sessão, e as duas rotas acima
   ficam inalcançáveis.
5. **`.env.example`** versionado — formato das variáveis, nenhum valor. É como
   um projeto público documenta credenciais sem vazá-las.

**Done:** chamada sem sessão nas duas rotas responde 401; `itemId` de outro
usuário responde 403; `.env.example` no repositório e `.env*` fora dele.

### 17. Sync automático do banco + fatura do cartão (depois da 16)

> Motivação do usuário: *"preciso conectar meus bancos pra ele receber os dados"*
> e ver *"a dívida de cartão atual dos meus 2 bancos"*. Hoje nenhuma das duas
> acontece sozinha.

1. **O fetch hoje roda uma vez só**, no `handleSuccess` do `ConnectBankSheet` —
   no segundo em que o banco é conectado. Abrir o app amanhã não traz nada novo.
   Varrer as conexões salvas e re-importar na abertura, mais um botão
   "Atualizar agora". Seguro por construção: o `lib/bankImport.ts` é idempotente
   por `bankTransactionId`.
2. **Guardar "última sincronização" por conexão.** A Pluggy atualiza o item
   ~1x/dia; sincronizar mais que isso não traz dado novo, só consumo.
3. **Usar `data.accounts`.** A `/api/transactions` já devolve as contas com
   `type: 'CREDIT'` e o saldo — que é a fatura atual — e o `importBankData`
   **descarta**. É essa informação que faz os cartões aparecerem sem o usuário
   digitar parcela nenhuma.
4. **Tirar o `includeSandbox`** do `PluggyConnect` quando os testes acabarem.
5. Webhook da Pluggy fica **fora de escopo**: exige URL pública, rota
   autenticada e `SUPABASE_SERVICE_ROLE_KEY` no servidor. Ganho pequeno quando
   a fonte atualiza 1x/dia.

**Done:** abrir o app traz transações novas sem reconectar; a fatura atual de
cada cartão aparece por banco; reabrir o app dez vezes não duplica nada.

### 18. Modo visitante (store local) — o que torna o app público

> Decisão registrada em sessão. O usuário quer o app no ar e com notoriedade,
> **sem** guardar dado de terceiros (LGPD) e **sem** custo. A conexão bancária
> é a única peça que não tem versão "sem custódia": o `CLIENT_SECRET` não pode
> ir ao navegador, então o extrato passa pelo servidor e o item nasce dentro da
> conta Pluggy do dono do app. Logo: **visitante usa o app inteiro, mas não
> conecta banco.**

1. **`lib/store/localStore.ts`** implementa o mesmo `FinanceStore`, gravando no
   navegador do visitante. Base recuperável do commit `c437e42`
   (`localStorageStore.ts`, 267 linhas) — mas ela era **síncrona** e não conhece
   `Debt`, `BankConnection` nem os campos novos de `Recurring`. Ponto de
   partida, não "colar e funcionar".
2. **`lib/store/index.ts` escolhe a implementação**: sem sessão → `LocalStore`;
   com sessão → `SupabaseStore`. Os componentes não sabem a diferença — é para
   isso que o contrato existe.
3. **Sem cadastro para o visitante.** Ele entra e usa; o app é *manual-first* e
   a spec já garante que ele é completo sem nunca conectar banco.
4. **O botão "Conectar banco" não aparece sem sessão.** Não é limitação
   esquisita: "estado desconectado é o padrão e não pode parecer um erro".
5. **Nada de analytics que identifique o visitante.** O argumento de LGPD aqui
   não é "protejo bem o dado alheio", é **"nunca recebo o dado"**. Analytics
   com identificação destruiria exatamente isso.

**Done:** abrir o site sem logar dá um app funcional; fechar e reabrir mantém os
dados; nenhuma requisição grava nada no Supabase nesse modo.

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
--radius: 6px          ← valor único do projeto. Este é o teto: nada acima de 6px.
                          (o "8px" das rodadas antigas foi descartado — teto é 6.)
```

**`:root` (claro)** — conjunto shadcn completo, senão o componente cai no default genérico:

```
--background   #F1F4F0     --foreground            #14201A
--card         #FFFFFF     --card-foreground       #14201A
--popover      #FFFFFF     --popover-foreground    #14201A
--primary      #4F7D63     --primary-foreground    #FFFFFF
--secondary    #DCE8DF     --secondary-foreground  #14201A
--muted        #DCE8DF     --muted-foreground      #6E7A72
--accent       #DCE8DF     --accent-foreground     #14201A
--destructive  #A84A2C     --destructive-foreground #FFFFFF
--border       #DFE5DF     --input                 #DFE5DF
--ring         #4F7D63
```

Tokens de **domínio** (não fazem parte do vocabulário shadcn — ver nota da regra 11):

```
--income  #3F7A5E   --expense  #A84A2C   --amber  #C08A2E   --forecast  #A9B7AE
```

**`.dark` (padrão)**

```
--background   #111612     --foreground            #E4EAE5
--card         #171E19     --card-foreground       #E4EAE5
--popover      #171E19     --popover-foreground    #E4EAE5
--primary      #6FA383     --primary-foreground    #0D120F   ← inverte
--secondary    #1E2721     --secondary-foreground  #E4EAE5
--muted        #1E2721     --muted-foreground      #8A968F
--accent       #1E2721     --accent-foreground     #E4EAE5
--destructive  #C85A47     --destructive-foreground #0D120F
--border       #2A332D     --input                 #2A332D
--ring         #6FA383
```

Tokens de domínio (dark):

```
--income  #74B492   --expense  #C85A47   --amber  #DDA544   --forecast  #46554C
```

### Regras de tema (o que quase todo mundo erra)

1. **Escuro não é o claro invertido.** Os valores acima foram derivados por
   luminosidade, não por inversão.
2. **`--primary-foreground` inverte.** No claro, `--primary` é verde escuro →
   texto branco. No escuro, `--primary` é verde claro → **texto quase preto**.
   Manter branco entrega botão ilegível.
3. **A elevação NÃO inverte.** O card é mais claro que o fundo nos dois temas
   (`#FFFFFF` sobre `#F1F4F0`; `#171E19` sobre `#111612`). **A elevação é sempre
   a diferença de superfície + `1px solid var(--border)`, nos dois temas — não
   sombra** (coerente com a regra de sombra lá embaixo). No claro o contraste
   card/fundo é sutil, então a borda é o que separa; no escuro a superfície mais
   clara já separa e a borda reforça. Em nenhum tema se usa sombra pra elevar
   card. Não colocar card
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
- Login real (Supabase Auth, Tarefa 13) → Home funcional **sem nunca conectar
  banco**, com dados lançados na mão. Sem sessão, o modo visitante (Tarefa 18)
  entrega a mesma Home com store local.
- Home mostra: saldo, linha do mês, os 4 números, barra de sobra, gastos por
  categoria, abas Planos e Anotações.
- Recorrentes: criar, editar, criar tipo novo, definir prioridade e link.
- Adicionar entrada/saída funciona e reflete na Home na hora.
- Histórico lista meses anteriores.
- Config → "Conectar banco" abre o widget e conecta. Durante o desenvolvimento,
  no sandbox (`user-ok` / `password-ok`); em uso real, banco próprio via Meu
  Pluggy. Transações do banco entram, dedup pergunta antes de mesclar.
- As rotas de API respondem 401 sem sessão (Tarefa 16).
- Nenhum componente toca `localStorage` direto — tudo via `lib/store/`.
- Todo método do store recebe `userId`.
- Nenhuma credencial no client; rotas de API com `runtime = 'nodejs'`.
- Sem `any` solto; dados do Pluggy tipados.
- App abre no **escuro** por padrão, sem piscar claro no carregamento.
- Alternar tema no popover funciona e persiste após reload.
- Nos dois temas: card mais claro que o fundo, texto do botão primário legível,
  linha do mês com "previsto" visível.
- Contraste conferido: 4.5:1 texto, 3:1 gráfico.
- **Nenhum raio acima de 6px (teto único do projeto). O app não parece o shadcn default** — se um
  screenshot da tela puder ser confundido com qualquer outro app shadcn
  genérico, os tokens não foram aplicados.
- Só componentes do registry oficial; nenhum componente adicionado sem uso.

---

## Fora de escopo (não fazer agora)

- Auth real e banco de dados real deixaram de ser adiados — ver Tarefa 13
  (migração para Supabase).
- Plano comercial da Pluggy (conectar contas de **terceiros**) — ver Tarefa 18:
  o app público não oferece conexão bancária. **Meu Pluggy deixou de ser fora de
  escopo**: é o tier gratuito para conectar as **próprias** contas (até 5), e é
  o que a Tarefa 17 usa.
- Import de OFX.
- Categorização automática dos lançamentos manuais.
- Notificações / lembretes de vencimento dos recorrentes.
