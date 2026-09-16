import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/*
 * 관리웹 컨테이너 nginx 는 `/api/` 를 백엔드로 넘기는 길목이라 **첨부가 전부 여기를 지난다.**
 * 그런데 업로드 상한은 배포 산출물의 설정이라 화면 시험이 한 줄도 건드리지 못한다 — 실제로
 * 지시어가 빠진 채 배포돼 기본값 1MB 가 걸렸고(2026-09-15 실측: 2MB POST 가 HTML 413),
 * 화면 사전 검사(10MB)를 통과한 첨부가 배포 환경에서만 막혔다.
 *
 * 그래서 「지시어가 있는가」가 아니라 **「화면이 통과시키는 크기를 받아낼 수 있는가」**를 묻는다 —
 * 두 값을 이 시험이 묶어 두지 않으면 한쪽만 조용히 바뀐다.
 */
const template = readFileSync(
  path.resolve(import.meta.dirname, '../../deploy/nginx/default.conf.template'),
  'utf8',
);
const layoutDraft = readFileSync(
  path.resolve(import.meta.dirname, '../../apps/web/src/screens/warehouse-layout/layout-draft.ts'),
  'utf8',
);

/** nginx 크기 표기(`12m`·`500k`·`1024`)를 바이트로. */
function parseNginxSize(value) {
  const [, amount, unit = ''] = value?.match(/^(\d+)([kKmM]?)$/) ?? [];

  assert.ok(amount, `nginx 크기 표기가 아니다: ${value}`);

  const multiplier = { k: 1024, m: 1024 * 1024, '': 1 }[unit.toLowerCase()];

  return Number(amount) * multiplier;
}

test('관리웹 nginx 는 화면이 통과시키는 첨부를 API 까지 흘려보낸다', () => {
  const declared = template.match(/client_max_body_size\s+(\S+);/)?.[1];

  assert.ok(declared, 'client_max_body_size 가 없으면 nginx 기본값 1MB 가 걸린다');

  const screenLimit = layoutDraft.match(/DRAWING_MAX_BYTES = (\d+) \* 1024 \* 1024/)?.[1];

  assert.ok(screenLimit, 'W-CO-08(창고 적재 위치 배치도) 의 도면 상한을 읽지 못했다');

  assert.ok(
    parseNginxSize(declared) >= Number(screenLimit) * 1024 * 1024,
    `nginx 상한(${declared}) 이 화면 상한(${screenLimit}MB) 보다 좁다 — 화면을 통과한 첨부가 배포 환경에서만 413 으로 막힌다`,
  );
});

test('관리웹 nginx 상한은 API 앞단과 같은 자리에 선다', () => {
  /*
   * 두 홉의 값이 같아야 「누가 막았는가」를 되짚을 일이 없다. API 앞단은 서버 저장소
   * (`deploy/proxy/omf-api.conf`) 소관이라 여기서 읽을 수 없으므로 값을 적어 둔다 — 한쪽이
   * 바뀌면 이 시험이 먼저 걸려 다른 쪽도 같이 옮기게 한다.
   */
  const declared = template.match(/client_max_body_size\s+(\S+);/)?.[1];

  assert.equal(parseNginxSize(declared), 12 * 1024 * 1024);
});
