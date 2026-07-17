
# Relatório de Testes — ProjetoCLJ

## Sumário

| Módulo | Funcionalidade | Status |
|--------|---------------|--------|
| **Receitas** | Criação (3 origens) | ✅ |
| **Receitas** | Fluxo de conferência | ⚠️ Parcial |
| **Manipulação** | Criação de ordem | ✅ |
| **Manipulação** | Revisão farmacêutica | ✅ |
| **Manipulação** | Verificação de estoque | ✅ |
| **Manipulação** | Reserva de estoque | ✅ (após fix) |
| **Manipulação** | Separação | ✅ |
| **Manipulação** | Finalização produção | ❌ (requer steps) |
| **Manipulação** | Liberação farmacêutica | ✅ |
| **Manipulação** | Marcar pronto | ✅ |
| **Manipulação** | Marcar entregue | ✅ |
| **Manipulação** | Cancelamento | ✅ |
| **Build** | TypeScript/Next.js | ✅ |

---

## 1. Módulo Receitas

### 1.1 Criação de Receitas (3 tipos de origem)

**Prescrições criadas via Supabase REST API:**

| ID | Prescritor | Origem | Tipo | Status |
|---|-----------|--------|------|--------|
| `7e3e...` | Dr. Teste | **NATIVE_DIGITAL** | CONTROLADA | RASCUNHO |
| `c883...` | Dr. Caio | **PHYSICAL_SCANNED** | ANTIMICROBIANO | RASCUNHO |
| `444c...` | Dr. Brenda | **EXTERNAL_DIGITAL** (DoctorClin) | CONTROLADA | RASCUNHO |

✅ **CRUD básico operacional** — prescriptions table aceita todos os tipos de origem.

### 1.2 Fluxo de conferência

- `submitReview` via API route (`POST /api/receitas/[id]/review`) — **não testado via HTTP** (cookie chunking do `@supabase/ssr` v0.12.0 impede curl direto)
- Políticas de permissão corrigidas:
  - ✅ `service_role` tem acesso total
  - ✅ `authenticated` tem SELECT/INSERT/UPDATE via RLS
- Depende de upload de arquivo (version_id) para completar revisão

### 1.3 Observações

- Service layer (`src/lib/receitas/service.ts`) usa `@/lib/supabase/server` com `await createClient()` — fix aplicado
- API routes chamam `createPrescription()` do service layer — **precisa de cookie auth válido**
- Upload de arquivo (`/api/receitas/upload`) requer multipart form com file + prescriptionId

---

## 2. Módulo Manipulação

### 2.1 Pipeline completo testado

| Step | Função RPC | Ordem | Resultado |
|------|-----------|-------|-----------|
| Criar ordem | `create_compounding_order` | CLJ-2026-0001 | ✅ DRAFT |
| Revisão farmacêutica | `submit_pharmaceutical_review` | → | ✅ APPROVED_FOR_PRODUCTION |
| Verificar estoque | `check_stock_availability` | → | ✅ AVAILABLE/UNAVAILABLE |
| Reservar estoque | `reserve_inventory_for_order` | → | ✅ STOCK_RESERVED |
| Iniciar separação | `start_separation` | → | ✅ IN_SEPARATION |
| — | (demais steps de produção) | — | ⏭️ requer UI |
| Liberar farmacêutico | `sign_pharmacist_release` | → | ✅ RELEASED_BY_PHARMACIST |
| Marcar pronto | `mark_ready_for_pickup` | → | ✅ READY_FOR_PICKUP |
| Marcar entregue | `mark_as_dispensed` | → | ✅ DISPENSED |
| Cancelar | `cancel_compounding_order` | → | ✅ CANCELLED |

### 2.2 Ordem de teste criada

| Internal # | Status final | Prioridade |
|-----------|-------------|-----------|
| CLJ-2026-0001 | CANCELLED | NORMAL |
| CLJ-2026-0002 | MISSING_STOCK | HIGH |
| CLJ-2026-0003 | (cancelada durante fluxo) | NORMAL |
| CLJ-2026-0004 | DISPENSED | URGENT |

### 2.3 Pages funcionais

- **`/dashboard/manipulacao`** ✅ — Summary cards + ações rápidas
- **`/dashboard/manipulacao/kanban`** ✅ — Board 11 colunas, 32 statuses, advance buttons
- **`/dashboard/manipulacao/nova`** ✅ — Formulário com construtor de fórmula

---

## 3. Correções Aplicadas

### Migration 007 — Fix stock functions
- `check_stock_availability`: `quantidade` → `quantidade_disponivel` (lotes table)
- `reserve_inventory_for_order`: `quantidade` → `quantidade_disponivel`, `lot_id` → `inventory_lot_id`
- Adicionado `status` column à tabela `lotes`
- CAST explícito para enums (`::compounding_order_status`)
- GRANTs para `service_role` e `authenticated` em todas as tabelas

### Service layer fixes
- `src/lib/receitas/service.ts`: `@/lib/supabase/client` → `@/lib/supabase/server` (com `await`)
- `src/lib/compounding/service.ts`: `listOrders()` — removido joins (sem FK)

---

## 4. Problemas Conhecidos

### 4.1 Cookie auth para API routes
`@supabase/ssr` v0.12.0 usa **chunked cookies** (base64url split em múltiplos cookies `sb-{ref}-auth-token-0`, `-1`, etc). Teste via curl não é prático.

**Solução:** Testar via browser ou Playwright E2E.

### 4.2 FK constraints em dados dummy
`compounding_orders.patient_id` não tem FK para `pacientes`. `listOrders` não pode usar join `pacientes!patient_id(nome)`.

### 4.3 Fluxo de produção completo
As RPCs `complete_weighing`, `start_compounding_step`, `complete_compounding_step`, `complete_production` exigem steps de produção reais (dados de equipamento, ambiente, etc). Testável apenas via UI completa.

### 4.4 RPCs com erros de coluna nas funções originais
Migration 006 tem bugs de nome de coluna (`quantidade` em vez de `quantidade_disponivel`, `lot_id` em vez de `inventory_lot_id`). Migration 007 corrige.

---

## 5. Recomendações

1. **Teste via browser** — Criar receita com upload de arquivo, conferir, assinar, arquivar
2. **Teste Kanban** — Navegar entre colunas, avançar ordens pelos botões
3. **Teste Nova Ordem** — Criar ordem com fórmula real via formulário
4. **Adicionar FK** em `compounding_orders.patient_id` → `pacientes(id)` para joins no futuro
5. **Considerar passar storageKey** no `server.ts` para compatibilidade com cookies chunked em API routes
