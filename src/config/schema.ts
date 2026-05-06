import { z } from 'zod';

export const HeaderRewriteSchema = z.object({
  set: z.record(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

export const RouteSchema = z.object({
  match: z.object({
    path: z.string(),
    method: z.string().optional(),
  }),
  target: z.string().url(),
  requestHeaders: HeaderRewriteSchema.optional(),
  responseHeaders: HeaderRewriteSchema.optional(),
});

export const RateLimitSchema = z.object({
  windowMs: z.number().positive().default(60000),
  maxRequests: z.number().positive().default(100),
}).optional();

export const ConfigSchema = z.object({
  port: z.number().default(8080),
  rateLimit: RateLimitSchema,
  routes: z.array(RouteSchema),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type RateLimitConfig = z.infer<typeof RateLimitSchema>;
