FROM node:22-bookworm-slim

WORKDIR /app

# Install netcat for healthcheck use by compose
RUN apt-get update \
  && apt-get install -y --no-install-recommends netcat-openbsd \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --foreground-scripts

COPY . .

# No CMD — overridden per service in docker-compose
