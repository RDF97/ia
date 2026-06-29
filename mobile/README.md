# Homie · App móvil (Expo / React Native)

Esqueleto de la app comercial. Stack: **Expo SDK 52 + React Native + TypeScript +
Expo Router + NativeWind**. Ver el plan completo en [`../docs/PLAN.md`](../docs/PLAN.md).

## Requisitos
- Node.js 18+ y npm
- App **Expo Go** en tu móvil (iOS/Android) para probar, o un emulador

## Puesta en marcha
```bash
cd mobile
npm install
npm start          # abre Expo; escanea el QR con Expo Go
# o:
npm run ios        # simulador iOS (requiere macOS/Xcode)
npm run android    # emulador Android
```

## Comprobaciones
```bash
npm run typecheck  # TypeScript
npm test           # Jest (incluye la lógica de Luz)
```

## Estructura
```
app/
  _layout.tsx          # raíz: providers (React Query, gestos, safe area)
  (tabs)/
    _layout.tsx        # tab bar con las 6 pestañas
    index.tsx          # Inicio
    gastos.tsx         # Gastos
    compra.tsx         # Compra
    tareas.tsx         # Tareas
    calendario.tsx     # Calendario
    luz.tsx            # Luz (Fase 1, ya funcional con la lógica del prototipo)
components/            # Screen, Card, PhaseCard (design system base)
lib/                   # luz.ts (lógica pura) + samplePrices.ts + tests
theme/tokens.ts        # tokens de color del mockup
```

## Estado
Esqueleto navegable con las 6 secciones. Cada pantalla indica su fase del roadmap.
La sección **Luz** ya incorpora la lógica validada (precio ahora, hora más barata y
las 3 mejores franjas para la lavadora) sobre datos de ejemplo.

## Siguientes pasos
1. Conectar Supabase (Auth + modelo de hogar).
2. Edge Function para PVPC (ESIOS) → sustituir los datos de ejemplo de Luz.
3. Push notifications para los avisos de la hora más barata.
