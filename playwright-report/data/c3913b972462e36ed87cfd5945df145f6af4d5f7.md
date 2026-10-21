# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rpz.api.spec.ts >> TC_USER_009 hapus user test
- Location: tests\rpz.api.spec.ts:242:5

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 401
Received array: [200, 204]
```

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 401
```

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 401
```

# Test source

```ts
  146 |     ['DELETE', `users/${ghost}`],
  147 |   ];
  148 |   for (const [m, p, data] of calls) {
  149 |     const r = await call(request, 'TC_USER_001', m, p, { token: user, data });
  150 |     expect.soft(r.status, `${m} ${p}`).toBe(403);
  151 |   }
  152 | });
  153 | 
  154 | test('TC_USER_004 mass assignment role', async ({ request }) => {
  155 |   await call(request, 'TC_USER_004', 'PUT', 'users/profile',
  156 |     { token: user, data: { name: 'TEST - QA RPZ', email, role: 'superadmin', is_active: true } });
  157 |   const me = await call(request, 'TC_USER_004', 'GET', 'auth/me', { token: user });
  158 |   expect.soft(JSON.stringify(me.body), 'role tidak boleh berubah').not.toContain('superadmin');
  159 | });
  160 | 
  161 | test('TC_PROF_002 update profil', async ({ request }) => {
  162 |   const same = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
  163 |     { token: user, data: { name: 'TEST - QA RPZ Edit', email } });
  164 |   expect.soft(same.status, 'email sendiri bukan duplikat').toBe(200);
  165 |   const dup = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
  166 |     { token: user, data: { name: 'TEST - QA RPZ Edit', email: ADMIN.email } });
  167 |   expect.soft([409, 422]).toContain(dup.status);
  168 | });
  169 | 
  170 | test('TC_PROF_003/004 ganti password', async ({ request }) => {
  171 |   const url = 'users/profile/password';
  172 |   const t = (data: any) => call(request, 'TC_PROF_003', 'PUT', url, { token: user, data });
  173 |   const wrong = await t({ password: NEW_PASS, current_password: 'Salah123', password_confirmation: NEW_PASS });
  174 |   expect.soft([400, 401, 403, 422], 'current salah').toContain(wrong.status);
  175 |   const mismatch = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: 'Beda123' });
  176 |   expect.soft([400, 422], 'confirmation beda').toContain(mismatch.status);
  177 |   const same = await t({ password: PASS, current_password: PASS, password_confirmation: PASS });
  178 |   expect.soft([400, 422], 'password baru = lama').toContain(same.status);
  179 |   const ok = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: NEW_PASS });
  180 |   expect.soft(ok.status).toBe(200);
  181 | 
  182 |   const old = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: PASS, remember: false } });
  183 |   expect.soft([401, 422], 'password lama harus gagal').toContain(old.status);
  184 |   const oldTok = await call(request, 'TC_PROF_004', 'GET', 'auth/me', { token: user });
  185 |   expect.soft(oldTok.status, 'token lama setelah ganti password (rekomendasi: 401)').toBe(401);
  186 |   const fresh = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false } });
  187 |   expect.soft(fresh.status).toBe(200);
  188 |   user = tok(fresh.body);
  189 | });
  190 | 
  191 | test('TC_AUTH_007/008 refresh', async ({ request }) => {
  192 |   const r = await call(request, 'TC_AUTH_007', 'POST', 'auth/refresh', { token: user });
  193 |   expect.soft(r.status).toBe(200);
  194 |   const next = tok(r.body);
  195 |   expect.soft(next, 'token baru').toBeTruthy();
  196 |   const old = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: user });
  197 |   expect.soft(old.status, 'token lama setelah refresh').toBe(401);
  198 |   const now = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: next });
  199 |   expect.soft(now.status).toBe(200);
  200 |   user = next || user;
  201 | 
  202 |   const par = await Promise.all([1, 2].map(() => call(request, 'TC_AUTH_008', 'POST', 'auth/refresh', { token: user })));
  203 |   par.forEach(p => noServerError(p.status));
  204 |   const re = await call(request, 'TC_AUTH_008', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false } });
  205 |   user = tok(re.body);
  206 | });
  207 | 
  208 | test('TC_AUTH_003 brute force login', async ({ request }) => {
  209 |   test.skip(!process.env.RUN_BRUTE, 'set RUN_BRUTE=1 (akan mengunci akun test)');
  210 |   const codes: number[] = [];
  211 |   for (let i = 0; i < 12; i++) {
  212 |     const r = await call(request, 'TC_AUTH_003', 'POST', 'auth/login', { data: { email, password: `Salah${i}`, remember: false } });
  213 |     codes.push(r.status);
  214 |   }
  215 |   expect.soft(codes, 'harus ada 429/lockout').toContain(429);
  216 | });
  217 | 
  218 | test('TC_AUTH_006 logout invalidate token', async ({ request }) => {
  219 |   const re = await call(request, 'TC_AUTH_006', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false } });
  220 |   const t = tok(re.body) || user;
  221 |   const out = await call(request, 'TC_AUTH_006', 'POST', 'auth/logout', { token: t });
  222 |   expect.soft(out.status).toBe(200);
  223 |   expect.soft((await call(request, 'TC_AUTH_006', 'GET', 'auth/me', { token: t })).status).toBe(401);
  224 |   expect.soft((await call(request, 'TC_AUTH_006', 'POST', 'auth/refresh', { token: t })).status).toBe(401);
  225 | });
  226 | 
  227 | test('TC_GEN_001 format request', async ({ request }) => {
  228 |   const json = { 'Content-Type': 'application/json' };
  229 |   const cases: [string, any][] = [
  230 |     ['malformed', { headers: json, data: '{"email":' }],
  231 |     ['text/plain', { headers: { 'Content-Type': 'text/plain' }, data: JSON.stringify(ADMIN) }],
  232 |     ['wrongTypes', { data: { email: 123, password: ['a'], remember: 'x' } }],
  233 |     ['objects', { data: { email: {}, password: {} } }],
  234 |   ];
  235 |   for (const [k, o] of cases) {
  236 |     const r = await call(request, 'TC_GEN_001', 'POST', 'auth/login', o);
  237 |     expect.soft([400, 415, 422], k).toContain(r.status);
  238 |     expect.soft(r.text, `${k}: bocor detail internal`).not.toMatch(/stack|trace|\.php|exception|vendor\//i);
  239 |   }
  240 | });
  241 | 
  242 | test('TC_USER_009 hapus user test', async ({ request }) => {
  243 |   const d1 = await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin });
  244 |   expect.soft([200, 204]).toContain(d1.status);
  245 |   expect.soft((await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin })).status).toBe(404);
> 246 |   expect.soft((await call(request, 'TC_USER_009', 'GET', `users/${userId}`, { token: admin })).status).toBe(404);
      |                                                                                                        ^ Error: expect(received).toBe(expected) // Object.is equality
  247 |   const login = await call(request, 'TC_USER_009', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false } });
  248 |   expect.soft([401, 422], 'user terhapus tidak boleh login').toContain(login.status);
  249 | });
  250 | 
  251 | test('TC_USER_010 self-delete superadmin', async ({ request }) => {
  252 |   test.skip(!process.env.ALLOW_DESTRUCTIVE, 'set ALLOW_DESTRUCTIVE=1 (bisa menghapus superadmin kalau API tidak memblokir)');
  253 |   const me = await call(request, 'TC_USER_010', 'GET', 'auth/me', { token: admin });
  254 |   const r = await call(request, 'TC_USER_010', 'DELETE', `users/${idOf(me.body)}`, { token: admin });
  255 |   expect.soft(r.status, 'self-delete harus ditolak').toBeGreaterThanOrEqual(400);
  256 | });
  257 | 
  258 | // status 404 = tidak ada; 200/401/403/405/422 = endpoint ada
  259 | test('DISCOVERY endpoint tidak terdokumentasi', async ({ request }) => {
  260 |   const paths = [
  261 |     'isp', 'isps', 'rpz', 'sync', 'sync/status', 'dashboard', 'dashboard/summary', 'domains', 'blocklist',
  262 |     'roles', 'permissions', 'users?search=a', 'users?role=readonly', 'users?sort=name',
  263 |     'auth/forgot-password', 'auth/reset-password', 'auth/logout-all', 'auth/sessions',
  264 |     'users/1/activate', 'users/1/deactivate', 'audit-logs', 'logs', 'health', 'docs', 'api-docs',
  265 |   ];
  266 |   for (const p of paths) await call(request, 'DISCOVERY', 'GET', p, { token: admin });
  267 | });
  268 | 
```