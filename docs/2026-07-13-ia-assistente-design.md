# Assistente IA — ProjetoCLJ

**Data:** 2026-07-13
**Status:** Aprovado
**Stack:** Next.js 16 + Supabase (pgvector) + Gemini API

## Sumário

Integração de IA estilo n8n: usuário cola API key do Gemini nas configurações e ganha assistente chat, prontuário com RAG farmacêutico, e relatórios sob demanda.

## 1. Armazenamento da API Key

- Tabela `configuracoes` (chave-valor) no Supabase
- RLS: `(auth.jwt() ->> 'role' = 'admin')` p/ SELECT e UPDATE
- Escrita via `POST /api/ia/config` que verifica role admin server-side
- Leitura server-only (`import 'server-only'`) no `lib/ia/config.ts`
- Chave nunca exposta ao client bundle

## 2. RAG — Conhecimento Farmacêutico

### Tabela
```sql
CREATE TABLE conhecimento_farma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text NOT NULL,
  -- categorias: 'bula' | 'interacao' | 'manipulacao' | 'posologia' | 'legislacao'
  conteudo text NOT NULL,
  fonte text,
  embedding vector(768),  -- text-embedding-004 (Gemini)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_conhecimento_farma_embedding 
  ON conhecimento_farma 
  USING ivfflat (embedding vector_cosine_ops);
```

- Populado pelo usuário (admin) via UI ou SQL direto
- Tool `searchBula(query, categoria?)` faz busca coseno no pgvector
- Embedding gerado server-side ao inserir
- RAG previne alucinação: IA só responde sobre remédios com base no que está no banco

## 3. Tools do Gemini

| Tool | Descrição | Dados |
|------|-----------|-------|
| `getPaciente` | Busca paciente por nome/CPF | `pacientes` |
| `getAgendamentos` | Agenda por data/paciente | `agendamentos` |
| `getProduto` | Estoque por nome/código | `produtos`, `lotes` |
| `searchBula` | **RAG** — busca pgvector | `conhecimento_farma` |
| `gerarRelatorio` | Relatório estruturado | financeiro/estoque/pacientes |
| `getAlertas` | Alertas ativos | `alertas` |

Tool definitions registradas na API Gemini em `POST /api/ia/chat`.

## 4. Chat Widget

- Botão flutuante (`lucide MessageCircle`) canto inferior direito
- Drawer modal com histórico + input + streaming
- Contexto da página atual enviado automaticamente (ex: na página do paciente X, tool já recebe `paciente_id`)
- Stream via SSE (`/api/ia/chat?stream=true`)
- Mensagens **não** persistem entre sessões (stateless por simplicidade)

### Fluxo
```
POST /api/ia/chat { message, contexto? }
  → init Gemini com key + tools
  → IA decide ferramenta ou resposta direta
  → Se tool → executa server-side → resultado devolvido à IA
  → IA gera resposta final
  → Stream text response
```

## 5. Relatórios Sob Demanda

- Botão "Gerar relatório com IA" nas páginas de relatório existentes
- Tool `gerarRelatorio` recebe { tipo, periodo, filtros }
- Servidor monta prompt com dados reais agregados do DB
- Gemini retorna markdown formatado
- Resultado exibido em modal/drawer na mesma página

### Tipos de relatório
- Financeiro: receitas/despesas/faturamento período
- Estoque: produtos críticos, lotes vencendo, movimentação
- Pacientes: novos cadastros, frequência, procedimentos
- Manipulação: ordens por período, insumos mais usados

## 6. Estrutura de Pastas

```
src/
  lib/ia/
    config.ts                # Carrega key, init Gemini
    chat.ts                  # Loop chat + tool calling
    rag.ts                   # Busca pgvector + gera embedding
    tools/
      paciente.ts
      estoque.ts
      agendamento.ts
      bula.ts
      relatorio.ts
  app/api/ia/
    chat/route.ts            # POST, SSE streaming
    config/route.ts          # POST salva key
  components/ia/
    widget-button.tsx
    widget-drawer.tsx
    widget-message.tsx
```

## 7. Segurança

- API key Gemini: server-only, RLS admin, nunca no client
- Nenhum tool call expõe dados indevidos — cada tool verifica auth do user
- RAG só retorna fragmentos do `conhecimento_farma` que o admin inseriu
- Rate limiting básico nas API routes (futuro: upstash)
- Input sanitization no chat (escapar HTML/JS injetados)

## 8. Não Escopo (para esta fase)

- Histórico persistente de conversas
- Múltiplos provedores (só Gemini)
- Automações programadas (workflows)
- Embeddings de documentos PDF automáticos
