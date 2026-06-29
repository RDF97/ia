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
