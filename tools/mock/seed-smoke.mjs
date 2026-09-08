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
  /* 화면은 아직 출고할 수 있는 지시만 담는다. 상태가 어긋나면 목록이 늘 빈다. */
  [
    'M-01-08 내 피킹 지시',
    '/logistics/picking-orders?assignedWorkerId=1001&statusCode=REGISTERED',
    1,
  ],
  ['M-01-08 출고 유형', '/mdm/code-values?codeGroupCode=ISSUE_TYPE', 1],
  ['M-01-06 입하 라인', '/logistics/inbound-receipts/9001/lines', 1],
  ['M-01-06 오류 유형', '/mdm/code-values?codeGroupCode=INBOUND_VARIANCE_TYPE', 1],
  ['M-01-06 오류 사유', '/mdm/code-values?codeGroupCode=INBOUND_VARIANCE_REASON', 1],
  ['M-01-07 임시 사유', '/mdm/code-values?codeGroupCode=PUTAWAY_TASK_TEMPORARY_REASON', 1],
  ['M-01-09 차이 사유', '/mdm/code-values?codeGroupCode=VARIANCE_REASON', 1],
  ['M-01-13 대기 요청', '/app/approval-requests?targetTypeCode=INBOUND_LOT&targetId=8003', 1],
  ['M-02-01 생산LOT', '/trace/lots?lotNo=PLOT-2026-0031', 1],
  ['P-02-04 현재 생산LOT', '/trace/lots?workOrderId=11002&currentOnly=true&withProgress=true', 1],
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
  ['M-04-03 라벨 미발행 포장', '/inventory/handling-units?labelIssued=false', 2],
  ['W-02-05 마감 상태', '/mdm/code-values?codeGroupCode=WORK_ORDER_STATUS', 4],
  ['W-03-02 해제 사유', '/mdm/code-values?codeGroupCode=LOT_HOLD_RELEASE_REASON', 4],
  ['W-04-06 원 출하', '/logistics/shipments?customerId=4002', 2],
  ['P-04-01 출하번호 정확 일치', '/logistics/shipments?shipmentNo=SH-2026-0455', 1],
  ['W-04-06 불량창고 위치', '/mdm/locations?warehouseId=1003', 2],
  ['W-04-06 반품 사유', '/mdm/code-values?codeGroupCode=GOODS_RECEIPT_REASON', 1],
  ['W-04-07 판정 대기 대상', '/quality/disposition-candidates?warehouseId=1003', 2],
  ['W-04-07 불량창고', '/mdm/warehouses?isDefect=true', 1],
  ['W-04-07 심각도', '/mdm/code-values?codeGroupCode=NONCONFORMANCE_SEVERITY', 1],
  ['W-03-10 상태', '/mdm/code-values?codeGroupCode=NONCONFORMANCE_STATUS', 3],
  ['M-05-01 설비', '/mdm/equipments', 2],
];

/** 목록이 아닌 상세는 형태로 본다. */
const DETAILS = [
  [
    'M-05-01 점검 항목',
    '/mdm/equipments/5001/inspection-items',
    (body) =>
      body.resolvedFromLevelCode === 'EQUIPMENT' &&
      body.assigned.length >= 3 &&
      body.effective.length >= 3,
  ],
  ['M-04-03 포장 내용물', '/inventory/handling-units/13001', (body) => body.contents.length >= 2],
  [
    'P-02-04 현재 생산LOT 형태',
    '/trace/lots?workOrderId=11002&currentOnly=true&withProgress=true',
    (body) =>
      body.items.length === 1 &&
      body.items[0].workOrderSequenceNo === 1 &&
      body.items[0].workOrderLotCount === 1 &&
      typeof body.items[0].progress === 'object',
  ],
  [
    'P-04-01 출하 배분 상세',
    '/logistics/shipment-lot-allocations/9921',
    (body) =>
      body.shipmentRequestNo === 'SR-2026-0820-0112' &&
      typeof body.customerName === 'string' &&
      body.shippingInspectionStatusCode === 'PASSED',
  ],
  [
    'M-01-04 품목 계약 필드',
    '/mdm/items/2002',
    (body) =>
      typeof body.item.itemName === 'string' &&
      typeof body.item.lotControlled === 'boolean' &&
      typeof body.item.serialControlTypeCode === 'string' &&
      typeof body.item.inspectionRequired === 'boolean' &&
      typeof body.item.negativeStockAllowed === 'boolean',
  ],
  /*
   * 계약이 필수로 둔 칸이 비면 화면이 그 자리에서 죽는다. 목록 건수만 보면 그 사실이 지나간다.
   */
  [
    'M-01-13 요청 필수 칸',
    '/app/approval-requests?targetTypeCode=INBOUND_LOT&targetId=8003',
    (body) =>
      body.items.every(
        (row) =>
          typeof row.target?.displayName === 'string' &&
          typeof row.approvalRequestNo === 'string' &&
          typeof row.requestedByName === 'string',
      ),
  ],
  /*
   * 되돌릴 수 없는 쓰기를 하는 화면은 한 번 하고 나면 그 대상이 목록에서 빠진다. 하나만 두면
   * 첫 시험에서 소진돼 두 번째 사람이 빈 화면을 만난다. 건수까지 본다.
   */
  [
    'M-01-02 사전부착 빈 LOT 라인',
    '/logistics/inbound-receipts/9002/lines?supplierLotMissing=false',
    (body) => body.items.filter((row) => row.lotId === null).length >= 2,
  ],
  [
    'M-01-02 다른 입하 건에도',
    '/logistics/inbound-receipts/9001/lines?supplierLotMissing=false',
    (body) => body.items.filter((row) => row.lotId === null).length >= 2,
  ],
  [
    'M-01-05 남는 적치 지시',
    '/logistics/putaway-tasks?assignedWorkerId=1001',
    (body) => body.items.length >= 3,
  ],
  [
    'M-01-08 남는 피킹 지시',
    '/logistics/picking-orders?assignedWorkerId=1001&statusCode=REGISTERED',
    (body) => body.items.length >= 2,
  ],
  [
    'M-01-09 남는 출고 전표',
    '/logistics/goods-issues?statusCode=POSTED',
    (body) => body.items.length >= 2,
  ],
  [
    'M-01-11 남는 실사',
    '/inventory/counts?statusCode=IN_PROGRESS',
    (body) => body.items.length >= 2,
  ],
  /* 출하 줄은 요청 응답에 실려 온다. 따로 부르는 경로가 없다. */
  [
    'M-04-01 남는 출하 줄',
    `/logistics/shipment-requests?shipDateFrom=${today()}&shipDateTo=${today()}`,
    (body) => body.items.some((row) => (row.lines ?? []).length >= 2),
  ],
  /* 재생재 행이 없으면 재생재 등록은 늘 등록되지 않은 품목이라고만 말한다. */
  [
    'M-01-12 재생재 품목',
    '/mdm/items?q=RM-1001&size=50',
    (body) => body.items.some((row) => row.mesCategoryCode === 'RECYCLED'),
  ],
  [
    /*
     * 계약이 「이 값이 있으므로 마스터를 다시 부르지 않는다」로 못 박은 자리다. 여기가 비면
     * 화면은 부를 곳도 없이 「알 수 없음」만 보이고, 그 사이 아무 시험도 깨지지 않는다.
     */
    'M-01-04 잔액 표시값',
    '/inventory/balances?groupBy=LOCATION&lotId=8001',
    (body) =>
      body.items.length >= 2 &&
      body.items.every(
        (row) =>
          typeof row.warehouseName === 'string' &&
          typeof row.locationCode === 'string' &&
          typeof row.locationName === 'string' &&
          typeof row.itemCode === 'string',
      ),
  ],
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

const server = spawn(process.execPath, ['tools/mock/seeded.mjs'], {
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

{
  const response = await fetch(`${BASE}/trace/lots?currentOnly=true`);
  const body = await response.json();
  const ok = response.status === 400 && body.code === 'WORK_ORDER_REQUIRED';

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} P-02-04 현재 LOT 작업지시 필수`);
}

{
  const createResponse = await fetch(`${BASE}/inventory/handling-units`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handlingUnitTypeCode: 'CARTON' }),
  });
  const created = await createResponse.json();
  const handlingUnitId = created.handlingUnit?.handlingUnitId;
  const deleteResponse = await fetch(`${BASE}/inventory/handling-units/${String(handlingUnitId)}`, {
    method: 'DELETE',
  });
  const ok = createResponse.status === 201 && deleteResponse.status === 204;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} P-02-08 빈 포장 단위 취소`);
}

{
  const response = await fetch(`${BASE}/logistics/shipment-lot-allocations/9921`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handlingUnitId: 13001 }),
  });
  const body = await response.json();
  const ok = response.ok && body.handlingUnitId === 13001;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} P-04-01 출하 배분 포장 연결`);
}

console.log(
  failed === 0
    ? `\n화면 ${String(ENTRIES.length + DETAILS.length)}자리 전부 열립니다.`
    : `\n${String(failed)}자리가 비어 화면이 서지 않습니다.`,
);

finish();
