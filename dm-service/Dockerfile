FROM node:18-slim

# Instalar Chromium e dependencias
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    fonts-liberation \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer usa o Chromium do sistema
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_CHROMIUM_REVISION=

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Render define a porta via env var
EXPOSE 10000

CMD ["node", "server.js"]