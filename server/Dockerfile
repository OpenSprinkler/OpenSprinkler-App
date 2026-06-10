# Stage 1 — build the SPA + install deps
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++   # better-sqlite3 native build
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:app                      # -> ./dist (app/vite.config.ts outDir "../dist")

# Stage 2 — slim runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/www/src ./www/src
RUN addgroup -S osc && adduser -S osc -G osc && mkdir -p /data && chown osc:osc /data
USER osc
VOLUME /data
EXPOSE 8080
CMD [ "npx", "tsx", "server/index.ts" ]
