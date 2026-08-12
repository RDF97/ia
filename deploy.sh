#!/usr/bin/env bash
#
# Actualiza BeachOps en el VPS con una sola orden. Pensado para lanzarlo desde
# el móvil por SSH:
#
#   /opt/beachops/deploy.sh            # despliega main
#   /opt/beachops/deploy.sh una-rama   # despliega otra rama
#
# El trabajo pesado (build de Next en un VPS de 1 GB) corre desprendido de la
# terminal: si el móvil pierde cobertura o se bloquea la pantalla, el despliegue
# sigue solo. Lo que ves aquí es el log en vivo; salir NO lo cancela.
#
set -euo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$REPO_DIR/beachops"
LOG="$REPO_DIR/.deploy.log"
ESTADO="$REPO_DIR/.deploy.status"
RAMA="${1:-main}"

# ── Parte visible: lanza el despliegue y enseña el log ──────────────────
if [ "${BEACHOPS_DEPLOY_WORKER:-}" != "1" ]; then
  : >"$LOG"
  rm -f "$ESTADO"
  lanzar=(env BEACHOPS_DEPLOY_WORKER=1 "${BASH_SOURCE[0]}" "$RAMA")
  # setsid lo saca de la sesión SSH; si no está, nohup basta.
  command -v setsid >/dev/null && lanzar=(setsid "${lanzar[@]}")
  nohup "${lanzar[@]}" >>"$LOG" 2>&1 </dev/null &
  trabajador=$!
  echo "▸ Desplegando '$RAMA' (PID $trabajador). Puedes cerrar la app: no se cancela."
  echo "  Log completo: $LOG"
  echo
  tail -n +1 -f "$LOG" &
  mirilla=$!
  trap 'kill "$mirilla" 2>/dev/null || true' EXIT
  while kill -0 "$trabajador" 2>/dev/null; do sleep 2; done
  sleep 1
  exit "$(cat "$ESTADO" 2>/dev/null || echo 1)"
fi

# ── Parte que hace el trabajo ───────────────────────────────────────────
terminar() {
  local codigo=$?
  echo "$codigo" >"$ESTADO"
  if [ "$codigo" -eq 0 ]; then
    echo "✅ Despliegue terminado. La web ya sirve la versión nueva."
  else
    echo "❌ Falló (código $codigo). El contenedor anterior sigue en pie."
  fi
}
trap terminar EXIT

echo "== $(date '+%F %T') · desplegando $RAMA =="

cd "$REPO_DIR"
git fetch --prune origin "$RAMA"
git checkout "$RAMA"
# --ff-only a propósito: si alguien tocó ficheros en el servidor, preferimos
# fallar y que se vea, antes que borrar ese cambio sin avisar.
git merge --ff-only "origin/$RAMA"
echo "→ commit desplegado: $(git log --oneline -1)"

cd "$APP_DIR"
docker compose up -d --build
docker compose ps

# El arranque real: hasta que la web no responde, el despliegue no está hecho.
# Sin tuberías a propósito: con `pipefail`, un grep sin coincidencias abortaría
# el script justo antes de comprobar que la web levanta.
puerto=3000
if [ -f .env ]; then
  linea="$(grep -E '^WEB_PORT=' .env || true)"
  if [ -n "$linea" ]; then
    solo_digitos="${linea#WEB_PORT=}"
    solo_digitos="${solo_digitos//[^0-9]/}"
    puerto="${solo_digitos:-3000}"
  fi
fi
echo "→ esperando a que responda en 127.0.0.1:$puerto …"
for intento in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$puerto/login"; then
    echo "→ responde (intento $intento)"
    break
  fi
  if [ "$intento" -eq 30 ]; then
    echo "→ NO responde tras 30 intentos. Últimas líneas del contenedor:"
    docker compose logs --tail 40 web
    exit 1
  fi
  sleep 3
done

docker compose logs --tail 15 web
# Las imágenes viejas se acumulan y el disco del VPS es pequeño.
docker image prune -f >/dev/null
