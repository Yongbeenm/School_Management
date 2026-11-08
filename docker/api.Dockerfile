FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build --workspace @school/database && npm run build --workspace @school/api

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=build /app/packages/database/prisma ./packages/database/prisma
COPY --from=build /app/packages/database/package.json ./packages/database/package.json
CMD ["node", "apps/api/dist/main.js"]
