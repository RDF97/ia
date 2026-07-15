# Configuración de Appwrite (Homie)

Pasos en la consola de Appwrite (`https://appwrite.lademanu.es`) para activar el
backend. Los **IDs** deben coincidir con los de `mobile/app.json → extra`.

## 1. Proyecto y plataformas
1. **Create Project** → nombre "Homie". Copia el **Project ID**.
2. En `mobile/app.json → extra.appwriteProjectId` pon ese Project ID (y confirma el endpoint).
3. **Add Platform** → Android (`com.homie.app`) e iOS (`com.homie.app`).

## 2. Base de datos
1. **Databases → Create database** con **Database ID = `homie`**.
2. Dentro, **Create collection** con **Collection ID = `tasks`**.
3. En la colección `tasks` → **Settings → Document Security: ON**
   (así cada tarea define quién la ve: los miembros del hogar).
4. **Permissions** de la colección: añade **Create** para el rol **Users**
   (cualquiera con sesión puede crear; lectura/edición/borrado las controla cada documento).

### Atributos de `tasks`
| Atributo | Tipo | Tamaño | Requerido | Defecto |
|---|---|---|---|---|
| `title` | String | 255 | sí | — |
| `done` | Boolean | — | sí | `false` |
| `hogarId` | String | 50 | sí | — |
| `createdByName` | String | 255 | sí | — |
| `assignedToName` | String | 255 | no | — |

### Índice
- **Create index** → key `hogarId_idx`, tipo **key**, atributo `hogarId` (ASC).
  (Necesario para filtrar tareas por hogar.)

### Colección `shopping_items` (lista de la compra)
Crea otra colección con **Collection ID = `shopping_items`**, **Document Security: ON**
y permiso **Create** para el rol **Users**.

| Atributo | Tipo | Tamaño | Requerido | Defecto |
|---|---|---|---|---|
| `name` | String | 255 | sí | — |
| `qty` | String | 32 | no | — |
| `store` | String | 100 | no | — |
| `done` | Boolean | — | sí | `false` |
| `hogarId` | String | 50 | sí | — |
| `createdByName` | String | 255 | sí | — |

Índice: key `hogarId_idx` sobre `hogarId` (ASC).

### Colección `expenses` (gastos)
**Collection ID = `expenses`**, **Document Security: ON**, permiso **Create** para **Users**.

| Atributo | Tipo | Tamaño/Config | Requerido | Defecto |
|---|---|---|---|---|
| `amount` | Double | — | sí | — |
| `concept` | String | 255 | sí | — |
| `category` | String | 100 | no | — |
| `paidByName` | String | 255 | sí | — |
| `shared` | Boolean | — | sí | `true` |
| `account` | String | 20 | no | `individual` |
| `spentAt` | Datetime | — | no | — |
| `hogarId` | String | 50 | sí | — |

Índice: key `hogarId_idx` sobre `hogarId` (ASC).

> `account` (`joint` = cuenta conjunta / `individual` = dinero de cada uno) separa
> lo pagado con dinero común de lo personal. `spentAt` es la fecha real del gasto
> (la elegida al añadirlo, o la del movimiento importado del CSV); si falta, se usa
> la de creación. Si la colección ya existía, añádelos:
> ```bash
> curl -sS -X POST "$EP/databases/$DB/collections/expenses/attributes/string"   "${H[@]}" -d '{"key":"account","size":20,"required":false,"default":"individual"}'; echo
> curl -sS -X POST "$EP/databases/$DB/collections/expenses/attributes/datetime" "${H[@]}" -d '{"key":"spentAt","required":false}'; echo
> ```

### Colección `events` (calendario)
**Collection ID = `events`**, **Document Security: ON**, permiso **Create** para **Users**.

| Atributo | Tipo | Tamaño/Config | Requerido |
|---|---|---|---|
| `title` | String | 255 | sí |
| `startAt` | Datetime | — | sí |
| `place` | String | 255 | no |
| `ownerName` | String | 255 | sí |
| `hogarId` | String | 50 | sí |

Índice: key `hogarId_idx` sobre `hogarId` (ASC).

**Comandos `curl`** (reutiliza `EP`, `PID`, `DB`, `KEY`, `H` de antes):
```bash
curl -sS -X POST "$EP/databases/$DB/collections" "${H[@]}" \
 -d '{"collectionId":"events","name":"events","documentSecurity":true,"permissions":["create(\"users\")"]}'; echo
sleep 1
curl -sS -X POST "$EP/databases/$DB/collections/events/attributes/string"   "${H[@]}" -d '{"key":"title","size":255,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/events/attributes/datetime" "${H[@]}" -d '{"key":"startAt","required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/events/attributes/string"   "${H[@]}" -d '{"key":"place","size":255,"required":false}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/events/attributes/string"   "${H[@]}" -d '{"key":"ownerName","size":255,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/events/attributes/string"   "${H[@]}" -d '{"key":"hogarId","size":50,"required":true}'; echo
sleep 3
curl -sS -X POST "$EP/databases/$DB/collections/events/indexes" "${H[@]}" \
 -d '{"key":"hogarId_idx","type":"key","attributes":["hogarId"],"orders":["ASC"]}'; echo
```

### Colecciones `products` y `price_points` (base de precios de la compra)
**Document Security: ON** y permiso **Create** para **Users** en ambas.

`products`:
| Atributo | Tipo | Tamaño/Config | Requerido |
|---|---|---|---|
| `name` | String | 255 | sí |
| `hogarId` | String | 50 | sí |
| `lastPrice` | Double | — | no |
| `lastStore` | String | 100 | no |
| `lastAt` | Datetime | — | no |

`price_points`:
| Atributo | Tipo | Tamaño/Config | Requerido |
|---|---|---|---|
| `productId` | String | 50 | sí |
| `price` | Double | — | sí |
| `store` | String | 100 | sí |
| `at` | Datetime | — | sí |
| `hogarId` | String | 50 | sí |

Índices: `hogarId_idx` en ambas; en `price_points` además `productId_idx` sobre `productId`.

**Comandos `curl`** (reutiliza `EP`, `PID`, `DB`, `KEY`, `H`):
```bash
curl -sS -X POST "$EP/databases/$DB/collections" "${H[@]}" \
 -d '{"collectionId":"products","name":"products","documentSecurity":true,"permissions":["create(\"users\")"]}'; echo
sleep 1
curl -sS -X POST "$EP/databases/$DB/collections/products/attributes/string"   "${H[@]}" -d '{"key":"name","size":255,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/products/attributes/string"   "${H[@]}" -d '{"key":"hogarId","size":50,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/products/attributes/float"    "${H[@]}" -d '{"key":"lastPrice","required":false}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/products/attributes/string"   "${H[@]}" -d '{"key":"lastStore","size":100,"required":false}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/products/attributes/datetime" "${H[@]}" -d '{"key":"lastAt","required":false}'; echo
sleep 3
curl -sS -X POST "$EP/databases/$DB/collections/products/indexes" "${H[@]}" \
 -d '{"key":"hogarId_idx","type":"key","attributes":["hogarId"],"orders":["ASC"]}'; echo

curl -sS -X POST "$EP/databases/$DB/collections" "${H[@]}" \
 -d '{"collectionId":"price_points","name":"price_points","documentSecurity":true,"permissions":["create(\"users\")"]}'; echo
sleep 1
curl -sS -X POST "$EP/databases/$DB/collections/price_points/attributes/string"   "${H[@]}" -d '{"key":"productId","size":50,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/price_points/attributes/float"    "${H[@]}" -d '{"key":"price","required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/price_points/attributes/string"   "${H[@]}" -d '{"key":"store","size":100,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/price_points/attributes/datetime" "${H[@]}" -d '{"key":"at","required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/price_points/attributes/string"   "${H[@]}" -d '{"key":"hogarId","size":50,"required":true}'; echo
sleep 3
curl -sS -X POST "$EP/databases/$DB/collections/price_points/indexes" "${H[@]}" \
 -d '{"key":"hogarId_idx","type":"key","attributes":["hogarId"],"orders":["ASC"]}'; echo
sleep 1
curl -sS -X POST "$EP/databases/$DB/collections/price_points/indexes" "${H[@]}" \
 -d '{"key":"productId_idx","type":"key","attributes":["productId"],"orders":["ASC"]}'; echo
```

### Colección `categories` (categorías + presupuesto de Gastos)
**Collection ID = `categories`**, **Document Security: ON**, permiso **Create** para **Users**.

| Atributo | Tipo | Tamaño/Config | Requerido | Defecto |
|---|---|---|---|---|
| `hogarId` | String | 50 | sí | — |
| `name` | String | 100 | sí | — |
| `color` | String | 20 | sí | — |
| `icon` | String | 40 | sí | — |
| `budget` | Double | — | no | `0` |

Índice: key `hogarId_idx` sobre `hogarId` (ASC).

```bash
curl -sS -X POST "$EP/databases/$DB/collections" "${H[@]}" \
 -d '{"collectionId":"categories","name":"categories","documentSecurity":true,"permissions":["create(\"users\")"]}'; echo
sleep 1
curl -sS -X POST "$EP/databases/$DB/collections/categories/attributes/string" "${H[@]}" -d '{"key":"hogarId","size":50,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/categories/attributes/string" "${H[@]}" -d '{"key":"name","size":100,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/categories/attributes/string" "${H[@]}" -d '{"key":"color","size":20,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/categories/attributes/string" "${H[@]}" -d '{"key":"icon","size":40,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/categories/attributes/float"  "${H[@]}" -d '{"key":"budget","required":false,"default":0}'; echo
sleep 3
curl -sS -X POST "$EP/databases/$DB/collections/categories/indexes" "${H[@]}" \
 -d '{"key":"hogarId_idx","type":"key","attributes":["hogarId"],"orders":["ASC"]}'; echo
```

> El interruptor "presupuesto activo" se guarda en las **preferencias del equipo**
> (team prefs de Appwrite), así que se comparte entre los miembros del hogar sin
> necesidad de otra colección.

### Nuevos atributos de `tasks` (fechas, asignación, recurrencia y avisos)
Añádelos a la colección `tasks` que ya existe. Si `assignedToName` ya estaba
creado, ese comando dará error de "ya existe": es normal, ignóralo.

| Atributo | Tipo | Tamaño/Config | Requerido | Defecto |
|---|---|---|---|---|
| `assignedToName` | String | 255 | no | — |
| `dueAt` | Datetime | — | no | — |
| `repeat` | String | 20 | no | `none` |
| `notify` | Boolean | — | no | `false` |

```bash
curl -sS -X POST "$EP/databases/$DB/collections/tasks/attributes/string"   "${H[@]}" -d '{"key":"assignedToName","size":255,"required":false}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/tasks/attributes/datetime" "${H[@]}" -d '{"key":"dueAt","required":false}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/tasks/attributes/string"   "${H[@]}" -d '{"key":"repeat","size":20,"required":false,"default":"none"}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/tasks/attributes/boolean"  "${H[@]}" -d '{"key":"notify","required":false,"default":false}'; echo
```

> **OCR de tickets** (pendiente): requiere un proveedor externo (Mindee / Google
> Vision) con API key, llamado desde una Appwrite Function para no exponer la
> clave. Se decidirá proveedor antes de implementarlo; el flujo manual de
> "precio al comprar" ya alimenta la misma base de datos.

## 3. SMTP (para los emails de invitación al hogar)
Sin SMTP, las invitaciones no se envían. En el VPS, edita el `.env` de Appwrite
(normalmente `/opt/appwrite/appwrite/.env`) y rellena:

```
_APP_SMTP_HOST=smtp.tu-proveedor.com
_APP_SMTP_PORT=587
_APP_SMTP_SECURE=tls
_APP_SMTP_USERNAME=usuario
_APP_SMTP_PASSWORD=contraseña
_APP_SYSTEM_EMAIL_NAME=Homie
_APP_SYSTEM_EMAIL_ADDRESS=no-reply@lademanu.es
```
Luego aplica los cambios:
```bash
cd /opt/appwrite/appwrite
sudo docker compose up -d
```
Proveedores gratuitos para empezar: **Brevo**, **Resend** (vía SMTP) o **Mailtrap** (pruebas).

## 4. Deep link de invitación
El enlace de invitación redirige a `homie://join`. En desarrollo con Expo Go el
esquema lo gestiona Expo; en build propia usa el scheme `homie` (ya configurado en
`app.json`). Si Appwrite bloquea el redirect, añade el dominio/esquema en
**Project → Platforms** o ajusta la URL de retorno.

---

Cuando `tasks` esté creada y el Project ID puesto en `app.json`, la pestaña
**Tareas** funciona en tiempo real entre los miembros del hogar. Los siguientes
módulos (Compra, Gastos) reutilizarán este mismo patrón (colección + permisos por
hogar + realtime).
