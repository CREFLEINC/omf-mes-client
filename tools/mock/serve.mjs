import { spawn } from 'node:child_process';

import { resolveSpecPath } from './resolve-spec.mjs';

const specPath = resolveSpecPath();
const port = process.env.MOCK_PORT ?? '4010';

console.log(`목 서버 시작: http://127.0.0.1:${port}`);
console.log(`스펙 정본: ${specPath}`);

const prism = spawn(
  'pnpm',
  ['exec', 'prism', 'mock', specPath, '--host', '127.0.0.1', '--port', port],
  { stdio: 'inherit' },
);

prism.on('exit', (code) => {
  process.exit(code ?? 0);
});
