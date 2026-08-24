#!/usr/bin/env bash
# Deja Homie listo de una vez: base de datos, funciones y comprobación final.
#
#   cd ~/homie && git pull origin main && bash scripts/homie-setup.sh
#
# Pide la API key una sola vez y no la deja en el historial ni en el entorno de
# otros procesos. La clave necesita scopes de Databases, Collections, Documents,
# Functions y Teams.

set -u
EP="${EP:-https://appwrite.lademanu.es/v1}"
PID="${PID:-6a552b8f0019ea6d2787}"
DB="${DB:-homie}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "╭──────────────────────────────────────────────╮"
echo "│  Homie · puesta a punto                      │"
echo "╰──────────────────────────────────────────────╯"
echo "Proyecto: $PID"
echo "Servidor: $EP"
echo ""

# --- La clave, sin que se quede escrita en ningún sitio ---
if [ -z "${KEY:-}" ]; then
  # -s para que no se vea, -r para que las barras no se coman nada. Pegar aquí
  # es seguro: no pasa por el historial del shell.
  read -rsp "Pega tu API key de Appwrite y pulsa Enter: " KEY
  echo ""
  echo ""
fi
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
export KEY PID EP DB

if [ ${#KEY} -lt 50 ]; then
  echo "✗ La clave parece cortada (${#KEY} caracteres; las de Appwrite pasan de 100)."
  echo "  Si pegas desde Windows a veces se trunca: prueba con clic derecho o Ctrl+Shift+V."
  exit 1
fi

# --- Aviso si el repo no está al día: desplegaríamos código viejo ---
if command -v git >/dev/null 2>&1 && [ -d "$RAIZ/.git" ]; then
  git -C "$RAIZ" fetch -q origin main 2>/dev/null || true
  DETRAS="$(git -C "$RAIZ" rev-list --count HEAD..origin/main 2>/dev/null || echo 0)"
  if [ "${DETRAS:-0}" -gt 0 ]; then
    echo "⚠ Tu copia va $DETRAS commits por detrás de origin/main."
    echo "  Se desplegaría código viejo. Sal con Ctrl+C y haz:  git pull origin main"
    echo ""
    read -rp "  ¿Seguir de todas formas? [s/N] " SEGUIR
    [ "${SEGUIR:-n}" = "s" ] || exit 1
    echo ""
  fi
fi

FALLOS=0

# Corre un paso con la salida sangrada, quedándose con el código de salida DEL
# PASO y no con el del `sed` de la tubería (que siempre vale 0: así un script que
# falla se daría por bueno y el resumen final mentiría).
paso() {
  local titulo="$1" script="$2" estado
  echo "▸ $titulo"
  echo "─────────────────────────────────────────────────────"
  set -o pipefail
  bash "$RAIZ/scripts/$script" 2>&1 | sed 's/^/   /'
  estado=${PIPESTATUS[0]}
  set +o pipefail
  [ "$estado" -ne 0 ] && FALLOS=$((FALLOS + 1))
  echo ""
}

paso "1/3  Base de datos (colecciones, columnas y permisos)" appwrite-setup.sh
paso "2/3  Funciones (código nuevo y ajustes)" deploy-functions.sh

echo "▸ 3/3  Comprobación"
echo "─────────────────────────────────────────────────────"
H=(-H "X-Appwrite-Project: $PID" -H "X-Appwrite-Key: $KEY")
campo() { python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print(''); sys.exit()
for k in sys.argv[1].split('.'):
    d = d.get(k) if isinstance(d,dict) else None
print('' if d is None else d)
" "$1"; }

# Las colecciones que hacen falta para que los nombres del hogar funcionen: son
# las que han estado faltando y las que rompen tareas, gastos e ingresos.
for C in profiles incomes; do
  BODY="$(curl -sS "$EP/databases/$DB/collections/$C" "${H[@]}" 2>/dev/null)"
  if [ -n "$(printf '%s' "$BODY" | campo '$id')" ]; then
    echo "   ✓ colección '$C'"
  else
    echo "   ✗ colección '$C' NO está: $(printf '%s' "$BODY" | head -c 120)"
    FALLOS=$((FALLOS + 1))
  fi
done

for F in scanReceipt joinHogar; do
  INFO="$(curl -sS "$EP/functions/$F" "${H[@]}" 2>/dev/null)"
  DEP="$(printf '%s' "$INFO" | campo 'deploymentId')"
  [ -z "$DEP" ] && DEP="$(printf '%s' "$INFO" | campo 'deployment')"
  TO="$(printf '%s' "$INFO" | campo 'timeout')"
  if [ -n "$DEP" ]; then
    echo "   ✓ función '$F' activa (timeout ${TO}s)"
  else
    echo "   ✗ función '$F' sin despliegue activo"
    FALLOS=$((FALLOS + 1))
  fi
done

# El modelo de Gemini: sin él puesto, el escáner depende de que la lista escrita
# a mano siga viva, y Google retira modelos cada pocos meses.
VARS="$(curl -sS "$EP/functions/scanReceipt/variables" "${H[@]}" 2>/dev/null)"
for V in GEMINI_API_KEY GEMINI_MODEL; do
  if printf '%s' "$VARS" | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: d={}
sys.exit(0 if any(v.get('key')==sys.argv[1] for v in d.get('variables',[])) else 1)
" "$V"; then
    echo "   ✓ variable '$V' puesta"
  else
    echo "   ⚠ falta la variable '$V' en scanReceipt"
    [ "$V" = "GEMINI_API_KEY" ] && FALLOS=$((FALLOS + 1))
  fi
done

unset KEY
echo ""
if [ "$FALLOS" -eq 0 ]; then
  echo "✅ Todo en orden."
  echo ""
  echo "   Abrid la app los dos (cada móvil publica su propio nombre al entrar)"
  echo "   y en Perfil deberíais veros por vuestro nombre. Con eso funcionan"
  echo "   también asignar tareas y repartir gastos."
else
  echo "⚠ Quedan $FALLOS cosas por revisar (líneas con ✗ arriba). Pega esta salida en el chat."
fi
