# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rpz.api.spec.ts >> TC_USER_001 RBAC readonly
- Location: tests\rpz.api.spec.ts:155:5

# Error details

```
Error: PUT users/00000000-0000-7000-8000-000000000000

expect(received).toBe(expected) // Object.is equality

Expected: 403
Received: 404
```

```
Error: DELETE users/00000000-0000-7000-8000-000000000000

expect(received).toBe(expected) // Object.is equality

Expected: 403
Received: 404
```

# Test source

```ts
  66  |   };
  67  |   for (const [k, token] of Object.entries(tokens)) {
  68  |     const r = await call(request, 'TC_AUTH_005', 'GET', 'auth/me', { token });
  69  |     expect.soft(r.status, k).toBe(401);
  70  |   }
  71  | });
  72  | 
  73  | test('TC_ROLE_001 options roles', async ({ request }) => {
  74  |   const ok = await call(request, 'TC_ROLE_001', 'GET', 'options/roles', { token: admin });
  75  |   expect.soft(ok.status).toBe(200);
  76  |   const no = await call(request, 'TC_ROLE_001', 'GET', 'options/roles');
  77  |   expect.soft(no.status).toBe(401);
  78  | });
  79  | 
  80  | test('TC_USER_002 create user valid', async ({ request }) => {
  81  |   const r = await call(request, 'TC_USER_002', 'POST', 'users', { token: admin, data: newUser() });
  82  |   expect.soft([200, 201]).toContain(r.status);
  83  |   userId = idOf(r.body);
  84  |   expect.soft(userId, 'id user baru').toBeTruthy();
  85  |   expect.soft(r.text).not.toMatch(/"password"/);
  86  | });
  87  | 
  88  | test('TC_USER_002b buat victim user', async ({ request }) => {
  89  |   const r = await call(request, 'TC_PROF_005', 'POST', 'users',
  90  |     { token: admin, data: newUser({ name: 'TEST - QA RPZ Victim', email: uniq('victim') }) });
  91  |   expect.soft([200, 201]).toContain(r.status);
  92  |   victimId = idOf(r.body);
  93  | });
  94  | 
  95  | test('TC_USER_003 validasi create', async ({ request }) => {
  96  |   const bad: Record<string, any> = {
  97  |     dupEmail: { email },
  98  |     dupEmailUpper: { email: email.toUpperCase() },
  99  |     badEmail: { email: 'x' },
  100 |     emptyName: { email: uniq('en'), name: '' },
  101 |     spaceName: { email: uniq('sn'), name: '   ' },
  102 |     longName: { email: uniq('ln'), name: 'A'.repeat(300) },
  103 |     badRole: { email: uniq('br'), role: 'tidak-ada' },
  104 |     shortPass: { email: uniq('sp'), password: 'Ab1', password_confirmation: 'Ab1' },
  105 |     mismatch: { email: uniq('mm'), password_confirmation: 'Beda123' },
  106 |   };
  107 |   for (const [k, o] of Object.entries(bad)) {
  108 |     const r = await call(request, 'TC_USER_003', 'POST', 'users', { token: admin, data: newUser(o) });
  109 |     expect.soft([400, 409, 422], k).toContain(r.status);
  110 |   }
  111 |   const xss = await call(request, 'TC_USER_003', 'POST', 'users',
  112 |     { token: admin, data: newUser({ email: uniq('xss'), name: '<script>alert(1)</script>' }) });
  113 |   noServerError(xss.status); // log only: cek apakah disimpan mentah
  114 |   if (idOf(xss.body)) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(xss.body)}`, { token: admin });
  115 | });
  116 | 
  117 | test('TC_USER_005 create paralel email sama', async ({ request }) => {
  118 |   const e = uniq('dup');
  119 |   const rs = await Promise.all([1, 2].map(() =>
  120 |     call(request, 'TC_USER_005', 'POST', 'users', { token: admin, data: newUser({ email: e }) })));
  121 |   const created = rs.filter(r => [200, 201].includes(r.status));
  122 |   expect.soft(created.length, 'hanya 1 record boleh terbuat').toBe(1);
  123 |   for (const r of created) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(r.body)}`, { token: admin });
  124 | });
  125 | 
  126 | test('TC_USER_006 boundary id', async ({ request }) => {
  127 |   for (const v of [0, -1, 'abc', ghost, '99999999999999999999', encodeURIComponent("1' OR '1'='1")]) {
  128 |     const r = await call(request, 'TC_USER_006', 'GET', `users/${v}`, { token: admin });
  129 |     noServerError(r.status);
  130 |     expect.soft([400, 404, 422], String(v)).toContain(r.status);
  131 |   }
  132 | });
  133 | 
  134 | test('TC_USER_007 list + pagination', async ({ request }) => {
  135 |   const no = await call(request, 'TC_USER_007', 'GET', 'users');
  136 |   expect.soft(no.status).toBe(401);
  137 |   for (const q of ['', 'page=1&per_page=1', 'page=0', 'page=-1', 'page=abc', 'per_page=0', 'per_page=100000', 'page=99999']) {
  138 |     const r = await call(request, 'TC_USER_007', 'GET', `users${q ? '?' + q : ''}`, { token: admin });
  139 |     noServerError(r.status);
  140 |   }
  141 | });
  142 | 
  143 | test('TC_PROF_001 route /users/profile vs /users/:id', async ({ request }) => {
  144 |   const r = await call(request, 'TC_PROF_001', 'GET', 'users/profile', { token: admin });
  145 |   expect.soft(r.status).toBe(200);
  146 |   expect.soft(r.text).toContain(ADMIN.email);
  147 | });
  148 | 
  149 | test('login user test (readonly)', async ({ request }) => {
  150 |   const r = await call(request, 'TC_AUTH_001b', 'POST', 'auth/login', { data: { email, password: PASS, remember: false, recaptcha_token: RC } });
  151 |   expect.soft(r.status).toBe(200);
  152 |   user = tok(r.body) || user;
  153 | });
  154 | 
  155 | test('TC_USER_001 RBAC readonly', async ({ request }) => {
  156 |   const calls: [string, string, any?][] = [
  157 |     ['GET', 'users'],
  158 |     ['POST', 'users', newUser({ email: uniq('rbac') })],
  159 |     ['PUT', `users/${victimId}`, { name: 'HACKED', role: 'readonly', email: uniq('hacked'), password: PASS, password_confirmation: PASS }],
  160 |     ['DELETE', `users/${victimId}`],
  161 |     ['PUT', `users/${ghost}`, newUser()],
  162 |     ['DELETE', `users/${ghost}`],
  163 |   ];
  164 |   for (const [m, p, data] of calls) {
  165 |     const r = await call(request, 'TC_USER_001', m, p, { token: user, data });
> 166 |     expect.soft(r.status, `${m} ${p}`).toBe(403);
      |                                        ^ Error: DELETE users/00000000-0000-7000-8000-000000000000
  167 |   }
  168 |   const v = await call(request, 'TC_PROF_005', 'GET', `users/${victimId}`, { token: admin });
  169 |   expect.soft(v.status, 'victim masih ada').toBe(200);
  170 |   expect.soft(v.body?.data?.name, 'victim tidak berubah').toBe('TEST - QA RPZ Victim');
  171 | });
  172 | 
  173 | test('TC_RBAC readonly akses isps/rpz (informasional)', async ({ request }) => {
  174 |   for (const p of ['isps', 'rpz', 'rpz/summary']) {
  175 |     const r = await call(request, 'TC_RBAC_DATA', 'GET', p, { token: user });
  176 |     noServerError(r.status);
  177 |   }
  178 | });
  179 | 
  180 | test('TC_USER_004 mass assignment role', async ({ request }) => {
  181 |   await call(request, 'TC_USER_004', 'PUT', 'users/profile',
  182 |     { token: user, data: { name: 'TEST - QA RPZ', email, role: 'superadmin', is_active: true } });
  183 |   const me = await call(request, 'TC_USER_004', 'GET', 'auth/me', { token: user });
  184 |   expect.soft(JSON.stringify(me.body), 'role tidak boleh berubah').not.toContain('superadmin');
  185 | });
  186 | 
  187 | test('TC_PROF_002 update profil', async ({ request }) => {
  188 |   const same = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
  189 |     { token: user, data: { name: 'TEST - QA RPZ Edit', email } });
  190 |   expect.soft(same.status, 'email sendiri bukan duplikat').toBe(200);
  191 |   const dup = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
  192 |     { token: user, data: { name: 'TEST - QA RPZ Edit', email: ADMIN.email } });
  193 |   expect.soft([409, 422]).toContain(dup.status);
  194 | });
  195 | 
  196 | test('TC_PROF_003/004 ganti password', async ({ request }) => {
  197 |   const url = 'users/profile/password';
  198 |   const t = (data: any) => call(request, 'TC_PROF_003', 'PUT', url, { token: user, data });
  199 |   const wrong = await t({ password: NEW_PASS, current_password: 'Salah123', password_confirmation: NEW_PASS });
  200 |   expect.soft([400, 401, 403, 422], 'current salah').toContain(wrong.status);
  201 |   const mismatch = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: 'Beda123' });
  202 |   expect.soft([400, 422], 'confirmation beda').toContain(mismatch.status);
  203 |   const same = await t({ password: PASS, current_password: PASS, password_confirmation: PASS });
  204 |   expect.soft([400, 422], 'password baru = lama').toContain(same.status);
  205 |   const ok = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: NEW_PASS });
  206 |   expect.soft(ok.status).toBe(200);
  207 | 
  208 |   const old = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: PASS, remember: false, recaptcha_token: RC } });
  209 |   expect.soft([401, 422], 'password lama harus gagal').toContain(old.status);
  210 |   const oldTok = await call(request, 'TC_PROF_004', 'GET', 'auth/me', { token: user });
  211 |   expect.soft(oldTok.status, 'token lama setelah ganti password (rekomendasi: 401)').toBe(401);
  212 |   const fresh = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  213 |   expect.soft(fresh.status).toBe(200);
  214 |   user = tok(fresh.body);
  215 | });
  216 | 
  217 | test('TC_AUTH_007/008 refresh', async ({ request }) => {
  218 |   const r = await call(request, 'TC_AUTH_007', 'POST', 'auth/refresh', { token: user });
  219 |   expect.soft(r.status).toBe(200);
  220 |   const next = tok(r.body);
  221 |   expect.soft(next, 'token baru').toBeTruthy();
  222 |   const old = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: user });
  223 |   expect.soft(old.status, 'token lama setelah refresh').toBe(401);
  224 |   const now = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: next });
  225 |   expect.soft(now.status).toBe(200);
  226 |   user = next || user;
  227 | 
  228 |   const par = await Promise.all([1, 2].map(() => call(request, 'TC_AUTH_008', 'POST', 'auth/refresh', { token: user })));
  229 |   par.forEach(p => noServerError(p.status));
  230 |   const re = await call(request, 'TC_AUTH_008', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  231 |   user = tok(re.body);
  232 | });
  233 | 
  234 | test('TC_AUTH_003 brute force login', async ({ request }) => {
  235 |   test.skip(!process.env.RUN_BRUTE, 'set RUN_BRUTE=1 (akan mengunci akun test)');
  236 |   const codes: number[] = [];
  237 |   for (let i = 0; i < 12; i++) {
  238 |     const r = await call(request, 'TC_AUTH_003', 'POST', 'auth/login', { data: { email, password: `Salah${i}`, remember: false, recaptcha_token: RC } });
  239 |     codes.push(r.status);
  240 |   }
  241 |   expect.soft(codes, 'harus ada 429/lockout').toContain(429);
  242 | });
  243 | 
  244 | test('TC_AUTH_004 efek remember pada masa berlaku token', async ({ request }) => {
  245 |   const login = (remember: boolean) => call(request, 'TC_AUTH_004', 'POST', 'auth/login',
  246 |     { data: { email, password: NEW_PASS, remember, recaptcha_token: RC } });
  247 |   const a = await login(false);
  248 |   const b = await login(true);
  249 |   const ttl = (r: any) => r.body?.data?.expires_in;
  250 |   expect.soft(ttl(b), `remember=true (${ttl(b)}) harus lebih lama dari false (${ttl(a)})`).toBeGreaterThan(ttl(a));
  251 |   user = tok(b.body) || user;
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
```