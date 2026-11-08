import { z } from 'zod';

export const emailSchema = z.string().email().max(254);

export const passwordSchema = z
  .string()
  .min(12, 'Password must contain at least 12 characters')
  .max(128, 'Password must contain at most 128 characters');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  schoolId: z.string().uuid().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
