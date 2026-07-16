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

Si nombraste la función distinto, cambia `appwriteJoinFunctionId` por su ID.

## 5. Probar
1. Anfitrión: **Invitar → Crear enlace → Compartir** (WhatsApp).
2. Invitado: instala el APK, **regístrate**, y en la pantalla de "Crea tu hogar" pega el
   **código** (o abre el enlace `homie://join?code=...`).
3. Debe entrar al hogar y ver los mismos datos.

> Los enlaces `homie://` no siempre son "clicables" en WhatsApp; por eso el mensaje
> incluye también el **código** para pegarlo a mano, que es el camino más fiable.
