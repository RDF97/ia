# OCR / interpretación de tickets (Gemini)

Flujo: en **Gastos → Escanear ticket** eliges **Cámara / Galería / PDF**; la app manda
la imagen o el PDF (base64) a una **función de Appwrite** (`scanReceipt`) que la
**interpreta con Google Gemini** (un modelo con visión) y devuelve ya estructurado:
**comercio, fecha, total, moneda y líneas de producto**. La app muestra la revisión,
confirmas el gasto y, si quieres, guardas los productos en la base de precios.

> No es OCR + reglas: Gemini "ve" el ticket y lo interpreta, así que aguanta
> pantallazos, fotos torcidas, facturas y formatos raros mucho mejor.

## 1. API key gratis de Gemini
1. Entra en **https://aistudio.google.com/app/apikey** (con tu cuenta de Google).
2. **Create API key** → cópiala. El plan gratis es generoso y **no pide tarjeta**.

## 2. Función `scanReceipt` en Appwrite
El código está en `appwrite/functions/scanReceipt/` (`src/main.js`; **sin dependencias**,
usa el módulo `https` de Node).

1. Consola → **Functions** → tu función `scanReceipt` (o créala: runtime Node, Execute **Users**).
2. **Settings → Variables**:
   - **`GEMINI_API_KEY`** = tu clave de AI Studio.
   - *(opcional)* `GEMINI_MODEL` = `gemini-2.5-flash` (por defecto). Si tu cuenta da
     `429 · limit: 0` con un modelo (su free tier es 0), prueba otro: `gemini-2.5-flash-lite`
     o `gemini-2.0-flash-lite` (los *lite* suelen tener más cuota gratis). No hace falta
     re-subir código, solo cambiar esta variable.
   - *(si aún tienes `OCR_SPACE_API_KEY` de antes, puedes borrarla — ya no se usa.)*
3. **Timeout** → **30 s**.
4. **Vuelve a subir el código** (tar.gz de `appwrite/functions/scanReceipt/`,
   Entrypoint `src/main.js`) — la función cambió de OCR.space a Gemini.
   ```bash
   cd /home/manu/homie/appwrite/functions/scanReceipt
   tar -czf /tmp/scanReceipt.tar.gz .
   ```

## 3. App
El ID ya está en `mobile/app.json → extra.appwriteScanFunctionId = "scanReceipt"`.
Usa `expo-image-picker`, `expo-image-manipulator` y `expo-document-picker`. Van en
Expo Go; en el **APK** hay que recompilar (módulos nativos), se incluyen en el próximo build.

## 4. Probar
**Gastos → Escanear ticket** → Cámara / Galería / PDF → revisa comercio/total/fecha
(editables), cuenta y categoría, marca los productos y **Guardar**. Debería interpretar
bien cualquier ticket o factura, aunque sea un pantallazo.
