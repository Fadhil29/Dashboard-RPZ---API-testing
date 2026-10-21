# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: rpz.api.spec.ts >> TC_USER_002 create user valid
- Location: tests\rpz.api.spec.ts:73:5

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 401
Received array: [200, 201]
```

```
Error: id user baru

expect(received).toBeTruthy()

Received: undefined
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { call } from './helper';
  3   | 
  4   | const ADMIN = { email: process.env.ADMIN_EMAIL!, password: process.env.ADMIN_PASS!, remember: false };
  5   | const PASS = 'Password123';
  6   | const NEW_PASS = 'PasswordBaru123';
  7   | const stamp = Date.now();
  8   | const email = `qa.rpz.${stamp}@komdigi.go.id`;
  9   | const ghost = 999999999;
  10  | let admin = '';
  11  | let user = '';
  12  | let userId: any;
  13  | 
  14  | const tok = (b: any) => b?.token ?? b?.access_token ?? b?.data?.token ?? b?.data?.access_token ?? '';
  15  | const idOf = (b: any) => b?.data?.id ?? b?.id;
  16  | const newUser = (o: any = {}) => ({
  17  |   name: 'TEST - QA RPZ', role: 'readonly', email, password: PASS, password_confirmation: PASS, ...o,
  18  | });
  19  | const noServerError = (s: number) => expect.soft(s, 'tidak boleh 5xx').toBeLessThan(500);
  20  | const uniq = (k: string) => `qa.${k}.${stamp}@komdigi.go.id`;
  21  | 
  22  | test('TC_AUTH_001 login valid', async ({ request }) => {
  23  |   const r = await call(request, 'TC_AUTH_001', 'POST', 'auth/login', { data: ADMIN });
  24  |   expect.soft(r.status).toBe(200);
  25  |   admin = tok(r.body);
  26  |   expect.soft(admin, 'token ada').toBeTruthy();
  27  |   expect.soft(r.text).not.toContain(ADMIN.password);
  28  |   expect.soft(r.text).not.toMatch(/"password"/);
  29  | });
  30  | 
  31  | test('TC_AUTH_002 login invalid + user enumeration', async ({ request }) => {
  32  |   const cases: Record<string, any> = {
  33  |     wrongPass: { ...ADMIN, password: 'Salah123' },
  34  |     unknownEmail: { ...ADMIN, email: 'nobody.xyz@komdigi.go.id' },
  35  |     empty: {},
  36  |     spaces: { email: '   ', password: '   ' },
  37  |     badEmail: { ...ADMIN, email: 'bukan-email' },
  38  |     nulls: { email: null, password: null },
  39  |     rememberString: { ...ADMIN, remember: 'abc' },
  40  |   };
  41  |   const res: Record<string, any> = {};
  42  |   for (const [k, data] of Object.entries(cases)) {
  43  |     res[k] = await call(request, 'TC_AUTH_002', 'POST', 'auth/login', { data });
  44  |     expect.soft([400, 401, 422], k).toContain(res[k].status);
  45  |   }
  46  |   expect.soft(JSON.stringify(res.wrongPass.body?.message), 'pesan email salah vs password salah harus sama')
  47  |     .toBe(JSON.stringify(res.unknownEmail.body?.message));
  48  | });
  49  | 
  50  | test('TC_AUTH_005 token tidak valid', async ({ request }) => {
  51  |   const [h = '', p = '', s = 'x'] = admin.split('.');
  52  |   const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  53  |   const tokens: Record<string, string | undefined> = {
  54  |     none: undefined,
  55  |     random: 'abc.def.ghi',
  56  |     tamperedSig: `${h}.${p}.${s.slice(0, -2)}xx`,
  57  |     tamperedPayload: `${h}.${b64({ sub: '1', role: 'superadmin' })}.${s}`,
  58  |     algNone: `${b64({ alg: 'none', typ: 'JWT' })}.${p}.`,
  59  |   };
  60  |   for (const [k, token] of Object.entries(tokens)) {
  61  |     const r = await call(request, 'TC_AUTH_005', 'GET', 'auth/me', { token });
  62  |     expect.soft(r.status, k).toBe(401);
  63  |   }
  64  | });
  65  | 
  66  | test('TC_ROLE_001 options roles', async ({ request }) => {
  67  |   const ok = await call(request, 'TC_ROLE_001', 'GET', 'options/roles', { token: admin });
  68  |   expect.soft(ok.status).toBe(200);
  69  |   const no = await call(request, 'TC_ROLE_001', 'GET', 'options/roles');
  70  |   expect.soft(no.status).toBe(401);
  71  | });
  72  | 
  73  | test('TC_USER_002 create user valid', async ({ request }) => {
  74  |   const r = await call(request, 'TC_USER_002', 'POST', 'users', { token: admin, data: newUser() });
  75  |   expect.soft([200, 201]).toContain(r.status);
  76  |   userId = idOf(r.body);
> 77  |   expect.soft(userId, 'id user baru').toBeTruthy();
      |                                       ^ Error: id user baru
  78  |   expect.soft(r.text).not.toMatch(/"password"/);
  79  | });
  80  | 
  81  | test('TC_USER_003 validasi create', async ({ request }) => {
  82  |   const bad: Record<string, any> = {
  83  |     dupEmail: { email },
  84  |     dupEmailUpper: { email: email.toUpperCase() },
  85  |     badEmail: { email: 'x' },
  86  |     emptyName: { email: uniq('en'), name: '' },
  87  |     spaceName: { email: uniq('sn'), name: '   ' },
  88  |     longName: { email: uniq('ln'), name: 'A'.repeat(300) },
  89  |     badRole: { email: uniq('br'), role: 'tidak-ada' },
  90  |     shortPass: { email: uniq('sp'), password: 'Ab1', password_confirmation: 'Ab1' },
  91  |     mismatch: { email: uniq('mm'), password_confirmation: 'Beda123' },
  92  |   };
  93  |   for (const [k, o] of Object.entries(bad)) {
  94  |     const r = await call(request, 'TC_USER_003', 'POST', 'users', { token: admin, data: newUser(o) });
  95  |     expect.soft([400, 409, 422], k).toContain(r.status);
  96  |   }
  97  |   const xss = await call(request, 'TC_USER_003', 'POST', 'users',
  98  |     { token: admin, data: newUser({ email: uniq('xss'), name: '<script>alert(1)</script>' }) });
  99  |   noServerError(xss.status); // log only: cek apakah disimpan mentah
  100 |   if (idOf(xss.body)) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(xss.body)}`, { token: admin });
  101 | });
  102 | 
  103 | test('TC_USER_005 create paralel email sama', async ({ request }) => {
  104 |   const e = uniq('dup');
  105 |   const rs = await Promise.all([1, 2].map(() =>
  106 |     call(request, 'TC_USER_005', 'POST', 'users', { token: admin, data: newUser({ email: e }) })));
  107 |   const created = rs.filter(r => [200, 201].includes(r.status));
  108 |   expect.soft(created.length, 'hanya 1 record boleh terbuat').toBe(1);
  109 |   for (const r of created) await call(request, 'CLEANUP', 'DELETE', `users/${idOf(r.body)}`, { token: admin });
  110 | });
  111 | 
  112 | test('TC_USER_006 boundary id', async ({ request }) => {
  113 |   for (const v of [0, -1, 'abc', ghost, '99999999999999999999', encodeURIComponent("1' OR '1'='1")]) {
  114 |     const r = await call(request, 'TC_USER_006', 'GET', `users/${v}`, { token: admin });
  115 |     noServerError(r.status);
  116 |     expect.soft([400, 404, 422], String(v)).toContain(r.status);
  117 |   }
  118 | });
  119 | 
  120 | test('TC_USER_007 list + pagination', async ({ request }) => {
  121 |   const no = await call(request, 'TC_USER_007', 'GET', 'users');
  122 |   expect.soft(no.status).toBe(401);
  123 |   for (const q of ['', 'page=1&per_page=1', 'page=0', 'page=-1', 'page=abc', 'per_page=0', 'per_page=100000', 'page=99999']) {
  124 |     const r = await call(request, 'TC_USER_007', 'GET', `users${q ? '?' + q : ''}`, { token: admin });
  125 |     noServerError(r.status);
  126 |   }
  127 | });
  128 | 
  129 | test('TC_PROF_001 route /users/profile vs /users/:id', async ({ request }) => {
  130 |   const r = await call(request, 'TC_PROF_001', 'GET', 'users/profile', { token: admin });
  131 |   expect.soft(r.status).toBe(200);
  132 |   expect.soft(r.text).toContain(ADMIN.email);
  133 | });
  134 | 
  135 | test('login user test (readonly)', async ({ request }) => {
  136 |   const r = await call(request, 'TC_AUTH_001b', 'POST', 'auth/login', { data: { email, password: PASS, remember: false } });
  137 |   expect.soft(r.status).toBe(200);
  138 |   user = tok(r.body);
  139 | });
  140 | 
  141 | test('TC_USER_001 RBAC readonly', async ({ request }) => {
  142 |   const calls: [string, string, any?][] = [
  143 |     ['GET', 'users'],
  144 |     ['POST', 'users', newUser({ email: uniq('rbac') })],
  145 |     ['PUT', `users/${ghost}`, newUser()],
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
```