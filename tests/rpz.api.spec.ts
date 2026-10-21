import { test, expect } from '@playwright/test';
import { call } from './helper';
import { getState, setState } from './state';

const RC = process.env.RECAPTCHA_TOKEN ?? '';
const ADMIN = { email: process.env.ADMIN_EMAIL!, password: process.env.ADMIN_PASS!, remember: false, recaptcha_token: RC };
const PASS = 'Password123';
const NEW_PASS = 'PasswordBaru123';
const stamp: number = getState().stamp ?? (() => { const t = Date.now(); setState({ stamp: t }); return t; })();
const email = `qa.rpz.${stamp}@komdigi.go.id`;
const ghost = '00000000-0000-7000-8000-000000000000'; // id berformat UUID tapi tidak ada
let admin = '';
let user = '';
let userId: any;
let victimId: any;

// worker di-restart Playwright setiap ada test gagal, jadi state dipersist ke file
test.beforeEach(() => { ({ admin = '', user = '', userId, victimId } = getState()); });
test.afterEach(() => setState({ admin, user, userId, victimId }));

const tok = (b: any) => b?.token ?? b?.access_token ?? b?.data?.token ?? b?.data?.access_token ?? '';
const idOf = (b: any) => b?.data?.id ?? b?.id;
const newUser = (o: any = {}) => ({
  name: 'TEST - QA RPZ', role: 'readonly', email, password: PASS, password_confirmation: PASS, ...o,
});
const noServerError = (s: number) => expect.soft(s, 'tidak boleh 5xx').toBeLessThan(500);
const uniq = (k: string) => `qa.${k}.${stamp}@komdigi.go.id`;

test('TC_AUTH_001 login valid', async ({ request }) => {
  const r = await call(request, 'TC_AUTH_001', 'POST', 'auth/login', { data: ADMIN });
  expect.soft(r.status).toBe(200);
  admin = tok(r.body) || admin;
  expect.soft(admin, 'token ada').toBeTruthy();
  expect.soft(r.text).not.toContain(ADMIN.password);
  expect.soft(r.text).not.toMatch(/"password"/);
});

test('TC_AUTH_002 login invalid + user enumeration', async ({ request }) => {
  const cases: Record<string, any> = {
    wrongPass: { ...ADMIN, password: 'Salah123' },
    unknownEmail: { ...ADMIN, email: 'nobody.xyz@komdigi.go.id' },
    empty: {},
    spaces: { email: '   ', password: '   ' },
    badEmail: { ...ADMIN, email: 'bukan-email' },
    nulls: { email: null, password: null },
    rememberString: { ...ADMIN, remember: 'abc' },
  };
  const res: Record<string, any> = {};
  for (const [k, data] of Object.entries(cases)) {
    res[k] = await call(request, 'TC_AUTH_002', 'POST', 'auth/login', { data });
    expect.soft([400, 401, 422], k).toContain(res[k].status);
  }
  expect.soft(JSON.stringify(res.wrongPass.body?.message), 'pesan email salah vs password salah harus sama')
    .toBe(JSON.stringify(res.unknownEmail.body?.message));
});

test('TC_AUTH_005 token tidak valid', async ({ request }) => {
  const [h = '', p = '', s = 'x'] = admin.split('.');
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tokens: Record<string, string | undefined> = {
    none: undefined,
    random: 'abc.def.ghi',
    tamperedSig: `${h}.${p}.${s.slice(0, -2)}xx`,
    tamperedPayload: `${h}.${b64({ sub: '1', role: 'superadmin' })}.${s}`,
    algNone: `${b64({ alg: 'none', typ: 'JWT' })}.${p}.`,
  };
  for (const [k, token] of Object.entries(tokens)) {
    const r = await call(request, 'TC_AUTH_005', 'GET', 'auth/me', { token });
    expect.soft(r.status, k).toBe(401);
  }
});

test('TC_ROLE_001 options roles', async ({ request }) => {
  const ok = await call(request, 'TC_ROLE_001', 'GET', 'options/roles', { token: admin });
  expect.soft(ok.status).toBe(200);
  const no = await call(request, 'TC_ROLE_001', 'GET', 'options/roles');
  expect.soft(no.status).toBe(401);
});

test('TC_USER_002 create user valid', async ({ request }) => {
  const r = await call(request, 'TC_USER_002', 'POST', 'users', { token: admin, data: newUser() });
  expect.soft([200, 201]).toContain(r.status);
  userId = idOf(r.body);
  expect.soft(userId, 'id user baru').toBeTruthy();
  expect.soft(r.text).not.toMatch(/"password"/);
});

test('TC_USER_002b buat victim user', async ({ request }) => {
  const r = await call(request, 'TC_PROF_005', 'POST', 'users',
    { token: admin, data: newUser({ name: 'TEST - QA RPZ Victim', email: uniq('victim') }) });
  expect.soft([200, 201]).toContain(r.status);
  victimId = idOf(r.body);
});

test('TC_USER_003 validasi create', async ({ request }) => {
  const bad: Record<string, any> = {
    dupEmail: { email },
    dupEmailUpper: { email: email.toUpperCase() },
    badEmail: { email: 'x' },
    emptyName: { email: uniq('en'), name: '' },
    spaceName: { email: uniq('sn'), name: '   ' },
    longName: { email: uniq('ln'), name: 'A'.repeat(300) },
    badRole: { email: uniq('br'), role: 'tidak-ada' },
    shortPass: { email: uniq('sp'), password: 'Ab1', password_confirmation: 'Ab1' },
    mismatch: { email: uniq('mm'), password_confirmation: 'Beda123' },
  };
  for (const [k, o] of Object.entries(bad)) {
    const r = await call(request, 'TC_USER_003', 'POST', 'users', { token: admin, data: newUser(o) });
    expect.soft([400, 409, 422], k).toContain(r.status);
  }
  const xss = await call(request, 'TC_USER_003', 'POST', 'users',
    { token: admin, data: newUser({ email: uniq('xss'), name: '<script>alert(1)</script>' }) });
  noServerError(xss.status); // log only: cek apakah disimpan mentah
  if (idOf(xss.body)) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(xss.body)}`, { token: admin });
});

test('TC_USER_005 create paralel email sama', async ({ request }) => {
  const e = uniq('dup');
  const rs = await Promise.all([1, 2].map(() =>
    call(request, 'TC_USER_005', 'POST', 'users', { token: admin, data: newUser({ email: e }) })));
  const created = rs.filter(r => [200, 201].includes(r.status));
  expect.soft(created.length, 'hanya 1 record boleh terbuat').toBe(1);
  for (const r of created) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(r.body)}`, { token: admin });
});

test('TC_USER_006 boundary id', async ({ request }) => {
  for (const v of [0, -1, 'abc', ghost, '99999999999999999999', encodeURIComponent("1' OR '1'='1")]) {
    const r = await call(request, 'TC_USER_006', 'GET', `users/${v}`, { token: admin });
    noServerError(r.status);
    expect.soft([400, 404, 422], String(v)).toContain(r.status);
  }
});

test('TC_USER_007 list + pagination', async ({ request }) => {
  const no = await call(request, 'TC_USER_007', 'GET', 'users');
  expect.soft(no.status).toBe(401);
  for (const q of ['', 'page=1&per_page=1', 'page=0', 'page=-1', 'page=abc', 'per_page=0', 'per_page=100000', 'page=99999']) {
    const r = await call(request, 'TC_USER_007', 'GET', `users${q ? '?' + q : ''}`, { token: admin });
    noServerError(r.status);
  }
});

test('TC_PROF_001 route /users/profile vs /users/:id', async ({ request }) => {
  const r = await call(request, 'TC_PROF_001', 'GET', 'users/profile', { token: admin });
  expect.soft(r.status).toBe(200);
  expect.soft(r.text).toContain(ADMIN.email);
});

test('login user test (readonly)', async ({ request }) => {
  const r = await call(request, 'TC_AUTH_001b', 'POST', 'auth/login', { data: { email, password: PASS, remember: false, recaptcha_token: RC } });
  expect.soft(r.status).toBe(200);
  user = tok(r.body) || user;
});

test('TC_USER_001 RBAC readonly', async ({ request }) => {
  const calls: [string, string, any?][] = [
    ['GET', 'users'],
    ['POST', 'users', newUser({ email: uniq('rbac') })],
    ['PUT', `users/${victimId}`, { name: 'HACKED', role: 'readonly', email: uniq('hacked'), password: PASS, password_confirmation: PASS }],
    ['DELETE', `users/${victimId}`],
    ['PUT', `users/${ghost}`, newUser()],
    ['DELETE', `users/${ghost}`],
  ];
  for (const [m, p, data] of calls) {
    const r = await call(request, 'TC_USER_001', m, p, { token: user, data });
    expect.soft(r.status, `${m} ${p}`).toBe(403);
  }
  const v = await call(request, 'TC_PROF_005', 'GET', `users/${victimId}`, { token: admin });
  expect.soft(v.status, 'victim masih ada').toBe(200);
  expect.soft(v.body?.data?.name, 'victim tidak berubah').toBe('TEST - QA RPZ Victim');
});

test('TC_RBAC readonly akses isps/rpz (informasional)', async ({ request }) => {
  for (const p of ['isps', 'rpz', 'rpz/summary']) {
    const r = await call(request, 'TC_RBAC_DATA', 'GET', p, { token: user });
    noServerError(r.status);
  }
});

test('TC_USER_004 mass assignment role', async ({ request }) => {
  await call(request, 'TC_USER_004', 'PUT', 'users/profile',
    { token: user, data: { name: 'TEST - QA RPZ', email, role: 'superadmin', is_active: true } });
  const me = await call(request, 'TC_USER_004', 'GET', 'auth/me', { token: user });
  expect.soft(JSON.stringify(me.body), 'role tidak boleh berubah').not.toContain('superadmin');
});

test('TC_PROF_002 update profil', async ({ request }) => {
  const same = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
    { token: user, data: { name: 'TEST - QA RPZ Edit', email } });
  expect.soft(same.status, 'email sendiri bukan duplikat').toBe(200);
  const dup = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
    { token: user, data: { name: 'TEST - QA RPZ Edit', email: ADMIN.email } });
  expect.soft([409, 422]).toContain(dup.status);
});

test('TC_PROF_003/004 ganti password', async ({ request }) => {
  const url = 'users/profile/password';
  const t = (data: any) => call(request, 'TC_PROF_003', 'PUT', url, { token: user, data });
  const wrong = await t({ password: NEW_PASS, current_password: 'Salah123', password_confirmation: NEW_PASS });
  expect.soft([400, 401, 403, 422], 'current salah').toContain(wrong.status);
  const mismatch = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: 'Beda123' });
  expect.soft([400, 422], 'confirmation beda').toContain(mismatch.status);
  const same = await t({ password: PASS, current_password: PASS, password_confirmation: PASS });
  expect.soft([400, 422], 'password baru = lama').toContain(same.status);
  const ok = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: NEW_PASS });
  expect.soft(ok.status).toBe(200);

  const old = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: PASS, remember: false, recaptcha_token: RC } });
  expect.soft([401, 422], 'password lama harus gagal').toContain(old.status);
  const oldTok = await call(request, 'TC_PROF_004', 'GET', 'auth/me', { token: user });
  expect.soft(oldTok.status, 'token lama setelah ganti password (rekomendasi: 401)').toBe(401);
  const fresh = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  expect.soft(fresh.status).toBe(200);
  user = tok(fresh.body);
});

test('TC_AUTH_007/008 refresh', async ({ request }) => {
  const r = await call(request, 'TC_AUTH_007', 'POST', 'auth/refresh', { token: user });
  expect.soft(r.status).toBe(200);
  const next = tok(r.body);
  expect.soft(next, 'token baru').toBeTruthy();
  const old = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: user });
  expect.soft(old.status, 'token lama setelah refresh').toBe(401);
  const now = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: next });
  expect.soft(now.status).toBe(200);
  user = next || user;

  const par = await Promise.all([1, 2].map(() => call(request, 'TC_AUTH_008', 'POST', 'auth/refresh', { token: user })));
  par.forEach(p => noServerError(p.status));
  const re = await call(request, 'TC_AUTH_008', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  user = tok(re.body);
});

test('TC_AUTH_003 brute force login', async ({ request }) => {
  test.skip(!process.env.RUN_BRUTE, 'set RUN_BRUTE=1 (akan mengunci akun test)');
  const codes: number[] = [];
  for (let i = 0; i < 12; i++) {
    const r = await call(request, 'TC_AUTH_003', 'POST', 'auth/login', { data: { email, password: `Salah${i}`, remember: false, recaptcha_token: RC } });
    codes.push(r.status);
  }
  expect.soft(codes, 'harus ada 429/lockout').toContain(429);
});

test('TC_AUTH_004 efek remember pada masa berlaku token', async ({ request }) => {
  const login = (remember: boolean) => call(request, 'TC_AUTH_004', 'POST', 'auth/login',
    { data: { email, password: NEW_PASS, remember, recaptcha_token: RC } });
  const a = await login(false);
  const b = await login(true);
  const ttl = (r: any) => r.body?.data?.expires_in;
  expect.soft(ttl(b), `remember=true (${ttl(b)}) harus lebih lama dari false (${ttl(a)})`).toBeGreaterThan(ttl(a));
  user = tok(b.body) || user;
});

test('TC_AUTH_006 logout invalidate token', async ({ request }) => {
  const re = await call(request, 'TC_AUTH_006', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  const t = tok(re.body) || user;
  const out = await call(request, 'TC_AUTH_006', 'POST', 'auth/logout', { token: t });
  expect.soft(out.status).toBe(200);
  expect.soft((await call(request, 'TC_AUTH_006', 'GET', 'auth/me', { token: t })).status).toBe(401);
  expect.soft((await call(request, 'TC_AUTH_006', 'POST', 'auth/refresh', { token: t })).status).toBe(401);
});

test('TC_GEN_001 format request', async ({ request }) => {
  const json = { 'Content-Type': 'application/json' };
  const cases: [string, any][] = [
    ['malformed', { headers: json, data: '{"email":' }],
    ['text/plain', { headers: { 'Content-Type': 'text/plain' }, data: JSON.stringify(ADMIN) }],
    ['wrongTypes', { data: { email: 123, password: ['a'], remember: 'x' } }],
    ['objects', { data: { email: {}, password: {} } }],
  ];
  for (const [k, o] of cases) {
    const r = await call(request, 'TC_GEN_001', 'POST', 'auth/login', o);
    expect.soft([400, 415, 422], k).toContain(r.status);
    expect.soft(r.text, `${k}: bocor detail internal`).not.toMatch(/stack|trace|\.php|exception|vendor\//i);
  }
});

test('TC_USER_009 hapus user test', async ({ request }) => {
  const pre = await call(request, 'TC_USER_009', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  const t2 = tok(pre.body);
  const d1 = await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin });
  expect.soft([200, 204]).toContain(d1.status);
  expect.soft((await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin })).status).toBe(404);
  expect.soft((await call(request, 'TC_USER_009', 'GET', `users/${userId}`, { token: admin })).status).toBe(404);
  const login = await call(request, 'TC_USER_009', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  expect.soft([401, 422], 'user terhapus tidak boleh login').toContain(login.status);
  const me = await call(request, 'TC_USER_009', 'GET', 'auth/me', { token: t2 });
  expect.soft(me.status, 'token user terhapus harus ditolak').toBe(401);
  if (victimId) await call(request, 'CLEANUP', 'DELETE', `users/${victimId}`, { token: admin });
});

test('TC_USER_010 self-delete superadmin', async ({ request }) => {
  test.skip(!process.env.ALLOW_DESTRUCTIVE, 'set ALLOW_DESTRUCTIVE=1 (bisa menghapus superadmin kalau API tidak memblokir)');
  const me = await call(request, 'TC_USER_010', 'GET', 'auth/me', { token: admin });
  const r = await call(request, 'TC_USER_010', 'DELETE', `users/${idOf(me.body)}`, { token: admin });
  expect.soft(r.status, 'self-delete harus ditolak').toBeGreaterThanOrEqual(400);
});

async function walk(request: any, tc: string, path: string) {
  const rows: any[] = [];
  let page = 1, last = 1, total = 0;
  do {
    const r = await call(request, tc, 'GET', `${path}?per_page=50&page=${page}`, { token: admin });
    expect.soft(r.status, `${path} page ${page}`).toBe(200);
    last = r.body?.meta?.last_page ?? 1;
    total = r.body?.meta?.total ?? 0;
    rows.push(...(r.body?.data ?? []));
    page++;
  } while (page <= last && page < 50);
  return { rows, total };
}

test('TC_ISP_001 list isps + konsistensi pagination', async ({ request }) => {
  expect.soft((await call(request, 'TC_ISP_001', 'GET', 'isps')).status).toBe(401);
  const { rows, total } = await walk(request, 'TC_ISP_001', 'isps');
  expect.soft(rows.length, 'jumlah row semua halaman = meta.total').toBe(total);
  expect.soft(new Set(rows.map(x => x.id)).size, 'tidak ada duplikat id antar halaman').toBe(rows.length);
  expect.soft(new Set(rows.map(x => x.as_number)).size, 'as_number unik').toBe(rows.length);
  const label: Record<string, string> = { rpz_only: 'RPZ Only', rtbh_only: 'RTBH Only', rpz_rtbh: 'RPZ & RTBH' };
  for (const x of rows) expect.soft(label[x.service], `service ${x.service} (${x.name})`).toBe(x.service_label);
  for (const q of ['per_page=0', 'per_page=101', 'page=abc', 'page=-1']) {
    noServerError((await call(request, 'TC_ISP_001', 'GET', `isps?${q}`, { token: admin })).status);
  }
});

test('TC_RPZ_001 list rpz + summary konsisten', async ({ request }) => {
  expect.soft((await call(request, 'TC_RPZ_001', 'GET', 'rpz')).status).toBe(401);
  expect.soft((await call(request, 'TC_RPZ_001', 'GET', 'rpz/summary')).status).toBe(401);
  const sum = (await call(request, 'TC_RPZ_001', 'GET', 'rpz/summary', { token: admin })).body?.data ?? {};
  const { rows, total } = await walk(request, 'TC_RPZ_001', 'rpz');
  expect.soft(rows.length, 'row semua halaman = meta.total').toBe(total);
  expect.soft(new Set(rows.map(x => x.id)).size, 'tidak ada duplikat id antar halaman').toBe(rows.length);
  expect.soft(total, 'meta.total = summary.total_ip').toBe(sum.total_ip);
  expect.soft(sum.total_axfr + sum.total_ixfr, 'axfr + ixfr = total_ip').toBe(sum.total_ip);
  expect.soft(rows.filter(x => x.method === 'AXFR').length, 'jumlah AXFR = summary').toBe(sum.total_axfr);
  expect.soft(rows.filter(x => x.method === 'IXFR').length, 'jumlah IXFR = summary').toBe(sum.total_ixfr);
  const asn = new Set(rows.map(x => x.as_number).filter(Boolean));
  expect.soft(asn.size, 'distinct as_number di rpz = summary.total_isp').toBe(sum.total_isp);
  const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  for (const x of rows) {
    expect.soft(ipv4.test(x.ip_address), `ip valid ${x.ip_address}`).toBe(true);
    expect.soft(['AXFR', 'IXFR']).toContain(x.method);
    expect.soft(x.last_sync_at >= x.first_sync_at, `last_sync >= first_sync (${x.ip_address})`).toBe(true);
    expect.soft(Number.isInteger(x.last_serial), `last_serial integer (${x.ip_address})`).toBe(true);
  }
});

test('TC_GEN_002 header keamanan response', async ({ request }) => {
  const r = await call(request, 'TC_GEN_002', 'GET', 'auth/me', { token: admin });
  const h = r.headers;
  expect.soft(h['x-content-type-options'], 'X-Content-Type-Options').toBe('nosniff');
  expect.soft(h['strict-transport-security'], 'HSTS').toBeTruthy();
  expect.soft(h['cache-control'] ?? '', 'Cache-Control untuk data sensitif').toMatch(/no-store|no-cache|private/);
  expect.soft(h['x-powered-by'], 'tidak bocorkan X-Powered-By').toBeUndefined();
  expect.soft(h['server'] ?? '', 'Server tidak bocorkan versi').not.toMatch(/\d+\.\d+/);
});

// status 404 = tidak ada; 200/401/403/405/422 = endpoint ada
test('DISCOVERY endpoint tidak terdokumentasi', async ({ request }) => {
  const paths = [
    'isp', 'isps', 'rpz', 'sync', 'sync/status', 'dashboard', 'dashboard/summary', 'domains', 'blocklist',
    'roles', 'permissions', 'users?search=a', 'users?role=readonly', 'users?sort=name',
    'auth/forgot-password', 'auth/reset-password', 'auth/logout-all', 'auth/sessions',
    'users/1/activate', 'users/1/deactivate', 'audit-logs', 'logs', 'health', 'docs', 'api-docs',
    'rpz/isps', 'rpz/domains', 'rpz/sync', 'rpz/zones', 'rpz/summary',
    'auth/login', 'auth/logout', // POST-only: kalau 404 (bukan 405), handler menyamarkan 405 jadi 404
    'isps?search=Ambon', 'isps?service=rpz_only', 'isps?province=Maluku', 'rpz?method=IXFR', 'rpz?search=Batam',
    'rpz?as_number=AS990044', 'rpz?sort=last_sync_at', 'isps/1', 'rpz/1',
  ];
  for (const p of paths) await call(request, 'DISCOVERY', 'GET', p, { token: admin });
  for (const p of ['auth/forgot-password', 'auth/reset-password']) await call(request, 'DISCOVERY', 'POST', p, { data: {} });
});
