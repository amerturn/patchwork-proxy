import { z } from 'zod';

export const HeaderRewriteSchema = z.object({
  set: z.record(z.string()).optional(),
  remove: z.array(z.string()).optional(),
  forward: z.array(z.string()).optional(),
});

export const RouteSchema = z.object({
  match: z.object({
    path: z.string(),
    method: z.string().optional(),
    headers: z.record(z.string()).optional(),
  }),
  target: z.string().url(),
  rewrite: z.object({
    request: HeaderRewriteSchema.optional(),
    response: HeaderRewriteSchema.optional(),
    pathPrefix: z.string().optional(),
  }).optional(),
});

export const AuthSchema = z.object({
  type: z.enum(['bearer', 'apiKey', 'basic']),
  token: z.string().optional(),
  key: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

export const RateLimitSchema = z.object({
  windowMs: z.number().positive(),
  maxRequests: z.number().positive(),
});

export const CacheSchema = z.object({
  ttlSeconds: z.number().positive().default(60),
  maxSize: z.number().positive().default(500),
  cacheableMethods: z.array(z.string()).default(['GET', 'HEAD']),
  cacheableStatuses: z.array(z.number()).default([200, 203, 204, 301, 404]),
});

export const ConfigSchema = z.object({
  port: z.number().default(8080),
  host: z.string().default('0.0.0.0'),
  routes: z.array(RouteSchema),
  auth: AuthSchema.optional(),
  rateLimit: RateLimitSchema.optional(),
  cache: CacheSchema.optional(),
  logFile: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type CacheConfig = z.infer<typeof CacheSchema>;
