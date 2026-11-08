# Production deployment guide

## Before release

1. Create a production PostgreSQL database and a private S3-compatible bucket (AWS S3 or Cloudflare R2).
2. Copy `.env.example` to `.env.production`; do not commit it.
3. Set `NODE_ENV=production`, `COOKIE_SECURE=true`, HTTPS `WEB_URL` and `CORS_ORIGINS`, unique 32+-character JWT secrets, `STORAGE_PROVIDER=s3`, and `EMAIL_PROVIDER=smtp`.
4. Fill `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, and `STORAGE_SECRET_KEY`. R2 uses its account S3 endpoint and normally uses `STORAGE_REGION=auto`.
5. Configure SMTP and a verified `EMAIL_FROM`. The API refuses to start in production with local storage, console email, or insecure cookies.
6. Build the web application with `NEXT_PUBLIC_API_BASE_URL` pointing to the browser-reachable API URL. This value is embedded at build time by Next.js.

## Release commands

Run migrations once for each release, from a trusted CI runner or deployment job:

```bash
npm ci
npm run db:generate
npm run migrate:deploy --workspace @school/database
npm run test --workspace @school/api
npm run build
```

For a container deployment, create `.env.production`, build the web image with the public API base URL, then start the API and web services:

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```

Put both services behind a TLS-terminating reverse proxy. Send `/api/*` to the API service and all other browser requests to the web service. The API health endpoint is `GET /api/v1/health` and is intentionally public.

## Operations

- Back up PostgreSQL daily and verify restore procedures. Object storage needs its own retention/versioning policy.
- Restrict the database and bucket to application identities; do not expose document buckets publicly.
- Monitor API health, SMTP delivery failures, authentication rate-limit events, and audit logs.
- Rotate JWT secrets deliberately: changing them invalidates active sessions.
- Change the seeded administrator password immediately, or omit seed execution after initial provisioning.

## Dependency-security posture

`npm audit --omit=dev` currently reports seven high-severity upstream advisories in the Nest multipart chain and Prisma CLI/config chain. The available remediation paths require major migrations (`@nestjs/platform-express` 12 to 11 according to the advisory resolver, and Prisma 6 to 7), so they were not applied automatically because that would be a downgrade or breaking change. Zod was upgraded to the current safe major. The document upload endpoint is restricted to one file, 5 MB, allowed MIME types, and verified file signatures as a mitigation for the multipart issue. Schedule a tested Prisma 7 migration and monitor supported Nest/multer releases before production launch.
