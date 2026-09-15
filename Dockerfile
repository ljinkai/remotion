FROM node:22-bookworm-slim

# Chrome Headless Shell runtime libraries + CJK fonts for Chinese weekly videos
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json remotion.config.ts ./
COPY src ./src
COPY public ./public
COPY tools ./tools

RUN npm ci \
  && npx remotion browser ensure

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["npm", "run", "workbench"]
