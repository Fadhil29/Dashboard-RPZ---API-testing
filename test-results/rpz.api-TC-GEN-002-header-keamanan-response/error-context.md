# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rpz.api.spec.ts >> TC_GEN_002 header keamanan response
- Location: tests\rpz.api.spec.ts:348:5

# Error details

```
Error: X-Content-Type-Options

expect(received).toBe(expected) // Object.is equality

Expected: "nosniff"
Received: undefined
```

```
Error: HSTS

expect(received).toBeTruthy()

Received: undefined
```

# Test source

```ts
  252 | });
  253 | 
  254 | test('TC_AUTH_006 logout invalidate token', async ({ request }) => {
  255 |   const re = await call(request, 'TC_AUTH_006', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  256 |   const t = tok(re.body) || user;
  257 |   const out = await call(request, 'TC_AUTH_006', 'POST', 'auth/logout', { token: t });
  258 |   expect.soft(out.status).toBe(200);
  259 |   expect.soft((await call(request, 'TC_AUTH_006', 'GET', 'auth/me', { token: t })).status).toBe(401);
  260 |   expect.soft((await call(request, 'TC_AUTH_006', 'POST', 'auth/refresh', { token: t })).status).toBe(401);
  261 | });
  262 | 
  263 | test('TC_GEN_001 format request', async ({ request }) => {
  264 |   const json = { 'Content-Type': 'application/json' };
  265 |   const cases: [string, any][] = [
  266 |     ['malformed', { headers: json, data: '{"email":' }],
  267 |     ['text/plain', { headers: { 'Content-Type': 'text/plain' }, data: JSON.stringify(ADMIN) }],
  268 |     ['wrongTypes', { data: { email: 123, password: ['a'], remember: 'x' } }],
  269 |     ['objects', { data: { email: {}, password: {} } }],
  270 |   ];
  271 |   for (const [k, o] of cases) {
  272 |     const r = await call(request, 'TC_GEN_001', 'POST', 'auth/login', o);
  273 |     expect.soft([400, 415, 422], k).toContain(r.status);
  274 |     expect.soft(r.text, `${k}: bocor detail internal`).not.toMatch(/stack|trace|\.php|exception|vendor\//i);
  275 |   }
  276 | });
  277 | 
  278 | test('TC_USER_009 hapus user test', async ({ request }) => {
  279 |   const pre = await call(request, 'TC_USER_009', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  280 |   const t2 = tok(pre.body);
  281 |   const d1 = await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin });
  282 |   expect.soft([200, 204]).toContain(d1.status);
  283 |   expect.soft((await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin })).status).toBe(404);
  284 |   expect.soft((await call(request, 'TC_USER_009', 'GET', `users/${userId}`, { token: admin })).status).toBe(404);
  285 |   const login = await call(request, 'TC_USER_009', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  286 |   expect.soft([401, 422], 'user terhapus tidak boleh login').toContain(login.status);
  287 |   const me = await call(request, 'TC_USER_009', 'GET', 'auth/me', { token: t2 });
  288 |   expect.soft(me.status, 'token user terhapus harus ditolak').toBe(401);
  289 |   if (victimId) await call(request, 'CLEANUP', 'DELETE', `users/${victimId}`, { token: admin });
  290 | });
  291 | 
  292 | test('TC_USER_010 self-delete superadmin', async ({ request }) => {
  293 |   test.skip(!process.env.ALLOW_DESTRUCTIVE, 'set ALLOW_DESTRUCTIVE=1 (bisa menghapus superadmin kalau API tidak memblokir)');
  294 |   const me = await call(request, 'TC_USER_010', 'GET', 'auth/me', { token: admin });
  295 |   const r = await call(request, 'TC_USER_010', 'DELETE', `users/${idOf(me.body)}`, { token: admin });
  296 |   expect.soft(r.status, 'self-delete harus ditolak').toBeGreaterThanOrEqual(400);
  297 | });
  298 | 
  299 | async function walk(request: any, tc: string, path: string) {
  300 |   const rows: any[] = [];
  301 |   let page = 1, last = 1, total = 0;
  302 |   do {
  303 |     const r = await call(request, tc, 'GET', `${path}?per_page=50&page=${page}`, { token: admin });
  304 |     expect.soft(r.status, `${path} page ${page}`).toBe(200);
  305 |     last = r.body?.meta?.last_page ?? 1;
  306 |     total = r.body?.meta?.total ?? 0;
  307 |     rows.push(...(r.body?.data ?? []));
  308 |     page++;
  309 |   } while (page <= last && page < 50);
  310 |   return { rows, total };
  311 | }
  312 | 
  313 | test('TC_ISP_001 list isps + konsistensi pagination', async ({ request }) => {
  314 |   expect.soft((await call(request, 'TC_ISP_001', 'GET', 'isps')).status).toBe(401);
  315 |   const { rows, total } = await walk(request, 'TC_ISP_001', 'isps');
  316 |   expect.soft(rows.length, 'jumlah row semua halaman = meta.total').toBe(total);
  317 |   expect.soft(new Set(rows.map(x => x.id)).size, 'tidak ada duplikat id antar halaman').toBe(rows.length);
  318 |   expect.soft(new Set(rows.map(x => x.as_number)).size, 'as_number unik').toBe(rows.length);
  319 |   const label: Record<string, string> = { rpz_only: 'RPZ Only', rtbh_only: 'RTBH Only', rpz_rtbh: 'RPZ & RTBH' };
  320 |   for (const x of rows) expect.soft(label[x.service], `service ${x.service} (${x.name})`).toBe(x.service_label);
  321 |   for (const q of ['per_page=0', 'per_page=101', 'page=abc', 'page=-1']) {
  322 |     noServerError((await call(request, 'TC_ISP_001', 'GET', `isps?${q}`, { token: admin })).status);
  323 |   }
  324 | });
  325 | 
  326 | test('TC_RPZ_001 list rpz + summary konsisten', async ({ request }) => {
  327 |   expect.soft((await call(request, 'TC_RPZ_001', 'GET', 'rpz')).status).toBe(401);
  328 |   expect.soft((await call(request, 'TC_RPZ_001', 'GET', 'rpz/summary')).status).toBe(401);
  329 |   const sum = (await call(request, 'TC_RPZ_001', 'GET', 'rpz/summary', { token: admin })).body?.data ?? {};
  330 |   const { rows, total } = await walk(request, 'TC_RPZ_001', 'rpz');
  331 |   expect.soft(rows.length, 'row semua halaman = meta.total').toBe(total);
  332 |   expect.soft(new Set(rows.map(x => x.id)).size, 'tidak ada duplikat id antar halaman').toBe(rows.length);
  333 |   expect.soft(total, 'meta.total = summary.total_ip').toBe(sum.total_ip);
  334 |   expect.soft(sum.total_axfr + sum.total_ixfr, 'axfr + ixfr = total_ip').toBe(sum.total_ip);
  335 |   expect.soft(rows.filter(x => x.method === 'AXFR').length, 'jumlah AXFR = summary').toBe(sum.total_axfr);
  336 |   expect.soft(rows.filter(x => x.method === 'IXFR').length, 'jumlah IXFR = summary').toBe(sum.total_ixfr);
  337 |   const asn = new Set(rows.map(x => x.as_number).filter(Boolean));
  338 |   expect.soft(asn.size, 'distinct as_number di rpz = summary.total_isp').toBe(sum.total_isp);
  339 |   const ipv4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  340 |   for (const x of rows) {
  341 |     expect.soft(ipv4.test(x.ip_address), `ip valid ${x.ip_address}`).toBe(true);
  342 |     expect.soft(['AXFR', 'IXFR']).toContain(x.method);
  343 |     expect.soft(x.last_sync_at >= x.first_sync_at, `last_sync >= first_sync (${x.ip_address})`).toBe(true);
  344 |     expect.soft(Number.isInteger(x.last_serial), `last_serial integer (${x.ip_address})`).toBe(true);
  345 |   }
  346 | });
  347 | 
  348 | test('TC_GEN_002 header keamanan response', async ({ request }) => {
  349 |   const r = await call(request, 'TC_GEN_002', 'GET', 'auth/me', { token: admin });
  350 |   const h = r.headers;
  351 |   expect.soft(h['x-content-type-options'], 'X-Content-Type-Options').toBe('nosniff');
> 352 |   expect.soft(h['strict-transport-security'], 'HSTS').toBeTruthy();
      |                                                       ^ Error: HSTS
  353 |   expect.soft(h['cache-control'] ?? '', 'Cache-Control untuk data sensitif').toMatch(/no-store|no-cache|private/);
  354 |   expect.soft(h['x-powered-by'], 'tidak bocorkan X-Powered-By').toBeUndefined();
  355 |   expect.soft(h['server'] ?? '', 'Server tidak bocorkan versi').not.toMatch(/\d+\.\d+/);
  356 | });
  357 | 
  358 | // status 404 = tidak ada; 200/401/403/405/422 = endpoint ada
  359 | test('DISCOVERY endpoint tidak terdokumentasi', async ({ request }) => {
  360 |   const paths = [
  361 |     'isp', 'isps', 'rpz', 'sync', 'sync/status', 'dashboard', 'dashboard/summary', 'domains', 'blocklist',
  362 |     'roles', 'permissions', 'users?search=a', 'users?role=readonly', 'users?sort=name',
  363 |     'auth/forgot-password', 'auth/reset-password', 'auth/logout-all', 'auth/sessions',
  364 |     'users/1/activate', 'users/1/deactivate', 'audit-logs', 'logs', 'health', 'docs', 'api-docs',
  365 |     'rpz/isps', 'rpz/domains', 'rpz/sync', 'rpz/zones', 'rpz/summary',
  366 |     'auth/login', 'auth/logout', // POST-only: kalau 404 (bukan 405), handler menyamarkan 405 jadi 404
  367 |     'isps?search=Ambon', 'isps?service=rpz_only', 'isps?province=Maluku', 'rpz?method=IXFR', 'rpz?search=Batam',
  368 |     'rpz?as_number=AS990044', 'rpz?sort=last_sync_at', 'isps/1', 'rpz/1',
  369 |   ];
  370 |   for (const p of paths) await call(request, 'DISCOVERY', 'GET', p, { token: admin });
  371 |   for (const p of ['auth/forgot-password', 'auth/reset-password']) await call(request, 'DISCOVERY', 'POST', p, { data: {} });
  372 | });
  373 | 
```