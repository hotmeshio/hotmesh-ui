FROM --platform=linux/amd64 node:20-bullseye-slim AS base
RUN npm install -g npm@10.5.1

# Add Tini for a proper init process
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini

USER node
WORKDIR /home/node/app

EXPOSE 3010
ENTRYPOINT ["/tini", "--"]

# Development Stage
FROM base AS development
ENV NODE_ENV=development
COPY --chown=node:node package*.json ./
RUN npm install
COPY . .
USER root
CMD ["npm", "run", "server"]

# Build Stage
FROM development AS build
RUN npm run build

# Production Stage
FROM base AS production
ENV NODE_ENV=production
COPY --chown=node:node package*.json ./
RUN npm ci
COPY --from=build /home/node/app/build ./
# We expect the `.hotmesh.config.json` to be mounted at runtime.
# The static React webapp is served from node_modules/@hotmeshio/dashboard/build
# already installed as dependency
CMD ["node", "web/server.js"]
