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
  ['M-01-01 대체 LOT 사유', '/mdm/code-values?codeGroupCode=SUBSTITUTE_LOT_REASON', 1],
  ['M-01-01 예외입하 유형', '/mdm/code-values?codeGroupCode=INBOUND_RECEIPT_EXCEPTION_TYPE', 1],
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
  ['M-01-13 요청 상태', '/mdm/code-values?codeGroupCode=APPROVAL_REQUEST_STATUS', 3],
  ['M-02-01 생산LOT', '/trace/lots?lotNo=PLOT-2026-0031', 1],
  ['P-02-04 현재 생산LOT', '/trace/lots?workOrderId=11002&currentOnly=true&withProgress=true', 1],
  [
    'P-02-04 마감 생산LOT',
    '/trace/lots?workOrderId=11001&lotTypeCode=PRODUCTION&completed=true',
    2,
  ],
  [
    'P-02-04 생산 LOT 라벨 발행 현황',
    '/app/document-issues/summary?targetTypeCode=LOT&targetIds=8101,8102&documentTypeCode=PRODUCTION_LOT_LABEL',
    2,
  ],
  ['M-02-01 다음 공정', '/production/work-orders?successorOfWorkOrderId=11001', 2],
  ['M-02-02 불량 기록', '/quality/defect-records?lotId=8102', 2],
  ['M-02-02 불량 코드', '/quality/defect-codes', 2],
  ['M-04-03 재구성 이력', '/inventory/handling-units/13001/repack-events', 1],
  ['M-04-04 완제품 적치 규칙', '/logistics/putaway-rules?warehouseId=1002&itemId=2003', 1],
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
  [
    'P-04-01 당일 피킹 완료 출하',
    `/logistics/shipments?pickedOnly=true&shipDateFrom=${today()}&shipDateTo=${today()}`,
    1,
  ],
  ['P-04-01 납품 라벨 재진입', '/logistics/shipment-lot-allocations?q=DL-SH-2026-0455-9921', 1],
  ['W-04-06 불량창고 위치', '/mdm/locations?warehouseId=1003', 2],
  ['W-04-06 반품 사유', '/mdm/code-values?codeGroupCode=GOODS_RECEIPT_REASON', 1],
  ['W-04-07 판정 대기 대상', '/quality/disposition-candidates?warehouseId=1003', 2],
  ['W-04-07 불량창고', '/mdm/warehouses?isDefect=true', 1],
  ['W-04-07 심각도', '/mdm/code-values?codeGroupCode=NONCONFORMANCE_SEVERITY', 1],
  ['W-03-10 상태', '/mdm/code-values?codeGroupCode=NONCONFORMANCE_STATUS', 3],
  ['M-05-01 설비', '/mdm/equipments?statusCode=IN_SERVICE', 2],
  ['W-06-07 창고', '/mdm/warehouses?includeInactive=true', 3],
  ['W-06-07 공장', '/mdm/plants?includeInactive=true', 1],
  ['W-06-07 사업부', '/mdm/business-units?includeInactive=true', 1],
  ['W-06-07 창고 유형', '/mdm/code-values?codeGroupCode=WAREHOUSE_TYPE', 3],
  ['W-06-07 관리 수준', '/mdm/code-values?codeGroupCode=MANAGEMENT_LEVEL', 4],
  ['W-06-07 Location 유형', '/mdm/code-values?codeGroupCode=LOCATION_TYPE', 3],
  ['W-06-07 보관 조건', '/mdm/code-values?codeGroupCode=STORAGE_CONDITION', 3],
  ['W-06-07 재발행 사유', '/mdm/code-values?codeGroupCode=REISSUE_REASON', 5],
  ['W-06-14 적치 규칙', '/logistics/putaway-rules?warehouseId=1001&includeInactive=true', 3],
  ['W-06-14 규칙 없는 품목', '/logistics/putaway-rules/uncovered-items?warehouseId=1001', 1],
];

/** 목록이 아닌 상세는 형태로 본다. */
const DETAILS = [
  [
    'M-01-01 발주 상세 라인',
    '/logistics/purchase-orders/9101',
    (body) =>
      body.purchaseOrder.purchaseOrderId === 9101 &&
      body.lines.length >= 1 &&
      body.lines.every(
        (line) =>
          typeof line.orderedQty === 'number' &&
          typeof line.receivedQty === 'number' &&
          typeof line.toleranceOverQty === 'number' &&
          typeof line.toleranceUnderQty === 'number',
      ),
  ],
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
  [
    'W-06-07 창고 상세 필수 칸',
    '/mdm/warehouses/1001',
    (body) =>
      typeof body.warehouse.businessUnitId === 'number' &&
      typeof body.warehouse.warehouseTypeCode === 'string' &&
      typeof body.warehouse.managementLevelCode === 'string' &&
      typeof body.warehouse.isExternal === 'boolean' &&
      typeof body.warehouse.isDefect === 'boolean',
  ],
  [
    'W-06-07 Location 상세 필수 칸',
    '/mdm/locations/3001',
    (body) =>
      typeof body.location.locationTypeCode === 'string' &&
      typeof body.location.allowMixedItem === 'boolean' &&
      typeof body.location.allowMixedLot === 'boolean',
  ],
  [
    'W-06-14 적치 규칙 상세·ETag 원천',
    '/logistics/putaway-rules/5101',
    (body) =>
      body.putawayRule.putawayRuleId === 5101 &&
      typeof body.putawayRule.capacityQty === 'number' &&
      typeof body.editability === 'object',
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
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'seed-smoke-w-06-07-create',
  };
  const warehouseCreateBody = {
    plantId: 101,
    businessUnitId: 201,
    warehouseCode: 'SMOKE-WH',
    warehouseName: '목업 검증 창고',
    warehouseTypeCode: 'GENERAL',
    managementLevelCode: 'RACK',
    isExternal: false,
    isDefect: false,
  };
  const warehouseCreate = await fetch(`${BASE}/mdm/warehouses`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(warehouseCreateBody),
  });
  const warehouse = await warehouseCreate.json();
  const warehouseCreateRetry = await fetch(`${BASE}/mdm/warehouses`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(warehouseCreateBody),
  });
  const warehouseRetry = await warehouseCreateRetry.json();
  const warehouseDetail = await fetch(`${BASE}/mdm/warehouses/${String(warehouse.warehouseId)}`);
  const warehouseEtag = warehouseDetail.headers.get('etag');
  const warehouseUpdate = await fetch(`${BASE}/mdm/warehouses/${String(warehouse.warehouseId)}`, {
    method: 'PUT',
    headers: { ...jsonHeaders, 'If-Match': warehouseEtag ?? '' },
    body: JSON.stringify({
      businessUnitId: 201,
      warehouseCode: 'SMOKE-WH',
      warehouseName: '검색 가능한 목업 창고',
      warehouseTypeCode: 'GENERAL',
      managementLevelCode: 'RACK',
      isExternal: false,
      isDefect: false,
    }),
  });
  const warehouseSearch = await fetch(
    `${BASE}/mdm/warehouses?q=${encodeURIComponent('검색 가능한')}&warehouseTypeCode=GENERAL`,
  );
  const warehouseSearchBody = await warehouseSearch.json();

  const locationCreateHeaders = {
    ...jsonHeaders,
    'Idempotency-Key': 'seed-smoke-w-06-07-location-create',
  };
  const locationCreateBody = {
    warehouseId: warehouse.warehouseId,
    parentLocationId: null,
    locationCode: 'SMOKE-LOC-01',
    locationName: '목업 검증 위치',
    locationTypeCode: 'RACK',
    allowMixedItem: false,
    allowMixedLot: false,
  };
  const locationCreate = await fetch(`${BASE}/mdm/locations`, {
    method: 'POST',
    headers: locationCreateHeaders,
    body: JSON.stringify(locationCreateBody),
  });
  const location = await locationCreate.json();
  const locationCreateRetry = await fetch(`${BASE}/mdm/locations`, {
    method: 'POST',
    headers: locationCreateHeaders,
    body: JSON.stringify(locationCreateBody),
  });
  const locationRetry = await locationCreateRetry.json();
  const locationDetail = await fetch(`${BASE}/mdm/locations/${String(location.locationId)}`);
  const locationEtag = locationDetail.headers.get('etag');
  const locationUpdateHeaders = {
    ...jsonHeaders,
    'Idempotency-Key': 'seed-smoke-w-06-07-location-update',
    'If-Match': locationEtag ?? '',
  };
  const locationUpdateBody = {
    parentLocationId: null,
    locationCode: 'SMOKE-LOC-01',
    locationName: '명칭 검색 목업 위치',
    locationTypeCode: 'RACK',
    qualityZoneCode: null,
    storageConditionCode: 'ROOM_TEMPERATURE',
    allowMixedItem: false,
    allowMixedLot: false,
    capacityQty: null,
    capacityUomId: null,
  };
  const locationUpdate = await fetch(`${BASE}/mdm/locations/${String(location.locationId)}`, {
    method: 'PUT',
    headers: locationUpdateHeaders,
    body: JSON.stringify(locationUpdateBody),
  });
  const locationUpdateRetry = await fetch(`${BASE}/mdm/locations/${String(location.locationId)}`, {
    method: 'PUT',
    headers: locationUpdateHeaders,
    body: JSON.stringify(locationUpdateBody),
  });
  const staleLocationUpdate = await fetch(`${BASE}/mdm/locations/${String(location.locationId)}`, {
    method: 'PUT',
    headers: {
      ...locationUpdateHeaders,
      'Idempotency-Key': 'seed-smoke-w-06-07-location-stale',
    },
    body: JSON.stringify(locationUpdateBody),
  });
  const locationSearch = await fetch(
    `${BASE}/mdm/locations?warehouseId=${String(warehouse.warehouseId)}&q=${encodeURIComponent('명칭 검색')}`,
  );
  const locationSearchBody = await locationSearch.json();

  const issueHeaders = {
    ...jsonHeaders,
    'Idempotency-Key': 'seed-smoke-w-06-07-label',
  };
  const issueCreateBody = {
    documentTypeCode: 'LOCATION_LABEL',
    targets: [{ targetTypeCode: 'LOCATION', targetId: location.locationId }],
  };
  const issueResponse = await fetch(`${BASE}/app/document-issues`, {
    method: 'POST',
    headers: issueHeaders,
    body: JSON.stringify(issueCreateBody),
  });
  const issueBody = await issueResponse.json();
  const issue = issueBody.items?.[0];
  const issueRetryResponse = await fetch(`${BASE}/app/document-issues`, {
    method: 'POST',
    headers: issueHeaders,
    body: JSON.stringify(issueCreateBody),
  });
  const issueRetryBody = await issueRetryResponse.json();
  const issueRetry = issueRetryBody.items?.[0];
  const rendition = await fetch(
    `${BASE}/app/document-issues/${String(issue?.documentIssueLogId)}/rendition?format=tspl`,
  );
  const renditionText = await rendition.text();

  const locationDeactivate = await fetch(
    `${BASE}/mdm/locations/${String(location.locationId)}:deactivate`,
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'seed-smoke-w-06-07-location-deactivate',
        'If-Match': locationUpdate.headers.get('etag') ?? '',
      },
    },
  );
  const activeLocations = await fetch(
    `${BASE}/mdm/locations?warehouseId=${String(warehouse.warehouseId)}`,
  );
  const allLocations = await fetch(
    `${BASE}/mdm/locations?warehouseId=${String(warehouse.warehouseId)}&includeInactive=true`,
  );
  const activeLocationBody = await activeLocations.json();
  const allLocationBody = await allLocations.json();

  const ok =
    warehouseCreate.status === 201 &&
    warehouseCreateRetry.status === 201 &&
    warehouseRetry.warehouseId === warehouse.warehouseId &&
    warehouseEtag !== null &&
    warehouseUpdate.ok &&
    warehouseSearchBody.items.some((row) => row.warehouseId === warehouse.warehouseId) &&
    locationCreate.status === 201 &&
    locationCreateRetry.status === 201 &&
    locationRetry.locationId === location.locationId &&
    locationEtag !== null &&
    locationUpdate.ok &&
    locationUpdateRetry.ok &&
    locationUpdateRetry.headers.get('etag') === locationUpdate.headers.get('etag') &&
    staleLocationUpdate.status === 409 &&
    locationSearchBody.items.some((row) => row.locationId === location.locationId) &&
    issue?.target?.targetTypeCode === 'LOCATION' &&
    issue?.target?.targetId === location.locationId &&
    typeof issue?.issuedBy === 'number' &&
    typeof issue?.issuedByName === 'string' &&
    issueRetry?.documentIssueLogId === issue?.documentIssueLogId &&
    issueRetry?.issueSeq === issue?.issueSeq &&
    rendition.ok &&
    renditionText.includes('SMOKE-LOC-01') &&
    !renditionText.includes('LOT NO.') &&
    locationDeactivate.ok &&
    !activeLocationBody.items.some((row) => row.locationId === location.locationId) &&
    allLocationBody.items.some(
      (row) => row.locationId === location.locationId && row.isActive === false,
    );

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} W-06-07 상태·검색·ETag·라벨 흐름`);
}

{
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'seed-smoke-w-06-14-create',
  };
  const createBody = {
    itemId: 2004,
    warehouseId: 1001,
    locationId: 3003,
    capacityQty: 250,
    uomId: 1001,
    priorityNo: 30,
    remarks: '목업 상태 검증',
  };
  const invalidMissing = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': 'seed-smoke-w-06-14-invalid-missing' },
    body: JSON.stringify({}),
  });
  const invalidNegative = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': 'seed-smoke-w-06-14-invalid-negative' },
    body: JSON.stringify({ ...createBody, capacityQty: -1 }),
  });
  const invalidForeignLocation = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': 'seed-smoke-w-06-14-invalid-location' },
    body: JSON.stringify({ ...createBody, locationId: 3004 }),
  });
  const invalidWarehouseLevel = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': 'seed-smoke-w-06-14-invalid-level' },
    body: JSON.stringify({ ...createBody, warehouseId: 1004, locationId: 3001 }),
  });
  const invalidInactiveLocation = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': 'seed-smoke-w-06-14-inactive-location' },
    body: JSON.stringify({ ...createBody, locationId: 3008 }),
  });
  const invalidInactiveUom = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: { ...jsonHeaders, 'Idempotency-Key': 'seed-smoke-w-06-14-inactive-uom' },
    body: JSON.stringify({ ...createBody, uomId: 1003 }),
  });
  const create = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(createBody),
  });
  const created = await create.json();
  const retry = await fetch(`${BASE}/logistics/putaway-rules`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(createBody),
  });
  const retried = await retry.json();
  const detail = await fetch(`${BASE}/logistics/putaway-rules/${String(created.putawayRuleId)}`);
  const etag = detail.headers.get('etag');
  const invalidUpdate = await fetch(
    `${BASE}/logistics/putaway-rules/${String(created.putawayRuleId)}`,
    {
      method: 'PUT',
      headers: {
        ...jsonHeaders,
        'Idempotency-Key': 'seed-smoke-w-06-14-invalid-update',
        'If-Match': etag ?? '',
      },
      body: JSON.stringify({}),
    },
  );
  const invalidUpdateLocation = await fetch(
    `${BASE}/logistics/putaway-rules/${String(created.putawayRuleId)}`,
    {
      method: 'PUT',
      headers: {
        ...jsonHeaders,
        'Idempotency-Key': 'seed-smoke-w-06-14-update-inactive-location',
        'If-Match': etag ?? '',
      },
      body: JSON.stringify({
        locationId: 3008,
        capacityQty: 250,
        uomId: 1001,
        priorityNo: 30,
      }),
    },
  );
  const invalidUpdateUom = await fetch(
    `${BASE}/logistics/putaway-rules/${String(created.putawayRuleId)}`,
    {
      method: 'PUT',
      headers: {
        ...jsonHeaders,
        'Idempotency-Key': 'seed-smoke-w-06-14-update-inactive-uom',
        'If-Match': etag ?? '',
      },
      body: JSON.stringify({
        locationId: 3003,
        capacityQty: 250,
        uomId: 1003,
        priorityNo: 30,
      }),
    },
  );
  const legacyDetail = await fetch(`${BASE}/logistics/putaway-rules/5104`);
  const legacyUpdate = await fetch(`${BASE}/logistics/putaway-rules/5104`, {
    method: 'PUT',
    headers: {
      ...jsonHeaders,
      'Idempotency-Key': 'seed-smoke-w-06-14-legacy-update',
      'If-Match': legacyDetail.headers.get('etag') ?? '',
    },
    body: JSON.stringify({
      locationId: 3007,
      capacityQty: 125,
      uomId: 1001,
      priorityNo: 100,
      remarks: '과거 참조 보존 수정',
    }),
  });
  const updateHeaders = {
    ...jsonHeaders,
    'Idempotency-Key': 'seed-smoke-w-06-14-update',
    'If-Match': etag ?? '',
  };
  const updateBody = {
    locationId: 3003,
    capacityQty: 275,
    uomId: 1001,
    priorityNo: 30,
    remarks: '수정된 목업 상태',
  };
  const update = await fetch(`${BASE}/logistics/putaway-rules/${String(created.putawayRuleId)}`, {
    method: 'PUT',
    headers: updateHeaders,
    body: JSON.stringify(updateBody),
  });
  const stale = await fetch(`${BASE}/logistics/putaway-rules/${String(created.putawayRuleId)}`, {
    method: 'PUT',
    headers: { ...updateHeaders, 'Idempotency-Key': 'seed-smoke-w-06-14-stale' },
    body: JSON.stringify(updateBody),
  });
  const deactivate = await fetch(
    `${BASE}/logistics/putaway-rules/${String(created.putawayRuleId)}:deactivate`,
    {
      method: 'POST',
      headers: {
        'Idempotency-Key': 'seed-smoke-w-06-14-deactivate',
        'If-Match': update.headers.get('etag') ?? '',
      },
    },
  );
  const uncovered = await fetch(`${BASE}/logistics/putaway-rules/uncovered-items?warehouseId=1001`);
  const uncoveredBody = await uncovered.json();
  const ok =
    invalidMissing.status === 400 &&
    invalidNegative.status === 400 &&
    invalidForeignLocation.status === 400 &&
    invalidWarehouseLevel.status === 400 &&
    invalidInactiveLocation.status === 400 &&
    invalidInactiveUom.status === 400 &&
    create.status === 201 &&
    retry.status === 201 &&
    retried.putawayRuleId === created.putawayRuleId &&
    etag !== null &&
    invalidUpdate.status === 400 &&
    invalidUpdateLocation.status === 400 &&
    invalidUpdateUom.status === 400 &&
    legacyUpdate.ok &&
    update.ok &&
    stale.status === 409 &&
    deactivate.ok &&
    uncoveredBody.items.some((row) => row.itemId === 2004);

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} W-06-14 상태·멱등·ETag·미설정 흐름`);
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
    body: JSON.stringify({ handlingUnitTypeCode: 'BOX' }),
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

{
  const occurredAt = new Date().toISOString();
  const line = (receivedQty, purchaseOrderLineId) => ({
    purchaseOrderLineId,
    itemId: 2001,
    receivedQty,
    uomId: 1001,
    supplierLotMissing: false,
  });
  const part = (lines) => ({
    supplierId: 4001,
    plantId: 101,
    receiptDatetime: occurredAt,
    lines,
  });
  const response = await fetch(`${BASE}/logistics/inbound-receipts:split`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'seed-smoke-m-01-01-split',
      'X-Worker-No': '100027',
    },
    body: JSON.stringify({
      mode: 'BOTH',
      normal: part([line(1, 9203)]),
      excess: {
        ...part([line(1, null)]),
        exceptionTypeCode: 'OVER_DELIVERY',
        exceptionReason: '목 서버 분리 등록 검증',
      },
      businessDate: today(),
      occurredAt,
    }),
  });
  const body = await response.json();
  const ok = response.status === 201 && body.created.length === 2;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-01-01 초과 입하 단일 분리 등록`);
}

{
  const beforeResponse = await fetch(`${BASE}/logistics/inbound-receipts`);
  const before = await beforeResponse.json();
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${BASE}/logistics/inbound-receipts:split`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'BOTH',
      normal: {
        supplierId: 4001,
        plantId: 101,
        receiptDatetime: occurredAt,
        lines: [{ itemId: 2001, receivedQty: 1, uomId: 1001, supplierLotMissing: false }],
      },
      excess: {
        supplierId: 4001,
        plantId: 101,
        receiptDatetime: occurredAt,
        lines: [{ itemId: 2001, receivedQty: 1, uomId: 1001, supplierLotMissing: false }],
      },
      businessDate: today(),
      occurredAt,
    }),
  });
  const afterResponse = await fetch(`${BASE}/logistics/inbound-receipts`);
  const after = await afterResponse.json();
  const ok = response.status === 400 && before.page.totalElements === after.page.totalElements;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-01-01 분리 실패 전건 롤백`);
}

/*
 * 임시 적치가 만든 상태를 정위치 이동 쪽이 되찾을 수 있는가. 상태값이 계약과 다르거나 끝난
 * 건을 목록이 무조건 빼면 임시로 둔 물건을 아무도 찾지 못한다.
 */
{
  const occurredAt = new Date().toISOString();
  const response = await fetch(`${BASE}/logistics/putaway-tasks/9405:complete-temporary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actualLocationId: 3003,
      reasonCode: 'NO_SPACE',
      businessDate: today(),
      occurredAt,
    }),
  });
  const saved = await response.json();
  const listed = await fetch(`${BASE}/logistics/putaway-tasks?temporaryOnly=true`);
  const body = await listed.json();
  const found = body.items.find((row) => row.putawayTaskId === 9405);
  const ok =
    saved.statusCode === 'COMPLETED_TEMPORARY' &&
    saved.reasonCode === 'NO_SPACE' &&
    found !== undefined;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-01-07 임시 적치를 정위치 이동 쪽이 되찾는다`);
}

/*
 * 지시 상세가 시드를 내리는가. 잇지 않으면 계약 예시값이 내려가 모든 지시가 이미 적치된
 * 것으로 보이고, 임시 위치 적재 화면이 통째로 막힌다.
 */
{
  const response = await fetch(`${BASE}/logistics/putaway-tasks/9401`);
  const task = await response.json();
  const ok = task.putawayTaskId === 9401 && task.actualLocationId === null;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-01-07 지시 상세가 시드를 내린다`);
}

/*
 * 투입한 건을 그 LOT 으로 되찾을 수 있는가. LOT 축은 실행 기록에 없고 원 불량을 거쳐 풀어야
 * 한다 - 곧장 찾으면 방금 투입한 건이 반출 탭에서 사라져 왕복이 닫히지 않는다.
 */
{
  const startedAt = new Date().toISOString();
  const response = await fetch(`${BASE}/production/repair-executions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'seed-smoke-repair',
      'X-Worker-No': '100027',
    },
    body: JSON.stringify({ defectRecordId: 14001, startedAt, repairQty: 5, uomId: 1001 }),
  });
  const created = await response.json();
  const listed = await fetch(`${BASE}/production/repair-executions?open=true&lotId=8102`);
  const body = await listed.json();
  const found = body.items.find((row) => row.repairExecutionId === created.repairExecutionId);

  const closing = await fetch(
    `${BASE}/production/repair-executions/${String(created.repairExecutionId)}:return`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'seed-smoke-repair-return',
        'X-Worker-No': '100027',
      },
      body: JSON.stringify({ returnedAt: startedAt, repairResultCode: 'SUCCEEDED' }),
    },
  );
  const closed = await closing.json();
  const reListed = await fetch(`${BASE}/production/repair-executions?open=true&lotId=8102`);
  const remaining = await reListed.json();
  const ok =
    found !== undefined &&
    closed.returnedAt === startedAt &&
    !remaining.items.some((row) => row.repairExecutionId === created.repairExecutionId);

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-02-02 투입한 건을 LOT 으로 되찾고 반출이 닫는다`);
}

/*
 * 불량 기록이 계약 모양인가. 불량 코드와 검출 시각이 없으면 화면이 무엇을 고르는지 말하지
 * 못하고 날짜 자리에 못 쓸 값을 적는다.
 */
{
  const response = await fetch(`${BASE}/quality/defect-records?lotId=8102`);
  const body = await response.json();
  const codes = await (await fetch(`${BASE}/quality/defect-codes`)).json();
  const named = body.items.every((row) =>
    codes.items.some((code) => code.defectCodeId === row.defectCodeId),
  );
  const ok =
    body.items.length > 0 &&
    body.items.every((row) => !Number.isNaN(Date.parse(String(row.detectedAt)))) &&
    named;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-02-02 불량 기록이 코드와 검출 시각을 들고 온다`);
}

/*
 * 구성을 치환하면 이력이 남는가. 계약이 그것을 이 치환에 묶어 두었다 - 남지 않으면 되돌리기가
 * 없는 화면에서 수량이 왜 달라졌는지를 되짚을 자리가 없다.
 */
{
  const before = await (await fetch(`${BASE}/inventory/handling-units/13002/repack-events`)).json();
  await fetch(`${BASE}/inventory/handling-units/13002/contents`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'seed-smoke-repack',
      'X-Worker-No': '100027',
    },
    body: JSON.stringify({ items: [{ itemId: 2003, lotId: 8201, qty: 100, uomId: 1001 }] }),
  });
  const after = await (await fetch(`${BASE}/inventory/handling-units/13002/repack-events`)).json();
  const added = after.items.length - before.items.length;
  const line = after.items.at(-1)?.lines.find((row) => row.lotId === 8201);
  const ok = added === 1 && line?.qtyBefore === 120 && line.qtyAfter === 100;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-04-03 구성을 치환하면 재구성 이력이 남는다`);
}

/*
 * 점검 항목이 계약 모양인가. 이름과 순번이 다른 이름으로 실려 있으면 화면이 항목 자리에
 * 빈 값을 적고, 점검자가 무엇을 재는지 알 수 없다.
 */
{
  const response = await fetch(`${BASE}/mdm/equipments/5001/inspection-items`);
  const body = await response.json();
  const measured = body.effective.find((row) => row.judgmentMethodCode === 'MEASUREMENT');
  const uoms = await (await fetch(`${BASE}/mdm/uoms?includeInactive=true`)).json();
  const named = uoms.items.some((row) => row.uomId === measured?.uomId);
  const ok =
    body.effective.length > 0 &&
    body.effective.every(
      (row) => typeof row.itemName === 'string' && typeof row.sequenceNo === 'number',
    ) &&
    named;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-05-01 점검 항목이 이름과 순번과 단위를 들고 온다`);
}

/*
 * 점검 이력이 유형과 기간 축을 거르는가. 무시하면 일상 점검 기록이 정기를 고른 화면에도 떠,
 * 중복을 막으라고 세운 안내가 엉뚱한 것을 가리킨다.
 */
{
  const daily = await (
    await fetch(`${BASE}/maintenance/inspections?equipmentId=5001&inspectionTypeCode=DAILY`)
  ).json();
  const monthly = await (
    await fetch(`${BASE}/maintenance/inspections?equipmentId=5001&inspectionTypeCode=MONTHLY`)
  ).json();
  const ok = daily.items.length > 0 && monthly.items.length === 0;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-05-01 점검 이력이 유형 축을 거른다`);
}

/*
 * 품목과 자리가 보관조건을 들고 오는가. 둘 중 하나라도 비면 적치의 보관조건 경고가 실기에서
 * 한 번도 서지 않는다 - 화면은 모르면 말하지 않기 때문이다.
 */
{
  const items = await (await fetch(`${BASE}/mdm/items?size=200`)).json();
  const locations = await (await fetch(`${BASE}/mdm/locations?warehouseId=1001`)).json();
  const item = items.items.find((row) => row.itemId === 2001);
  const at = locations.items.find((row) => row.storageConditionCode !== undefined);
  const ok =
    typeof item?.storageConditionCode === 'string' &&
    at !== undefined &&
    item.storageConditionCode !== at.storageConditionCode;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} M-01-05 품목과 자리가 어긋나는 보관조건을 들고 온다`);
}

/*
 * W-04-05 IQC 대기 큐와 W-CO-09 결재(#1032).
 *
 * 씨앗에 IQC 의뢰가 없어 16번이 늘 「전체 0건」이었고, 승인 요청 «단건»을 씨앗이 다루지
 * 않아 목록과 상세가 다른 건을 가리켰다. 상세가 ETag 를 내지 않으면 화면은 승인 요청을
 * 아예 내지 못한다.
 *
 * 이 블록도 씨앗 상태를 바꾼다(요청 하나가 결재된다) - 그래서 뒤쪽에 둔다.
 */
{
  const queue = await (
    await fetch(`${BASE}/quality/inspection-requests?inspectionTypeCode=IQC&pendingOnly=true`)
  ).json();
  const list = await (await fetch(`${BASE}/app/approval-requests?pendingOnly=true`)).json();
  const target = list.items[0];
  const detailResponse = await fetch(
    `${BASE}/app/approval-requests/${String(target?.approvalRequestId ?? 0)}`,
  );
  const etag = detailResponse.headers.get('etag');
  const detail = await detailResponse.json();
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'seed-smoke-w-co-09-approve',
    'If-Match': etag ?? '',
  };
  /* 반려는 의견이 필수다 - 빈 의견은 400 으로 막힌다(공유계약 A-12). */
  const emptyReject = await fetch(
    `${BASE}/app/approval-requests/${String(target?.approvalRequestId ?? 0)}:reject`,
    {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': 'seed-smoke-w-co-09-reject-empty' },
      body: JSON.stringify({ comment: '' }),
    },
  );
  const approve = await fetch(
    `${BASE}/app/approval-requests/${String(target?.approvalRequestId ?? 0)}:approve`,
    { method: 'POST', headers, body: JSON.stringify({ comment: '수량 확인함' }) },
  );
  const approved = await approve.json();
  const ok =
    queue.items.length >= 1 &&
    queue.items.every((row) => row.inspectionTypeCode === 'IQC') &&
    /* 목록과 상세가 «같은 건»을 가리킨다 - 예시 서버가 답하면 여기서 갈린다. */
    detail.request?.approvalRequestNo === target?.approvalRequestNo &&
    typeof etag === 'string' &&
    detail.steps?.length >= 1 &&
    emptyReject.status === 400 &&
    approve.ok &&
    approved.steps?.[0]?.decisionCode === 'APPROVED';

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} W-04-05 IQC 큐와 W-CO-09 결재가 선다`);
}

/*
 * 라벨 발행 이력 조회가 **질의 축을 지키는가**(#1006).
 *
 * 씨앗이 이 경로를 다루지 않던 동안에는 계약 예시 서버가 답했고, 그쪽은 조건을 무시한 채 예시
 * 한 건을 그대로 돌려주었다 — 발행한 적 없는 LOT 이 「이미 발행됨(2회차)」으로 서서 생산 실적
 * 등록이 늘 재인쇄 갈래로 시작했다. 없는 번호로 물어도 같은 답이 왔다(실측).
 *
 * ⚠ **`ENTRIES` 에 둘 수 없다** — 그쪽은 「비면 실패」인데 여기서 재는 첫 조건은 「비어야
 *   통과」다. 두 규칙이 한 표에 들어가지 않아 제 블록으로 둔다.
 */
{
  const target = 8102;
  const scope = 'documentTypeCode=PRODUCTION_LOT_LABEL&targetTypeCode=LOT';
  const ask = async (query) => (await fetch(`${BASE}/app/document-issues?${query}`)).json();

  const before = await ask(`${scope}&targetId=${String(target)}`);
  const missing = await ask(`${scope}&targetId=999999`);

  await fetch(`${BASE}/app/document-issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'seed-smoke-p-02-04-label' },
    body: JSON.stringify({
      documentTypeCode: 'PRODUCTION_LOT_LABEL',
      targets: [{ targetTypeCode: 'LOT', targetId: target, lotId: target }],
    }),
  });

  const after = await ask(`${scope}&targetId=${String(target)}`);
  const other = await ask(`${scope}&targetId=8103`);
  /* 계약이 둔 축이다 — 개체 단위 출력물을 LOT 으로 모아 볼 때 쓴다(listDocumentIssues). */
  const byLot = await ask(`${scope}&lotId=${String(target)}`);
  const byOtherLot = await ask(`${scope}&lotId=8103`);

  const ok =
    before.items.length === 0 &&
    missing.items.length === 0 &&
    after.items.length === 1 &&
    after.items[0].targetId === target &&
    after.items[0].issueSeq === 1 &&
    other.items.length === 0 &&
    byLot.items.length === 1 &&
    byOtherLot.items.length === 0;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} P-02-04 라벨 발행 이력이 대상·LOT 축을 거른다`);
}

/*
 * 실적 입력 -> 마감 -> 포장 체인의 가운데 토막(#1031).
 *
 * 이 경로가 없어 계약 예시 서버가 받아 400 을 돌려주었고, 88단계 시험이 46번에서 멈춰 그
 * 뒤의 포장 - 납품 라벨까지 볼 수 없었다.
 *
 * 이 블록은 씨앗 상태를 바꾼다(현재 생산 LOT 이 마감된다) - 그래서 맨 뒤에 둔다.
 */
{
  const detail = await fetch(`${BASE}/trace/lots/8103`);
  const etag = detail.headers.get('etag');
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'seed-smoke-p-02-04-complete',
    'X-Worker-No': '100027',
  };
  const body = JSON.stringify({
    businessDate: '2026-09-11',
    occurredAt: '2026-09-11T11:30:00+09:00',
  });
  const complete = await fetch(`${BASE}/trace/lots/8103:complete`, {
    method: 'POST',
    headers: { ...headers, 'If-Match': etag ?? '' },
    body,
  });
  const completed = await complete.json();
  /* 되돌릴 수 없는 전이다 - 다른 키로 다시 부르면 거절한다. */
  const again = await fetch(`${BASE}/trace/lots/8103:complete`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': 'seed-smoke-p-02-04-complete-again' },
    body,
  });
  const packing = await (await fetch(`${BASE}/trace/lots?workOrderId=11002&completed=true`)).json();
  const ok =
    typeof etag === 'string' &&
    complete.ok &&
    typeof completed.completedAt === 'string' &&
    again.status === 409 &&
    packing.items.some((row) => row.lotId === 8103);

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} P-02-04 생산 LOT 마감이 포장 대상으로 이어진다`);
}

/*
 * P-02-13 검사 결과 저장 - 되읽기 체인(#1154).
 *
 * 이 경로가 통째로 없어 확정을 보내도 남는 것이 없었고, PQC 의 「확정 이후」 갈래를 목으로
 * 한 번도 밟을 수 없었다. 저장한 것이 목록 · 단건 · 측정치로 «되읽혀야» 체인이 산다.
 *
 * ⛔ 검사 «의뢰»의 상태는 변하지 않아야 한다 - 누가 옮기는지가 설계에 없다(#1146).
 */
{
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'seed-smoke-p-02-13-confirm',
  };
  const saved = await fetch(`${BASE}/quality/inspection-results`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inspectionRequestId: 16001,
      inspectedQty: 120,
      acceptedQty: 120,
      rejectedQty: 0,
      heldQty: 0,
      uomId: 1001,
      overallJudgmentCode: 'ACCEPTED',
      inspectedAt: '2026-09-11T13:00:00+09:00',
      statusCode: 'CONFIRMED',
      measurements: [
        {
          inspectionItemSpecId: 7102,
          sampleNo: 1,
          numericValue: 12,
          judgmentCode: 'ACCEPTED',
          measuredAt: '2026-09-11T13:00:00+09:00',
        },
      ],
    }),
  });
  const created = await saved.json();
  const resultId = Number(created.inspectionResultId);

  const rounds = await (
    await fetch(`${BASE}/quality/inspection-results?inspectionRequestId=16001`)
  ).json();
  const single = await fetch(`${BASE}/quality/inspection-results/${String(resultId)}`);
  const measurements = await (
    await fetch(`${BASE}/quality/inspection-results/${String(resultId)}/measurements`)
  ).json();
  /* 유계가 아니면 400 이다(L-3) - 전수 조회를 열어 두지 않는다. */
  const unbounded = await fetch(`${BASE}/quality/inspection-results`);
  const request = await (await fetch(`${BASE}/quality/inspection-requests/16001`)).json();

  const ok =
    saved.status === 201 &&
    created.statusCode === 'CONFIRMED' &&
    created.inspectionRound === 1 &&
    rounds.items.some((row) => row.inspectionResultId === resultId) &&
    typeof single.headers.get('etag') === 'string' &&
    measurements.items.some((row) => row.numericValue === 12) &&
    unbounded.status === 400 &&
    request.statusCode === 'REQUESTED';

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} P-02-13 확정한 검사 결과가 목록 · 단건 · 측정치로 되읽힌다`);
}

/*
 * P-02-13 확정 경로(`:confirm`)와 **이름 경로가 번호 자리에 먹히지 않는 것**(#1157 리뷰).
 *
 * ⛔ `/quality/inspection-results/{id}` 를 세우면서 같은 깊이의 `…/summary` ·
 *    `…/defect-rate-trend` 를 삼켜 404 를 냈다. 종전에는 Prism 으로 넘어가 답하던 자리라
 *    W-03-05 의 요약·추이 패널이 «조용히» 고장 났다 — 감지기가 없어 게이트는 초록이었다.
 */
{
  const save = await fetch(`${BASE}/quality/inspection-results`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'seed-smoke-p-02-13-draft',
    },
    body: JSON.stringify({
      inspectionRequestId: 16001,
      /* 소수 수량 - 부동소수를 그대로 견주면 여기서 합계가 어긋난다. */
      inspectedQty: 1,
      acceptedQty: 0.7,
      rejectedQty: 0.2,
      heldQty: 0.1,
      uomId: 1001,
      inspectedAt: '2026-09-11T14:00:00+09:00',
      statusCode: 'DRAFT',
    }),
  });
  const draft = await save.json();
  const resultId = Number(draft.inspectionResultId);
  const path = `${BASE}/quality/inspection-results/${String(resultId)}`;

  const etag = (await fetch(path)).headers.get('etag') ?? '';
  const confirmHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'seed-smoke-p-02-13-confirm-action',
    'If-Match': etag,
  };
  const body = JSON.stringify({ overallJudgmentCode: 'ACCEPTED' });

  /*
   * If-Match 를 안 실으면 막힌다 - 계약이 필수로 못박았다.
   *
   * ⛔ **아래 확정과 «같은 키»를 쓴다.** 거부를 멱등 캐시가 기억하면, 토큰을 제대로 실어
   *    다시 보내도 옛 400 이 그대로 되돌아온다 - 고친 뒤 재시도가 영영 막힌다.
   */
  const noToken = await fetch(`${path}:confirm`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': confirmHeaders['Idempotency-Key'],
    },
    body,
  });
  const confirmed = await fetch(`${path}:confirm`, {
    method: 'POST',
    headers: confirmHeaders,
    body,
  });
  const settled = await confirmed.json();
  /* 같은 키로 다시 오면 최초 응답을 재생한다 - 없는 충돌을 지어내지 않는다. */
  const replay = await fetch(`${path}:confirm`, { method: 'POST', headers: confirmHeaders, body });

  /*
   * 같은 깊이의 이름 경로가 번호 자리에 먹히지 않는다.
   *
   * ⚠ **200 을 요구하지 않는다** — 이 둘은 씨앗이 다루지 않아 Prism 이 답하는 자리이고,
   *    Prism 은 목보다 늦게 뜬다. 재는 것은 「목이 «자기» 404 로 가로챘는가」 하나다.
   */
  const swallowed = async (path) => {
    const answer = await fetch(`${BASE}${path}`);

    if (answer.status !== 404) return false;

    const problem = await answer.json().catch(() => ({}));

    return problem.code === 'NOT_FOUND';
  };

  const summarySwallowed = await swallowed('/quality/inspection-results/summary');
  const trendSwallowed = await swallowed('/quality/inspection-results/defect-rate-trend');

  /*
   * ⛔ **거부가 재시도를 영영 막지 않는다**(#1157 2회차 리뷰). 합계를 어긋나게 저장한 회차를
   *    같은 키로 확정하면 400 이 오는데, 그 400 이 캐시되면 수량을 고쳐도 같은 400 이
   *    되돌아온다. 그리고 거부된 확정이 판정·비고를 «이미 써 두면» 안 된다.
   */
  const bad = await fetch(`${BASE}/quality/inspection-results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'seed-smoke-p-02-13-bad' },
    body: JSON.stringify({
      inspectionRequestId: 16001,
      inspectedQty: 10,
      acceptedQty: 4,
      rejectedQty: 0,
      heldQty: 0,
      uomId: 1001,
      overallJudgmentCode: 'REJECTED',
      remarks: 'orig',
      inspectedAt: '2026-09-11T15:00:00+09:00',
      statusCode: 'DRAFT',
    }),
  });
  const badRound = await bad.json();
  const badPath = `${BASE}/quality/inspection-results/${String(badRound.inspectionResultId)}`;
  const badEtag = (await fetch(badPath)).headers.get('etag') ?? '';
  const badHeaders = {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'seed-smoke-p-02-13-retry',
    'If-Match': badEtag,
  };
  const rejected = await fetch(`${badPath}:confirm`, {
    method: 'POST',
    headers: badHeaders,
    body: JSON.stringify({ overallJudgmentCode: 'ACCEPTED', remarks: 'changed' }),
  });
  /* 거부된 확정이 저장본을 건드리지 않았는가. */
  const untouched = await (await fetch(badPath)).json();

  const ok =
    save.status === 201 &&
    noToken.status === 400 &&
    confirmed.status === 200 &&
    confirmed.headers.get('etag') !== null &&
    settled.statusCode === 'CONFIRMED' &&
    settled.overallJudgmentCode === 'ACCEPTED' &&
    settled.versionNo === 2 &&
    replay.status === 200 &&
    rejected.status === 400 &&
    untouched.overallJudgmentCode === 'REJECTED' &&
    untouched.remarks === 'orig' &&
    untouched.statusCode === 'DRAFT' &&
    !summarySwallowed &&
    !trendSwallowed;

  if (!ok) failed += 1;
  console.log(`${ok ? '✔' : '✘'} P-02-13 확정이 토큰을 요구하고, 이름 경로가 번호에 먹히지 않는다`);
}

console.log(
  failed === 0
    ? `\n화면 ${String(ENTRIES.length + DETAILS.length)}자리 전부 열립니다.`
    : `\n${String(failed)}자리가 비어 화면이 서지 않습니다.`,
);

finish();
