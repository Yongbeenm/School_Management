FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN npm ci
COPY . .
RUN npm run build --workspace @school/types && npm run build --workspace @school/validation && npm run build --workspace @school/web

FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/packages/types/dist ./packages/types/dist
COPY --from=build /app/packages/validation/dist ./packages/validation/dist
COPY --from=build /app/packages/types/package.json ./packages/types/package.json
COPY --from=build /app/packages/validation/package.json ./packages/validation/package.json
CMD ["npm", "run", "start", "--workspace", "@school/web"]
