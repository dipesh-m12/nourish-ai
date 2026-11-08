# Nourish AI API image: install, compile TypeScript, drop dev tools, run as non-root.
FROM node:22-alpine

WORKDIR /app
COPY package*.json tsconfig.json ./
COPY src ./src
# One step on purpose: dev-only packages (tsx, typescript, drizzle-kit) are installed, used to
# build dist/, and removed in the same layer, so they never add to the image size.
RUN npm ci && npm run build && npm prune --omit=dev && npm cache clean --force

ENV NODE_ENV=production
USER node
EXPOSE 4000
# The app's own /health: API up + Redis reachable. (busybox wget ships with alpine.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/index.js"]
