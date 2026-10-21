# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rpz.api.spec.ts >> TC_USER_001 RBAC readonly
- Location: tests\rpz.api.spec.ts:147:5

# Error details

```
Error: PUT users/999999999

expect(received).toBe(expected) // Object.is equality

Expected: 403
Received: 404
```

```
Error: DELETE users/999999999

expect(received).toBe(expected) // Object.is equality

Expected: 403
Received: 404
```

# Test source

```ts
  56  | test('TC_AUTH_005 token tidak valid', async ({ request }) => {
  57  |   const [h = '', p = '', s = 'x'] = admin.split('.');
  58  |   const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  59  |   const tokens: Record<string, string | undefined> = {
  60  |     none: undefined,
  61  |     random: 'abc.def.ghi',
  62  |     tamperedSig: `${h}.${p}.${s.slice(0, -2)}xx`,
  63  |     tamperedPayload: `${h}.${b64({ sub: '1', role: 'superadmin' })}.${s}`,
  64  |     algNone: `${b64({ alg: 'none', typ: 'JWT' })}.${p}.`,
  65  |   };
  66  |   for (const [k, token] of Object.entries(tokens)) {
  67  |     const r = await call(request, 'TC_AUTH_005', 'GET', 'auth/me', { token });
  68  |     expect.soft(r.status, k).toBe(401);
  69  |   }
  70  | });
  71  | 
  72  | test('TC_ROLE_001 options roles', async ({ request }) => {
  73  |   const ok = await call(request, 'TC_ROLE_001', 'GET', 'options/roles', { token: admin });
  74  |   expect.soft(ok.status).toBe(200);
  75  |   const no = await call(request, 'TC_ROLE_001', 'GET', 'options/roles');
  76  |   expect.soft(no.status).toBe(401);
  77  | });
  78  | 
  79  | test('TC_USER_002 create user valid', async ({ request }) => {
  80  |   const r = await call(request, 'TC_USER_002', 'POST', 'users', { token: admin, data: newUser() });
  81  |   expect.soft([200, 201]).toContain(r.status);
  82  |   userId = idOf(r.body);
  83  |   expect.soft(userId, 'id user baru').toBeTruthy();
  84  |   expect.soft(r.text).not.toMatch(/"password"/);
  85  | });
  86  | 
  87  | test('TC_USER_003 validasi create', async ({ request }) => {
  88  |   const bad: Record<string, any> = {
  89  |     dupEmail: { email },
  90  |     dupEmailUpper: { email: email.toUpperCase() },
  91  |     badEmail: { email: 'x' },
  92  |     emptyName: { email: uniq('en'), name: '' },
  93  |     spaceName: { email: uniq('sn'), name: '   ' },
  94  |     longName: { email: uniq('ln'), name: 'A'.repeat(300) },
  95  |     badRole: { email: uniq('br'), role: 'tidak-ada' },
  96  |     shortPass: { email: uniq('sp'), password: 'Ab1', password_confirmation: 'Ab1' },
  97  |     mismatch: { email: uniq('mm'), password_confirmation: 'Beda123' },
  98  |   };
  99  |   for (const [k, o] of Object.entries(bad)) {
  100 |     const r = await call(request, 'TC_USER_003', 'POST', 'users', { token: admin, data: newUser(o) });
  101 |     expect.soft([400, 409, 422], k).toContain(r.status);
  102 |   }
  103 |   const xss = await call(request, 'TC_USER_003', 'POST', 'users',
  104 |     { token: admin, data: newUser({ email: uniq('xss'), name: '<script>alert(1)</script>' }) });
  105 |   noServerError(xss.status); // log only: cek apakah disimpan mentah
  106 |   if (idOf(xss.body)) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(xss.body)}`, { token: admin });
  107 | });
  108 | 
  109 | test('TC_USER_005 create paralel email sama', async ({ request }) => {
  110 |   const e = uniq('dup');
  111 |   const rs = await Promise.all([1, 2].map(() =>
  112 |     call(request, 'TC_USER_005', 'POST', 'users', { token: admin, data: newUser({ email: e }) })));
  113 |   const created = rs.filter(r => [200, 201].includes(r.status));
  114 |   expect.soft(created.length, 'hanya 1 record boleh terbuat').toBe(1);
  115 |   for (const r of created) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(r.body)}`, { token: admin });
  116 | });
  117 | 
  118 | test('TC_USER_006 boundary id', async ({ request }) => {
  119 |   for (const v of [0, -1, 'abc', ghost, '99999999999999999999', encodeURIComponent("1' OR '1'='1")]) {
  120 |     const r = await call(request, 'TC_USER_006', 'GET', `users/${v}`, { token: admin });
  121 |     noServerError(r.status);
  122 |     expect.soft([400, 404, 422], String(v)).toContain(r.status);
  123 |   }
  124 | });
  125 | 
  126 | test('TC_USER_007 list + pagination', async ({ request }) => {
  127 |   const no = await call(request, 'TC_USER_007', 'GET', 'users');
  128 |   expect.soft(no.status).toBe(401);
  129 |   for (const q of ['', 'page=1&per_page=1', 'page=0', 'page=-1', 'page=abc', 'per_page=0', 'per_page=100000', 'page=99999']) {
  130 |     const r = await call(request, 'TC_USER_007', 'GET', `users${q ? '?' + q : ''}`, { token: admin });
  131 |     noServerError(r.status);
  132 |   }
  133 | });
  134 | 
  135 | test('TC_PROF_001 route /users/profile vs /users/:id', async ({ request }) => {
  136 |   const r = await call(request, 'TC_PROF_001', 'GET', 'users/profile', { token: admin });
  137 |   expect.soft(r.status).toBe(200);
  138 |   expect.soft(r.text).toContain(ADMIN.email);
  139 | });
  140 | 
  141 | test('login user test (readonly)', async ({ request }) => {
  142 |   const r = await call(request, 'TC_AUTH_001b', 'POST', 'auth/login', { data: { email, password: PASS, remember: false, recaptcha_token: RC } });
  143 |   expect.soft(r.status).toBe(200);
  144 |   user = tok(r.body) || user;
  145 | });
  146 | 
  147 | test('TC_USER_001 RBAC readonly', async ({ request }) => {
  148 |   const calls: [string, string, any?][] = [
  149 |     ['GET', 'users'],
  150 |     ['POST', 'users', newUser({ email: uniq('rbac') })],
  151 |     ['PUT', `users/${ghost}`, newUser()],
  152 |     ['DELETE', `users/${ghost}`],
  153 |   ];
  154 |   for (const [m, p, data] of calls) {
  155 |     const r = await call(request, 'TC_USER_001', m, p, { token: user, data });
> 156 |     expect.soft(r.status, `${m} ${p}`).toBe(403);
      |                                        ^ Error: DELETE users/999999999
  157 |   }
  158 | });
  159 | 
  160 | test('TC_USER_004 mass assignment role', async ({ request }) => {
  161 |   await call(request, 'TC_USER_004', 'PUT', 'users/profile',
  162 |     { token: user, data: { name: 'TEST - QA RPZ', email, role: 'superadmin', is_active: true } });
  163 |   const me = await call(request, 'TC_USER_004', 'GET', 'auth/me', { token: user });
  164 |   expect.soft(JSON.stringify(me.body), 'role tidak boleh berubah').not.toContain('superadmin');
  165 | });
  166 | 
  167 | test('TC_PROF_002 update profil', async ({ request }) => {
  168 |   const same = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
  169 |     { token: user, data: { name: 'TEST - QA RPZ Edit', email } });
  170 |   expect.soft(same.status, 'email sendiri bukan duplikat').toBe(200);
  171 |   const dup = await call(request, 'TC_PROF_002', 'PUT', 'users/profile',
  172 |     { token: user, data: { name: 'TEST - QA RPZ Edit', email: ADMIN.email } });
  173 |   expect.soft([409, 422]).toContain(dup.status);
  174 | });
  175 | 
  176 | test('TC_PROF_003/004 ganti password', async ({ request }) => {
  177 |   const url = 'users/profile/password';
  178 |   const t = (data: any) => call(request, 'TC_PROF_003', 'PUT', url, { token: user, data });
  179 |   const wrong = await t({ password: NEW_PASS, current_password: 'Salah123', password_confirmation: NEW_PASS });
  180 |   expect.soft([400, 401, 403, 422], 'current salah').toContain(wrong.status);
  181 |   const mismatch = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: 'Beda123' });
  182 |   expect.soft([400, 422], 'confirmation beda').toContain(mismatch.status);
  183 |   const same = await t({ password: PASS, current_password: PASS, password_confirmation: PASS });
  184 |   expect.soft([400, 422], 'password baru = lama').toContain(same.status);
  185 |   const ok = await t({ password: NEW_PASS, current_password: PASS, password_confirmation: NEW_PASS });
  186 |   expect.soft(ok.status).toBe(200);
  187 | 
  188 |   const old = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: PASS, remember: false, recaptcha_token: RC } });
  189 |   expect.soft([401, 422], 'password lama harus gagal').toContain(old.status);
  190 |   const oldTok = await call(request, 'TC_PROF_004', 'GET', 'auth/me', { token: user });
  191 |   expect.soft(oldTok.status, 'token lama setelah ganti password (rekomendasi: 401)').toBe(401);
  192 |   const fresh = await call(request, 'TC_PROF_003', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  193 |   expect.soft(fresh.status).toBe(200);
  194 |   user = tok(fresh.body);
  195 | });
  196 | 
  197 | test('TC_AUTH_007/008 refresh', async ({ request }) => {
  198 |   const r = await call(request, 'TC_AUTH_007', 'POST', 'auth/refresh', { token: user });
  199 |   expect.soft(r.status).toBe(200);
  200 |   const next = tok(r.body);
  201 |   expect.soft(next, 'token baru').toBeTruthy();
  202 |   const old = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: user });
  203 |   expect.soft(old.status, 'token lama setelah refresh').toBe(401);
  204 |   const now = await call(request, 'TC_AUTH_007', 'GET', 'auth/me', { token: next });
  205 |   expect.soft(now.status).toBe(200);
  206 |   user = next || user;
  207 | 
  208 |   const par = await Promise.all([1, 2].map(() => call(request, 'TC_AUTH_008', 'POST', 'auth/refresh', { token: user })));
  209 |   par.forEach(p => noServerError(p.status));
  210 |   const re = await call(request, 'TC_AUTH_008', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  211 |   user = tok(re.body);
  212 | });
  213 | 
  214 | test('TC_AUTH_003 brute force login', async ({ request }) => {
  215 |   test.skip(!process.env.RUN_BRUTE, 'set RUN_BRUTE=1 (akan mengunci akun test)');
  216 |   const codes: number[] = [];
  217 |   for (let i = 0; i < 12; i++) {
  218 |     const r = await call(request, 'TC_AUTH_003', 'POST', 'auth/login', { data: { email, password: `Salah${i}`, remember: false, recaptcha_token: RC } });
  219 |     codes.push(r.status);
  220 |   }
  221 |   expect.soft(codes, 'harus ada 429/lockout').toContain(429);
  222 | });
  223 | 
  224 | test('TC_AUTH_006 logout invalidate token', async ({ request }) => {
  225 |   const re = await call(request, 'TC_AUTH_006', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  226 |   const t = tok(re.body) || user;
  227 |   const out = await call(request, 'TC_AUTH_006', 'POST', 'auth/logout', { token: t });
  228 |   expect.soft(out.status).toBe(200);
  229 |   expect.soft((await call(request, 'TC_AUTH_006', 'GET', 'auth/me', { token: t })).status).toBe(401);
  230 |   expect.soft((await call(request, 'TC_AUTH_006', 'POST', 'auth/refresh', { token: t })).status).toBe(401);
  231 | });
  232 | 
  233 | test('TC_GEN_001 format request', async ({ request }) => {
  234 |   const json = { 'Content-Type': 'application/json' };
  235 |   const cases: [string, any][] = [
  236 |     ['malformed', { headers: json, data: '{"email":' }],
  237 |     ['text/plain', { headers: { 'Content-Type': 'text/plain' }, data: JSON.stringify(ADMIN) }],
  238 |     ['wrongTypes', { data: { email: 123, password: ['a'], remember: 'x' } }],
  239 |     ['objects', { data: { email: {}, password: {} } }],
  240 |   ];
  241 |   for (const [k, o] of cases) {
  242 |     const r = await call(request, 'TC_GEN_001', 'POST', 'auth/login', o);
  243 |     expect.soft([400, 415, 422], k).toContain(r.status);
  244 |     expect.soft(r.text, `${k}: bocor detail internal`).not.toMatch(/stack|trace|\.php|exception|vendor\//i);
  245 |   }
  246 | });
  247 | 
  248 | test('TC_USER_009 hapus user test', async ({ request }) => {
  249 |   const d1 = await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin });
  250 |   expect.soft([200, 204]).toContain(d1.status);
  251 |   expect.soft((await call(request, 'TC_USER_009', 'DELETE', `users/${userId}`, { token: admin })).status).toBe(404);
  252 |   expect.soft((await call(request, 'TC_USER_009', 'GET', `users/${userId}`, { token: admin })).status).toBe(404);
  253 |   const login = await call(request, 'TC_USER_009', 'POST', 'auth/login', { data: { email, password: NEW_PASS, remember: false, recaptcha_token: RC } });
  254 |   expect.soft([401, 422], 'user terhapus tidak boleh login').toContain(login.status);
  255 | });
  256 | 
```