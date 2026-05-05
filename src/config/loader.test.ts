import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from './loader';
import { ConfigLoadError } from './loader';

const validYaml = `
port: 3000
host: 127.0.0.1
routes:
  - match: /api
    target: https://api.example.com
    requestHeaders:
      set:
        X-Forwarded-By: patchwork
      remove:
        - Authorization
    responseHeaders:
      set:
        Cache-Control: no-store
`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'patchwork-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('parses a valid YAML config', () => {
    const file = path.join(tmpDir, 'config.yaml');
    fs.writeFileSync(file, validYaml);
    const config = loadConfig(file);
    expect(config.port).toBe(3000);
    expect(config.host).toBe('127.0.0.1');
    expect(config.routes).toHaveLength(1);
    expect(config.routes[0].match).toBe('/api');
    expect(config.routes[0].requestHeaders?.set?.['X-Forwarded-By']).toBe('patchwork');
  });

  it('applies default port and host', () => {
    const file = path.join(tmpDir, 'config.yaml');
    fs.writeFileSync(file, 'routes:\n  - match: /\n    target: https://example.com\n');
    const config = loadConfig(file);
    expect(config.port).toBe(8080);
    expect(config.host).toBe('0.0.0.0');
  });

  it('throws ConfigLoadError for missing file', () => {
    expect(() => loadConfig('/nonexistent/config.yaml')).toThrow(ConfigLoadError);
  });

  it('throws ConfigLoadError for invalid schema', () => {
    const file = path.join(tmpDir, 'config.yaml');
    fs.writeFileSync(file, 'port: 99999\nroutes: []\n');
    expect(() => loadConfig(file)).toThrow(ConfigLoadError);
  });

  it('throws ConfigLoadError for malformed YAML', () => {
    const file = path.join(tmpDir, 'config.yaml');
    fs.writeFileSync(file, 'port: [unclosed\n');
    expect(() => loadConfig(file)).toThrow(ConfigLoadError);
  });
});
