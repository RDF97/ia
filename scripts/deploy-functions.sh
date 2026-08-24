#!/usr/bin/env bash
# Despliega las funciones de Appwrite desde este repo, sin pasar por el navegador.
#
# Hasta ahora había que empaquetar a mano, bajarse el .tar.gz por scp y subirlo
# por la consola web. Ese camino ya nos ha costado dos incidentes: un tar que
# empaquetó medio Windows, y una función que se quedó semanas con código viejo
# sin que nadie lo notara. Todo eso lo hace la API igual de bien y sin manos.
#
# Uso:  PID=... KEY=... bash scripts/deploy-functions.sh [nombre_funcion]
#
# La API key necesita scopes de Functions (functions.read, functions.write,
# execution.read) para poder desplegar y leer el estado.

set -u
EP="${EP:-https://appwrite.lademanu.es/v1}"
: "${PID:?Falta PID (Project ID).}"
: "${KEY:?Falta KEY (API key con permisos de Functions).}"

KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
PID="$(printf '%s' "$PID" | tr -d '[:space:]')"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H=(-H "X-Appwrite-Project: $PID" -H "X-Appwrite-Key: $KEY")

# Lector de JSON. Se usa python3 porque en Ubuntu viene de serie; con sed y grep
# esto acaba en falsos negativos como los que ya nos han despistado antes.
if ! command -v python3 >/dev/null 2>&1; then
  echo "✗ Hace falta python3 para leer las respuestas de Appwrite (viene en Ubuntu)."
  exit 1
fi
campo() { python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print(''); sys.exit()
for k in sys.argv[1].split('.'):
    if isinstance(d,dict): d=d.get(k)
    else: d=None
print('' if d is None else d)
" "$1"; }

# --- Qué se despliega y con qué punto de entrada ---
FUNCIONES=("scanReceipt:src/main.js" "joinHogar:src/main.js")

desplegar() {
  local fn="$1" entry="$2"
  local dir="$RAIZ/appwrite/functions/$fn"

  if [ ! -f "$dir/$entry" ]; then
    echo "  ✗ no encuentro $dir/$entry"
    return 1
  fi

  # Comprobamos que la función existe antes de empaquetar nada.
  local info status
  info="$(curl -sS "$EP/functions/$fn" "${H[@]}" 2>/dev/null)"
  if [ -z "$(printf '%s' "$info" | campo '$id')" ]; then
    echo "  ✗ la función '$fn' no existe en el proyecto, o la API key no tiene"
    echo "    permisos de Functions. Respuesta: $(printf '%s' "$info" | head -c 160)"
    return 1
  fi

  local tmp tar
  tmp="$(mktemp -d)"
  tar="$tmp/$fn.tar.gz"
  # Desde DENTRO del directorio, para que package.json y src/ queden en la raíz
  # del paquete: es donde Appwrite busca el punto de entrada.
  ( cd "$dir" && tar -czf "$tar" . ) || { rm -rf "$tmp"; return 1; }
  echo "  · paquete: $(du -h "$tar" | cut -f1)"

  local resp dep
  resp="$(curl -sS -X POST "$EP/functions/$fn/deployments" "${H[@]}" \
    -F "entrypoint=$entry" -F "activate=true" -F "code=@$tar" 2>/dev/null)"
  rm -rf "$tmp"

  dep="$(printf '%s' "$resp" | campo '$id')"
  if [ -z "$dep" ]; then
    echo "  ✗ no se pudo crear el despliegue: $(printf '%s' "$resp" | head -c 200)"
    return 1
  fi

  # Esperamos a que compile: si no, se da por bueno un despliegue que va a fallar.
  echo -n "  · construyendo"
  local i
  for i in $(seq 1 60); do
    sleep 3
    status="$(curl -sS "$EP/functions/$fn/deployments/$dep" "${H[@]}" 2>/dev/null | campo 'status')"
    case "$status" in
      ready) echo " listo."; return 0 ;;
      failed)
        echo " FALLÓ."
        echo "  ── registro de construcción ──"
        curl -sS "$EP/functions/$fn/deployments/$dep" "${H[@]}" 2>/dev/null \
          | campo 'buildLogs' | tail -20 | sed 's/^/    /'
        return 1 ;;
      *) echo -n "." ;;
    esac
  done
  echo " sigue construyendo; míralo en la consola."
  return 1
}

ajustar() {
  local fn="$1" timeout="$2"
  local info cuerpo ahora
  info="$(curl -sS "$EP/functions/$fn" "${H[@]}" 2>/dev/null)"

  # PUT reemplaza la configuración ENTERA: lo que no se manda vuelve a su valor
  # por defecto. Mandar solo el timeout dejaría `execute` vacío y entonces la app
  # ya no podría llamar a la función: el escáner se quedaría muerto justo después
  # de haberlo "arreglado". Por eso se reenvía lo que ya había, cambiando solo el
  # timeout.
  cuerpo="$(printf '%s' "$info" | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: sys.exit(1)
if not d.get('\$id'): sys.exit(1)
body={'name': d.get('name') or sys.argv[1], 'timeout': int(sys.argv[2])}
# Se copia tal cual todo lo que Appwrite acepta en el PUT y que, de omitirse,
# se perdería.
for k in ('execute','events','schedule','enabled','logging','entrypoint',
          'commands','scopes','specification'):
    v=d.get(k)
    if v is not None: body[k]=v
json.dump(body,sys.stdout)
" "$fn" "$timeout")" || {
    echo "  ⚠ no pude leer la configuración de '$fn'; dejo el timeout como estaba."
    return 0
  }

  curl -sS -X PUT "$EP/functions/$fn" "${H[@]}" -H "Content-Type: application/json" \
    -d "$cuerpo" >/dev/null 2>&1
  ahora="$(curl -sS "$EP/functions/$fn" "${H[@]}" 2>/dev/null | campo 'timeout')"
  if [ "$ahora" = "$timeout" ]; then
    echo "  · timeout: ${ahora}s"
  else
    echo "  ⚠ el timeout se quedó en ${ahora}s (quería ${timeout}s)"
  fi
}

SOLO="${1:-}"
FALLOS=0
for par in "${FUNCIONES[@]}"; do
  fn="${par%%:*}"; entry="${par##*:}"
  [ -n "$SOLO" ] && [ "$SOLO" != "$fn" ] && continue
  echo "== $fn =="
  if desplegar "$fn" "$entry"; then
    case "$fn" in
      # Leer un ticket con visión no cabe en los 15 s por defecto, y cuando
      # Appwrite corta la función no queda ni respuesta que explicar.
      scanReceipt) ajustar "$fn" 120 ;;
      *) ajustar "$fn" 30 ;;
    esac
  else
    FALLOS=$((FALLOS + 1))
  fi
  echo ""
done

exit $FALLOS
