import { z } from 'zod';

export const HeaderRewriteSchema = z.object({
  set: z.record(z.string()).optional(),
  remove: z.array(z.string()).optional(),
  append: z.record(z.string()).optional(),
});

export const RouteSchema = z.object({
  match: z.string(),
  target: z.string().url(),
  stripPrefix: z.string().optional(),
  requestHeaders: HeaderRewriteSchema.optional(),
  responseHeaders: HeaderRewriteSchema.optional(),
});

export const ProxyConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(8080),
  host: z.string().default('0.0.0.0'),
  routes: z.array(RouteSchema).min(1),
});

export type HeaderRewrite = z.infer<typeof HeaderRewriteSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;
