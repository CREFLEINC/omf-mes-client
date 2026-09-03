/**
 * 씨앗 목 서버가 «모든 화면을 열 수 있는가»를 본다.
 *
 * 화면이 진입에 거는 질의를 그대로 눌러 보고, 하나라도 빈 목록이면 실패한다. 데이터가 없어
 * 열리지 않는 화면은 시험할 수 없는 화면이고, 그 사실이 조용히 지나가면 실기에서야 안다.
 *
 * 화면을 새로 만들면 여기에 한 줄을 더한다.
 */

import { spawn } from 'node:child_process';

const PORT = Number(process.env.MOCK_PORT ?? 4055);
const BASE = `http://127.0.0.1:${String(PORT)}`;

const today = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** 각 줄이 한 화면의 진입 조건이다. `least` 만큼은 나와야 화면이 선다. */
const ENTRIES = [
  ['M-CO-01 사번 확인', '/mdm/workers?q=100027', 1],
  ['M-01-01 발주 목록', '/logistics/purchase-orders?statusCode=OPEN', 1],
  ['M-01-01 발주 라인', '/logistics/purchase-orders/9101/lines', 1],
  ['M-01-01 대체 LOT 사유', '/mdm/code-values?codeGroupCode=SUBSTITUTE_LOT_REASON', 1],
  ['M-01-04 LOT 정확 일치', '/trace/lots?lotNo=0001234500000012002607310001230007', 1],
  ['M-01-04 잔액', '/inventory/balances?lotId=8001', 1],
  ['M-01-04 보류', '/trace/lots/8003/holds', 1],
  ['M-01-05 내 적치 지시', '/logistics/putaway-tasks?assignedWorkerId=1001', 1],
  ['M-01-05 창고 위치', '/mdm/locations?warehouseId=1001', 2],
  ['M-01-06 입하 목록', '/logistics/inbound-receipts', 1],
  ['M-01-08 내 피킹 지시', '/logistics/picking-orders?assignedWorkerId=1001', 1],
  ['M-01-08 출고 유형', '/mdm/code-values?codeGroupCode=ISSUE_TYPE', 1],
  ['M-01-06 입하 라인', '/logistics/inbound-receipts/9001/lines', 1],
  ['M-01-06 오류 유형', '/mdm/code-values?codeGroupCode=INBOUND_VARIANCE_TYPE', 1],
  ['M-01-07 임시 사유', '/mdm/code-values?codeGroupCode=PUTAWAY_TASK_TEMPORARY_REASON', 1],
  ['M-01-13 대기 요청', '/app/approval-requests?targetTypeCode=INBOUND_LOT&targetId=8003', 1],
  ['M-02-01 생산LOT', '/trace/lots?lotNo=PLOT-2026-0031', 1],
  [
    'P-02-07 완료 생산LOT',
    '/trace/lots?workOrderId=11001&lotTypeCode=PRODUCTION&completed=true',
    2,
  ],
  [
    'P-02-07 발행 현황',
    '/app/document-issues/summary?targetTypeCode=LOT&targetIds=8101,8102&documentTypeCode=PRODUCTION_LOT_LABEL',
    2,
  ],
  ['M-02-01 다음 공정', '/production/work-orders?successorOfWorkOrderId=11001', 2],
  ['M-02-02 불량 기록', '/quality/defect-records?lotId=8102', 1],
  [
    'M-04-01 오늘 출하',
    `/logistics/shipment-requests?shipDateFrom=${today()}&shipDateTo=${today()}`,
    1,
  ],
  ['M-04-01 제품 재고', '/inventory/balances?itemId=2003&includeZero=true', 2],
  ['M-04-03 포장 검색', '/inventory/handling-units?q=HU-2026-000058', 1],
  ['W-04-06 원 출하', '/logistics/shipments?customerId=4002', 2],
  ['W-04-06 불량창고 위치', '/mdm/locations?warehouseId=1003', 2],
  ['W-04-06 반품 사유', '/mdm/code-values?codeGroupCode=GOODS_RECEIPT_REASON', 1],
  ['W-04-07 판정 대기 대상', '/quality/disposition-candidates?warehouseId=1003', 2],
  ['W-04-07 불량창고', '/mdm/warehouses?isDefect=true', 1],
  ['W-04-07 심각도', '/mdm/code-values?codeGroupCode=NONCONFORMANCE_SEVERITY', 1],
  ['M-05-01 설비', '/mdm/equipments', 2],
  ['M-05-01 점검 항목', '/mdm/equipments/5001/inspection-items', 3],
];

/** 목록이 아닌 상세는 형태로 본다. */
const DETAILS = [
  ['M-04-03 포장 내용물', '/inventory/handling-units/13001', (body) => body.contents.length >= 2],
  ['M-01-04 품목명', '/mdm/items/2002', (body) => typeof body.item.itemName === 'string'],
  [
    'M-01-08 라인 표시값',
    '/logistics/picking-orders/16001',
    (body) =>
      body.lines.length >= 3 &&
      body.lines.every(
        (line) => typeof line.itemCode === 'string' && typeof line.lotNo === 'string',
      ) &&
      body.lines.some((line) => line.held === true),
  ],
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const reachable = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const probe = await fetch(`${BASE}/mdm/uoms`);

      if (probe.ok) {
        return true;
      }
    } catch {
      /* 아직 안 떴다. */
    }

    await wait(500);
  }

  return false;
};

const server = spawn('node', ['tools/mock/seeded.mjs'], {
  env: { ...process.env, MOCK_PORT: String(PORT) },
  stdio: ['ignore', 'ignore', 'inherit'],
});

let failed = 0;

const finish = () => {
  server.kill();
  process.exit(failed === 0 ? 0 : 1);
};

if (!(await reachable())) {
  console.error('목 서버가 뜨지 않았습니다.');
  finish();
}

for (const [name, path, least] of ENTRIES) {
  const response = await fetch(`${BASE}${path}`);
  const body = await response.json();
  const count = Array.isArray(body.items) ? body.items.length : -1;
  const ok = response.ok && count >= least;

  if (!ok) {
    failed += 1;
  }

  console.log(`${ok ? '✔' : '✘'} ${name.padEnd(24)} ${String(count)}건 (최소 ${String(least)})`);
}

for (const [name, path, check] of DETAILS) {
  const response = await fetch(`${BASE}${path}`);
  const ok = response.ok && check(await response.json());

  if (!ok) {
    failed += 1;
  }

  console.log(`${ok ? '✔' : '✘'} ${name}`);
}

console.log(
  failed === 0
    ? `\n화면 ${String(ENTRIES.length + DETAILS.length)}자리 전부 열립니다.`
    : `\n${String(failed)}자리가 비어 화면이 서지 않습니다.`,
);

finish();
