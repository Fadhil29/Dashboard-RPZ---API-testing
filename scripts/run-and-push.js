const { spawnSync } = require('child_process');

const run = (cmd) => spawnSync(cmd, { stdio: 'inherit', shell: true });

run('npx playwright test'); // exit code diabaikan, test gagal tetap harus di-push
run('git add -A');
run(`git commit -m "run ${new Date().toISOString()}"`);
run('git push origin HEAD');
