# Compilar la app instalable (EAS Build)

Con esto dejas de depender del servidor de Expo: obtienes un **APK** que se
instala en el móvil (tuyo y de María) y funciona solo.

## Requisitos (una vez)
1. Cuenta gratuita en **https://expo.dev** (regístrate).
2. En el VPS (o en tu PC):
   ```bash
   npm install -g eas-cli
   eas login          # con tu cuenta de expo.dev
   ```

## Vincular el proyecto (una vez)
```bash
cd ~/homie/mobile
eas init             # crea el proyecto en tu cuenta y añade el projectId a app.json
```
> Esto añade `extra.eas.projectId` a `app.json`. Súbelo (`git add app.json && git commit && git push`) para no perderlo.

## Compilar un APK de prueba (Android)
```bash
eas build -p android --profile preview
```
- La compilación ocurre en la nube de Expo (tarda ~10-15 min).
- Al terminar te da un **enlace**; ábrelo en el móvil y descarga/instala el APK.
- Android pedirá permitir "instalar apps de orígenes desconocidos" la primera vez.

## Notas
- **Notificaciones remotas / push**: este build ya soporta `expo-notifications`
  nativo. Las notificaciones **locales** (avisos de luz) funcionan tal cual; el
  push remoto ("María añadió una tarea") se añadiría después con Expo Push.
- **Actualizaciones sin recompilar**: se pueden enviar cambios de JS por OTA con
  EAS Update (`eas update`) sin rehacer el APK, siempre que no cambien partes
  nativas.
- **iOS / tiendas**: publicar en App Store (99 $/año) o Google Play (25 $ único)
  es un paso posterior; el APK de `preview` no necesita cuentas de pago.
- La config de Appwrite viaja en `app.json → extra`, así que el APK ya apunta a
  tu backend (`appwrite.lademanu.es`).

## Iconos
- `assets/icon.png` — icono de la app (fondo accent + “H”).
- `assets/adaptive.png` — logo blanco (Android adaptive, splash y notificaciones).
