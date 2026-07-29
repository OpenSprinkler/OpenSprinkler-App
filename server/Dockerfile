# Stage 1 — build the SPA + install deps. Keep the human-readable tag for update tooling while the
# digest anchors the same reviewed base image across Proxmox and CI on amd64/arm64.
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++   # better-sqlite3 native build
COPY package*.json .npmrc ./
RUN HUSKY=0 npm ci && npm run deps:rebuild
COPY app ./app
COPY www/src ./www/src
COPY server ./server
COPY tsconfig.json ./
RUN npm run build:app                      # -> ./dist (app/vite.config.ts outDir "../dist")
RUN npm run build:server                   # -> ./dist-server/index.mjs (+ external source map)
# The server bundle retains production packages as externals (including better-sqlite3); discard
# TypeScript/Vite/test/mobile tooling after both production artifacts have been built.
RUN npm prune --omit=dev

# Stage 2 — slim runtime
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tzdata su-exec
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/server/docker-entrypoint.sh ./server/docker-entrypoint.sh
# Normalize the entrypoint to LF (it may be committed with CRLF on Windows) + make it runnable.
RUN sed -i 's/\r$//' /app/server/docker-entrypoint.sh && chmod +x /app/server/docker-entrypoint.sh && mkdir -p /data
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
	CMD node -e "const l=(process.env.LISTEN_HOST||'').trim(),h=l==='::'||l==='::1'?'[::1]':'127.0.0.1',a=process.env.API_TOKEN?{Authorization:'Bearer '+process.env.API_TOKEN}:{};fetch('http://'+h+':'+(process.env.PORT||8080)+'/api/health',{headers:a,signal:AbortSignal.timeout(2000)}).then(r=>r.json()).then(v=>{if(v.ok!==true)process.exit(1)}).catch(()=>process.exit(1))"
# Starts as root, applies PUID/PGID/TZ + chowns /data, then drops privileges (docker-entrypoint.sh).
ENTRYPOINT [ "/app/server/docker-entrypoint.sh" ]
CMD [ "node", "--enable-source-maps", "dist-server/index.mjs" ]
