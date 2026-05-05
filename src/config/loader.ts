import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ProxyConfigSchema, ProxyConfig } from './schema';
import { ZodError } from 'zod';

export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

export function loadConfig(configPath: string): ProxyConfig {
  const resolved = path.resolve(configPath);

  if (!fs.existsSync(resolved)) {
    throw new ConfigLoadError(`Config file not found: ${resolved}`);
  }

  let raw: unknown;
  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    raw = yaml.load(content);
  } catch (err) {
    throw new ConfigLoadError(`Failed to parse YAML config: ${resolved}`, err);
  }

  try {
    return ProxyConfigSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      const issues = err.errors
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n');
      throw new ConfigLoadError(
        `Invalid config schema:\n${issues}`,
        err
      );
    }
    throw new ConfigLoadError('Unknown validation error', err);
  }
}
