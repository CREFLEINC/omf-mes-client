import { spawn } from 'node:child_process';

import { writeMergedSpec } from '../merge-spec.mjs';
import { resolveSpecPaths } from './resolve-spec.mjs';

const specPaths = resolveSpecPaths();
const port = process.env.MOCK_PORT ?? '4010';

// Prism mock 은 문서 하나만 받는다 — 도메인 계약을 병합해 한 포트에서 함께 서빙한다.
const mergedSpecPath = writeMergedSpec(specPaths);

console.log(`목 서버 시작: http://127.0.0.1:${port}`);
console.log(`스펙 정본 ${specPaths.length}벌:`);
for (const specPath of specPaths) console.log(`  ${specPath}`);
console.log(`병합본: ${mergedSpecPath}`);

const prism = spawn(
  'pnpm',
  ['exec', 'prism', 'mock', mergedSpecPath, '--host', '127.0.0.1', '--port', port],
  { stdio: 'inherit' },
);

prism.on('exit', (code) => {
  process.exit(code ?? 0);
});
