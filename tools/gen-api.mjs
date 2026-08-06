import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GENERATED_TYPES_PATH, checkGeneratedBoundary } from './check-generated-boundary.mjs';
import { resolveSpecPath } from './mock/resolve-spec.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specPath = resolveSpecPath();
const outPath = GENERATED_TYPES_PATH;

console.log(`타입 생성: ${specPath}`);
console.log(`  → ${outPath}`);

execFileSync('pnpm', ['exec', 'openapi-typescript', specPath, '-o', outPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

// 생성 직후 검사한다. package.json 이 아니라 여기서 부르는 이유는
// `node tools/gen-api.mjs` 를 직접 실행해도 검사를 건너뛸 수 없게 하기 위해서다.
if (!checkGeneratedBoundary(outPath)) {
  process.exitCode = 1;
}
