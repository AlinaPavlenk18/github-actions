FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

RUN --mount=type=secret,id=npm_token \
    if [ -f /run/secrets/npm_token ]; then \
      echo "Secret is available during this RUN step only (not persisted)"; \
    fi

COPY . .
RUN npm run build

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

ARG APP_VERSION=unknown
ENV APP_VERSION=${APP_VERSION}

EXPOSE 3000

CMD ["node", "dist/textUtils.js"]