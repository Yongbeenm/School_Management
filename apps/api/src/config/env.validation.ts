import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('14d'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_BUCKET: z.string().min(3).optional(),
  STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  STORAGE_SECRET_KEY: z.string().min(1).optional(),
  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().min(3).default('School Management <no-reply@example.com>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  // dotenv represents an intentionally blank optional value as an empty string.
  // Normalize it before validation so local development can leave S3/SMTP fields blank.
  const normalizedConfig = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, typeof value === 'string' && value.trim() === '' ? undefined : value]),
  );
  const parsed = environmentSchema.safeParse(normalizedConfig);

  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }

  const environment = parsed.data;
  if (environment.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (environment.COOKIE_SECURE !== 'true') missing.push('COOKIE_SECURE=true');
    if (environment.STORAGE_PROVIDER !== 's3') missing.push('STORAGE_PROVIDER=s3');
    if (environment.EMAIL_PROVIDER !== 'smtp') missing.push('EMAIL_PROVIDER=smtp');
    if (missing.length) throw new Error(`Production configuration requires: ${missing.join(', ')}`);
  }
  return environment;
}
