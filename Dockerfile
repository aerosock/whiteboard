FROM node:22-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM node:22-slim AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --production
COPY server/ .

# copy the built frontend
COPY --from=frontend /app/dist /app/dist

EXPOSE 3001
ENV PORT=3001
CMD ["node", "--import", "tsx", "src/index.ts"]
