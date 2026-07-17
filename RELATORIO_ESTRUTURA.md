# Relatório Completo — ProjetoCLJ (CLJ Clínica)

> Gerado em: 2026-07-14

---

## 1. Visão Geral

**Projeto:** Sistema de gestão clínica/farmácia — "Orbit CRM light enterprise"
**Stack:** Next.js 16.2.9 + React 19.2.4 + TypeScript + Supabase + Tailwind v4
**UI:** shadcn/ui (base-nova) sobre @base-ui/react
**Ícones:** lucide-react
**Fontes:** Inter (corpo) + Outfit (títulos)
**Tema:** Light/Dark via ThemeContext

---

## 2. Estrutura de Diretórios (src/)

```
src/
├── app/
│   ├── layout.tsx                    # Root layout: Inter font, ThemeProvider, Toaster
│   ├── globals.css                   # Tailwind v4 + CSS vars + animações
│   ├── page.tsx                      # Redireciona p/ /dashboard
│   ├── (auth)/
│   │   ├── layout.tsx                # Auth layout (pass-through)
│   │   └── login/page.tsx            # Login (email/senha, Supabase Auth)
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Sidebar + Header + Conteúdo + AuthProvider
│   │   └── dashboard/
│   │       ├── page.tsx              # Home: KPIs, Quick Actions, Calendário mini
│   │       ├── pacientes/            # CRUD pacientes (listar, cadastro, editar)
│   │       ├── agendamentos/         # Calendário de agendamentos
│   │       ├── receitas/             # MÓDULO NOVO: Guarda de Receitas
│   │       ├── estoque/              # Inventário completo (produtos, lotes, etc)
│   │       ├── financeiro/           # Dashboard financeiro + vendas + despesas
│   │       ├── manipulacao/          # Placeholder "Em breve"
│   │       ├── relatorios/           # Placeholder "Em breve"
│   │       ├── assistente-ia/        # Página info do assistente
│   │       └── configuracoes/        # Config (chave Gemini)
│   └── api/
│       ├── ia/
│       │   ├── chat/route.ts         # Chat streaming (Gemini)
│       │   └── config/route.ts       # CRUD chave API
│       ├── estoque/fefo/route.ts     # Lógica FEFO
│       ├── receitas/                 # 9 rotas do módulo Guarda de Receitas
│       ├── setup-financeiro/route.ts # Setup tabelas financeiras
│
├── components/
│   ├── ui/
│   │   ├── button.tsx                # Button c/ variantes (base-ui)
│   │   ├── card.tsx                  # Card + Header/Title/Content/Footer
│   │   ├── input.tsx                 # Input (base-ui)
│   │   ├── label.tsx                 # Label
│   │   ├── sonner.tsx                # Toaster (notificações)
│   │   └── theme-toggle.tsx          # Botão light/dark
│   ├── dashboard/
│   │   └── sidebar.tsx               # Sidebar colapsável com nav role-based
│   ├── calendar/
│   │   ├── calendar-grid.tsx         # Grade mensal
│   │   ├── appointment-card.tsx      # Card de agendamento
│   │   └── appointment-form.tsx      # Formulário de agendamento
│   ├── ia/
│   │   ├── widget-button.tsx         # FAB flutuante do chat
│   │   └── widget-message.tsx        # Bolha de mensagem
│   ├── estoque/
│   │   └── barcode-scanner.tsx       # Leitor de código de barras
│   └── receitas/
│       ├── prescription-tabs.tsx      # Abas de status
│       ├── prescription-card.tsx      # Card de receita
│       ├── prescription-status-badge.tsx # Badge colorido
│       ├── prescription-form.tsx      # Formulário de criação
│       ├── checklist-form.tsx         # Checklist do farmacêutico
│       ├── signature-dialog.tsx       # Diálogo de assinatura
│       ├── document-viewer.tsx        # Visualizador de PDF
│       └── audit-timeline.tsx         # Timeline de auditoria
│
├── contexts/
│   ├── auth-context.tsx              # AuthProvider: sessão, perfil, roles
│   └── theme-context.tsx             # ThemeProvider: light/dark
│
├── lib/
│   ├── utils.ts                      # cn() (clsx + tailwind-merge)
│   ├── validators.ts                 # Schemas Zod
│   ├── supabase/
│   │   ├── client.ts                 # Browser client
│   │   ├── server.ts                 # Server client (cookies SSR)
│   │   ├── admin.ts                  # Service role client (bypass RLS)
│   │   ├── middleware.ts             # Middleware de sessão
│   │   └── types.ts                  # Interfaces das tabelas
│   ├── ia/
│   │   ├── chat.ts                   # Lógica do chat Gemini (streaming)
│   │   ├── config.ts                 # Gerenciamento de chave Gemini
│   │   ├── rag.ts                    # Busca vetorial (pgvector)
│   │   └── tools/index.ts           # Ferramentas do Gemini (6 tools)
│   ├── estoque/
│   │   └── fefo.ts                  # Algoritmo FEFO
│   └── receitas/
│       ├── types.ts                  # Tipos + constantes do módulo
│       └── service.ts               # 12 funções de serviço
│
├── proxy.ts                          # Middleware Next.js (updateSession)
└── middleware.ts                     # (config)
```

### 2.1 Novos Arquivos do Módulo Guarda de Receitas

| Arquivo | Função |
|---------|--------|
| `migrations/004_guarda_receitas.sql` | Cria 5 tabelas + RLS + storage + funções |
| `lib/receitas/types.ts` | Tipos, enums, labels, constantes |
| `lib/receitas/service.ts` | Lógica de negócio (CRUD, upload, revisão, assinatura) |
| `api/receitas/route.ts` | GET listar + POST criar |
| `api/receitas/upload/route.ts` | Upload de arquivo |
| `api/receitas/[id]/route.ts` | GET detalhe |
| `api/receitas/[id]/review/route.ts` | Iniciar/submeter conferência |
| `api/receitas/[id]/sign/route.ts` | Assinatura farmacêutico |
| `api/receitas/[id]/archive/route.ts` | Arquivar |
| `api/receitas/[id]/cancel/route.ts` | Cancelar |
| `api/receitas/[id]/legal-hold/route.ts` | Retenção legal |
| `api/receitas/[id]/file-url/route.ts` | URL assinada do storage |
| `components/receitas/*` (8) | Componentes UI |
| `dashboard/receitas/*` (4 pages) | Páginas do módulo |

---

## 3. Estrutura Visual

### 3.1 Layout do Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ [Sidebar 240px] │       [Header 64px]                     │
│ ─────────────── │  ← breadcrumb · search · 🔔 · 👤      │
│                 │                                          │
│  🏥 Clínica     │  ┌────────────────────────────────────┐  │
│                 │  │                                    │  │
│  📊 Dashboard   │  │        CONTEÚDO PRINCIPAL          │  │
│  👥 Pacientes   │  │     (scroll, p-6 lg:p-8)           │  │
│  📅 Agendamentos│  │                                    │  │
│  📋 Receitas    │  │                                    │  │
│  📦 Estoque     │  │                                    │  │
│  💰 Financeiro  │  └────────────────────────────────────┘  │
│  🔬 Manipulação │                                          │
│  📈 Relatórios  │       [FAB Chat 💬] — canto inferior dir.│
│  🤖 Assistente  │                                          │
│                 │                                          │
│  👤 farmacêutico│                                          │
│  🌓 ⏻          │                                          │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Sidebar

- **Largura:** 240px (colapsa para 56px com toggle)
- **Background:** white (light) / dark bg (dark)
- **Logo:** HeartPulse icon + "CLJ Clínica"
- **Navegação:** Itens com ícone + label, item ativo tem barra gradiente (primary/blue)
- **Roles:** Itens filtrados por role do usuário:
  - `administrador` → tudo
  - `farmaceutico` → pacientes, receitas, estoque, manipulação, relatórios
  - `atendente` → dashboard, pacientes, agendamentos
  - `manipulador` → pacientes, receitas, estoque, manipulação
  - `estoquista` → estoque
  - `financeiro` → dashboard, financeiro, relatórios
- **Seção inferior:** Avatar do usuário, theme toggle, sign out

### 3.3 Header

- **Altura:** 64px, border-bottom
- **Elementos:**
  - Breadcrumb navigation (ex: "Dashboard > Receitas")
  - Search input (hidden em mobile)
  - Notification bell (ícone com red dot)
  - User avatar (iniciais do nome)

### 3.4 Cards

Padrão consistente em todo o app:

```tsx
<Card size="sm">     // rounded-xl, border, shadow-sm
  <CardHeader>
    <CardTitle>      // font-heading (Outfit), font-medium
    </CardTitle>
  </CardHeader>
  <CardContent>      // espaço interno
  </CardContent>
  <CardFooter>       // opcional
  </CardFooter>
</Card>
```

- **Variant "sm":** padding reduzido (p-4 header/content, p-3 footer)
- **Card accent:** `.card-accent` classe adicional adiciona gradiente no topo (via ::before pseudo-elemento)
- **Hover animado:** cards interativos usam `hover:-translate-y-0.5 hover:shadow-md`

### 3.5 Botões

| Variante | Aparência | Uso |
|----------|-----------|-----|
| **default** (primary) | `bg-primary text-primary-foreground` | Ações principais: "Salvar", "Nova Receita" |
| **outline** | `border border-border bg-background` | Ações secundárias: "Cancelar", "Voltar" |
| **ghost** | Sem bg/borda, só no hover | Ações leves: botão voltar (seta) |
| **destructive** | `bg-destructive text-destructive-foreground` | Ações destrutivas: "Rejeitar", "Excluir" |
| **link** | Apenas texto sublinhado | Links inline |
| **secondary** | `bg-secondary text-secondary-foreground` | Ações alternativas |

- **Tamanho:** sm (h-8), md/default (h-9), lg (h-10), icon (h-9 w-9)
- **Ícone:** Todos aceitam `children` com ícones lucide + texto separado por gap-2
- **Click:** `active:scale-[0.97]` para feedback tátil

### 3.6 Cores

Tema usa variáveis CSS personalizadas (globals.css):

```
--primary: azul (diferentes matizes light/dark)
--destructive: vermelho
--success: #22c55e (custom, não padrão shadcn)
--warning: #f59e0b (custom)
--info: #3b82f6 (custom)
--muted: cinza para texto secundário
--card: bg do card
--border: bordas
```

### 3.7 Tipografia

- **Títulos:** `font-heading` (Outfit), semibold, `tracking-tight`
  - h1: text-xl (páginas principais)
  - Títulos de card: text-sm font-medium
- **Corpo:** `font-sans` (Inter), text-[13px] ou text-[14px]
- **Labels/Metadata:** text-xs, text-[12px], text-muted-foreground

### 3.8 Animações

- **Page load:** fade-up com stagger children (`.stagger-1` a `.stagger-10`, 40ms delay cada)
- **Transições:** `transition-all duration-200` com `var(--ease-out)` cubic-bezier
- **Hover:** transform suave, shadow transition
- **Loading:** spinner `<Loader2 className="animate-spin" />`

---

## 4. Banco de Dados

### 4.1 Tabelas Existentes

| Tabela | Finalidade | ~Colunas |
|--------|-----------|----------|
| `profiles` | Perfis de usuário | id, nome, role, created_at |
| `pacientes` | Cadastro de pacientes | id, nome, cpf, telefone, email |
| `agendamentos` | Agendas/consultas | id, paciente_id, data, hora, status |
| `categorias` | Categorias de produtos | id, nome, descricao, ativo |
| `fornecedores` | Fornecedores | id, razao_social, cnpj, contato |
| `localizacoes` | Endereços no estoque | id, setor, armario, prateleira |
| `produtos` | Produtos/medicamentos | id, nome, principio_ativo, saldo_atual |
| `lotes` | Lotes de produtos | id, produto_id, numero_lote, validade |
| `compras` | Ordens de compra | id, fornecedor_id, valor_total |
| `itens_compra` | Itens de compra | id, compra_id, produto_id, lote_id |
| `movimentacoes` | Movimentação de estoque | id, produto_id, tipo, quantidade |
| `inventarios` | Contagem física | id, produto_id, qtd_sistema, qtd_fisica |
| `alertas` | Alertas de estoque | id, tipo, mensagem, lido |
| `vendas` | Vendas | id, paciente_id, valor_total |
| `itens_venda` | Itens de venda | id, venda_id, produto_id |
| `despesas` | Despesas | id, tipo, descricao, valor |
| `configuracoes` | Config chave/valor | chave (PK), valor |
| `conhecimento_farma` | Base RAG (pgvector) | conteúdo, embedding |

### 4.2 Novas Tabelas (Guarda de Receitas)

| Tabela | Finalidade |
|--------|-----------|
| `prescriptions` | Receitas médicas |
| `prescription_versions` | Versões de arquivos (hash SHA-256) |
| `pharmacist_reviews` | Checklists de conferência |
| `pharmacist_signatures` | Assinaturas digitais |
| `prescription_audit_logs` | Log de auditoria (append-only) |

### 4.3 Roles

6 roles: `administrador`, `farmaceutico`, `atendente`, `manipulador`, `estoquista`, `financeiro`

### 4.4 RLS Policies

Todas as tabelas têm Row Level Security ativado. As policies verificam:
- O usuário está autenticado (`auth.uid()`)
- O role do usuário permite a operação
- Para audit logs: apenas INSERT/SELECT (UPDATE/DELETE revogados)

---

## 5. Fluxo de Autenticação

```
Login → Supabase Auth (email/senha) → sessão salva em cookie SSR
  → AuthProvider monta no DashboardLayout
  → Busca profiles para obter nome + role
  → Sidebar filtra nav por role
  → SignOut: limpa sessão, redireciona /login
```

- **Middleware:** `updateSession` do `@supabase/ssr` — não bloqueia rotas não autenticadas
- **Proteção:** Client-side via `useAuth()` — cada página verifica `profile.role`
- **Registro:** Trigger `handle_new_user()` auto-cria profile ao registrar

---

## 6. Estado do Chat IA

### 6.1 O que já existe

- **Frontend:** Widget flutuante (FAB) no canto inferior direito
  - Abre drawer de chat (380px)
  - Stream de respostas do Gemini
  - Status "não configurado" / "configurado"
  - Envia pathname como contexto

- **Backend:** API `/api/ia/chat` com streaming
  - Gemini 2.0 Flash
  - 6 ferramentas: busca paciente, agendamentos, produto, alertas, bula (RAG), relatório
  - Sistema de RAG com pgvector em `conhecimento_farma`

### 6.2 ❌ Por que NÃO está funcionando

**Falta a chave de API do Gemini.**

Para ativar:
1. Admin vai em **Configurações** (`/dashboard/configuracoes`)
2. Insere a **chave de API do Google Gemini** (obter em https://aistudio.google.com/apikey)
3. Chave é salva na tabela `configuracoes` (chave `gemini_api_key`)
4. Widget de chat no canto inferior direito passa a funcionar automaticamente

### 6.3 Como o chat funciona (quando configurado)

```
Usuário digita → POST /api/ia/chat → 
  → busca chave Gemini do DB
  → inicializa modelo
  → formata histórico
  → chama Gemini com tools
  → se Gemini chama tool → executa (SQL no Supabase)
  → retorna resultado pro Gemini
  → Gemini gera resposta final → streaming HTTP → UI
```

---

## 7. Módulo Guarda de Receitas — Visão Detalhada

### 7.1 Fluxo de Uso

```
Nova Receita (atendente/admin)
  → Preenche dados + faz upload PDF
  → Status: AGUARDANDO_CONFERENCIA
  ↓
Conferência Documental (farmacêutico)
  → Visualiza documento no viewer
  → Preenche checklist de 12 itens
  → Informa CRF + UF
  → Aprova / Rejeita / Pendência
  ↓
Assinatura Digital (farmacêutico)
  → Confirma assinatura (RDC 585/2021 + RDC 602/2021)
  → Seleciona método: Assinatura Eletrônica Avançada / ICP-Brasil
  → Assina → status ARQUIVADA
  ↓
Auditoria (tudo logado em prescription_audit_logs)
```

### 7.2 Status Possíveis

`RASCUNHO` → `AGUARDANDO_UPLOAD` → `AGUARDANDO_CONFERENCIA` → `EM_CONFERENCIA` → `APROVADA` (+ assinatura) → `ARQUIVADA`

Com ramificações: `REJEITADA`, `PENDENCIA_DOCUMENTAL`, `CANCELADA`, `VENCIDA`, `EM_RETENCAO_LEGAL`, `DESCARTADA`

### 7.3 Regras de Negócio

- Checklist de 12 itens: TODOS devem ser true para aprovação
- Assinatura apenas após revisão aprovada
- Arquivamente apenas com assinatura registrada
- Audit logs são append-only (UPDATE/DELETE revogados no DB)
- Hash SHA-256 de cada versão evita duplicação de documentos

---

## 8. Dependências Principais

```json
{
  "next": "16.2.9",
  "react": "19.2.4",
  "react-dom": "19.2.4",
  "@supabase/supabase-js": "^2.108.2",
  "@supabase/ssr": "^0.12.0",
  "@base-ui/react": "^1.6.0",
  "@google/generative-ai": "^0.24.1",
  "@fontsource/outfit": "^5.2.8",
  "lucide-react": "^1.21.0",
  "class-variance-authority": "^0.7.1",
  "tailwind-merge": "^3.6.0",
  "zod": "^4.4.3",
  "sonner": "^2.0.7",
  "pg": "^8.22.0",
  "tailwindcss": "^4",
  "@tailwindcss/postcss": "^4"
}
```

**Notas:**
- `@base-ui/react` substitui Radix como base headless (shadcn base-nova)
- Tailwind v4 usa CSS-based config (sem `tailwind.config.ts`)
- Zod v4 — API `.issues` em vez de `.errors`
- Não usa Prisma/NextAuth; BaaS com Supabase

---

## 9. Como Rodar

```bash
# Dev server
npm run dev -p 3001

# Build
npm run build

# Migrations SQL (via Supabase dashboard SQL Editor)
# Arquivo: migrations/004_guarda_receitas.sql

# Configurar Gemini (para chat IA):
# /dashboard/configuracoes → inserir chave Gemini
```

---

## 10. Melhorias Pendentes / Observações

1. **Chat IA:** Precisa de chave Gemini para funcionar (config em /dashboard/configuracoes)
2. **Manipulação + Relatórios:** São placeholders ("Em breve")
3. **CRF fields:** Farmacêutico precisa informar CRF manualmente na conferência (não salvo no profile ainda)
4. **clinic_id:** Usando fallfixo `00000000-0000-0000-0000-000000000001` para clínica única
5. **Pacientes:** Tabela `pacientes` sem data_nascimento, endereço (mínimo para v1)
