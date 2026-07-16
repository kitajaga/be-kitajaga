import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().default(10),

  MIDTRANS_SERVER_KEY: z.string().default(''),
  MIDTRANS_CLIENT_KEY: z.string().default(''),
  MIDTRANS_IS_PRODUCTION: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  MIDTRANS_WEBHOOK_URL: z.string().default(''),

  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('claude-sonnet-4-6'),

  MATCHING_IMMEDIATE_TIMEOUT_SECONDS: z.coerce.number().default(60),
  MATCHING_RESCHEDULE_TIMEOUT_MINUTES: z.coerce.number().default(15),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
