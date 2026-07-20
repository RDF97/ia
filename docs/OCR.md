# OCR de tickets (OCR.space)

Flujo: en **Gastos → Escanear ticket** haces una foto; la app la encoge y la manda
(base64) a una **función de Appwrite** (`scanReceipt`) que llama a **OCR.space** y
devuelve el **texto** del ticket. La app lo parsea (comercio, fecha, total y líneas
de producto) y muestra una pantalla de revisión donde confirmas el gasto y, si
quieres, guardas los productos en la base de precios.

> El parseo del texto vive en la app (`lib/receipts.ts`, con tests), así se afina
> sin re-desplegar la función. La función solo hace la llamada a OCR.space.

## 1. API key gratis de OCR.space
1. Regístrate en **https://ocr.space/ocrapi** → **Register for free API Key**.
2. Recibirás la API key por email (plan gratis: ~25.000 peticiones/mes, imágenes ≤1 MB).

## 2. Función `scanReceipt` en Appwrite
El código está en `appwrite/functions/scanReceipt/` (`src/main.js`; **sin dependencias**,
usa el módulo `https` de Node).

1. Consola → **Functions → Create function**:
   - **Name / Function ID:** `scanReceipt`
   - **Runtime:** Node.js (16, 18 o 20 — cualquiera vale, no usa librerías externas)
   - **Execute access:** `Users`
2. **Settings** de la función:
   - **Variables** → añade `OCR_SPACE_API_KEY` = tu API key de OCR.space.
   - **Timeout** → **30 s** (por si el OCR tarda).
3. **Sube el código** (igual que `joinHogar`): `.tar.gz` de la carpeta y súbelo en el
   formulario (Entrypoint `src/main.js`). No hace falta comando de build (sin deps),
   pero si te lo pide, `npm install` no molesta.
   ```bash
   cd /home/manu/homie/appwrite/functions/scanReceipt
   tar -czf /tmp/scanReceipt.tar.gz .
   ```

## 3. App
El ID ya está en `mobile/app.json → extra.appwriteScanFunctionId = "scanReceipt"`.
Usa `expo-image-picker` (cámara/galería) y `expo-image-manipulator` (encoge la foto
por debajo de 1 MB). Van en Expo Go; en el **APK** hay que **recompilar** (módulos
nativos nuevos), se incluyen en el próximo `eas build`.

## 4. Probar
1. **Gastos → Escanear ticket** → **Cámara**, **Galería** o **PDF**.
2. Revisa **comercio / total / fecha** (editables), elige **cuenta** y **categoría**,
   marca los **productos** a guardar, y **Guardar**.

> Admite **foto o PDF**. El parseo (comercio/total/productos) vive en la app
> (`lib/receipts.ts`, con tests), así que se afina sin re-desplegar la función.
> Consejo: foto **recta y nítida**, del ticket **solo** (evita pantallazos con la
> barra de estado del móvil). Todo se puede editar antes de guardar.

> Si añades soporte PDF y ya tenías la función desplegada, **vuelve a subir** el
> `.tar.gz` de `scanReceipt` (ahora manda el `filetype` a OCR.space).
