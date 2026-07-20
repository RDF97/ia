# TPV Evento

TPV ultra-simple para vender comida y bebida en un evento, pensado para una
tablet Android de 10" en horizontal. Sin cuentas, sin red, sin base de datos:
enciendes la tablet y cobras.

## Cómo funciona

La pantalla se divide en tres zonas:

| Carta | Ticket | Cambio |
|---|---|---|
| Pulsa un producto y se suma. El globo azul muestra las unidades; el botón − resta. | Líneas del pedido con steppers, total en grande y botón **Nueva venta**. | Pulsa los billetes/monedas que te entrega el cliente y la app te dice el **cambio** y su desglose en monedas. |

- **Solo carta / Con cambio**: el selector de arriba oculta o muestra el panel
  de cambio (la carta y el ticket siempre quedan visibles).
- **Editar carta**: cambia nombres, precios y emojis de los productos. Se
  guardan en la tablet y sobreviven a reinicios.
- **Importe justo**: el cliente paga exacto; **Borrar** limpia lo entregado.
- Pulsa un chip de lo entregado para quitarlo si te equivocas.
- La pantalla queda siempre encendida y las barras del sistema ocultas
  (modo quiosco); desliza desde el borde para recuperarlas.

## Descargar el APK

Cada cambio en `tpv-evento/` compila el APK automáticamente (GitHub Actions):

1. **Release** *(lo más fácil)*: ve a **Releases → "TPV Evento — última versión"**
   y descarga `tpv-evento.apk` directamente desde la tablet.
2. **Artifact**: en la pestaña **Actions**, abre el último run de
   *Build TPV Evento APK* y descarga el artifact `tpv-evento-apk`.

En la tablet, abre el archivo y acepta instalar desde orígenes desconocidos.
Requiere Android 8.0 o superior.

## Compilar en local

```bash
cd tpv-evento
./gradlew assembleRelease
# app/build/outputs/apk/release/app-release.apk
```

Necesitas el Android SDK (API 35). El APK ocupa ~1 MB.

## Notas técnicas

- Kotlin + Jetpack Compose (Material 3), sin más dependencias. Estética
  siguiendo las Apple Human Interface Guidelines: paleta del sistema iOS,
  tipografía generosa, esquinas redondeadas y objetivos táctiles grandes.
- Los precios se manejan en céntimos (`Long`) para evitar errores de coma
  flotante; el desglose del cambio es un algoritmo voraz sobre las
  denominaciones del euro.
- La carta se persiste como JSON en `SharedPreferences`.

## Firma del APK

El keystore **no** se versiona. Por defecto, cada build de CI genera una clave
de usar y tirar, así que para instalar una versión nueva sobre otra anterior
hay que **desinstalar antes la app** (se pierde la carta guardada).

Si quieres actualizaciones in-place, crea una clave estable y súbela como
secret del repositorio:

```bash
keytool -genkeypair -keystore release.keystore -alias tpv -keyalg RSA \
  -keysize 2048 -validity 10000 -storepass tpvevento -keypass tpvevento \
  -dname "CN=TPV Evento"
base64 -w0 release.keystore   # copia la salida
```

Guárdala en **Settings → Secrets and variables → Actions** como
`TPV_KEYSTORE_B64`. (Opcionalmente `TPV_KEYSTORE_PASSWORD`, `TPV_KEY_ALIAS` y
`TPV_KEY_PASSWORD` si usaste otros valores.)
