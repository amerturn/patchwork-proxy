import { z } from 'zod';

export const HeaderPatchSchema = z.object({
  set: z.record(z.string()).optional(),
  remove: z.array(z.string()).optional(),
  append: z.record(z.string()).optional(),
});

export const RouteSchema = z.object({
  match: z.object({
    path: z.string(),
    method: z.union([z.string(), z.array(z.string())]).optional(),
    headers: z.record(z.string()).optional(),
  }),
  target: z.string().url(),
  pathRewrite: z.record(z.string()).optional(),
  requestHeaders: HeaderPatchSchema.optional(),
  responseHeaders: HeaderPatchSchema.optional(),
  auth: z
    .object({
      type: z.enum(['bearer', 'apiKey', 'basic']),
      secret: z.string(),
    })
    .optional(),
  rateLimit: z
    .object({
      windowMs: z.number().positive(),
      max: z.number().positive(),
    })
    .optional(),
  cache: z
    .object({
      ttl: z.number().positive(),
      methods: z.array(z.string()).optional(),
    })
    .optional(),
  circuitBreaker: z
    .object({
      failureThreshold: z.number().positive().optional(),
      successThreshold: z.number().positive().optional(),
      timeout: z.number().positive().optional(),
    })
    .optional(),
});

export const ConfigSchema = z.object({
  server: z.object({
    port: z.number().int().positive().default(8080),
    host: z.string().default('0.0.0.0'),
  }),
  accessLog: z
    .object({
      file: z.string().optional(),
      console: z.boolean().default(true),
    })
    .optional(),
  routes: z.array(RouteSchema).min(1),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type HeaderPatch = z.infer<typeof HeaderPatchSchema>;
