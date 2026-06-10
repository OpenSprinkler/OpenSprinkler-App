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
RUN apk add --no-cache tzdata su-exec
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/www/src ./www/src
# Normalize the entrypoint to LF (it may be committed with CRLF on Windows) + make it runnable.
RUN sed -i 's/\r$//' /app/server/docker-entrypoint.sh && chmod +x /app/server/docker-entrypoint.sh && mkdir -p /data
VOLUME /data
EXPOSE 8080
# Starts as root, applies PUID/PGID/TZ + chowns /data, then drops privileges (docker-entrypoint.sh).
ENTRYPOINT [ "/app/server/docker-entrypoint.sh" ]
CMD [ "npx", "tsx", "server/index.ts" ]
