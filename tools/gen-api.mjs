import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveSpecPath } from './mock/resolve-spec.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specPath = resolveSpecPath();
const outPath = path.join(repoRoot, 'packages', 'api-client', 'src', 'generated', 'api.d.ts');

console.log(`타입 생성: ${specPath}`);
console.log(`  → ${outPath}`);

execFileSync('pnpm', ['exec', 'openapi-typescript', specPath, '-o', outPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});
