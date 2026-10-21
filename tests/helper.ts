import { APIRequestContext } from '@playwright/test';
import fs from 'fs';

type Opts = { token?: string; data?: any; headers?: Record<string, string> };
const LOG = 'responses/log.json';

// hanya string pada key secret yang di-mask; array pesan validasi tetap terbaca
const mask = (v: any, k = ''): any => {
  if (typeof v === 'string') return /pass|token/i.test(k) ? '***' : v;
  if (Array.isArray(v)) return v.map(x => mask(x));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, mask(x, key)]));
  return v;
};
const maskReq = (d: any) => {
  if (typeof d !== 'string') return mask(d);
  try { return mask(JSON.parse(d)); } catch { return `[raw string, ${d.length} chars]`; }
};
const HDR = ['content-type', 'cache-control', 'strict-transport-security', 'x-content-type-options', 'x-frame-options',
  'content-security-policy', 'server', 'x-powered-by', 'access-control-allow-origin', 'x-ratelimit-limit', 'retry-after'];

// path harus relatif tanpa leading slash ('auth/login'), supaya /api/v1 tidak terbuang
export async function call(request: APIRequestContext, tc: string, method: string, path: string, o: Opts = {}) {
  const headers = { ...(o.headers ?? {}), ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) };
  const t = Date.now();
  const res = await request.fetch(path, { method, headers, data: o.data });
  const text = await res.text();
  const all = res.headers();
  const headers_ = Object.fromEntries(HDR.filter(h => all[h] !== undefined).map(h => [h, all[h]]));
  let body: any = text.slice(0, 300);
  try { body = JSON.parse(text); } catch {}
  fs.mkdirSync('responses', { recursive: true });
  const cur = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
  cur.push({ tc, method, path, req: maskReq(o.data), status: res.status(), headers: headers_, ms: Date.now() - t, body: mask(body) });
  fs.writeFileSync(LOG, JSON.stringify(cur, null, 2));
  return { status: res.status(), body, text, headers: all };
}
