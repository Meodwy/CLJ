export interface Categoria {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
  created_at: string
}

export interface Fornecedor {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string | null
  telefone: string | null
  email: string | null
  endereco: string | null
  contato: string | null
  ativo: boolean
  created_at: string
}

export interface Localizacao {
  id: string
  setor: string
  armario: string | null
  prateleira: string | null
  gaveta: string | null
  descricao: string | null
  ativo: boolean
  created_at: string
}

export interface Produto {
  id: string
  nome: string
  nome_comercial: string | null
  principio_ativo: string | null
  categoria_id: string | null
  subcategoria: string | null
  fabricante: string | null
  codigo_barras: string | null
  sku: string | null
  registro_anvisa: string | null
  unidade_medida: string
  quantidade_por_embalagem: number
  estoque_minimo: number
  estoque_maximo: number | null
  saldo_atual: number
  ativo: boolean
  created_at: string
  updated_at: string
  // joined
  categorias?: Categoria
}

export interface Lote {
  id: string
  produto_id: string
  numero_lote: string
  data_fabricacao: string | null
  data_validade: string
  quantidade_recebida: number
  quantidade_disponivel: number
  custo_unitario: number | null
  fornecedor_id: string | null
  nota_fiscal: string | null
  localizacao_id: string | null
  registro_anvisa: string | null
  usuario_id: string | null
  created_at: string
  // joined
  produtos?: Produto
  fornecedores?: Fornecedor
  localizacoes?: Localizacao
}

// ── Financeiro ──

export interface Venda {
  id: string
  paciente_id: string | null
  data_venda: string
  valor_total: number
  forma_pagamento: FormaPagamento
  usuario_id: string | null
  observacao: string | null
  created_at: string
  // joined
  pacientes?: { id: string; nome: string } | null
  itens_venda?: ItemVenda[]
}

export type FormaPagamento = 'dinheiro' | 'cartao_credito' | 'cartao_debito' | 'pix' | 'boleto' | 'convenio' | 'transferencia' | 'outros'

export interface ItemVenda {
  id: string
  venda_id: string
  produto_id: string | null
  quantidade: number
  valor_unitario: number
  subtotal: number
  created_at: string
  // joined
  produtos?: Produto | null
}

export type TipoDespesa = 'aluguel' | 'salario' | 'agua' | 'energia' | 'telefone' | 'internet'
  | 'material_escritorio' | 'manutencao' | 'marketing' | 'impostos' | 'compra_produtos' | 'operacional' | 'outros'

export interface Despesa {
  id: string
  tipo: TipoDespesa
  descricao: string
  valor: number
  data_despesa: string
  forma_pagamento: string
  fornecedor_id: string | null
  usuario_id: string | null
  observacao: string | null
  recorrente: boolean
  dia_vencimento: number | null
  created_at: string
  // joined
  fornecedores?: { id: string; razao_social: string } | null
}

export const formaPagamentoLabels: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  pix: 'Pix',
  boleto: 'Boleto',
  convenio: 'Convênio',
  transferencia: 'Transferência',
  outros: 'Outros',
}

export const tipoDespesaLabels: Record<TipoDespesa, string> = {
  aluguel: 'Aluguel',
  salario: 'Salário',
  agua: 'Água',
  energia: 'Energia',
  telefone: 'Telefone',
  internet: 'Internet',
  material_escritorio: 'Material Escritório',
  manutencao: 'Manutenção',
  marketing: 'Marketing',
  impostos: 'Impostos',
  compra_produtos: 'Compra de Produtos',
  operacional: 'Operacional',
  outros: 'Outros',
}

export interface Compra {
  id: string
  fornecedor_id: string | null
  numero_nota: string | null
  data_compra: string
  valor_total: number | null
  usuario_id: string | null
  observacao: string | null
  created_at: string
  // joined
  fornecedores?: Fornecedor
  profiles?: Profile
}

export interface ItemCompra {
  id: string
  compra_id: string
  produto_id: string
  lote_id: string | null
  quantidade: number
  valor_unitario: number | null
  subtotal: number | null
  created_at: string
  // joined
  produtos?: Produto
  lotes?: Lote
}

export interface Movimentacao {
  id: string
  produto_id: string
  lote_id: string | null
  tipo_movimentacao: 'entrada' | 'saida' | 'ajuste' | 'transferencia' | 'perda' | 'descarte'
  quantidade: number
  usuario_id: string | null
  observacao: string | null
  created_at: string
  // joined
  produtos?: Produto
  lotes?: Lote
  profiles?: Profile
}

export interface Inventario {
  id: string
  produto_id: string
  lote_id: string | null
  quantidade_sistema: number
  quantidade_fisica: number
  diferenca: number
  usuario_id: string | null
  data: string
  observacao: string | null
  created_at: string
  // joined
  produtos?: Produto
  lotes?: Lote
  profiles?: Profile
}

export interface Agendamento {
  id: string
  paciente_id: string | null
  data: string
  hora_inicio: string
  hora_fim: string | null
  tipo_consulta: string | null
  status: 'agendado' | 'confirmado' | 'cancelado' | 'realizado' | 'faltou'
  observacao: string | null
  usuario_id: string | null
  created_at: string
  updated_at: string
  // joined
  pacientes?: Paciente
  profiles?: Profile
}

export interface Alerta {
  id: string
  tipo: 'estoque_minimo' | 'vencido' | 'vencendo_30' | 'vencendo_60' | 'vencendo_90' | 'lote_zerado' | 'divergencia_inventario'
  produto_id: string | null
  lote_id: string | null
  mensagem: string
  lido: boolean
  created_at: string
  // joined
  produtos?: Produto
  lotes?: Lote
}

export interface Profile {
  id: string
  nome: string
  role: string
  created_at: string
}

export interface Paciente {
  id: string
  nome: string
  cpf: string | null
  telefone: string | null
  email: string | null
  created_at: string
}