# syntax=docker/dockerfile:1

# Shared runtime image for the web service and all Bun worker services. Railway
# overrides the process command per service; keeping one image prevents the
# worker services from drifting from the web service's dependency set.
FROM oven/bun:1.3.14

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN bun run build

ENV NODE_ENV=production

CMD ["bun", "run", "start"]
