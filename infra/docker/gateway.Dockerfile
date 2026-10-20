FROM node:24-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
FROM caddy:2-alpine
COPY --from=frontend /frontend/dist /srv/frontend
COPY backend/public /srv/backend/public
COPY infra/caddy/production.Caddyfile /etc/caddy/Caddyfile
