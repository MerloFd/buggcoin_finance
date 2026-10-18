# Modo de resposta:

- Sempre a cada passo da Spec me diga qual o proximo passo e porque estamos caminhando pra ele.
- Me responda em PT-BR, e sou iniciante então me guie como um.

# Regras invioláveis

- spec.md é a fonte de verdade. Contradição com ela = parar e perguntar.
- Nenhum componente chama localStorage direto. Tudo via lib/store/.
  Exceção única: next-themes (tema).
- Todo método do store recebe userId como primeiro argumento.
- Nunca assumir assinatura do pluggy-sdk. Ler os .d.ts em node_modules antes.
- Rotas com SDK: runtime = 'nodejs' + dynamic = 'force-dynamic'.
- CLIENT_ID/CLIENT_SECRET nunca no client.
- Código e comentários em inglês. UI em pt-BR.
- Sem any. Sem raio acima de 8px.
- Dedup nunca é automático. O usuário confirma. Banner persistente, nunca toast.
- Dark: --primary-foreground é escuro, não branco. Card mais claro que o fundo.
- Nada comunicado só por opacidade.
