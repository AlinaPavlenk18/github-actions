FROM node:25-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

RUN --mount=type=secret,id=npm_token \
    if [ -f /run/secrets/npm_token ]; then \
      echo "Secret is available during this RUN step only (not persisted)"; \
    fi

COPY . .
RUN npm run build

FROM node:25-alpine AS runtime

RUN apk upgrade --no-cache

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=build /app/dist ./dist

ARG APP_VERSION=unknown
ENV APP_VERSION=${APP_VERSION}

EXPOSE 3000

CMD ["node", "dist/textUtils.js"]