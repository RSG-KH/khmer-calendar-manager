import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['--test', 'tests/browser.test.mjs', 'tests/pages.test.mjs'], {
  stdio: 'inherit', env: { ...process.env, MANAGER_TEST_MODE: 'pages' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
