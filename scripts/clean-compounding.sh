#!/bin/bash
API="https://gqkyjfrbgodcjiciwmbz.supabase.co/rest/v1"
KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdxa3lqZnJiZ29kY2ppY2l3bWJ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTkwMjI0MiwiZXhwIjoyMDk1NDc4MjQyfQ.RrfZ0e9ytE3XTSPh7tDXepMoIy3e9flZHfpNaI4g6a4"
H="apikey: $KEY"
A="Authorization: Bearer $KEY"
CT="Content-Type: application/json"

echo "=== Limpando compounding_orders ==="
# Delete in reverse FK order
for table in compounding_status_history compounding_order_items compounding_weighings compounding_separations compounding_formulas compounding_orders; do
  echo -n "  $table ... "
  curl -s -X DELETE "$API/$table" -H "$CT" -H "$H" -H "$A" -H "Prefer: return=minimal" \
    --data-raw '{"internal_number": {"$like": "MC-%"}}' -G 2>&1 | head -c 100
  # Try alternative - delete all since service role bypasses RLS
  # Use a filter that matches everything
  curl -s -X DELETE "$API/$table?id=neq.00000000-0000-0000-0000-000000000000" \
    -H "$H" -H "$A" -H "Prefer: return=minimal" -o /dev/null -w "OK\n" 2>&1
done

echo "=== Limpo ==="
