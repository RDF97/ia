# Imagen única para web y worker (docker-compose elige el comando).
FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El build no necesita secretos; las env reales llegan en runtime.
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
# Chromium del sistema para generar el PDF del cuadro (Playwright usa este
# binario: playwright-core NO descarga navegador, y en Alpine hay que usar el
# del sistema porque los de Playwright son para glibc, no musl).
#
# font-noto-emoji NO es opcional: sin una fuente de emoji, Chromium pinta
# cuadraditos en su lugar y el PDF sale sin las banderas de país ni los iconos
# (💶, ⚓, 📍…). font-noto trae latino y CJK, pero ningún emoji.
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates \
    ttf-freefont font-noto font-noto-emoji
ENV PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium-browser
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src ./src
COPY --from=build /app/worker ./worker
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./tsconfig.json
EXPOSE 3000
CMD ["npm", "start"]
