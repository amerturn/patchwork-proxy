import { IncomingMessage, ServerResponse } from 'http';

export type IpFilterMode = 'allowlist' | 'denylist';

export interface IpFilterOptions {
  mode: IpFilterMode;
  ips: string[];
}

export function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.socket?.remoteAddress ?? '127.0.0.1';
}

export function ipMatchesCidr(ip: string, cidr: string): boolean {
  if (!cidr.includes('/')) return ip === cidr;

  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

  const ipNum = ipToInt(ip);
  const rangeNum = ipToInt(range);

  if (ipNum === null || rangeNum === null) return false;
  return (ipNum & mask) === (rangeNum & mask);
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
  return (nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3];
}

export function isIpAllowed(ip: string, options: IpFilterOptions): boolean {
  const matched = options.ips.some((entry) => ipMatchesCidr(ip, entry));
  return options.mode === 'allowlist' ? matched : !matched;
}

export function createIpFilterMiddleware(
  options: IpFilterOptions
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    const ip = getClientIp(req);
    if (isIpAllowed(ip, options)) {
      next();
    } else {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Forbidden', message: 'IP address not allowed' }));
    }
  };
}
