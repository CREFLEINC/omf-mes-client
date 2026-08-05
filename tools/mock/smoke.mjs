import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { resolveSpecPath } from './resolve-spec.mjs';

const specPath = resolveSpecPath();
const port = process.env.MOCK_PORT ?? '4010';
const baseUrl = `http://127.0.0.1:${port}`;

// 대표 경로 3종 — 리소스 패턴별 하나씩 (마스터 형 · 버전 마스터 형 · 연계 실행).
const REPRESENTATIVE_PATHS = ['/mdm/warehouses', '/planning/routings', '/integration/messages'];

const spec = JSON.parse(readFileSync(specPath, 'utf-8'));

const resolveParameter = (parameter) =>
  '$ref' in parameter
    ? spec.components.parameters[parameter.$ref.split('/').at(-1)]
    : parameter;

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
  spawn('pnpm', ['exec', 'prism', 'mock', specPath, '--host', '127.0.0.1', '--port', port], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

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
