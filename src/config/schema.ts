import { z } from 'zod';

const AuthConfigSchema = z.union([
  z.object({
    type: z.literal('bearer'),
    tokens: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal('apikey'),
    tokens: z.array(z.string()).min(1),
    header: z.string().optional(),
  }),
  z.object({
    type: z.literal('basic'),
    users: z.record(z.string()),
  }),
]);

const RouteSchema = z.object({
  match: z.object({
    path: z.string(),
    method: z.string().optional(),
  }),
  target: z.string().url(),
  rewrite: z
    .object({
      requestHeaders: z.record(z.string()).optional(),
      responseHeaders: z.record(z.string()).optional(),
      stripPrefix: z.string().optional(),
    })
    .optional(),
  auth: AuthConfigSchema.optional(),
});

export const ConfigSchema = z.object({
  port: z.number().int().positive().default(8080),
  rateLimit: z
    .object({
      windowMs: z.number().positive(),
      maxRequests: z.number().int().positive(),
    })
    .optional(),
  auth: AuthConfigSchema.optional(),
  routes: z.array(RouteSchema).min(1),
});

export type Route = z.infer<typeof RouteSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
