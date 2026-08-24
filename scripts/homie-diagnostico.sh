#!/usr/bin/env bash
# Mira qué hay REALMENTE en la base de datos detrás de "Miembro sin nombre".
#
#   cd ~/homie && bash scripts/homie-diagnostico.sh
#
# No cambia nada: solo lee y cuenta lo que ve. La API key salta los permisos, así
# que enseña las fichas aunque la app no pueda leerlas — que es justo lo que hay
# que distinguir: si el problema es que no están o que no se pueden leer.

set -u
EP="${EP:-https://appwrite.lademanu.es/v1}"
PID="${PID:-6a552b8f0019ea6d2787}"
DB="${DB:-homie}"

if [ -z "${KEY:-}" ]; then
  read -rsp "Pega tu API key de Appwrite y pulsa Enter: " KEY
  echo ""
fi
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"
H=(-H "X-Appwrite-Project: $PID" -H "X-Appwrite-Key: $KEY")

echo ""
echo "═══ 1. La colección 'profiles' ═══"
COL="$(curl -sS "$EP/databases/$DB/collections/profiles" "${H[@]}")"
printf '%s' "$COL" | python3 -c "
import json,sys
d=json.load(sys.stdin)
if not d.get('\$id'):
    print('  ✗ NO EXISTE. Falta pasar scripts/appwrite-setup.sh.')
    print('    ', str(d)[:200]); sys.exit()
print('  ✓ existe')
print('  documentSecurity:', d.get('documentSecurity'))
print('  permisos de la colección:', d.get('\$permissions'))
if not d.get('documentSecurity'):
    print('  ⚠ Con documentSecurity APAGADO mandan solo los permisos de arriba.')
    print('    Si ahí no hay un read, NADIE puede leer las fichas.')
"

echo ""
echo "═══ 2. Las fichas guardadas ═══"
# Sin parámetros de consulta a propósito: la sintaxis de `queries[]` ha
# cambiado entre versiones de Appwrite, y si aquí falla parecería que no hay
# fichas cuando el problema sería la propia consulta del diagnóstico. Por
# defecto devuelve 25, de sobra para un hogar.
DOCS="$(curl -sS "$EP/databases/$DB/collections/profiles/documents" "${H[@]}")"
printf '%s' "$DOCS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
docs=d.get('documents')
if docs is None:
    print('  ✗ no se pudieron listar:', str(d)[:200]); sys.exit()
print(f'  {len(docs)} ficha(s)')
for x in docs:
    print(f\"   · name={x.get('name')!r}  userId={x.get('userId')}  hogarId={x.get('hogarId')}\")
    print(f\"     permisos: {x.get('\$permissions')}\")
    if not any('read' in p for p in x.get('\$permissions') or []):
        print('     ⚠ SIN permiso de lectura: existe pero la app no la ve.')
# Duplicados = la app no consigue leer y crea una nueva en cada arranque.
from collections import Counter
c=Counter((x.get('hogarId'),x.get('userId')) for x in docs)
rep=[k for k,n in c.items() if n>1]
if rep:
    print(f'  ⚠ {len(rep)} persona(s) con ficha DUPLICADA.')
    print('    Eso significa que la app escribe bien pero NO puede leer:')
    print('    al no encontrar la suya, crea otra en cada arranque.')
"

echo ""
echo "═══ 3. Los hogares y sus miembros ═══"
curl -sS "$EP/teams" "${H[@]}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for t in d.get('teams',[]):
    print(f\"  hogar {t['\$id']}  ·  {t['name']}  ·  {t['total']} miembro(s)\")
" 2>/dev/null

for T in $(curl -sS "$EP/teams" "${H[@]}" | python3 -c "
import json,sys
print(' '.join(t['\$id'] for t in json.load(sys.stdin).get('teams',[])))
" 2>/dev/null); do
  echo "  ── membresías de $T:"
  curl -sS "$EP/teams/$T/memberships" "${H[@]}" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for m in d.get('memberships',[]):
    conf='confirmada' if m.get('confirm') else 'SIN CONFIRMAR'
    print(f\"     userId={m.get('userId')}  nombre={m.get('userName')!r}  {conf}\")
    if not m.get('confirm'):
        print('     ⚠ Sin confirmar NO se tiene el rol del equipo en Appwrite,')
        print('       así que esa persona no puede leer NINGUNA ficha del hogar.')
" 2>/dev/null
done

echo ""
echo "═══ 4. Hogares repetidos ═══"
# La app usa SIEMPRE el primero que le devuelve Appwrite (`hogares[0]`). Con dos
# hogares del mismo nombre, cada cuenta puede acabar mirando uno distinto sin que
# nada lo indique: las fichas están en uno y la app las busca en el otro.
TEAMS="$(curl -sS "$EP/teams" "${H[@]}" 2>/dev/null)"
python3 - "$TEAMS" <<'PY_TEAMS'
import json, sys
from collections import Counter
try:
    ts = json.loads(sys.argv[1]).get("teams", [])
except Exception:
    ts = []
c = Counter(t["name"] for t in ts)
rep = [n for n, k in c.items() if k > 1]
if not rep:
    print("  ok  ningun nombre de hogar repetido")
else:
    for n in rep:
        print("  AVISO  hay %d hogares llamados %r:" % (c[n], n))
        for t in ts:
            if t["name"] == n:
                print("      %s  ·  %s miembro(s)" % (t["$id"], t["total"]))
    print("    La app usa el PRIMERO que le da Appwrite. Si cada movil entra con")
    print("    una cuenta distinta, pueden estar mirando hogares distintos, y las")
    print("    fichas estaran en uno solo. Sobra el que tenga 1 miembro.")
PY_TEAMS

echo ""
echo "═══ 5. Veredicto ═══"
python3 - "$DOCS" <<'PY'
import json,sys
try: docs=json.loads(sys.argv[1]).get('documents') or []
except Exception: docs=[]
if not docs:
    print("  Las fichas NO están guardadas. El fallo es al ESCRIBIR.")
elif len({(d.get('hogarId'),d.get('userId')) for d in docs}) < len(docs):
    print("  Las fichas están, y duplicadas. El fallo es al LEER: la app escribe")
    print("  pero no consigue leerlas de vuelta, y por eso nadie tiene nombre.")
else:
    print("  Las fichas están y son únicas. Si la app sigue sin enseñar nombres,")
    print("  el fallo es de permisos de lectura (mira los ⚠ de arriba).")
PY
unset KEY
echo ""
echo "Pega TODA esta salida en el chat."
