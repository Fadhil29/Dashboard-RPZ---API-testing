import { APIRequestContext } from '@playwright/test';
import fs from 'fs';

type Opts = { token?: string; data?: any; headers?: Record<string, string> };
const LOG = 'responses/log.json';

const mask = (v: any): any => {
  if (Array.isArray(v)) return v.map(mask);
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, /pass|token/i.test(k) ? '***' : mask(x)]));
  return v;
};

// path harus relatif tanpa leading slash ('auth/login'), supaya /api/v1 tidak terbuang
export async function call(request: APIRequestContext, tc: string, method: string, path: string, o: Opts = {}) {
  const headers = { ...(o.headers ?? {}), ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}) };
  const t = Date.now();
  const res = await request.fetch(path, { method, headers, data: o.data });
  const text = await res.text();
  let body: any = text.slice(0, 300);
  try { body = JSON.parse(text); } catch {}
  fs.mkdirSync('responses', { recursive: true });
  const cur = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
  cur.push({ tc, method, path, req: mask(o.data), status: res.status(), ms: Date.now() - t, body: mask(body) });
  fs.writeFileSync(LOG, JSON.stringify(cur, null, 2));
  return { status: res.status(), body, text };
}
