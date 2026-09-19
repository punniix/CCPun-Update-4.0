FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY tsconfig.json ./
COPY lib/local-ai ./lib/local-ai
COPY workers/local-ai ./workers/local-ai
USER node
CMD ["node", "--import", "tsx", "workers/local-ai/src/index.ts"]
