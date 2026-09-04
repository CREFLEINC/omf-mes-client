import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GENERATED_TYPES_PATH, checkGeneratedBoundary } from './check-generated-boundary.mjs';
import { writeMergedSpec } from './merge-spec.mjs';
import { resolveSpecPaths } from './mock/resolve-spec.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specPaths = resolveSpecPaths();
const outPath = GENERATED_TYPES_PATH;
const openapiTypescriptCli = path.join(repoRoot, 'node_modules/openapi-typescript/bin/cli.js');

console.log(`타입 생성: 계약 ${specPaths.length}벌`);
for (const specPath of specPaths) console.log(`  ${specPath}`);

// 도메인마다 계약 파일이 갈려 있고 openapi-typescript 는 문서 하나만 받는다 — 병합본을 만들어 넘긴다.
const mergedSpecPath = writeMergedSpec(specPaths);
console.log(`  병합본 → ${mergedSpecPath}`);
console.log(`  → ${outPath}`);

/*
 * OpenAPI의 `required`가 요청 필수 여부의 정본이다. openapi-typescript 기본값은 `default`가
 * 붙은 선택 속성도 필수 TypeScript 키로 승격한다. 그러면 "생략 시 서버 기본값"인 계약이
 * "클라이언트가 반드시 전송"으로 바뀌므로 그 추론을 끈다.
 */
execFileSync(
  process.execPath,
  [openapiTypescriptCli, mergedSpecPath, '--default-non-nullable', 'false', '-o', outPath],
  {
    cwd: repoRoot,
    stdio: 'inherit',
  },
);

// 생성 직후 검사한다. package.json 이 아니라 여기서 부르는 이유는
// `node tools/gen-api.mjs` 를 직접 실행해도 검사를 건너뛸 수 없게 하기 위해서다.
if (!checkGeneratedBoundary(outPath)) {
  process.exitCode = 1;
}
