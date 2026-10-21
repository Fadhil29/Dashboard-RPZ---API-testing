import { request } from '@playwright/test';
import fs from 'fs';
import 'dotenv/config';

export default async function globalSetup() {
  fs.rmSync('.state.json', { force: true });
  fs.rmSync('responses', { recursive: true, force: true });

  const { ADMIN_EMAIL, ADMIN_PASS, ADMIN_TOKEN, RECAPTCHA_TOKEN = '' } = process.env;
  if (ADMIN_TOKEN) {
    fs.writeFileSync('.state.json', JSON.stringify({ admin: ADMIN_TOKEN }));
    return;
  }
  if (!ADMIN_EMAIL || !ADMIN_PASS) throw new Error('ADMIN_EMAIL / ADMIN_PASS kosong. Isi .env atau set ADMIN_TOKEN.');

  const base = (process.env.BASE_URL ?? 'https://be-dashboard-rpz.unictive.net/api/v1').replace(/\/?$/, '/');
  const ctx = await request.newContext({ baseURL: base, extraHTTPHeaders: { Accept: 'application/json' } });
  const res = await ctx.post('auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASS, remember: false, recaptcha_token: RECAPTCHA_TOKEN },
  });
  const text = await res.text();
  if (res.status() !== 200) throw new Error(`Login admin gagal (${res.status()}): ${text.slice(0, 400)}`);
  const b = JSON.parse(text);
  const token = b?.token ?? b?.access_token ?? b?.data?.token ?? b?.data?.access_token;
  if (!token) throw new Error(`Login 200 tapi token tidak ketemu. Keys: ${Object.keys(b?.data ?? b).join(', ')}`);
  fs.writeFileSync('.state.json', JSON.stringify({ admin: token }));
}
