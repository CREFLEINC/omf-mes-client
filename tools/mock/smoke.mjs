import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeMergedSpec } from '../merge-spec.mjs';
import { resolveSpecPaths } from './resolve-spec.mjs';

const specPaths = resolveSpecPaths();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const prismCli = path.join(repoRoot, 'node_modules/@stoplight/prism-cli/dist/index.js');
// 서빙과 같은 병합본을 검사한다 — 병합이 깨지면 여기서 먼저 드러나야 한다.
const mergedSpecPath = writeMergedSpec(specPaths);
const port = process.env.MOCK_PORT ?? '4010';
const baseUrl = `http://127.0.0.1:${port}`;

// 대표 경로 9종 — 리소스 패턴별 하나씩 (마스터 형 · 버전 마스터 형 · 연계 실행) + 첫 벌 외 계약 벌마다 하나.
// 뒤의 여섯은 계약 벌을 대표한다 — 계약 벌이 하나라도 병합본에서 빠지면 여기서 먼저 드러난다.
// **계약이 늘면 이 목록에도 한 줄을 더한다.** 배열에만 더하고 여기를 잊으면 새 계약이 조용히
// 빠져도 스모크가 통과한다 — 그 침묵이 이 목록이 막으려는 것이다.
const REPRESENTATIVE_PATHS = [
  '/mdm/warehouses',
  '/planning/routings',
  '/integration/messages',
  '/logistics/asns', // 2 자재창고
  '/app/approval-routes', // 3 공통
  '/planning/production-orders', // 4 생산실행
  '/quality/defect-records', // 5 품질
  '/logistics/shipments', // 6 제품출하
  '/maintenance/breakdowns', // 7 설비툴
];

const spec = JSON.parse(readFileSync(mergedSpecPath, 'utf-8'));

const resolveParameter = (parameter) =>
  '$ref' in parameter ? spec.components.parameters[parameter.$ref.split('/').at(-1)] : parameter;

// 필수 쿼리 파라미터를 계약에서 읽어 형식에 맞는 고정값으로 채운다 — 경로별 지식을 하드코딩하지 않는다.
const sampleValue = (name, schema) => {
  if (schema?.format === 'date-time') {
    return name.endsWith('To') ? '2026-12-31T23:59:59Z' : '2026-01-01T00:00:00Z';
  }
  if (schema?.type === 'integer') return '1';
  if (schema?.type === 'boolean') return 'false';
  return 'SMOKE';
};

const requiredQueryString = (path) => {
  const parameters = (spec.paths[path]?.get?.parameters ?? []).map(resolveParameter);
  const query = new URLSearchParams();
  for (const parameter of parameters) {
    if (parameter.in === 'query' && parameter.required === true) {
      query.set(parameter.name, sampleValue(parameter.name, parameter.schema));
    }
  }
  const queryString = query.toString();
  return queryString === '' ? '' : `?${queryString}`;
};

const startPrism = () =>
  spawn(
    process.execPath,
    [prismCli, 'mock', mergedSpecPath, '--host', '127.0.0.1', '--port', port],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

const waitUntilReady = async (timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`목 서버가 ${timeoutMs / 1000}초 안에 응답하지 않습니다`);
};

const checkPath = async (path) => {
  if (!spec.paths[path]?.get) {
    return { path, ok: false, detail: '계약에 GET이 없음 — 대표 경로 목록을 갱신하라' };
  }
  const url = `${baseUrl}${path}${requiredQueryString(path)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    return { path, ok: false, detail: `HTTP ${response.status}` };
  }
  const body = await response.json();
  if (body === null || typeof body !== 'object') {
    return { path, ok: false, detail: '응답이 JSON 객체가 아님' };
  }
  return { path, ok: true, detail: `${response.status}` };
};

const checkUnknownPathRejected = async () => {
  const response = await fetch(`${baseUrl}/definitely-not-a-path`, {
    signal: AbortSignal.timeout(10_000),
  });
  return {
    path: '/definitely-not-a-path (미정의 경로 거부)',
    ok: !response.ok,
    detail: `HTTP ${response.status}`,
  };
};

const prism = startPrism();
let stderrBuffer = '';
prism.stderr.on('data', (chunk) => {
  stderrBuffer += chunk;
});

try {
  await waitUntilReady(60_000);

  const results = [...(await Promise.all(REPRESENTATIVE_PATHS.map(checkPath)))];
  results.push(await checkUnknownPathRejected());

  let failed = 0;
  for (const { path, ok, detail } of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${path}  (${detail})`);
    if (!ok) failed += 1;
  }

  if (failed > 0) {
    console.error(`\nsmoke 실패: ${failed}건`);
    process.exitCode = 1;
  } else {
    console.log(`\nsmoke 통과: ${results.length}건 전건`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  if (stderrBuffer) console.error(stderrBuffer);
  process.exitCode = 1;
} finally {
  prism.kill();
}
