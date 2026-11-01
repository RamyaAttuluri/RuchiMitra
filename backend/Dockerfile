FROM node:22-bookworm-slim
# Chromium renders recipe PDF downloads (Telugu/Hindi fonts are bundled in assets/fonts).
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates chromium && rm -rf /var/lib/apt/lists/*
ENV PDF_BROWSER_EXECUTABLE=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build && mkdir -p data uploads && chown -R node:node /app
ENV NODE_ENV=production PORT=5000
USER node
EXPOSE 5000
CMD ["npm","start"]
