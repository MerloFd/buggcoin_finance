# BuggCoin

**App de finanças pessoais que responde uma pergunta direta: pra quem eu devo, quanto devo, qual a parcela deste mês e em quantas vezes.**

> ⚠️ **Status: em desenvolvimento, ainda não está no ar.** Este README descreve o
> projeto como ele é hoje — o que já funciona está marcado, o que falta também.
> Nada aqui é aspiracional.

---

## O problema

A maioria dos apps de finanças soma tudo num número só e te diz "você gastou R$ 4.200".
Isso não ajuda a decidir nada. As perguntas que realmente importam são outras:

- Quanto do que vou gastar **já está comprometido** (aluguel, parcelas, assinaturas)?
- Quanto sobra para gastar **sem furar o mês**?
- **Pra quem eu devo**, e quando isso acaba?

O BuggCoin é construído em torno dessas três perguntas.

## Duas ideias que guiam o projeto

**1. Manual-first.** O app é completo sem nunca conectar um banco. Conectar é um
atalho opcional, não um requisito — os dados de Open Finance chegam com até 24h de
atraso, então lançar na mão continua sendo o caminho rápido. Estado desconectado é o
padrão e não é tratado como erro.

**2. Previsto e realizado nunca se somam.** Um gasto recorrente é uma *previsão* que
desaparece quando o gasto real chega. Somar os dois infla o total e é o erro mais
comum nesse tipo de app. Toda a métrica deriva dessa regra.

## O que já funciona

- **Lançamentos** manuais de entrada e saída, com categoria.
- **Recorrentes** com frequência, vigência e término (`nunca` / `após N vezes` / `em
  tal data`), e tipos criáveis pelo usuário.
- **Métricas do mês**: gasto realizado, entradas, renda conhecida, gastos fixos,
  gasto variável, e o número principal — **quanto ainda dá para gastar**.
- **Dívidas agrupadas por credor**: parcelas (`12x de R$ 350`) e dívidas abertas
  (`R$ 2.000 pro meu irmão`) na mesma lista, com subtotal por credor, parcela do mês,
  total restante e em que mês acaba.
- **Gráfico de movimento** por semana/mês/semestre/ano, com os dias futuros do mês
  em cor de previsão.
- **Histórico** de meses anteriores.
- **Conexão bancária via Pluggy**: o widget conecta, as transações viram lançamentos,
  e o import é idempotente — reconectar nunca duplica nada.
- **Dedup banco × manual**: quando uma transação do banco parece ser a mesma coisa que
  um lançamento manual, o app **pergunta**. Nunca mescla sozinho.
- **Auth real** e isolamento por usuário via Row Level Security no Postgres.
- **Tema claro/escuro** com tokens próprios.

## O que falta

- [ ] Autenticação nas rotas de API (hoje elas não verificam sessão — **bloqueia o deploy**)
- [ ] Sincronização automática do banco (hoje o fetch roda só no momento da conexão)
- [ ] Fatura atual do cartão por banco (o dado já chega da Pluggy e é descartado)
- [ ] Modo visitante com armazenamento local (usar o app sem cadastro)
- [ ] Metas
- [ ] Screenshots e GIF de demonstração
- [ ] Deploy

## Como funciona por dentro

As decisões que mais moldam o código:

**Contrato de armazenamento.** Nenhum componente toca `localStorage` ou Supabase
direto — tudo passa pela interface `FinanceStore` (`lib/store/types.ts`). Trocar o
backend é trocar uma linha em `lib/store/index.ts`. É isso que vai permitir o modo
visitante (armazenamento no navegador) conviver com a conta logada (Postgres) sem o
resto do app saber da diferença.

**Todo método do store recebe `userId` como primeiro argumento.** Regra rígida, para
que seja impossível esquecer o escopo do usuário por acidente.

**Isolamento no banco, não no app.** Cada tabela tem RLS com `auth.uid() = user_id`.
Mesmo que o cliente peça o dado de outro usuário, o Postgres não entrega.

**Estado inválido não é representável.** O término de um recorrente vira três colunas
mais um `CHECK` no SQL, garantindo que só a coluna do tipo escolhido esteja
preenchida. A mesma regra vale no banco e no TypeScript.

**Import idempotente.** Cada lançamento vindo do banco carrega o
`bankTransactionId`. Reimportar é seguro por construção — transação já importada é
pulada, não duplicada.

**Direção nunca vem do sinal.** O valor é sempre positivo; entrada ou saída é um campo
próprio. Confiar no sinal do número é fonte clássica de bug quando o provedor muda a
convenção.

**Decisões documentadas.** O [`spec.md`](./spec.md) é a fonte de verdade do projeto:
modelo de dados, regras de matching, métricas derivadas e o porquê de cada escolha.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui sobre
Base UI · Chart.js · Supabase (Postgres + Auth + RLS) · Pluggy (Open Finance)

## Rodando localmente

Você vai precisar das **suas próprias** credenciais — o projeto não vem com nenhuma.

**1. Clone e instale**

```bash
git clone <url-do-repo>
cd buggcoin
npm install
```

**2. Supabase** — crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard),
abra o SQL Editor e rode, nesta ordem:

```
supabase/schema.sql
supabase/migrations/001_debts_and_multibank.sql
```

**3. Pluggy (opcional)** — só se quiser conectar banco. Crie uma conta gratuita no
[Meu Pluggy](https://meu.pluggy.ai), que permite conectar as **suas próprias** contas
(até 5). As credenciais ficam no [dashboard](https://dashboard.pluggy.ai) em
*Settings > API Keys*.

**4. Variáveis de ambiente**

```bash
cp .env.example .env.local
```

Preencha com os seus valores. O `.env.example` explica cada uma.

**5. Suba**

```bash
npm run dev
```

Para testar a conexão bancária sem banco real, o widget inclui os conectores de
sandbox da Pluggy — use `user-ok` / `password-ok`.

## Segurança e privacidade

O código ser público não enfraquece nada: **o que protege não é o código ser secreto,
é o segredo não estar no código.**

- `CLIENT_ID` e `CLIENT_SECRET` da Pluggy existem apenas no servidor
  (`lib/pluggy.ts`), nunca são importados por componente de cliente, e não têm o
  prefixo `NEXT_PUBLIC_` — logo não entram no bundle do navegador.
- Nenhum arquivo `.env` foi commitado em nenhum ponto da história do repositório.
- A anon key do Supabase **é** visível no navegador, por design: quem protege os
  dados é a RLS, não o sigilo dela.
- Quem clona o projeto usa as credenciais **dele**, com a cota dele e o banco dele.
  Não há contato com a instância de ninguém.

Quando este app for ao ar, ele **não** oferecerá conexão bancária a terceiros. Esse é
o único recurso que exige custódia de dado alheio: o `CLIENT_SECRET` não pode ir ao
navegador, então o extrato passa pelo servidor e a conexão nasce dentro da conta
Pluggy do dono do app. Quem quiser a automação bancária roda a própria instância,
seguindo as instruções acima.

## Licença

A definir.
