# BeachOps

Cuadro diario de reservas para empresas de kayak / paddle surf, **actualizado
automáticamente desde el correo**. El usuario conecta su Gmail, la app lee los
emails de reserva de **GetYourGuide** y **Bókun/Viator**, y el cuadro del día
(franjas, cupos, sobre-reservas, caja en efectivo) se mantiene al día solo.
Las reservas de hotel y privadas se añaden a mano en un formulario.

Primer despliegue: Secret Point Mallorca. El esquema es multi-empresa
(`org_id` en todas las tablas) para comercializarlo a más operadores sin
migraciones.

## Qué hace

- **Conexión Gmail (OAuth, solo lectura)**: backfill del último mes al conectar
  y sincronización incremental cada 60 s (`history.list`).
- **Parsers por plataforma** (`src/server/parsers/`): GetYourGuide y
  Bókun/Viator. Detectan altas, cancelaciones y modificaciones; extraen
  referencia, fecha/hora local, pax adultos/niños, cliente, teléfono (y país
  por el prefijo), idioma e importe. Idempotencia doble: por id de mensaje de
  Gmail y por referencia externa (los duplicados actualizan, nunca duplican).
- **Motor de mapeo** (`src/server/mapping/`): reglas configurables que traducen
  el nombre del producto del email a producto/playa internos; la franja se
  resuelve por la hora del email (±30 min). Sin regla → la reserva queda
  "sin asignar" y se resuelve con un clic desde el cuadro.
- **El cuadro** (`/cuadro/[fecha]`): franjas por playa y producto con
  `ocupado/cupo` (sobre-reserva en rojo, botón "doble salida" que duplica el
  cupo), lista de clientes con teléfono y referencia, caja del día con importes
  por confirmar, resumen y vista de impresión. Se refresca solo cada 30 s.
- **Cola de revisión** (`/emails`): los emails que no se pudieron interpretar
  nunca se pierden; se pueden reintentar o ignorar.

## Puesta en marcha (desarrollo)

```bash
npm install
cp .env.example .env    # rellena AUTH_SECRET y TOKEN_ENCRYPTION_KEY (openssl rand -hex 32)
npm run db:seed         # crea la org, playas, franjas y el usuario (SEED_OWNER_*)
npm run dev             # http://localhost:3000
npm run db:seed:demo    # opcional: día de demo 10-jul-2026 (el del PDF real)
npm test                # tests de parsers e ingesta
```

Sin `DATABASE_URL` la app usa **PGlite** (Postgres embebido, carpeta
`.data/`): no hace falta instalar nada. En producción, define
`DATABASE_URL=postgres://…`.

## Conectar Gmail (Google Cloud)

1. En [console.cloud.google.com](https://console.cloud.google.com) crea un
   proyecto → "APIs y servicios" → habilita **Gmail API**.
2. "Pantalla de consentimiento OAuth": tipo *Externo*, añade el scope
   `gmail.readonly` y publica la app ("En producción"). Para uso propio
   (<100 usuarios) no hace falta pasar la verificación de Google; los usuarios
   verán un aviso de "app no verificada" al conectar. Inicia la verificación
   (scope restringido) antes de venderla a terceros.
3. "Credenciales" → "ID de cliente OAuth" (aplicación web) con URI de
   redirección `https://TU-DOMINIO/api/gmail/callback` (y
   `http://localhost:3000/api/gmail/callback` para desarrollo).
4. Copia `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` al `.env`.
5. En la app: **Configuración → Conectar Gmail**.

## Despliegue (Railway u otro PaaS)

Tres procesos sobre el mismo repo:

| Servicio | Comando | Notas |
|---|---|---|
| Web | `npm run build && npm start` | `PORT` lo inyecta Railway |
| Worker | `npm run worker` | sincroniza Gmail cada 60 s (`SYNC_INTERVAL_MS`) |
| Postgres | plugin de Railway | copia la URL a `DATABASE_URL` |

Variables: `DATABASE_URL`, `AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`,
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL` (https del dominio).
Las migraciones se aplican solas al arrancar el worker, o con
`npx tsx -e "import('./src/server/db/migrate').then(m=>m.runMigrations())"`.

## Estructura

```
src/server/db/         esquema Drizzle (multi-tenant) y migraciones
src/server/gmail/      OAuth + sincronización incremental
src/server/parsers/    GetYourGuide, Bókun/Viator (+ fixtures en /fixtures)
src/server/mapping/    reglas producto→playa/franja
src/server/ingest/     pipeline email → reserva (idempotente)
src/server/board/      agregación del cuadro
src/app/               UI (cuadro, reservas, emails, configuración)
worker/sync.ts         proceso de polling
scripts/               seed inicial y día de demostración
```

## Notas de diseño

- Fecha/hora de actividad guardadas en **hora local** de la org (no UTC): son
  horas de operación en playa.
- El HTML crudo de cada email se conserva: si una plataforma cambia su
  plantilla, se ajusta el parser y se reprocesa sin pérdida.
- Tokens OAuth cifrados con AES-256-GCM; el scope de Gmail es solo lectura.
- La sobre-reserva no se bloquea (a veces se acepta y se resuelve con "doble
  salida"): se marca en rojo y la decisión es humana.
