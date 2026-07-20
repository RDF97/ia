# Despliegue de BeachOps — Secret Point Mallorca

Estado actual de producción y cómo publicar cambios. **Este documento no contiene
secretos**: solo nombres de variables, rutas y comandos. Los valores reales viven
únicamente en el `.env` del servidor.

## Dónde está desplegado

- **Proveedor**: VPS de **Piensa Solutions** (Ubuntu).
- **Dominio**: <https://booking.lademanu.es> (HTTPS gestionado por Caddy).
- **Usuario del servidor**: `manu` (te conectas por SSH con tus credenciales de
  Piensa; la IP está en el panel de Piensa Solutions).
- **Código en el servidor**: clon de `https://github.com/RDF97/ia.git` en
  **`/opt/beachops`**. La app Next.js es el subdirectorio **`/opt/beachops/beachops`**
  (ahí está el `.env` real y el `docker-compose.yml`).

## Arquitectura en el servidor

`docker compose` levanta tres contenedores (definidos en `beachops/docker-compose.yml`):

| Servicio | Qué hace | Puerto |
|----------|----------|--------|
| `web`    | La app Next.js (cuadro, PDF, config, OAuth) | `127.0.0.1:3000` (solo loopback) |
| `worker` | Sincroniza Gmail cada 60 s (`npm run worker`) | — |
| `db`     | PostgreSQL 16 (volumen persistente `pgdata`) | interno |

Delante, **Caddy** (`/etc/caddy/Caddyfile`) hace de proxy inverso con certificado
HTTPS automático:

```
booking.lademanu.es {
    reverse_proxy 127.0.0.1:3000
}
```

Tras tocar el Caddyfile: `sudo caddy validate --config /etc/caddy/Caddyfile` y
`systemctl reload caddy`.

## Variables de entorno (en `/opt/beachops/beachops/.env`)

Solo los **nombres** (los valores están en el servidor):

- `DATABASE_URL` = `postgres://beachops:${POSTGRES_PASSWORD}@db:5432/beachops`
- `POSTGRES_PASSWORD` — contraseña del Postgres del compose
- `AUTH_SECRET` — secreto de sesión (`openssl rand -hex 32`)
- `TOKEN_ENCRYPTION_KEY` — cifra los tokens OAuth, 64 hex (`openssl rand -hex 32`)
- `APP_URL` = `https://booking.lademanu.es`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — OAuth de Gmail
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — notificaciones push
- `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` — primer usuario (solo `db:seed`)

### Gmail / Google Cloud OAuth

- Consola: <https://console.cloud.google.com> → Credenciales → ID de cliente OAuth
  (aplicación web), scope `gmail.readonly`.
- **URI de redirección autorizada** (debe coincidir exactamente):
  `https://booking.lademanu.es/api/gmail/callback`

## Publicar cambios (redeploy)

Los cambios se hacen en GitHub (rama + PR) y se publican reconstruyendo el
contenedor en el servidor. Desde `manu@` en el VPS:

```bash
cd /opt/beachops
git pull                       # trae la rama desplegada (o main si ya está mergeado el PR)
cd beachops
docker compose up -d --build   # reconstruye web + worker y reinicia
docker compose logs -f web     # comprobar que arranca sin errores
```

- Las **migraciones** de base de datos se aplican solas al arrancar el `worker`.
- El **volumen `pgdata` persiste**: los datos y reservas no se pierden al reconstruir.

### Parche de datos tras un cambio de configuración

`scripts/seed.ts` es idempotente y **se salta las orgs que ya existen**. Por eso,
cuando una versión añade nuevas playas/productos de fábrica (p. ej. **Cala Santanyí /
Es Pontàs**), hay que aplicarlos a la base ya sembrada con un parche idempotente:

```bash
docker compose exec web npx tsx scripts/upgrade-santanyi.ts
```

(Alternativa: crearlos a mano desde `/config`, que es editable.)

## Si el build se queda sin memoria

El VPS tiene ~1 GB de RAM. Para que `docker compose up -d --build` quepa:

- El build del contenedor **no** repite el chequeo de tipos ni el lint (se hacen en
  el repo/CI antes de cada push), configurado en `next.config.ts`. Esa fase era la
  que agotaba la memoria.
- La imagen se construye **una sola vez** (la comparten `web` y `worker`), no dos en
  paralelo.

Si aun así fallara por memoria, añade 2 GB de swap en el VPS (una sola vez):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Copia de seguridad

```bash
docker compose exec db pg_dump -U beachops beachops > backup_$(date +%F).sql
```

## Comandos útiles

```bash
docker compose ps                 # estado de los contenedores
docker compose logs -f worker     # ver la sincronización de Gmail
docker compose down -v && docker compose up -d --build   # reset TOTAL (borra la BBDD)
```

> ⚠️ `down -v` borra el volumen `pgdata` (todos los datos). Úsalo solo para empezar
> de cero; después vuelve a sembrar con `docker compose exec web npx tsx scripts/seed.ts`.
