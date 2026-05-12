import { z } from 'zod';

export const HeaderPatchSchema = z.object({
  set: z.record(z.string()).optional(),
  remove: z.array(z.string()).optional(),
});

export const RouteSchema = z.object({
  match: z.object({
    path: z.string(),
    method: z.union([z.string(), z.array(z.string())]).optional(),
    headers: z.record(z.string()).optional(),
  }),
  target: z.string().url(),
  rewrite: z.object({
    request: HeaderPatchSchema.optional(),
    response: HeaderPatchSchema.optional(),
    pathPrefix: z.string().optional(),
  }).optional(),
});

export const RateLimitConfigSchema = z.object({
  windowMs: z.number().positive().default(60000),
  max: z.number().positive().default(100),
}).optional();

export const AuthConfigSchema = z.object({
  type: z.enum(['bearer', 'apikey', 'basic']),
  token: z.string().optional(),
  key: z.string().optional(),
  users: z.record(z.string()).optional(),
}).optional();

export const CorsConfigSchema = z.object({
  origins: z.array(z.string()).default(['*']),
  methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']),
  headers: z.array(z.string()).optional(),
  credentials: z.boolean().default(false),
}).optional();

export const RequestSizeConfigSchema = z.object({
  trackByRoute: z.boolean().default(false),
}).optional();

export const ConfigSchema = z.object({
  port: z.number().positive().default(8080),
  routes: z.array(RouteSchema).min(1),
  rateLimit: RateLimitConfigSchema,
  auth: AuthConfigSchema,
  cors: CorsConfigSchema,
  requestSize: RequestSizeConfigSchema,
  healthCheck: z.object({
    path: z.string().default('/__health'),
    enabled: z.boolean().default(true),
  }).optional(),
  metrics: z.object({
    path: z.string().default('/__metrics'),
    enabled: z.boolean().default(true),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type HeaderPatch = z.infer<typeof HeaderPatchSchema>;
export type RequestSizeConfig = z.infer<typeof RequestSizeConfigSchema>;
