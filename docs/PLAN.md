# Homie · Plan para la app comercial

> Documento vivo. Convierte el prototipo `index.html` (mockup navegable) en una app
> real iOS + Android.

## Decisiones de partida

| Decisión | Elección | Implicación |
|---|---|---|
| Plataformas | **iOS + Android** con **React Native (Expo)** | Una sola base de código, ~90% compartido, time-to-market rápido. |
| Alcance | **Suite completa** (Inicio, Gastos, Compra, Tareas, Calendario, Luz) | Mucho trabajo → se construye **módulo a módulo**; la suite es el destino, no el primer commit. |
| Monetización | **De pago / sin monetizar aún** | Se lanza sin pasarela; la arquitectura queda preparada para activar IAP/suscripción más tarde. |
| Equipo | **Tú, en plan aprendizaje/lateral** | Stack que minimiza backend propio (BaaS), fases pequeñas y alcanzables, aprender haciendo. |

> ⚠️ **Realidad**: a tiempo parcial y en solitario, la suite completa son **meses**. La
> estrategia es que cada fase deje algo **usable y demostrable** (puedes hacer un
> *soft-launch* en TestFlight/Play interno en cuanto haya 2-3 módulos sólidos), aunque
> el lanzamiento público "oficial" sea con la suite entera.

---

## 1. Visión de producto

**Homie** es el centro de operaciones de un hogar compartido (pareja/piso): dinero,
tareas, compra inteligente y ahorro energético, en una app cuidada estilo Apple HIG.

**Diferenciadores frente a la competencia (Splitwise, Tricount, listas, etc.):**
- **Todo-en-uno** para convivencia (gasto + tareas + compra + calendario).
- **Compra inteligente**: OCR de tickets → histórico de precios por producto y
  supermercado → recomendación del súper más barato.
- **Luz**: precios PVPC por horas + **planificador de electrodomésticos** con avisos
  a la hora más barata (gancho único y muy "viral" en España).

**Público**: parejas y pisos compartidos en España (PVPC es específico de España).

---

## 2. Stack técnico recomendado

Pensado para un desarrollador en solitario que aprende: máxima productividad, poco
backend que mantener.

### App (cliente)
- **Expo (managed) + React Native + TypeScript** — OTA updates, build en la nube (EAS),
  sin tocar Xcode/Android Studio salvo casos puntuales.
- **Expo Router** — navegación por ficheros; la tab bar del mockup → `(tabs)`.
- **NativeWind** (Tailwind para RN) — recrea el *design system* del mockup con utilidades;
  combinado con componentes propios que repliquen los tokens (`--accent #1F4D52`, radios,
  tipografía SF). Alternativa: Tamagui (más potente, más curva).
- **TanStack Query** — estado de servidor (caché, refetch, offline).
- **Zustand** — estado de UI local (tema, filtros, selección).
- **Reanimated 3 + Gesture Handler** — animaciones spring y *drag-to-dismiss* de los sheets
  (ya prometido en el mockup).
- **expo-notifications** — push (clave para los avisos de Luz y recordatorios).
- **expo-calendar** — integración con el calendario del dispositivo.
- **expo-camera / image-picker** — captura de tickets para OCR.

### Backend (BaaS — minimiza lo que tienes que construir)
- **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions):
  - **Auth**: email + "Sign in with Apple" (obligatorio si hay otros logins) + Google.
  - **Postgres + Row Level Security**: datos por hogar, seguros por usuario.
  - **Realtime**: sincronización en vivo entre los miembros del hogar (tareas, lista de
    la compra, gastos) — esencial para "hogar compartido".
  - **Storage**: imágenes de tickets.
  - **Edge Functions + cron**: proxy de la API de la luz, OCR (claves a salvo en servidor),
    y disparo de notificaciones programadas.

### Servicios externos
- **Luz**: **API oficial de ESIOS (REE)**, indicador **1001 (PVPC)**, con **token**
  (gratis, se pide por email). Se llama **desde una Edge Function** (oculta el token,
  evita CORS, cachea 1×/día). Respaldo: `apidatos.ree.es` / `preciodelaluz.org`.
  *(Ya implementado en el prototipo con esta misma capa de abstracción — `LUZ_API.proxyBase`.)*
- **OCR de tickets**: empezar con un servicio especializado en recibos —
  **Mindee** o **Veryfi** (devuelven líneas, total, comercio, fecha ya estructurados),
  o **Google Cloud Vision** si se quiere algo genérico/barato. Llamada vía Edge Function.
- **Push**: servicio de Expo Push (gratuito) sobre APNs/FCM.

### Calidad / entrega
- **EAS Build & Submit** — compilación y subida a tiendas.
- **EAS Update** — parches OTA sin pasar por revisión.
- **GitHub Actions** — lint + typecheck + tests en cada PR.
- **Sentry** — errores en producción.
- Tests: **Jest + React Native Testing Library** (lógica y componentes); la lógica pura
  (cálculo de tramos, ventanas más baratas, parsers PVPC) es fácil de testear y ya está
  prototipada.

---

## 3. Arquitectura de datos (esquema inicial)

```
households            (id, nombre, creado_por)
household_members     (household_id, user_id, rol, color)        -- Ruben/María
profiles             (user_id, nombre, avatar, push_token)

-- Gastos
expense_categories    (household_id, nombre, icono, color, presupuesto)
expenses              (household_id, importe, categoria_id, pagado_por, compartido,
                       fecha, descripcion, ticket_id?)
settlements           (household_id, de_user, a_user, importe, fecha)   -- "liquidar"

-- Compra
products              (household_id?, nombre, marca, formato)            -- BD propia
supermarkets          (id, nombre, color)                               -- catálogo
price_points          (product_id, supermarket_id, precio, fecha, fuente)
shopping_items        (household_id, product_id?, texto, cantidad, super, hecho_por)
receipts              (household_id, supermarket_id, total, fecha, imagen_url, estado_ocr)

-- Tareas
tasks                 (household_id, titulo, asignado_a, recurrencia, vence, hecha, hecha_at)

-- Calendario
events                (household_id, titulo, inicio, fin, lugar, owner, fuente)

-- Luz
appliances            (household_id, nombre, kwh, duracion_h, icono, color)
luz_schedules         (household_id, appliance_id, dia, hora_inicio, aviso, push_at)
alerts_prefs          (household_id, hora_barata, recordatorio_electro, tramos_caros,
                       resumen_manana)

-- Infra
devices               (user_id, expo_push_token, plataforma)
```

Reglas RLS: todo lo de un `household` solo es visible/editable por sus `members`.

---

## 4. Roadmap por fases (orden pensado para aprender progresivamente)

Cada fase es un incremento **demostrable**. El orden empieza por lo más
**autocontenido y motivador** (Luz, ya prototipado) y va sumando complejidad de
datos compartidos.

### Fase 0 · Fundaciones *(la base que todo lo demás necesita)*
- Proyecto Expo + TypeScript + Expo Router + NativeWind.
- **Portar el design system** del mockup a componentes RN (Card, ListRow, Pill,
  Segmented, Sheet, Tab bar, IconTile, toggles) + tema claro/oscuro.
- Proyecto Supabase: Auth (email + Apple), modelo `households`/`members`, onboarding
  (crear hogar, invitar a tu pareja por enlace/código).
- Navegación con la tab bar y las 6 pestañas vacías.
- **Aprendes**: Expo, navegación, estilos, auth, modelo multi-usuario.

### Fase 1 · Luz ⚡ *(el módulo estrella, ya diseñado)*
- Edge Function que cachea PVPC de ESIOS (hoy/mañana) → endpoint propio.
- Pantalla Luz: precio ahora, gráfico por horas, tramos, electrodomésticos, planificador
  con 3 opciones (portar la lógica del prototipo, ya validada).
- **Push notifications** end-to-end: aviso a la hora más barata + recordatorio de
  electrodoméstico programado (cron en Supabase que calcula y encola los avisos).
- **Aprendes**: Edge Functions, cron, push, gráficos en RN. Resultado: algo **lanzable**
  y diferenciador por sí solo.

### Fase 2 · Tareas ✅ *(primer dato compartido en tiempo real)*
- CRUD de tareas, asignación a miembros, recurrencias, "equilibrio del hogar".
- **Realtime**: cuando tu pareja marca una tarea, lo ves al instante.
- Recordatorios push de tareas.
- **Aprendes**: Postgres + RLS + Realtime + formularios + fechas/recurrencia.

### Fase 3 · Compra 🛒 *(el módulo con más "magia")*
- Lista de la compra colaborativa (realtime) por supermercado.
- BD de productos + histórico de precios + ficha de producto con gráfico.
- **OCR de tickets**: foto → Edge Function (Mindee/Vision) → líneas → alta de precios y
  gasto. Ranking "súper más barato" y ahorro estimado.
- **Aprendes**: Storage, integración OCR, modelado de precios, vistas/insights.

### Fase 4 · Gastos 💶 *(se apoya en tickets y categorías)*
- Presupuestos por categoría (editor con steppers del mockup), movimientos, gráficos.
- "Quién debe a quién" + liquidaciones.
- Vincular gastos a tickets de la Fase 3.
- **Aprendes**: agregaciones, lógica de reparto, visualización.

### Fase 5 · Calendario 📅
- Eventos del hogar + sincronización con el calendario del dispositivo (expo-calendar).
- Vista mensual + agenda; puntos por miembro.
- (Opcional futuro) sync con Google Calendar.

### Fase 6 · Inicio + pulido 🏠
- Dashboard que **agrega** todo (resumen de gastos, tareas de hoy, compra pendiente,
  deudas, precio de la luz ahora).
- Pulido: animaciones spring, *drag-to-dismiss*, haptics, vacíos/errores, accesibilidad.

### Fase 7 · Pre-lanzamiento
- Cuenta Apple Developer (99 $/año) y Google Play (25 $ único).
- Política de privacidad, *Account deletion* (obligatorio), fichas de tienda, capturas.
- Beta cerrada (TestFlight / Play testing interno) → feedback → lanzamiento.

> **Soft-launch sugerido**: tras Fase 1–3 ya tienes un producto coherente y atractivo
> para una beta pública, sin esperar a la suite entera.

---

## 5. Cross-cutting (en todas las fases)
- **Offline-first**: TanStack Query + persistencia; colas de escritura para mala conexión.
- **i18n**: textos en español; estructura lista para más idiomas.
- **Seguridad/privacidad**: RLS estricto, secretos solo en Edge Functions, mínimo de datos.
- **Observabilidad**: Sentry + logs de funciones.
- **Diseño**: un único *theme* (tokens del mockup) como fuente de verdad.

---

## 6. Cumplimiento legal (España/UE)
- **RGPD**: base legal, política de privacidad, derecho de acceso/borrado, minimización.
  Los tickets contienen datos personales → tratarlos con cuidado y permitir su borrado.
- **Tiendas**: Apple exige *Sign in with Apple* si ofreces login social, y **borrado de
  cuenta** dentro de la app. Declaración de privacidad (App Privacy / Data safety).
- **Datos bancarios**: la agregación bancaria automática (PSD2) está **regulada** y es
  compleja → **fuera del MVP**; de momento, entrada manual + OCR. Si más adelante se
  quiere, vía proveedor licenciado (Tink, GoCardless, etc.).

---

## 7. Costes aproximados (fase inicial)
| Concepto | Coste |
|---|---|
| Apple Developer | 99 $/año |
| Google Play | 25 $ (único) |
| Supabase | Gratis al inicio (Pro ~25 $/mes al crecer) |
| Expo EAS | Plan gratis/insuficiente → ~0–19 $/mes |
| ESIOS (luz) | Gratis |
| OCR (Mindee/Vision) | Gratis/“pago por uso” (céntimos por ticket) |
| Sentry | Gratis al inicio |

---

## 8. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Alcance demasiado grande para solitario | Construir por fases; cada una usable; soft-launch temprano. |
| Constancia (proyecto lateral) | Metas pequeñas y demostrables; celebrar cada fase. |
| Precisión OCR de tickets | Servicio especializado + edición manual de líneas. |
| CORS/token de la luz | Edge Function como proxy (ya previsto). |
| Notificaciones (lo más frágil de RN) | Abordarlas pronto (Fase 1) y probar en dispositivo real. |
| Coste OCR si escala | Límite por usuario / caché / mover a Premium cuando se monetice. |

---

## 9. Primeros pasos concretos (siguiente sesión)
1. Crear el proyecto Expo + TypeScript + Expo Router + NativeWind.
2. Crear el proyecto Supabase y configurar Auth (email + Apple).
3. Portar 4-5 componentes base del design system (Card, ListRow, Pill, Sheet, Tab bar).
4. Montar la tab bar con las 6 pestañas (pantallas vacías).
5. Empezar **Fase 1 (Luz)** reutilizando la lógica ya validada del prototipo.

> Cuando quieras, en la próxima sesión te genero el esqueleto del proyecto Expo y migramos
> la pantalla Luz como primer módulo real.
