# Invitaciones por enlace (WhatsApp)

Flujo: el anfitrión pulsa **Invitar → Crear enlace**, se genera un **código** guardado
en la colección `invites`, y lo comparte por WhatsApp. Quien lo recibe abre la app
(con su cuenta) y, al abrir el enlace o pegar el código, una **función de Appwrite**
(`joinHogar`) lo añade al hogar. Unir a alguien a un equipo hay que hacerlo desde el
servidor (con API key); por eso hace falta la función.

Reutiliza las variables `EP`, `PID`, `DB`, `KEY`, `H` de `APPWRITE_SETUP.md`.

## 1. Colección `invites`
`Document Security: ON`, permiso **Create** para **Users**.

| Atributo | Tipo | Tamaño | Requerido |
|---|---|---|---|
| `code` | String | 16 | sí |
| `hogarId` | String | 50 | sí |
| `hogarName` | String | 100 | sí |
| `createdByName` | String | 255 | no |
| `expiresAt` | Datetime | — | no |

```bash
curl -sS -X POST "$EP/databases/$DB/collections" "${H[@]}" \
 -d '{"collectionId":"invites","name":"invites","documentSecurity":true,"permissions":["create(\"users\")"]}'; echo
sleep 1
curl -sS -X POST "$EP/databases/$DB/collections/invites/attributes/string"   "${H[@]}" -d '{"key":"code","size":16,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/invites/attributes/string"   "${H[@]}" -d '{"key":"hogarId","size":50,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/invites/attributes/string"   "${H[@]}" -d '{"key":"hogarName","size":100,"required":true}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/invites/attributes/string"   "${H[@]}" -d '{"key":"createdByName","size":255,"required":false}'; echo
curl -sS -X POST "$EP/databases/$DB/collections/invites/attributes/datetime" "${H[@]}" -d '{"key":"expiresAt","required":false}'; echo
sleep 3
curl -sS -X POST "$EP/databases/$DB/collections/invites/indexes" "${H[@]}" \
 -d '{"key":"code_idx","type":"key","attributes":["code"],"orders":["ASC"]}'; echo
```

## 2. API key para la función
Crea una **API key** (Consola → Overview → API keys) con scopes **`databases.read`** y
**`teams.write`**. Cópiala; es distinta de la de setup y solo la usará la función.

## 3. Función `joinHogar`
El código está en `appwrite/functions/joinHogar/` (entrypoint `src/main.js`, dependencia
`node-appwrite`).

### Crear la función (consola, una vez)
Functions → **Create function** → runtime **Node.js** (18 o 20) →
**Function ID = `joinHogar`** → **Execute access: Users**.
Luego, en **Settings → Variables**, añade:
- `APPWRITE_API_KEY` = la API key del paso 2.

### Subir el código (Appwrite CLI)
```bash
npm install -g appwrite-cli
appwrite client --endpoint "$EP" --project-id "$PID" --key "TU_API_KEY_DE_SETUP"

# desde la raíz del repo:
appwrite functions create-deployment \
  --function-id joinHogar \
  --entrypoint 'src/main.js' \
  --commands 'npm install' \
  --code 'appwrite/functions/joinHogar' \
  --activate true
```
> Los nombres de comando/opciones del CLI pueden variar según versión (`create-deployment`
> vs `createDeployment`, `--project-id` vs `--projectId`). Si tu CLL usa camelCase, adáptalo.
> El runtime Node debe estar habilitado en tu Appwrite (`_APP_FUNCTIONS_RUNTIMES`).

## 4. Conectar la app
Los IDs ya están en `mobile/app.json → extra`:
- `appwriteInvitesCollectionId: "invites"`
- `appwriteJoinFunctionId: "joinHogar"`
- `homieApkUrl` = enlace de descarga del APK que se mete en el mensaje de invitación
  (por defecto `https://github.com/RDF97/ia/releases/latest/download/homie.apk`).

Si nombraste la función distinto, cambia `appwriteJoinFunctionId` por su ID.

## 5. Enlace de descarga del APK (para el mensaje de invitación)
El mensaje de WhatsApp lleva **primero un enlace de descarga** (https válido) y luego el
código. Ese enlace sale de `extra.homieApkUrl`. Como el repo es **público**, lo más simple
es un **GitHub Release** con una URL estable:

`https://github.com/RDF97/ia/releases/latest/download/homie.apk`

Esta URL sirve siempre el **último** APK que subas con el nombre `homie.apk`. Para publicarlo:
1. Compila el APK: `eas build --profile preview --platform android` y **descarga** el `.apk`
   desde la página del build de EAS.
2. En GitHub → repo `ia` → **Releases** → **Draft a new release** → crea un tag (p. ej. `app`),
   marca **"Set as the latest release"**, y **arrastra el `.apk`** renombrándolo a `homie.apk`.
3. A partir de ahí, ese enlace descarga siempre la última versión. Para actualizar, publica
   una nueva release con el APK nuevo (mismo nombre de asset `homie.apk`).

> Alternativa: subir el APK a un **bucket público de Appwrite Storage** y poner esa URL de
> descarga en `homieApkUrl`. Con GitHub Releases no hace falta tocar el servidor.

## 6. Probar
1. Anfitrión: **Invitar → Crear código → Compartir** (WhatsApp).
2. Invitado: abre el **enlace de descarga**, instala el APK, **regístrate**, y en la pantalla
   de "Crea tu hogar" pega el **código**.
3. Debe entrar al hogar y ver los mismos datos.

> El mensaje ya no usa el deep link `homie://` (WhatsApp no lo reconoce y no sirve si la
> persona no tiene la app): lleva el enlace de descarga + el código, que es lo fiable.
