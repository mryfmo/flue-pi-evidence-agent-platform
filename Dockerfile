# syntax=docker/dockerfile:1

# Validation image, not a minimal production runtime.
# Builds native for the container runtime; OPA resolves from per-arch optional
# npm packages for linux/amd64 and linux/arm64.
FROM node:22-bookworm

WORKDIR /app
ENV PYTHON=python3

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN ./node_modules/node/bin/node scripts/setup-python.mjs

CMD ["npm", "run", "validate-release"]
