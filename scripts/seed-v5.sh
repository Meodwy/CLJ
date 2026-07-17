#!/bin/bash
# Seed compounding — curl direto, sem abstração quebrada
API="https://gqkyjfrbgodcjiciwmbz.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4"
AUTH="-H 'apikey: $KEY' -H 'Authorization: Bearer $KEY' -H 'Content-Type: application/json' -H 'Prefer: return=minimal'"
ADMIN="cabee5b7-0fad-43be-8b6f-9f659f9a7e20"
MANIP="3a131664-ce3f-477c-8c79-a90febe3faef"
FARMA="c0f1e05a-3975-41bf-a328-f12d71e6beee"
CLINIC="00000000-0000-0000-0000-000000000000"
PATIENT="dc52fe24-280d-4a25-ba1c-d5be96928d22"
RX="c883295d-9bd1-4287-8a45-c803b7c495cf"
PROD="d38deaa8-7be9-4647-8db5-cf27f25c0f4f"

POST() {
  local tbl=$1 data=$2
  eval curl -sf -X POST "'$API/$tbl'" "$AUTH" -d "'$data'" > /dev/null || { echo "FAIL: $tbl"; exit 1; }
}

uid() { node -e "console.log(require('crypto').randomUUID())"; }
ts() { node -e "console.log(new Date(Date.now() + ($1)*3600000).toISOString())"; }

MONTH=$(date +%y%m)
SEQ=1
mk() {
  local s=$1 f=$2 q=$3 u=$4 p=$5 prev=$6 ph=$7 ma=$8 h=$9
  local num=$(printf "MC-${MONTH}-%04d" $SEQ); SEQ=$((SEQ+1))
  local oid=$(uid) fid=$(uid) iid=$(uid) hid=$(uid) t=$(ts $h)

  echo -n "  $num — $s ... "

  # Order
  local order='{"id":"'$oid'","clinic_id":"'$CLINIC'","patient_id":"'$PATIENT'","prescription_id":"'$RX'","prescription_version_id":"00000000-0000-0000-0000-000000000000","internal_number":"'$num'","pharmaceutical_form":"'$f'","requested_quantity":'$q',"requested_unit":"'$u'","status":"'$s'","priority":"'$p'","created_by":"'$ADMIN'","created_at":"'$t'"'
  [ -n "$ph" ] && order="$order,\"pharmacist_id\":\"$ph\""
  [ -n "$ma" ] && order="$order,\"assigned_manipulator_id\":\"$ma\""
  order="$order}"
  POST compounding_orders "$order"

  # Formula
  local formula='{"id":"'$fid'","order_id":"'$oid'","version_number":1,"status":"ACTIVE","formula_data":{"instructions":"Formula personalizada"},"calculation_data":{"totalQuantity":'$q',"unit":"'$u'","batchSize":'$q',"overage":0},"created_by":"'$ADMIN'","created_at":"'$t'"}'
  POST compounding_formulas "$formula"

  # Item
  local item='{"id":"'$iid'","order_id":"'$oid'","formula_id":"'$fid'","inventory_item_id":"'$PROD'","item_type":"ACTIVE_INGREDIENT","theoretical_quantity":'$q',"technical_margin_quantity":0,"total_required_quantity":'$q',"unit":"'$u'","sequence":1}'
  POST compounding_order_items "$item"

  # History
  if [ -n "$prev" ]; then
    local hist='{"id":"'$hid'","clinic_id":"'$CLINIC'","order_id":"'$oid'","previous_status":"'$prev'","new_status":"'$s'","changed_by":"'$ADMIN'","changed_at":"'$t'"}'
    POST compounding_status_history "$hist"
  fi

  echo "OK"
}

echo "=== Seed Compounding Orders ==="
echo ""

mk DRAFT Capsula 60 un NORMAL "" "" "" -120
mk AWAITING_PHARMACEUTICAL_REVIEW Capsula 60 un NORMAL "" "" "" -116
mk PRESCRIPTION_PENDING Capsula 60 un NORMAL "" "" "" -112
mk PRESCRIPTION_REJECTED Capsula 60 un NORMAL "" "" "" -108
mk APPROVED_FOR_PRODUCTION Capsula 60 un NORMAL "" "" "" -104
mk CHECKING_STOCK Solucao 200 ml HIGH "" "" "" -96
mk MISSING_STOCK Solucao 200 ml HIGH "" "" "" -90
mk AWAITING_PURCHASE Solucao 200 ml HIGH "" "" "" -84
mk STOCK_RESERVED Solucao 200 ml HIGH "" "" "" -78
mk QUEUED_FOR_PRODUCTION Pomada 50 g NORMAL STOCK_RESERVED "" "" -72
mk IN_SEPARATION Capsula 30 un URGENT QUEUED_FOR_PRODUCTION "" "$MANIP" -48
mk AWAITING_WEIGHING Suspensao 150 ml NORMAL IN_SEPARATION "" "$MANIP" -18
mk IN_WEIGHING Suspensao 150 ml NORMAL AWAITING_WEIGHING "" "$MANIP" -12
mk IN_COMPOUNDING Creme 100 g HIGH IN_WEIGHING "" "$MANIP" -6
mk IN_PROCESS_CONTROL Capsula 90 un NORMAL IN_COMPOUNDING "" "$MANIP" -8
mk AWAITING_PACKAGING Capsula 90 un NORMAL IN_PROCESS_CONTROL "" "$MANIP" -6
mk PRODUCTION_COMPLETED Capsula 90 un NORMAL AWAITING_PACKAGING "" "$MANIP" -4
mk REWORK_REQUIRED Capsula 90 un NORMAL AWAITING_FINAL_QUALITY_CONTROL "" "$MANIP" -2
mk AWAITING_PHARMACIST_RELEASE Solucao 300 ml NORMAL PRODUCTION_COMPLETED "$FARMA" "" -10
mk RELEASE_REJECTED Solucao 300 ml NORMAL PRODUCTION_COMPLETED "$FARMA" "" -6
mk RELEASED_BY_PHARMACIST Solucao 300 ml NORMAL PRODUCTION_COMPLETED "$FARMA" "" -3
mk READY_FOR_PICKUP Pomada 30 g NORMAL RELEASED_BY_PHARMACIST "$FARMA" "" -1
mk OUT_FOR_DELIVERY Capsula 120 un LOW READY_FOR_PICKUP "$FARMA" "" -48
mk DISPENSED Capsula 120 un LOW READY_FOR_PICKUP "$FARMA" "" -72
mk CANCELLED Gel 80 g LOW AWAITING_PHARMACEUTICAL_REVIEW "" "" -144

echo ""
echo "Total: $((SEQ - 1)) ordens criadas!"
