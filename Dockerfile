# syntax=docker/dockerfile:1

# Shared runtime image for the web service and all Bun worker services. Railway
# overrides the process command per service; keeping one image prevents the
# worker services from drifting from the web service's dependency set.
FROM oven/bun:1.3.14

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .

ARG ALCHEMY_BASE_RPC_URL
ARG ALCHEMY_WEBHOOK_SIGNING_KEY
ARG ALCHEMY_NOTIFY_WEBHOOK_ID
ENV ALCHEMY_BASE_RPC_URL=${ALCHEMY_BASE_RPC_URL}
ENV ALCHEMY_WEBHOOK_SIGNING_KEY=${ALCHEMY_WEBHOOK_SIGNING_KEY}
ENV ALCHEMY_NOTIFY_WEBHOOK_ID=${ALCHEMY_NOTIFY_WEBHOOK_ID}

RUN bun run build

ENV NODE_ENV=production

CMD ["bun", "run", "start"]
