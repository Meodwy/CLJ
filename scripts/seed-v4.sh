#!/bin/bash
# Seed compounding orders — curl direto na REST API
API="https://gqkyjfrbgodcjiciwmbz.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4"
HDR="-H 'apikey: $KEY' -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -H 'Prefer: return=minimal'"

ADMIN="cabee5b7-0fad-43be-8b6f-9f659f9a7e20"
MANIP="3a131664-ce3f-477c-8c79-a90febe3faef"
FARMA="c0f1e05a-3975-41bf-a328-f12d71e6beee"
PATIENT="dc52fe24-280d-4a25-ba1c-d5be96928d22"
RX="c883295d-9bd1-4287-8a45-c803b7c495cf"
PROD="d38deaa8-7be9-4647-8db5-cf27f25c0f4f"
CLINIC="00000000-0000-0000-0000-000000000000"

MONTH=$(date +%y%m)
COUNT=1
uid() { node -e "console.log(require('crypto').randomUUID())"; }
ts() { node -e "console.log(new Date(Date.now() + ($1)*3600000).toISOString())"; }

api() {
  local method=$1 path=$2 data=$3
  curl -sf -X "$method" "$API/$path" \
    -H "apikey: $KEY" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "$data" > /dev/null 2>&1
}

mkorder() {
  local STATUS=$1 FORM=$2 QTY=$3 UNIT=$4 PRIORITY=$5 PREV=$6 PHARM=$7 MAN=$8 HOURS=$9 CANCEL="${10:-}"
  local NUM=$(printf "MC-${MONTH}-%04d" $COUNT)
  COUNT=$((COUNT + 1))

  local OID=$(uid)
  local FID=$(uid)
  local IID=$(uid)
  local HID=$(uid)
  local TS=$(ts $HOURS)

  # 1. Order
  local ORDER='{"id":"'$OID'","clinic_id":"'$CLINIC'","patient_id":"'$PATIENT'","prescription_id":"'$RX'","prescription_version_id":"00000000-0000-0000-0000-000000000000","internal_number":"'$NUM'","pharmaceutical_form":"'$FORM'","requested_quantity":'$QTY',"requested_unit":"'$UNIT'","status":"'$STATUS'","priority":"'$PRIORITY'","created_by":"'$ADMIN'","created_at":"'$TS'"'
  [ -n "$PHARM" ] && ORDER="$ORDER,\"pharmacist_id\":\"$PHARM\""
  [ -n "$MAN" ] && ORDER="$ORDER,\"assigned_manipulator_id\":\"$MAN\""
  [ -n "$CANCEL" ] && ORDER="$ORDER,\"cancellation_reason\":\"$CANCEL\""
  ORDER="$ORDER}"
  api POST "compounding_orders" "$ORDER" || { echo "  FAIL order $NUM"; return; }

  # 2. Formula
  local FORMULA='{"id":"'$FID'","order_id":"'$OID'","version_number":1,"status":"ACTIVE","formula_data":{"instructions":"Fórmula personalizada"},"calculation_data":{"totalQuantity":'$QTY',"unit":"'$UNIT'","batchSize":'$QTY',"overage":0},"created_by":"'$ADMIN'","created_at":"'$TS'"}'
  api POST "compounding_formulas" "$FORMULA" || { echo "  FAIL formula $NUM"; return; }

  # 3. Item
  local ITEM='{"id":"'$IID'","order_id":"'$OID'","formula_id":"'$FID'","inventory_item_id":"'$PROD'","item_type":"ACTIVE_INGREDIENT","theoretical_quantity":'$QTY',"technical_margin_quantity":0,"total_required_quantity":'$QTY',"unit":"'$UNIT'","sequence":1}'
  api POST "compounding_order_items" "$ITEM" || { echo "  FAIL item $NUM"; return; }

  # 4. History (only if previous status exists)
  if [ -n "$PREV" ]; then
    local HIST='{"id":"'$HID'","clinic_id":"'$CLINIC'","order_id":"'$OID'","previous_status":"'$PREV'","new_status":"'$STATUS'","changed_by":"'$ADMIN'","changed_at":"'$TS'"}'
    api POST "compounding_status_history" "$HIST" || { echo "  FAIL history $NUM"; return; }
  fi

  echo "  OK $NUM — $STATUS"
}

echo "=== Seed Compounding Orders ==="
echo ""

# ANALISE (5)
mkorder DRAFT Capsula 60 un NORMAL "" "" "" -120
mkorder AWAITING_PHARMACEUTICAL_REVIEW Capsula 60 un NORMAL "" "" "" -116
mkorder PRESCRIPTION_PENDING Capsula 60 un NORMAL "" "" "" -112
mkorder PRESCRIPTION_REJECTED Capsula 60 un NORMAL "" "" "" -108
mkorder APPROVED_FOR_PRODUCTION Capsula 60 un NORMAL "" "" "" -104

# ESTOQUE (4)
mkorder CHECKING_STOCK Solucao 200 ml HIGH "" "" "" -96
mkorder MISSING_STOCK Solucao 200 ml HIGH "" "" "" -90
mkorder AWAITING_PURCHASE Solucao 200 ml HIGH "" "" "" -84
mkorder STOCK_RESERVED Solucao 200 ml HIGH "" "" "" -78

# FILA (1)
mkorder QUEUED_FOR_PRODUCTION Pomada 50 g NORMAL STOCK_RESERVED "" "" -72

# SEPARACAO (1)
mkorder IN_SEPARATION Capsula 30 un URGENT QUEUED_FOR_PRODUCTION "" "$MANIP" -48

# PESAGEM (2)
mkorder AWAITING_WEIGHING Suspensao 150 ml NORMAL IN_SEPARATION "" "$MANIP" -18
mkorder IN_WEIGHING Suspensao 150 ml NORMAL AWAITING_WEIGHING "" "$MANIP" -12

# MANIPULACAO (1)
mkorder IN_COMPOUNDING Creme 100 g HIGH IN_WEIGHING "" "$MANIP" -6

# CONTROLE (4)
mkorder IN_PROCESS_CONTROL Capsula 90 un NORMAL IN_COMPOUNDING "" "$MANIP" -8
mkorder AWAITING_PACKAGING Capsula 90 un NORMAL IN_PROCESS_CONTROL "" "$MANIP" -6
mkorder PRODUCTION_COMPLETED Capsula 90 un NORMAL AWAITING_PACKAGING "" "$MANIP" -4
mkorder REWORK_REQUIRED Capsula 90 un NORMAL AWAITING_FINAL_QUALITY_CONTROL "" "$MANIP" -2

# LIBERACAO (3)
mkorder AWAITING_PHARMACIST_RELEASE Solucao 300 ml NORMAL PRODUCTION_COMPLETED "$FARMA" "" -10
mkorder RELEASE_REJECTED Solucao 300 ml NORMAL PRODUCTION_COMPLETED "$FARMA" "" -6
mkorder RELEASED_BY_PHARMACIST Solucao 300 ml NORMAL PRODUCTION_COMPLETED "$FARMA" "" -3

# PRONTA (1)
mkorder READY_FOR_PICKUP Pomada 30 g NORMAL RELEASED_BY_PHARMACIST "$FARMA" "" -1

# ENTREGUE (2)
mkorder OUT_FOR_DELIVERY Capsula 120 un LOW READY_FOR_PICKUP "$FARMA" "" -48
mkorder DISPENSED Capsula 120 un LOW READY_FOR_PICKUP "$FARMA" "" -72

# CANCELADO (1)
mkorder CANCELLED Gel 80 g LOW AWAITING_PHARMACEUTICAL_REVIEW "" "" -144 "Paciente desistiu"

echo ""
echo "Total: $((COUNT - 1)) ordens criadas!"
