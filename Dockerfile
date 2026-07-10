# ── 1단계: 프론트엔드 빌드 ──
FROM node:24-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web ./
RUN npm run build

# ── 2단계: 런타임 ──
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src ./src
COPY --from=web /app/web/dist ./web/dist

# SQLite 는 볼륨 마운트 지점(/data)에 저장
ENV DB_PATH=/data/happy-home.db

EXPOSE 3000
CMD ["npm", "start"]
