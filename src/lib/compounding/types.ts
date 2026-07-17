// ============================================================
// CLJ Clínica — Módulo Manipulação (Compounding)
// Tipos TypeScript — gerados a partir de 005_compounding_base.sql
// ============================================================

// ─── Enums ──────────────────────────────────────────────────

export type CompoundingOrderStatus =
  | 'DRAFT'
  | 'AWAITING_PHARMACEUTICAL_REVIEW'
  | 'PRESCRIPTION_PENDING'
  | 'PRESCRIPTION_REJECTED'
  | 'APPROVED_FOR_PRODUCTION'
  | 'CHECKING_STOCK'
  | 'MISSING_STOCK'
  | 'AWAITING_PURCHASE'
  | 'STOCK_RESERVED'
  | 'QUEUED_FOR_PRODUCTION'
  | 'IN_SEPARATION'
  | 'AWAITING_WEIGHING'
  | 'IN_WEIGHING'
  | 'IN_COMPOUNDING'
  | 'IN_PROCESS_CONTROL'
  | 'AWAITING_PACKAGING'
  | 'IN_PACKAGING'
  | 'AWAITING_LABELING'
  | 'IN_LABELING'
  | 'PRODUCTION_COMPLETED'
  | 'AWAITING_FINAL_QUALITY_CONTROL'
  | 'QUALITY_CONTROL_REJECTED'
  | 'QUARANTINED'
  | 'REWORK_REQUIRED'
  | 'AWAITING_PHARMACIST_RELEASE'
  | 'RELEASE_REJECTED'
  | 'RELEASED_BY_PHARMACIST'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DISPENSED'
  | 'CANCELLED'
  | 'DESTROYED'

export type ItemType =
  | 'ACTIVE_INGREDIENT'
  | 'EXCIPIENT'
  | 'VEHICLE'
  | 'BASE'
  | 'PACKAGING'
  | 'LABEL'
  | 'CONSUMABLE'
  | 'CLEANING_MATERIAL'
  | 'FINAL_PRODUCT'

export type LotStatus =
  | 'RECEIVED'
  | 'QUARANTINE'
  | 'UNDER_ANALYSIS'
  | 'APPROVED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'RECALLED'
  | 'EXPIRED'
  | 'DEPLETED'
  | 'DISCARDED'

export type ReservationStatus =
  | 'ACTIVE'
  | 'CONSUMED'
  | 'PARTIALLY_CONSUMED'
  | 'RELEASED'
  | 'EXPIRED'
  | 'CANCELLED'

export type SeparationStatus =
  | 'PENDING'
  | 'SEPARATED'
  | 'CHECKED'
  | 'DIVERGENT'
  | 'CANCELLED'

export type WeighingStatus =
  | 'PENDING'
  | 'RECORDED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'CANCELLED'

export type StepStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'DEVIATED'

export type QualityStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'NOT_APPLICABLE'
  | 'REQUIRES_INVESTIGATION'

export type QualityDecision =
  | 'APPROVED'
  | 'REJECTED'
  | 'QUARANTINED'
  | 'REWORK_REQUIRED'
  | 'INVESTIGATION_REQUIRED'

export type DeviationSeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type DeviationStatus =
  | 'OPEN'
  | 'INVESTIGATION'
  | 'CLOSED'
  | 'CANCELLED'

export type ReleaseDecision =
  | 'APPROVED'
  | 'REJECTED'
  | 'QUARANTINED'
  | 'REWORK_REQUIRED'
  | 'INVESTIGATION_REQUIRED'

export type SignatureMethod =
  | 'ADVANCED_ELECTRONIC_SIGNATURE'
  | 'ICP_BRASIL_QUALIFIED_SIGNATURE'

export type PriorityLevel =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type MovementType =
  | 'RECEIPT'
  | 'APPROVAL'
  | 'RESERVATION'
  | 'RESERVATION_RELEASE'
  | 'PRODUCTION_CONSUMPTION'
  | 'PRODUCTION_RETURN'
  | 'PRODUCTION_LOSS'
  | 'QUALITY_SAMPLE'
  | 'DISCARD'
  | 'ADJUSTMENT'
  | 'TRANSFER'
  | 'BLOCK'
  | 'UNBLOCK'
  | 'RECALL'

export type StepType =
  | 'PREPARATION'
  | 'SIEVING'
  | 'MIXING'
  | 'HOMOGENIZATION'
  | 'DILUTION'
  | 'DISSOLUTION'
  | 'HEATING'
  | 'COOLING'
  | 'ENCAPSULATION'
  | 'FILLING'
  | 'FILTRATION'
  | 'ENVASING'
  | 'PACKAGING'
  | 'LABELING'
  | 'CLEANING'
  | 'IN_PROCESS_CHECK'
  | 'OTHER'

// ─── Table Interfaces ──────────────────────────────────────

export interface CompoundingOrder {
  id: string
  clinic_id: string
  patient_id: string
  patient?: { id: string; nome: string } | null
  prescription_id: string
  prescription_version_id: string

  internal_number: string
  final_batch_number: string | null
  pharmaceutical_form: string
  requested_quantity: number
  requested_unit: string

  status: CompoundingOrderStatus
  priority: PriorityLevel

  pharmacist_id: string | null
  assigned_manipulator_id: string | null

  scheduled_start_at: string | null
  production_started_at: string | null
  production_completed_at: string | null
  released_at: string | null
  ready_at: string | null
  dispensed_at: string | null

  due_at: string | null
  cancellation_reason: string | null

  created_by: string
  created_at: string
  updated_at: string
}

export interface CompoundingFormula {
  id: string
  order_id: string
  version_number: number
  status: string

  formula_data: unknown
  calculation_data: unknown
  packaging_requirements: unknown | null
  storage_requirements: unknown | null
  warning_requirements: unknown | null

  approved_by: string | null
  approved_at: string | null
  approval_signature_id: string | null

  created_by: string
  created_at: string
}

export interface CompoundingOrderItem {
  id: string
  order_id: string
  formula_id: string

  inventory_item_id: string
  inventory_item_name?: string | null
  item_type: ItemType

  theoretical_quantity: number
  technical_margin_quantity: number
  total_required_quantity: number
  unit: string

  actual_consumed_quantity: number
  returned_quantity: number
  loss_quantity: number

  sequence: number
  created_at: string
}

export interface InventoryLotReservation {
  id: string
  clinic_id: string
  order_id: string
  order_item_id: string

  inventory_item_id: string
  inventory_lot_id: string

  reserved_quantity: number
  consumed_quantity: number
  returned_quantity: number
  loss_quantity: number
  unit: string

  status: ReservationStatus
  reserved_by: string
  reserved_at: string
  expires_at: string | null
  released_at: string | null
  release_reason: string | null
}

export interface CompoundingSeparation {
  id: string
  order_id: string
  reservation_id: string

  expected_quantity: number
  separated_quantity: number
  unit: string

  separated_by: string
  checked_by: string | null
  separated_at: string
  checked_at: string | null

  status: SeparationStatus
  divergence_reason: string | null
}

export interface CompoundingWeighing {
  id: string
  order_id: string
  order_item_id: string
  reservation_id: string

  sequence: number
  theoretical_quantity: number
  actual_quantity: number
  unit: string

  allowed_minimum: number | null
  allowed_maximum: number | null
  container_tare: number | null
  gross_weight: number | null
  net_weight: number | null

  equipment_id: string | null
  calibration_status: string | null

  weighed_by: string
  verified_by: string | null
  weighed_at: string
  verified_at: string | null

  status: WeighingStatus
  notes: string | null
}

export interface CompoundingStep {
  id: string
  order_id: string

  sequence: number
  step_type: StepType
  instruction_version: string
  approved_instruction: string

  status: StepStatus
  started_by: string | null
  started_at: string | null
  completed_by: string | null
  completed_at: string | null

  equipment_data: unknown | null
  environment_data: unknown | null
  measured_values: unknown | null
  notes: string | null

  deviation_detected: boolean
  deviation_id: string | null
}

export interface CompoundingQualityCheck {
  id: string
  order_id: string

  check_stage: string
  check_type: string
  required: boolean

  target_value: string | null
  minimum_value: number | null
  maximum_value: number | null
  unit: string | null

  result_value: string | null
  result_status: QualityStatus

  method_reference: string | null
  equipment_id: string | null

  performed_by: string | null
  verified_by: string | null
  performed_at: string | null
  verified_at: string | null

  notes: string | null
  attachment_storage_key: string | null
}

export interface CompoundingDeviation {
  id: string
  order_id: string

  deviation_type: string
  severity: DeviationSeverity
  description: string

  detected_by: string
  detected_at: string

  status: DeviationStatus
  investigation: string | null
  corrective_action: string | null
  preventive_action: string | null

  decided_by: string | null
  decided_at: string | null
  final_decision: string | null
}

export interface CompoundingRelease {
  id: string
  order_id: string

  pharmacist_id: string
  pharmacist_name: string
  crf_number: string
  crf_state: string

  decision: ReleaseDecision
  notes: string | null

  signature_method: SignatureMethod
  signature_status: string

  order_hash: string
  production_record_hash: string
  quality_record_hash: string
  release_record_hash: string

  certificate_subject: string | null
  certificate_issuer: string | null
  certificate_serial: string | null

  release_pdf_storage_key: string | null
  signed_at: string
  validated_at: string | null
  validation_result: unknown | null

  ip_address: string | null
  user_agent: string | null
  authentication_session_id: string | null

  created_at: string
}

export interface CompoundingStatusHistory {
  id: string
  clinic_id: string
  order_id: string

  previous_status: string | null
  new_status: string
  reason: string | null

  changed_by: string
  changed_at: string

  metadata: unknown | null
}

export interface CompoundingAuditLog {
  id: string
  clinic_id: string
  order_id: string | null
  user_id: string | null

  event_type: string
  event_reason: string | null
  entity_type: string | null
  entity_id: string | null

  previous_data: unknown | null
  new_data: unknown | null
  metadata: unknown | null

  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ─── Lookup Helpers ────────────────────────────────────────

export const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  LOW: 'Baixa',
  NORMAL: 'Normal',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  LOW: 'text-muted-foreground',
  NORMAL: 'text-blue-500',
  HIGH: 'text-orange-500',
  URGENT: 'text-destructive',
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  ACTIVE_INGREDIENT: 'Insumo ativo',
  EXCIPIENT: 'Excipiente',
  VEHICLE: 'Veículo',
  BASE: 'Base',
  PACKAGING: 'Embalagem',
  LABEL: 'Rótulo',
  CONSUMABLE: 'Consumível',
  CLEANING_MATERIAL: 'Material de limpeza',
  FINAL_PRODUCT: 'Produto final',
}

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  PREPARATION: 'Preparação',
  SIEVING: 'Tamisação',
  MIXING: 'Mistura',
  HOMOGENIZATION: 'Homogeneização',
  DILUTION: 'Diluição',
  DISSOLUTION: 'Dissolução',
  HEATING: 'Aquecimento',
  COOLING: 'Resfriamento',
  ENCAPSULATION: 'Encapsulação',
  FILLING: 'Enchimento',
  FILTRATION: 'Filtração',
  ENVASING: 'Envase',
  PACKAGING: 'Embalagem',
  LABELING: 'Rotulagem',
  CLEANING: 'Limpeza',
  IN_PROCESS_CHECK: 'Controle em processo',
  OTHER: 'Outro',
}

// ─── Status Labels (Português) ─────────────────────────────

export const STATUS_LABELS: Record<CompoundingOrderStatus, string> = {
  DRAFT: 'Rascunho',
  AWAITING_PHARMACEUTICAL_REVIEW: 'Aguardando revisão farmacêutica',
  PRESCRIPTION_PENDING: 'Pendência de prescrição',
  PRESCRIPTION_REJECTED: 'Prescrição rejeitada',
  APPROVED_FOR_PRODUCTION: 'Aprovado para produção',
  CHECKING_STOCK: 'Verificando estoque',
  MISSING_STOCK: 'Estoque insuficiente',
  AWAITING_PURCHASE: 'Aguardando compra',
  STOCK_RESERVED: 'Estoque reservado',
  QUEUED_FOR_PRODUCTION: 'Fila de produção',
  IN_SEPARATION: 'Em separação',
  AWAITING_WEIGHING: 'Aguardando pesagem',
  IN_WEIGHING: 'Em pesagem',
  IN_COMPOUNDING: 'Em manipulação',
  IN_PROCESS_CONTROL: 'Controle em processo',
  AWAITING_PACKAGING: 'Aguardando embalagem',
  IN_PACKAGING: 'Em embalagem',
  AWAITING_LABELING: 'Aguardando rotulagem',
  IN_LABELING: 'Em rotulagem',
  PRODUCTION_COMPLETED: 'Produção concluída',
  AWAITING_FINAL_QUALITY_CONTROL: 'Aguardando CQ final',
  QUALITY_CONTROL_REJECTED: 'Reprovado no CQ',
  QUARANTINED: 'Em quarentena',
  REWORK_REQUIRED: 'Necessita retrabalho',
  AWAITING_PHARMACIST_RELEASE: 'Aguardando liberação',
  RELEASE_REJECTED: 'Liberação rejeitada',
  RELEASED_BY_PHARMACIST: 'Liberado pelo farmacêutico',
  READY_FOR_PICKUP: 'Pronto para retirada',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DISPENSED: 'Dispensado',
  CANCELLED: 'Cancelado',
  DESTROYED: 'Destruído',
}

// ─── Status Colors ─────────────────────────────────────────

export const STATUS_COLORS: Record<CompoundingOrderStatus, string> = {
  DRAFT: 'text-muted-foreground',
  AWAITING_PHARMACEUTICAL_REVIEW: 'text-amber-500',
  PRESCRIPTION_PENDING: 'text-orange-500',
  PRESCRIPTION_REJECTED: 'text-destructive',
  APPROVED_FOR_PRODUCTION: 'text-emerald-500',
  CHECKING_STOCK: 'text-blue-400',
  MISSING_STOCK: 'text-orange-600',
  AWAITING_PURCHASE: 'text-amber-500',
  STOCK_RESERVED: 'text-emerald-400',
  QUEUED_FOR_PRODUCTION: 'text-blue-500',
  IN_SEPARATION: 'text-violet-500',
  AWAITING_WEIGHING: 'text-blue-400',
  IN_WEIGHING: 'text-violet-600',
  IN_COMPOUNDING: 'text-indigo-500',
  IN_PROCESS_CONTROL: 'text-cyan-500',
  AWAITING_PACKAGING: 'text-blue-400',
  IN_PACKAGING: 'text-blue-600',
  AWAITING_LABELING: 'text-blue-400',
  IN_LABELING: 'text-blue-600',
  PRODUCTION_COMPLETED: 'text-emerald-500',
  AWAITING_FINAL_QUALITY_CONTROL: 'text-amber-500',
  QUALITY_CONTROL_REJECTED: 'text-destructive',
  QUARANTINED: 'text-red-600',
  REWORK_REQUIRED: 'text-orange-600',
  AWAITING_PHARMACIST_RELEASE: 'text-amber-500',
  RELEASE_REJECTED: 'text-destructive',
  RELEASED_BY_PHARMACIST: 'text-emerald-500',
  READY_FOR_PICKUP: 'text-emerald-600',
  OUT_FOR_DELIVERY: 'text-blue-500',
  DISPENSED: 'text-emerald-700',
  CANCELLED: 'text-destructive/60',
  DESTROYED: 'text-destructive/40',
}

// ─── Status Groups (Kanban Columns) ────────────────────────

export type KanbanColumn =
  | 'ANALISE'
  | 'ESTOQUE'
  | 'FILA'
  | 'SEPARACAO'
  | 'PESAGEM'
  | 'MANIPULACAO'
  | 'CONTROLE'
  | 'LIBERACAO'
  | 'PRONTA'
  | 'ENTREGUE'
  | 'CANCELADO'

export const STATUS_GROUPS: Record<KanbanColumn, CompoundingOrderStatus[]> = {
  ANALISE: [
    'DRAFT',
    'AWAITING_PHARMACEUTICAL_REVIEW',
    'PRESCRIPTION_PENDING',
    'PRESCRIPTION_REJECTED',
    'APPROVED_FOR_PRODUCTION',
  ],
  ESTOQUE: [
    'CHECKING_STOCK',
    'MISSING_STOCK',
    'AWAITING_PURCHASE',
    'STOCK_RESERVED',
  ],
  FILA: [
    'QUEUED_FOR_PRODUCTION',
  ],
  SEPARACAO: [
    'IN_SEPARATION',
  ],
  PESAGEM: [
    'AWAITING_WEIGHING',
    'IN_WEIGHING',
  ],
  MANIPULACAO: [
    'IN_COMPOUNDING',
  ],
  CONTROLE: [
    'IN_PROCESS_CONTROL',
    'AWAITING_PACKAGING',
    'IN_PACKAGING',
    'AWAITING_LABELING',
    'IN_LABELING',
    'PRODUCTION_COMPLETED',
    'AWAITING_FINAL_QUALITY_CONTROL',
    'QUALITY_CONTROL_REJECTED',
    'QUARANTINED',
    'REWORK_REQUIRED',
  ],
  LIBERACAO: [
    'AWAITING_PHARMACIST_RELEASE',
    'RELEASE_REJECTED',
    'RELEASED_BY_PHARMACIST',
  ],
  PRONTA: [
    'READY_FOR_PICKUP',
  ],
  ENTREGUE: [
    'OUT_FOR_DELIVERY',
    'DISPENSED',
  ],
  CANCELADO: [
    'CANCELLED',
    'DESTROYED',
  ],
}

export const KANBAN_COLUMN_LABELS: Record<KanbanColumn, string> = {
  ANALISE: 'Análise',
  ESTOQUE: 'Estoque',
  FILA: 'Fila',
  SEPARACAO: 'Separação',
  PESAGEM: 'Pesagem',
  MANIPULACAO: 'Manipulação',
  CONTROLE: 'Controle',
  LIBERACAO: 'Liberação',
  PRONTA: 'Pronta',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

// ─── Composite query types ─────────────────────────────────

export interface CompoundingOrderWithRelations extends CompoundingOrder {
  patient: { id: string; nome: string; cpf: string | null; telefone: string | null } | null
  pharmacist: { id: string; nome: string } | null
  assigned_manipulator: { id: string; nome: string } | null
  formula: CompoundingFormula | null
  items: CompoundingOrderItem[]
  reservations: InventoryLotReservation[]
  separations: CompoundingSeparation[]
  weighings: CompoundingWeighing[]
  steps: CompoundingStep[]
  quality_checks: CompoundingQualityCheck[]
  deviations: CompoundingDeviation[]
  releases: CompoundingRelease[]
  status_history: CompoundingStatusHistory[]
}

// ─── Dashboard summary ─────────────────────────────────────

export interface CompoundingSummary {
  awaiting_analysis: number
  in_production: number
  awaiting_release: number
  ready_for_pickup: number
  total_active: number
}
