# Product

## Register

product

## Users

Equipe de clínica médica distribuída em 6 funções:
- **Administrador** — visão geral, configurações, gestão completa
- **Farmacêutico** — receitas, manipulação, estoque
- **Atendente** — agendamentos, cadastro de pacientes
- **Manipulador** — ordens de manipulação, kanban
- **Estoquista** — inventário, compras, lotes, fornecedores
- **Financeiro** — vendas, despesas, relatórios

Cada usuário opera em contexto clínico: ritmo acelerado, multitarefa, precisa de informação clara e ações rápidas.

## Product Purpose

CLJ Clínica é um sistema de gestão clínica que centraliza pacientes, agendamentos, receitas, estoque, manipulação e financeiro em uma plataforma única. Sucesso é reduzir o tempo gasto em tarefas administrativas e eliminar erros de comunicação entre setores.

## Brand Personality

Profissional, preciso, confiável.

Tom institucional mas não frio — comunica competência técnica sem jargão desnecessário. A interface inspira confiança: dados corretos, estados claros, zero ambiguidade.

## Anti-references

- Sistemas clínicos legados (interface poluída, hierarquia visual plana, contraste baixo)
- "SaaS genérico" — landing pages com eyebrows, cards idênticos, metric-hero template
- Excesso de cor ou elementos decorativos que distraem do dado clínico
- Modal inception (modal abrindo modal)

## Design Principles

1. **Clareza sobre estilo** — cada elemento existe pra informar ou permitir ação. Decoração pura não entra.
2. **Dados primeiro** — números, status e prazos são o centro. Tipografia e hierarquia servem legibilidade.
3. **Consistência de sistema** — um padrão de input, um padrão de card, um padrão de botão. Sem surpresas entre telas.
4. **Feedback imediato** — loading, empty, error, success states em todo lugar. Usuário nunca se pergunta "aconteceu algo?".
5. **Antifrágil** — entradas inválidas, dados faltando, permissões insuficientes: o sistema guia, não quebra.

## Accessibility & Inclusion

- WCAG AA (contraste ≥4.5:1 corpo, ≥3:1 texto grande)
- Dark mode completo com paleta dedicada (não inversão simples)
- prefers-reduced-motion respeitado
- Focus-visible rings em todo elemento interativo
