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

# Limpia espacios, saltos y retornos de carro. Al pegar desde Windows/PowerShell
# suele colarse un \r al final: la cabecera HTTP queda corrupta y Appwrite te
# trata como invitado ("role: guests"), que parece un problema de permisos y no lo es.
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
PID="$(printf '%s' "$PID" | tr -d '[:space:]')"

if [ ${#KEY} -lt 50 ]; then
  echo "✗ La API key parece incompleta (${#KEY} caracteres; las de Appwrite pasan de 100)."
  echo "  Seguramente se cortó al pegar. Mira más abajo cómo pegarla sin que se rompa."
  exit 1
fi

H=(-H "X-Appwrite-Project: $PID" -H "X-Appwrite-Key: $KEY" -H "Content-Type: application/json")

post() { curl -sS -X POST "$EP$1" "${H[@]}" -d "$2"; echo; }
put()  { curl -sS -X PUT  "$EP$1" "${H[@]}" -d "$2"; echo; }
attr() { post "/databases/$DB/collections/$1/attributes/$2" "$3"; }   # coll type json
idx()  { post "/databases/$DB/collections/$1/indexes" "$2"; }

# Crea la colección y, EXISTA O NO, fuerza su configuración con un PUT.
# Esto es lo importante: si la colección ya existía creada a mano (o con otros
# permisos), el POST solo da "already exists" y los permisos se quedaban mal,
# así que la app no podía insertar documentos. El PUT los deja siempre bien:
# documentSecurity ON + permiso "create" para el rol users.
CFG='"documentSecurity":true,"permissions":["create(\"users\")"]'
coll() {
  post "/databases/$DB/collections" "{\"collectionId\":\"$1\",\"name\":\"$1\",$CFG}" >/dev/null 2>&1
  echo -n "  [$1] permisos: "
  put "/databases/$DB/collections/$1" "{\"name\":\"$1\",$CFG}"
}

# --- Comprobación previa de credenciales ---
PING="$(curl -sS "$EP/databases/$DB" "${H[@]}" 2>/dev/null)"
if ! printf '%s' "$PING" | grep -q '"\$id"'; then
  echo "✗ No se pudo acceder a la base de datos '$DB'."
  echo "  Respuesta del servidor:"
  echo "  $(printf '%s' "$PING" | head -c 300)"
  echo ""
  echo "  Causas típicas:"
  echo "   · la API key es incorrecta, caducada o de otro proyecto"
  echo "   · le faltan scopes de Databases (databases.read/write, collections.*)"
  echo "   · el PID no es el de este proyecto"
  exit 1
fi
echo "✓ Credenciales correctas."
echo ""

echo "== permisos de TODAS las colecciones (documentSecurity + create users) =="
# Se aplica también a las que ya existían: si alguna se creó a mano sin el
# permiso "create" para users, la app no puede añadir nada en ella (tareas,
# eventos, productos...). Este PUT lo corrige.
for C in tasks shopping_items expenses events products price_points categories settlements invites; do
  coll "$C"
done

echo "== tasks (atributos nuevos) =="
attr tasks string   '{"key":"assignedToName","size":255,"required":false}'
attr tasks datetime '{"key":"dueAt","required":false}'
attr tasks string   '{"key":"repeat","size":20,"required":false,"default":"none"}'
attr tasks boolean  '{"key":"notify","required":false,"default":false}'

echo "== expenses (atributos nuevos) =="
attr expenses string   '{"key":"account","size":20,"required":false,"default":"individual"}'
attr expenses datetime '{"key":"spentAt","required":false}'
# Artículos del ticket escaneado (JSON), para ver el detalle del gasto.
# OJO con el tamaño: por debajo de ~16 KB Appwrite crea un VARCHAR, y en utf8mb4
# eso son 4 bytes por carácter (16000 -> 64 000 bytes). Sumado al resto de
# columnas se pasa del límite de 65 535 bytes por fila de MySQL y el atributo
# se queda en "processing" o falla. Pidiendo más, se crea como TEXT (fuera de
# la fila) y no hay problema.
attr expenses string   '{"key":"items","size":100000,"required":false}'
# reparto por porcentajes del gasto (JSON), p. ej. 20 % / 80 %
attr expenses string   '{"key":"splits","size":2000,"required":false}'

echo "== events =="
attr events string   '{"key":"title","size":255,"required":true}'
attr events datetime '{"key":"startAt","required":true}'
attr events string   '{"key":"place","size":255,"required":false}'
attr events string   '{"key":"ownerName","size":255,"required":true}'
attr events string   '{"key":"hogarId","size":50,"required":true}'

echo "== products =="
attr products string   '{"key":"name","size":255,"required":true}'
attr products string   '{"key":"hogarId","size":50,"required":true}'
attr products float    '{"key":"lastPrice","required":false}'
attr products string   '{"key":"lastStore","size":100,"required":false}'
attr products datetime '{"key":"lastAt","required":false}'

echo "== price_points =="
attr price_points string   '{"key":"productId","size":50,"required":true}'
attr price_points float    '{"key":"price","required":true}'
attr price_points string   '{"key":"store","size":100,"required":true}'
attr price_points datetime '{"key":"at","required":true}'
attr price_points string   '{"key":"hogarId","size":50,"required":true}'

echo "== settlements =="
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
echo "======================= COMPROBACIÓN ======================="
echo "(los 'already exists' de arriba son normales; mira solo esto)"
echo ""

# Appwrite construye los atributos en segundo plano: recién creados están en
# "processing" unos segundos. Esperamos a que terminen en vez de dar un falso
# error por haber mirado demasiado pronto.
echo -n "Esperando a que los atributos estén listos"
for _ in $(seq 1 20); do
  PENDING=0
  for C in tasks expenses events products price_points settlements; do
    A="$(curl -sS "$EP/databases/$DB/collections/$C/attributes" "${H[@]}" 2>/dev/null)"
    N="$(printf '%s' "$A" | tr ',' '\n' | grep '"status"' | grep -c 'processing')"
    PENDING=$((PENDING + N))
  done
  [ "$PENDING" -eq 0 ] && break
  echo -n "."
  sleep 3
done
echo " listo."
echo ""
ALL_OK=1
for C in tasks shopping_items expenses events products price_points categories settlements invites; do
  BODY="$(curl -sS "$EP/databases/$DB/collections/$C" "${H[@]}" 2>/dev/null)"
  if ! printf '%s' "$BODY" | grep -q '"\$id"'; then
    # Ojo: un 401/403 tampoco trae "$id". Hay que distinguirlo de "no existe",
    # si no el diagnóstico engaña.
    if printf '%s' "$BODY" | grep -qi 'not_found\|could not be found'; then
      echo "  ✗ $C  → NO EXISTE la colección"
    else
      echo "  ✗ $C  → no se pudo consultar: $(printf '%s' "$BODY" | head -c 120)"
    fi
    ALL_OK=0; continue
  fi
  # OJO: Appwrite devuelve las comillas escapadas -> create(\"users\").
  # Hay que quitar las barras antes de comparar, si no da un falso negativo.
  PLAIN="$(printf '%s' "$BODY" | tr -d '\\')"
  PERM_OK=0; printf '%s' "$PLAIN" | grep -q 'create("users")' && PERM_OK=1
  # atributos que no estén 'available'
  AT="$(curl -sS "$EP/databases/$DB/collections/$C/attributes" "${H[@]}" 2>/dev/null)"
  BAD="$(printf '%s' "$AT" | tr ',' '\n' | grep '"status"' | grep -cv 'available')"
  if [ "$PERM_OK" = 1 ] && [ "${BAD:-0}" = 0 ]; then
    echo "  ✓ $C"
  else
    ALL_OK=0
    if [ "$PERM_OK" != 1 ]; then
      echo "  ✗ $C  → le falta el permiso create(\"users\")"
      echo "      permisos actuales: $(printf '%s' "$PLAIN" | sed -n 's/.*"$permissions":\[\([^]]*\)\].*/\1/p')"
    fi
    [ "${BAD:-0}" = 0 ] || echo "  ✗ $C  → $BAD atributo(s) NO están 'available'"
  fi
done
echo ""
if [ "$ALL_OK" = 1 ]; then
  echo "TODO CORRECTO. Recarga la app: tareas, eventos, precios y Liquidar deben ir."
else
  echo "Hay algo mal (líneas con ✗). Pega esta comprobación en el chat."
fi
