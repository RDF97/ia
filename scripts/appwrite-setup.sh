#!/usr/bin/env bash
# Crea/parchea TODAS las colecciones y atributos de Appwrite que la app necesita.
# Idempotente: lo que ya exista devolverá "already exists" (inofensivo).
#
# Uso (desde la raíz del repo):
#   PID=tu_project_id KEY=tu_api_key bash scripts/appwrite-setup.sh
#
# Variables:
#   PID  (obligatoria)  Project ID de Appwrite
#   KEY  (obligatoria)  API key de Appwrite con scope de Databases (write)
#   EP   (opcional)     endpoint; por defecto https://appwrite.lademanu.es/v1
#   DB   (opcional)     database id; por defecto "homie"

set -u
EP="${EP:-https://appwrite.lademanu.es/v1}"
DB="${DB:-homie}"
: "${PID:?Falta PID (Project ID). Ej: PID=6a552b8f0019ea6d2787 KEY=... bash scripts/appwrite-setup.sh}"
: "${KEY:?Falta KEY (API key de Appwrite con permisos de Databases).}"

H=(-H "X-Appwrite-Project: $PID" -H "X-Appwrite-Key: $KEY" -H "Content-Type: application/json")

post() { curl -sS -X POST "$EP$1" "${H[@]}" -d "$2"; echo; }
coll() { post "/databases/$DB/collections" "{\"collectionId\":\"$1\",\"name\":\"$1\",\"documentSecurity\":true,\"permissions\":[\"create(\\\"users\\\")\"]}"; }
attr() { post "/databases/$DB/collections/$1/attributes/$2" "$3"; }   # coll type json
idx()  { post "/databases/$DB/collections/$1/indexes" "$2"; }

echo "== tasks (atributos nuevos) =="
attr tasks string   '{"key":"assignedToName","size":255,"required":false}'
attr tasks datetime '{"key":"dueAt","required":false}'
attr tasks string   '{"key":"repeat","size":20,"required":false,"default":"none"}'
attr tasks boolean  '{"key":"notify","required":false,"default":false}'

echo "== expenses (atributos nuevos) =="
attr expenses string   '{"key":"account","size":20,"required":false,"default":"individual"}'
attr expenses datetime '{"key":"spentAt","required":false}'

echo "== events =="
coll events
sleep 1
attr events string   '{"key":"title","size":255,"required":true}'
attr events datetime '{"key":"startAt","required":true}'
attr events string   '{"key":"place","size":255,"required":false}'
attr events string   '{"key":"ownerName","size":255,"required":true}'
attr events string   '{"key":"hogarId","size":50,"required":true}'

echo "== products =="
coll products
sleep 1
attr products string   '{"key":"name","size":255,"required":true}'
attr products string   '{"key":"hogarId","size":50,"required":true}'
attr products float    '{"key":"lastPrice","required":false}'
attr products string   '{"key":"lastStore","size":100,"required":false}'
attr products datetime '{"key":"lastAt","required":false}'

echo "== price_points =="
coll price_points
sleep 1
attr price_points string   '{"key":"productId","size":50,"required":true}'
attr price_points float    '{"key":"price","required":true}'
attr price_points string   '{"key":"store","size":100,"required":true}'
attr price_points datetime '{"key":"at","required":true}'
attr price_points string   '{"key":"hogarId","size":50,"required":true}'

echo "== settlements =="
coll settlements
sleep 1
attr settlements string   '{"key":"fromName","size":255,"required":true}'
attr settlements string   '{"key":"toName","size":255,"required":true}'
attr settlements float    '{"key":"amount","required":true}'
attr settlements string   '{"key":"hogarId","size":50,"required":true}'
attr settlements datetime '{"key":"at","required":true}'

echo "== índices (esperando a que los atributos estén listos) =="
sleep 5
for C in events products price_points settlements; do
  idx "$C" '{"key":"hogarId_idx","type":"key","attributes":["hogarId"],"orders":["ASC"]}'
done
idx price_points '{"key":"productId_idx","type":"key","attributes":["productId"],"orders":["ASC"]}'

echo ""
echo "Listo. Revisa arriba: los errores 'already exists' son normales."
echo "Comprueba en la consola que los atributos de 'tasks' (dueAt, repeat, notify,"
echo "assignedToName) y las colecciones events/products/price_points/settlements"
echo "aparecen como 'available'. Luego recarga la app."
