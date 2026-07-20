# OCR de tickets (Mindee)

Flujo: en **Gastos → Escanear ticket** haces una foto; la app la encoge y la manda
(base64) a una **función de Appwrite** (`scanReceipt`) que llama a **Mindee** y
devuelve **comercio, fecha, total y líneas de producto**. En la pantalla de revisión
confirmas el gasto y, si quieres, guardas los productos en la base de precios.

## 1. Cuenta y API key de Mindee
1. Regístrate gratis en **https://mindee.com** (plan gratis ~250 documentos/mes).
2. En el panel, usa el producto **Expense Receipts** (recibos).
3. Copia tu **API Key** (Settings/API Keys).

## 2. Función `scanReceipt` en Appwrite
El código está en `appwrite/functions/scanReceipt/` (`src/main.js` + `package.json`,
dependencia `mindee`).

1. Consola → **Functions → Create function**:
   - **Name / Function ID:** `scanReceipt`
   - **Runtime:** Node.js (18 o 20 recomendado; 16 también vale)
   - **Execute access:** `Users`
2. **Settings** de la función:
   - **Variables** → añade `MINDEE_API_KEY` = tu API key de Mindee.
   - **Timeout** → súbelo a **30 s** (Mindee tarda unos segundos; el timeout por
     defecto de 15 s puede quedarse corto).
3. **Sube el código** (igual que hiciste con `joinHogar`): crea un `.tar.gz` de la
   carpeta y súbelo en el formulario de la función (o por CLI). Ejemplo con tar:
   ```bash
   cd /home/manu/homie/appwrite/functions/scanReceipt
   tar -czf /tmp/scanReceipt.tar.gz .
   ```
   y arrastra `scanReceipt.tar.gz` al recuadro **"Upload a tar.gz"**, con
   **Entrypoint** `src/main.js` y, en **Build settings → Commands**, `npm install`.

## 3. App
El ID ya está en `mobile/app.json → extra.appwriteScanFunctionId = "scanReceipt"`.
La app usa `expo-image-picker` (cámara/galería) y `expo-image-manipulator` (encoge la
foto antes de enviarla). Ambas van en Expo Go; en el **APK** hay que **recompilar**
(son módulos nativos nuevos) — se incluyen en el próximo `eas build`.

## 4. Probar
1. **Gastos → Escanear ticket → Hacer foto** (recto y bien iluminado).
2. Espera unos segundos ("Leyendo el ticket…").
3. Revisa **comercio / total / fecha**, elige **cuenta** y **categoría**, marca los
   **productos** que quieras guardar en la base de precios, y **Guardar**.

> Si sale "El servicio de lectura no respondió bien": revisa que la variable
> `MINDEE_API_KEY` esté puesta, que el runtime instaló `mindee` (log del deployment)
> y que el timeout sea ≥30 s. Con fotos torcidas o borrosas Mindee acierta menos.
