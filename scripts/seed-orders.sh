#!/bin/bash
# Seed compounding orders via Supabase REST API
set -e

API="https://gqkyjfrbgodcjiciwmbz.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4"
AUTH="Authorization: Bearer $KEY"
CT="Content-Type: application/json"
PREFS="Prefer: return=minimal"

ADMIN="cabee5b7-0fad-43be-8b6f-9f659f9a7e20"
MANIP="3a131664-ce3f-477c-8c79-a90febe3faef"
FARMA="c0f1e05a-3975-41bf-a328-f12d71e6beee"
PATIENT="dc52fe24-280d-4a25-ba1c-d5be96928d22"
RX="c883295d-9bd1-4287-8a45-c803b7c495cf"
RX_V="00000000-0000-0000-0000-000000000000"
CLINIC="00000000-0000-0000-0000-000000000000"
ITEM="00000000-0000-0000-0000-000000000001"

MONTH=$(date +%y%m)

insert() {
  local STATUS="$1" FORM="$2" QTY="$3" UNIT="$4" PRIORITY="${5:-NORMAL}" PREV="${6:-null}" PHARM="${7:-null}" MAN="${8:-null}" DAYS="$9" CANCEL="${10:-}"
  local SEQ=$(printf '%04d' $COUNTER)
  local NUM="MC-${MONTH}-${SEQ}"
  COUNTER=$((COUNTER + 1))
  local OID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "$(date +%N)-$$-$RANDOM")
  local FID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "$(date +%N)-$$-$RANDOM")
  local IID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "$(date +%N)-$$-$RANDOM")
  local HID=$(uuidgen 2>/dev/null || python3 -c "import uuid; print(uuid.uuid4())" 2>/dev/null || echo "$(date +%N)-$$-$RANDOM")
  local CREATED=$(date -d "$DAYS hours ago" -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-${DAYS}H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)")

  # Insert order
  local ORDER_JSON=$(cat <<EOF
{
  "id": "$OID",
  "clinic_id": "$CLINIC",
  "patient_id": "$PATIENT",
  "prescription_id": "$RX",
  "prescription_version_id": "$RX_V",
  "internal_number": "$NUM",
  "pharmaceutical_form": "$FORM",
  "requested_quantity": $QTY,
  "requested_unit": "$UNIT",
  "status": "$STATUS",
  "priority": "$PRIORITY",
  "created_by": "$ADMIN",
  "created_at": "$CREATED",
  "pharmacist_id": ${PHARM:-null},
  "assigned_manipulator_id": ${MAN:-null},
  "cancellation_reason": ${CANCEL:-null}
}
EOF
)

  local RES=$(curl -s -X POST "$API/compounding_orders" -H "$CT" -H "$AUTH" -H "$PREFS" -d "$ORDER_JSON" 2>&1)
  if echo "$RES" | grep -q "error"; then echo "  FAIL order $NUM: $RES"; return; fi

  # Insert formula
  local FORM_JSON=$(cat <<EOF
{
  "id": "$FID",
  "order_id": "$OID",
  "version_number": 1,
  "status": "ACTIVE",
  "formula_data": {"instructions": "Formula personalizada"},
  "calculation_data": {"totalQuantity": $QTY, "unit": "$UNIT", "batchSize": $QTY, "overage": 0},
  "created_by": "$ADMIN",
  "created_at": "$CREATED"
}
EOF
)
  curl -s -X POST "$API/compounding_formulas" -H "$CT" -H "$AUTH" -H "$PREFS" -d "$FORM_JSON" > /dev/null 2>&1

  # Insert item
  local ITEM_JSON=$(cat <<EOF
{
  "id": "$IID",
  "order_id": "$OID",
  "formula_id": "$FID",
  "inventory_item_id": "$ITEM",
  "item_type": "ACTIVE_INGREDIENT",
  "theoretical_quantity": $QTY,
  "technical_margin_quantity": 0,
  "total_required_quantity": $QTY,
  "unit": "$UNIT",
  "sequence": 1
}
EOF
)
  curl -s -X POST "$API/compounding_order_items" -H "$CT" -H "$AUTH" -H "$PREFS" -d "$ITEM_JSON" > /dev/null 2>&1

  # Insert history (skip if prev is null string)
  if [ "$PREV" != "null" ]; then
    local HIST_JSON=$(cat <<EOF
{
  "id": "$HID",
  "clinic_id": "$CLINIC",
  "order_id": "$OID",
  "previous_status": "$PREV",
  "new_status": "$STATUS",
  "changed_by": "$ADMIN",
  "changed_at": "$CREATED"
}
EOF
)
    curl -s -X POST "$API/compounding_status_history" -H "$CT" -H "$AUTH" -H "$PREFS" -d "$HIST_JSON" > /dev/null 2>&1
  fi

  echo "  OK $NUM — $STATUS"
}

COUNTER=1
echo "=== Limpando dados existentes ==="

echo "=== Criando ordens ==="

# ANALISE (5)
insert "DRAFT" "Capsula" 60 "un" "NORMAL" null null null -120
insert "AWAITING_PHARMACEUTICAL_REVIEW" "Capsula" 60 "un" "NORMAL" null null null -116
insert "PRESCRIPTION_PENDING" "Capsula" 60 "un" "NORMAL" null null null -112
insert "PRESCRIPTION_REJECTED" "Capsula" 60 "un" "NORMAL" null null null -108
insert "APPROVED_FOR_PRODUCTION" "Capsula" 60 "un" "NORMAL" null null null -104

# ESTOQUE (4)
insert "CHECKING_STOCK" "Solucao" 200 "ml" "HIGH" null null null -96
insert "MISSING_STOCK" "Solucao" 200 "ml" "HIGH" null null null -90
insert "AWAITING_PURCHASE" "Solucao" 200 "ml" "HIGH" null null null -84
insert "STOCK_RESERVED" "Solucao" 200 "ml" "HIGH" null null null -78

# FILA (1)
insert "QUEUED_FOR_PRODUCTION" "Pomada" 50 "g" "NORMAL" "STOCK_RESERVED" null null -72

# SEPARACAO (1)
insert "IN_SEPARATION" "Capsula" 30 "un" "URGENT" "QUEUED_FOR_PRODUCTION" null "$MANIP" -48

# PESAGEM (2)
insert "AWAITING_WEIGHING" "Suspensao" 150 "ml" "NORMAL" "IN_SEPARATION" null "$MANIP" -18
insert "IN_WEIGHING" "Suspensao" 150 "ml" "NORMAL" "AWAITING_WEIGHING" null "$MANIP" -12

# MANIPULACAO (1)
insert "IN_COMPOUNDING" "Creme" 100 "g" "HIGH" "IN_WEIGHING" null "$MANIP" -6

# CONTROLE (4)
insert "IN_PROCESS_CONTROL" "Capsula" 90 "un" "NORMAL" "IN_COMPOUNDING" null "$MANIP" -8
insert "AWAITING_PACKAGING" "Capsula" 90 "un" "NORMAL" "IN_PROCESS_CONTROL" null "$MANIP" -6
insert "PRODUCTION_COMPLETED" "Capsula" 90 "un" "NORMAL" "AWAITING_PACKAGING" null "$MANIP" -4
insert "REWORK_REQUIRED" "Capsula" 90 "un" "NORMAL" "AWAITING_FINAL_QUALITY_CONTROL" null "$MANIP" -2

# LIBERACAO (3)
insert "AWAITING_PHARMACIST_RELEASE" "Solucao" 300 "ml" "NORMAL" "PRODUCTION_COMPLETED" "$FARMA" null -10
insert "RELEASE_REJECTED" "Solucao" 300 "ml" "NORMAL" "PRODUCTION_COMPLETED" "$FARMA" null -6
insert "RELEASED_BY_PHARMACIST" "Solucao" 300 "ml" "NORMAL" "PRODUCTION_COMPLETED" "$FARMA" null -3

# PRONTA (1)
insert "READY_FOR_PICKUP" "Pomada" 30 "g" "NORMAL" "RELEASED_BY_PHARMACIST" "$FARMA" null -1

# ENTREGUE (2)
insert "OUT_FOR_DELIVERY" "Capsula" 120 "un" "LOW" "READY_FOR_PICKUP" "$FARMA" null -48
insert "DISPENSED" "Capsula" 120 "un" "LOW" "READY_FOR_PICKUP" "$FARMA" null -72

# CANCELADO (1)
insert "CANCELLED" "Gel" 80 "g" "LOW" "AWAITING_PHARMACEUTICAL_REVIEW" null null -144

echo ""
echo "Total: $((COUNTER - 1)) ordens criadas!"
