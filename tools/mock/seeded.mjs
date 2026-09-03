/**
 * 상태 기반 목 서버.
 *
 * Prism 은 example 을 돌려줄 뿐 상태가 없어, 만든 것이 목록에 나타나지 않고 서로 이어진
 * 데이터도 없다. 그래서 발주가 없어 입하를 못 열고, 지시가 없어 적치를 못 열었다.
 *
 * 여기서는 씨앗 하나로 이어진 데이터를 만들고, 화면이 실제로 거는 필터를 그대로 건다.
 * 쓰기는 상태를 바꾼다 - 적치를 끝내면 지시 목록에서 빠지고, 인계하면 기록이 쌓인다.
 *
 * 모르는 경로는 Prism 으로 넘긴다. 계약 전체를 여기서 다시 구현하지 않는다.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';

import { writeMergedSpec } from '../merge-spec.mjs';
import { resolveSpecPaths } from './resolve-spec.mjs';
import { createSeed } from './seed.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 4010);
/*
 * 기본으로 모든 인터페이스에 묶는다. 실기(PDA)는 Wi-Fi 로 이 기계의 LAN 주소를 부르는데,
 * 루프백에만 묶으면 단말에서 닿지 않는다 - 화면은 「연결을 확인하세요」만 말하고 이유를
 * 알려 주지 않는다.
 */
const HOST = process.env.MOCK_HOST ?? '0.0.0.0';
/** Prism 은 뒤에 숨겨 두고 모르는 경로만 넘긴다. */
const FALLBACK_PORT = PORT + 1;

/** 실기가 부를 주소. 사람이 찾아 헤매지 않게 띄울 때 함께 적는다. */
const lanAddresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry !== undefined && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);

const state = createSeed();
let nextId = 900001;
const newId = () => (nextId += 1);

const page = (items, query) => {
  const size = Number(query.get('size') ?? 20);
  const at = Number(query.get('page') ?? 0);
  const from = at * size;

  return {
    items: items.slice(from, from + size),
    page: { page: at, size, total: items.length, totalElements: items.length, totalPages: 1 },
  };
};

const num = (query, key) => (query.has(key) ? Number(query.get(key)) : null);
const bool = (query, key) => (query.has(key) ? query.get(key) === 'true' : null);

/** 질의로 준 축만 건다. 안 준 축으로 거르면 화면이 이유 없이 빈 목록을 받는다. */
const keep = (rows, checks) => rows.filter((row) => checks.every((check) => check(row)));

const byNum = (query, key, field) => {
  const value = num(query, key);
  return (row) => value === null || row[field] === value;
};

const byText = (query, key, field) => {
  const value = query.get(key);
  return (row) => value === null || value === '' || row[field] === value;
};

const contains = (query, key, field) => {
  const value = query.get(key);
  return (row) => value === null || value === '' || String(row[field] ?? '').includes(value);
};

const withProgress = (lot) => ({ ...lot, progress: lot.progress ?? undefined });

const routes = [];
const on = (method, pattern, handle) => {
  const keys = [];
  const source = pattern
    .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
    .replace(/\{([a-zA-Z]+)\}/g, (_, key) => {
      keys.push(key);
      return '([^/:]+)';
    });
  routes.push({ method, matcher: new RegExp(`^${source}$`), keys, handle });
};

/* ── 기준정보 ─────────────────────────────────────────────── */

on('GET', '/mdm/workers', (_p, query) =>
  page(keep(state.workers, [contains(query, 'q', 'workerNo')]), query),
);

on('GET', '/mdm/items', (_p, query) =>
  page(keep(state.items, [contains(query, 'q', 'itemCode')]), query),
);
on('GET', '/mdm/items/{itemId}', (params) => {
  const item = state.items.find((each) => each.itemId === Number(params.itemId));
  return item === undefined ? null : { item, editability: { editable: true } };
});

on('GET', '/mdm/uoms', (_p, query) => page(state.uoms, query));

on('GET', '/mdm/warehouses', (_p, query) => page(state.warehouses, query));
on('GET', '/mdm/warehouses/{warehouseId}', (params) => {
  const warehouse = state.warehouses.find(
    (each) => each.warehouseId === Number(params.warehouseId),
  );
  return warehouse === undefined ? null : { warehouse, editability: { editable: true } };
});

on('GET', '/mdm/locations', (_p, query) =>
  page(
    keep(state.locations, [
      byNum(query, 'warehouseId', 'warehouseId'),
      byText(query, 'locationCode', 'locationCode'),
      contains(query, 'q', 'locationCode'),
    ]),
    query,
  ),
);
on('GET', '/mdm/locations/{locationId}', (params) => {
  const location = state.locations.find((each) => each.locationId === Number(params.locationId));
  return location === undefined ? null : { location, editability: { editable: true } };
});

on('GET', '/mdm/partners', (_p, query) =>
  page(keep(state.partners, [byText(query, 'roleTypeCode', 'roleTypeCode')]), query),
);

on('GET', '/mdm/equipments', (_p, query) =>
  page(keep(state.equipments, [contains(query, 'q', 'equipmentCode')]), query),
);
on('GET', '/mdm/equipments/{equipmentId}/inspection-items', (params, query) =>
  page(
    keep(state.inspectionItems, [
      (row) => row.equipmentId === Number(params.equipmentId),
      byText(query, 'inspectionTypeCode', 'inspectionTypeCode'),
    ]),
    query,
  ),
);

on('GET', '/mdm/code-values', (_p, query) => {
  const group = query.get('codeGroupCode') ?? '';
  const values = state.codeValues[group] ?? [];

  return page(
    values.map(([code, name], index) => ({
      codeValueId: 20000 + index,
      codeGroupId: 2000,
      codeGroupCode: group,
      code,
      codeName: name,
      nameKo: name,
      nameVi: null,
      displayOrder: index + 1,
      isActive: true,
    })),
    query,
  );
});

on('GET', '/mdm/terminals/{terminalId}/processes', () => ({
  items: [
    {
      processId: 1001,
      processName: '사출',
      canStartWork: true,
      canCompleteWork: true,
      canInputMaterial: true,
      canInputResult: true,
      canInputInspection: true,
      canPrintLabel: true,
      canCancelInput: true,
      canReturnMaterial: true,
    },
  ],
}));

/* ── 추적 ─────────────────────────────────────────────────── */

on('GET', '/trace/lots', (_p, query) => {
  const completed = bool(query, 'completed');
  const heldOnly = bool(query, 'heldOnly');

  return page(
    keep(state.lots, [
      byText(query, 'lotNo', 'lotNo'),
      contains(query, 'q', 'lotNo'),
      byNum(query, 'itemId', 'itemId'),
      byText(query, 'lotTypeCode', 'lotTypeCode'),
      byText(query, 'statusCode', 'statusCode'),
      byNum(query, 'workOrderId', 'sourceId'),
      (row) => completed === null || (row.completedAt !== null) === completed,
      (row) => heldOnly === null || row.held === heldOnly,
    ]).map(withProgress),
    query,
  );
});

on('GET', '/trace/lots/{lotId}', (params) => {
  const lot = state.lots.find((each) => each.lotId === Number(params.lotId));

  return lot === undefined
    ? null
    : {
        lot: withProgress(lot),
        externalIdentifiers: [],
        holds: state.holds.filter((hold) => hold.lotId === lot.lotId && hold.releasedAt === null),
      };
});

on('GET', '/trace/lots/{lotId}/holds', (params, query) =>
  page(
    state.holds.filter((hold) => hold.lotId === Number(params.lotId) && hold.releasedAt === null),
    query,
  ),
);

/* ── 문서 발행·인쇄 ───────────────────────────────────────── */

const targetIds = (query) =>
  query
    .getAll('targetIds')
    .flatMap((value) => value.split(','))
    .map(Number)
    .filter(Number.isFinite);

on('GET', '/app/document-issues/summary', (_params, query) => {
  const targetTypeCode = query.get('targetTypeCode');
  const documentTypeCode = query.get('documentTypeCode');

  return {
    items: targetIds(query).map((targetId) => {
      const issues = state.documentIssues.filter(
        (issue) =>
          issue.targetId === targetId &&
          issue.targetTypeCode === targetTypeCode &&
          issue.documentTypeCode === documentTypeCode,
      );
      const last = issues.at(-1);

      return {
        targetTypeCode,
        targetId,
        issueCount: issues.length,
        ...(last === undefined
          ? {}
          : {
              lastIssueSeq: last.issueSeq,
              lastIssuedAt: last.issuedAt,
              lastPrintOutcome: last.printOutcome,
            }),
      };
    }),
  };
});

on('POST', '/app/document-issues', (_params, _query, body) => {
  const items = (body?.targets ?? []).map((target) => {
    const lot = state.lots.find((row) => row.lotId === target.lotId);
    const issueSeq =
      state.documentIssues.filter(
        (issue) =>
          issue.targetId === target.targetId &&
          issue.targetTypeCode === target.targetTypeCode &&
          issue.documentTypeCode === body.documentTypeCode,
      ).length + 1;
    const issue = {
      documentIssueLogId: newId(),
      documentTypeCode: body.documentTypeCode,
      targetTypeCode: target.targetTypeCode,
      targetId: target.targetId,
      lotId: target.lotId,
      issueSeq,
      issuedAt: new Date().toISOString(),
      printOutcome: 'PENDING',
    };
    state.documentIssues.push(issue);

    return {
      ...issue,
      target: { displayName: lot?.lotNo ?? String(target.targetId) },
    };
  });

  return { created: { items, issuedCount: items.length }, status: 201 };
});

on('GET', '/app/document-issues/{documentIssueLogId}/rendition', () => ({
  format: 'png',
  content: 'synthetic-label',
}));

on('POST', '/app/document-issues/{documentIssueLogId}:report-print', (params, _query, body) => {
  const issue = state.documentIssues.find(
    (row) => row.documentIssueLogId === Number(params.documentIssueLogId),
  );
  if (issue === undefined) return null;

  issue.printOutcome = body?.outcome ?? 'FAILED';
  return { issue };
});

on('POST', '/trace/lots/{lotId}:request-iqc-skip', (params, _q, body) => {
  const request = {
    approvalRequestId: newId(),
    approvalTypeCode: 'IQC_SKIP',
    targetTypeCode: 'INBOUND_LOT',
    targetId: Number(params.lotId),
    requestedByWorkerNo: body?.requestedByWorkerNo ?? '100027',
    requestedAt: new Date().toISOString(),
    reason: body?.reason ?? '',
    statusCode: 'PENDING',
    isMyTurn: false,
  };

  state.approvalRequests.push(request);
  return { created: request, status: 201 };
});

/* ── 재고 ─────────────────────────────────────────────────── */

on('GET', '/inventory/balances', (_p, query) =>
  page(
    keep(state.balances, [
      byNum(query, 'lotId', 'lotId'),
      byNum(query, 'itemId', 'itemId'),
      byNum(query, 'warehouseId', 'warehouseId'),
      byNum(query, 'locationId', 'locationId'),
      (row) => bool(query, 'includeZero') === true || row.onHandQty !== 0,
    ]),
    query,
  ),
);

on('GET', '/inventory/handling-units', (_p, query) =>
  page(
    keep(state.handlingUnits, [
      contains(query, 'q', 'handlingUnitNo'),
      byNum(query, 'warehouseId', 'warehouseId'),
      byNum(query, 'locationId', 'locationId'),
    ]),
    query,
  ),
);

on('GET', '/inventory/handling-units/{handlingUnitId}', (params) => {
  const id = Number(params.handlingUnitId);
  const handlingUnit = state.handlingUnits.find((each) => each.handlingUnitId === id);

  return handlingUnit === undefined
    ? null
    : {
        handlingUnit,
        contents: state.handlingUnitContents.filter((each) => each.handlingUnitId === id),
      };
});

on('GET', '/inventory/handling-units/{handlingUnitId}/contents', (params) => ({
  items: state.handlingUnitContents.filter(
    (each) => each.handlingUnitId === Number(params.handlingUnitId),
  ),
}));

on('POST', '/inventory/handling-units', (_p, _q, body) => {
  const handlingUnitId = newId();
  const created = {
    handlingUnitId,
    handlingUnitNo: `HU-2026-${String(handlingUnitId).slice(-6)}`,
    handlingUnitTypeCode: body?.handlingUnitTypeCode ?? 'CARTON',
    parentHandlingUnitId: body?.parentHandlingUnitId ?? null,
    warehouseId: body?.warehouseId ?? null,
    locationId: body?.locationId ?? null,
    statusCode: 'ACTIVE',
  };

  state.handlingUnits.push(created);

  const contents = (body?.contents ?? []).map((content) => ({
    handlingUnitContentId: newId(),
    handlingUnitId,
    ...content,
  }));

  state.handlingUnitContents.push(...contents);

  /* 계약의 201 은 HandlingUnitDetailResponse 다 — 취급 단위만 내리면 화면이 번호를 못 읽는다. */
  return { created: { handlingUnit: created, contents }, status: 201 };
});

/*
 * 포장 확정 — 내용물 N 행이 한 트랜잭션으로 실린다(P-02-08 · 계약 :pack).
 *
 * 씨앗에 두지 않으면 Prism 이 받아 계약의 «첫» 응답인 400 을 돌려준다 — 화면을 손으로
 * 확인하는 사람은 자기 입력이 틀린 줄 안다.
 *
 * 치환이라 요청에서 빠진 줄은 지워진다. 빈 내용물은 계약대로 400 이다.
 */
on('POST', '/inventory/handling-units/{handlingUnitId}:pack', (params, _q, body) => {
  const id = Number(params.handlingUnitId);
  const handlingUnit = state.handlingUnits.find((each) => each.handlingUnitId === id);

  if (handlingUnit === undefined) return null;

  const items = body?.contents ?? [];

  if (items.length === 0) {
    return {
      status: 400,
      created: {
        errors: [
          { scope: 'request', code: 'EMPTY_CONTENTS', message: '담은 것이 없습니다.' },
        ],
      },
    };
  }

  if (handlingUnit.statusCode === 'PACKED') {
    return {
      status: 409,
      created: {
        errors: [{ scope: 'request', code: 'ALREADY_PACKED', message: '이미 확정된 포장입니다.' }],
      },
    };
  }

  state.handlingUnitContents = state.handlingUnitContents.filter(
    (each) => each.handlingUnitId !== id,
  );

  const contents = items.map((content) => ({
    handlingUnitContentId: newId(),
    handlingUnitId: id,
    ...content,
  }));

  state.handlingUnitContents.push(...contents);
  handlingUnit.statusCode = 'PACKED';

  return { handlingUnit, contents };
});

/* 치환이라 요청에서 빠진 줄은 지워진다. 실서버와 같은 성격이어야 화면이 그것을 시험할 수 있다. */
on('PUT', '/inventory/handling-units/{handlingUnitId}/contents', (params, _q, body) => {
  const id = Number(params.handlingUnitId);
  state.handlingUnitContents = state.handlingUnitContents.filter(
    (each) => each.handlingUnitId !== id,
  );

  const items = (body?.items ?? []).map((content) => ({
    handlingUnitContentId: newId(),
    handlingUnitId: id,
    ...content,
  }));

  state.handlingUnitContents.push(...items);
  return { items };
});

/* ── 물류 ─────────────────────────────────────────────────── */

on('GET', '/logistics/purchase-orders', (_p, query) =>
  page(
    keep(state.purchaseOrders, [
      byText(query, 'statusCode', 'statusCode'),
      contains(query, 'q', 'purchaseOrderNo'),
    ]),
    query,
  ),
);

on('GET', '/logistics/purchase-orders/{purchaseOrderId}/lines', (params) => ({
  items: state.purchaseOrderLines.filter(
    (line) => line.purchaseOrderId === Number(params.purchaseOrderId),
  ),
}));

on('GET', '/logistics/inbound-receipts', (_p, query) =>
  page(
    keep(state.inboundReceipts, [
      byNum(query, 'supplierId', 'supplierId'),
      contains(query, 'q', 'inboundReceiptNo'),
    ]),
    query,
  ),
);

on('GET', '/logistics/inbound-receipts/{inboundReceiptId}/lines', (params) => ({
  items: state.inboundReceiptLines.filter(
    (line) => line.inboundReceiptId === Number(params.inboundReceiptId),
  ),
}));

on('POST', '/logistics/inbound-receipts', (_p, _q, body) => {
  const inboundReceiptId = newId();
  const created = {
    inboundReceiptId,
    inboundReceiptNo: `IR-2026-${String(inboundReceiptId).slice(-6)}`,
    supplierId: body?.supplierId ?? 4001,
    plantId: body?.plantId ?? state.plantId,
    receiptDatetime: body?.receiptDatetime ?? new Date().toISOString(),
    deliveryNoteNo: body?.deliveryNoteNo ?? null,
    businessDate: body?.businessDate ?? state.today,
    statusCode: 'RECEIVED',
  };

  state.inboundReceipts.push(created);

  const lines = (body?.lines ?? []).map((line, index) => {
    const inboundReceiptLineId = newId();
    /* 줄 번호는 서버가 붙인다. 없으면 화면이 「undefined번 줄」을 보인다. */
    const lineNo = index + 1;

    /* 사전부착 라인은 자재 LOT 이 함께 생기고 검사 대기로 보류된다. */
    let lotId = null;

    if (line.supplierLotMissing !== true && line.supplierLotNo) {
      lotId = newId();
      state.lots.push({
        lotId,
        lotNo: line.supplierLotNo,
        itemId: line.itemId,
        lotTypeCode: 'MATERIAL',
        plantId: state.plantId,
        initialQty: line.receivedQty,
        uomId: line.uomId,
        manufacturedAt: line.manufacturedDate ?? null,
        expiryDate: line.expiryDate ?? null,
        sourceTypeCode: 'INBOUND_RECEIPT',
        sourceId: inboundReceiptId,
        statusCode: 'INSPECTION_PENDING',
        lifecycleStatusCode: null,
        parentLotId: null,
        completedAt: null,
        bomSnapshot: null,
        remarks: null,
        held: true,
        receiptDispositionCode: null,
      });
      state.holds.push({
        lotHoldId: newId(),
        lotId,
        reasonCode: 'INSPECTION_PENDING',
        holdQty: null,
        uomId: line.uomId,
        releaseCondition: '수입검사 합격',
        statusCode: 'OPEN',
        heldAt: new Date().toISOString(),
        releasedAt: null,
      });
    }

    /* 누적 입하가 늘어야 다음 회차의 남은 예정이 줄어든다. */
    const poLine = state.purchaseOrderLines.find(
      (each) => each.purchaseOrderLineId === line.purchaseOrderLineId,
    );

    if (poLine !== undefined) {
      poLine.receivedQty += line.receivedQty;
    }

    return { inboundReceiptLineId, inboundReceiptId, lineNo, ...line, lotId, labelIssued: false };
  });

  state.inboundReceiptLines.push(...lines);
  return { created: { inboundReceipt: created, lines }, status: 201 };
});

on('GET', '/logistics/inbound-receipt-lines/{inboundReceiptLineId}/variances', (params) => ({
  items: state.inboundVariances.filter(
    (each) => each.inboundReceiptLineId === Number(params.inboundReceiptLineId),
  ),
}));

on(
  'POST',
  '/logistics/inbound-receipt-lines/{inboundReceiptLineId}/variances',
  (params, _q, body) => {
    const created = {
      inboundVarianceId: newId(),
      inboundReceiptLineId: Number(params.inboundReceiptLineId),
      ...body,
      statusCode: 'OPEN',
    };

    state.inboundVariances.push(created);
    return { created, status: 201 };
  },
);

on('GET', '/logistics/putaway-tasks', (_p, query) =>
  page(
    keep(state.putawayTasks, [
      byNum(query, 'assignedWorkerId', 'assignedWorkerId'),
      byNum(query, 'warehouseId', 'warehouseId'),
      byText(query, 'statusCode', 'statusCode'),
      (row) => row.completedAt === null,
    ]),
    query,
  ),
);

const completePutaway = (params, _q, body, temporary) => {
  const task = state.putawayTasks.find(
    (each) => each.putawayTaskId === Number(params.putawayTaskId),
  );

  if (task === undefined) {
    return null;
  }

  task.actualLocationId = body?.actualLocationId ?? null;
  task.completedAt = new Date().toISOString();
  task.statusCode = temporary ? 'TEMPORARY' : 'COMPLETED';

  /* 적치가 끝나면 재고가 그 위치로 간다 - 위치 확인 화면이 그 결과를 보인다. */
  const balance = state.balances.find((each) => each.lotId === task.lotId);

  if (balance !== undefined && task.actualLocationId !== null) {
    balance.locationId = task.actualLocationId;
  }

  return { ...task };
};

on('POST', '/logistics/putaway-tasks/{putawayTaskId}:complete', (p, q, body) =>
  completePutaway(p, q, body, false),
);
on('POST', '/logistics/putaway-tasks/{putawayTaskId}:complete-temporary', (p, q, body) =>
  completePutaway(p, q, body, true),
);

on('GET', '/inventory/reservations', (_p, query) =>
  page(
    keep(state.reservations, [
      byNum(query, 'lotId', 'lotId'),
      byNum(query, 'itemId', 'itemId'),
      (row) => bool(query, 'openOnly') !== true || row.consumedQty < row.reservedQty,
    ]),
    query,
  ),
);

on('GET', '/logistics/picking-orders', (_p, query) =>
  page(
    keep(state.pickingOrders, [
      byNum(query, 'assignedWorkerId', 'assignedWorkerId'),
      byNum(query, 'warehouseId', 'warehouseId'),
      byText(query, 'statusCode', 'statusCode'),
    ]),
    query,
  ),
);

on('GET', '/logistics/picking-orders/{pickingOrderId}', (params) => {
  const id = Number(params.pickingOrderId);
  const order = state.pickingOrders.find((each) => each.pickingOrderId === id);

  return order === undefined
    ? null
    : {
        pickingOrder: order,
        lines: state.pickingLines.filter((line) => line.pickingOrderId === id),
      };
});

/* 집은 양은 서버가 더한다. 화면이 그 셈을 따로 하지 않는다. */
on(
  'POST',
  '/logistics/picking-orders/{pickingOrderId}/lines/{pickingLineId}:pick',
  (params, _q, body) => {
    const line = state.pickingLines.find(
      (each) => each.pickingLineId === Number(params.pickingLineId),
    );

    if (line === undefined) {
      return null;
    }

    /* 보류 중인 LOT 은 서버가 막는다. 화면이 비활성으로 두더라도 정본은 여기다. */
    if (line.held === true) {
      return {
        status: 400,
        created: { code: 'LOT_ON_HOLD', message: '보류 중인 LOT 입니다.', errors: [] },
      };
    }

    if (body?.lotId !== undefined && body.lotId !== null && body.lotId !== line.lotId) {
      return {
        status: 400,
        created: { code: 'LOT_MISMATCH', message: '계획과 다른 LOT 입니다.', errors: [] },
      };
    }

    line.pickedQty += body?.pickedQty ?? 0;

    const balance = state.balances.find((each) => each.lotId === line.lotId);

    if (balance !== undefined) {
      balance.pickedQty += body?.pickedQty ?? 0;
      balance.availableQty = balance.onHandQty - balance.pickedQty - balance.blockedQty;
    }

    return { ...line };
  },
);

on('POST', '/logistics/goods-issues', (_p, _q, body) => {
  const goodsIssueId = newId();
  const created = {
    goodsIssueId,
    goodsIssueNo: `GI-2026-${String(goodsIssueId).slice(-6)}`,
    ...body,
    statusCode: body?.postImmediately === true ? 'POSTED' : 'DRAFT',
  };

  state.goodsIssues.push(created);

  /* 전기하면 재고가 실제로 빠진다. 위치 확인 화면이 그 결과를 보인다. */
  for (const line of body?.lines ?? []) {
    const balance = state.balances.find((each) => each.lotId === line.lotId);

    if (balance !== undefined) {
      balance.onHandQty -= line.issueQty;
      balance.pickedQty = Math.max(0, balance.pickedQty - line.issueQty);
      balance.availableQty = balance.onHandQty - balance.pickedQty - balance.blockedQty;
    }
  }

  return { created, status: 201 };
});

on('GET', '/logistics/shipment-requests', (_p, query) => {
  const from = query.get('shipDateFrom');
  const to = query.get('shipDateTo');

  const rows = keep(state.shipmentRequests, [
    (row) => from === null || row.shipDate >= from,
    (row) => to === null || row.shipDate <= to,
    byText(query, 'statusCode', 'statusCode'),
  ]).map((request) => ({
    ...request,
    lines: state.shipmentRequestLines.filter(
      (line) => line.shipmentRequestId === request.shipmentRequestId,
    ),
  }));

  return page(rows, query);
});

on(
  'POST',
  '/logistics/shipment-requests/{shipmentRequestId}/lines/{shipmentRequestLineId}:pick',
  (params, _q, body) => {
    const line = state.shipmentRequestLines.find(
      (each) => each.shipmentRequestLineId === Number(params.shipmentRequestLineId),
    );

    if (line === undefined) {
      return null;
    }

    line.pickedQty += body?.pickedQty ?? 0;

    const balance = state.balances.find((each) => each.lotId === body?.lotId);

    if (balance !== undefined) {
      balance.pickedQty += body?.pickedQty ?? 0;
      balance.availableQty = balance.onHandQty - balance.pickedQty - balance.blockedQty;
    }

    return { ...line };
  },
);

on('GET', '/logistics/goods-receipts', (_p, query) => page(state.goodsReceipts, query));

/* ── 생산 ─────────────────────────────────────────────────── */

on('GET', '/production/work-orders', (_p, query) => {
  const successorOf = num(query, 'successorOfWorkOrderId');

  return page(
    keep(state.workOrders, [
      (row) => successorOf === null || row.predecessorOfWorkOrderId === successorOf,
      byNum(query, 'productionPlanId', 'productionPlanId'),
      byText(query, 'statusCode', 'statusCode'),
      contains(query, 'q', 'workOrderNo'),
    ]),
    query,
  );
});

on('POST', '/production/operation-handovers', (_p, _q, body) => {
  const created = {
    operationHandoverId: newId(),
    handoverNo: `OH-2026-${String(nextId).slice(-6)}`,
    fromWorkOrderId: body?.fromWorkOrderId,
    toWorkOrderId: body?.toWorkOrderId,
    statusCode: 'RECEIVED',
    handedOverAt: body?.handedOverAt ?? new Date().toISOString(),
    /* 받는 쪽 화면이 없어 인계 확정과 같은 시각으로 함께 찍는다. */
    receivedAt: body?.handedOverAt ?? new Date().toISOString(),
    lines: (body?.lines ?? []).map((line) => ({ operationHandoverLineId: newId(), ...line })),
  };

  state.operationHandovers.push(created);
  return { created, status: 201 };
});

on('GET', '/production/operation-handovers', (_p, query) =>
  page(
    keep(state.operationHandovers, [
      byNum(query, 'fromWorkOrderId', 'fromWorkOrderId'),
      byNum(query, 'toWorkOrderId', 'toWorkOrderId'),
    ]),
    query,
  ),
);

on('GET', '/production/repair-executions', (_p, query) =>
  page(
    keep(state.repairExecutions, [
      byNum(query, 'lotId', 'lotId'),
      byNum(query, 'defectRecordId', 'defectRecordId'),
      (row) => bool(query, 'openOnly') !== true || row.returnedAt === null,
    ]),
    query,
  ),
);

on('POST', '/production/repair-executions', (_p, _q, body) => {
  const created = {
    repairExecutionId: newId(),
    ...body,
    returnedAt: null,
    repairResultCode: null,
    statusCode: 'IN_REPAIR',
  };

  state.repairExecutions.push(created);
  return { created, status: 201 };
});

on('POST', '/production/repair-executions/{repairExecutionId}:return', (params, _q, body) => {
  const execution = state.repairExecutions.find(
    (each) => each.repairExecutionId === Number(params.repairExecutionId),
  );

  if (execution === undefined) {
    return null;
  }

  Object.assign(execution, body, {
    returnedAt: new Date().toISOString(),
    statusCode: 'RETURNED',
  });

  return { ...execution };
});

on('POST', '/production/results', (_p, _q, body) => {
  const created = { productionResultId: newId(), ...body };
  state.productionResults.push(created);
  return { created, status: 201 };
});

/* ── 품질 ─────────────────────────────────────────────────── */

on('GET', '/quality/defect-records', (_p, query) => {
  const from = query.get('occurredFrom');
  const to = query.get('occurredTo');

  return page(
    keep(state.defectRecords, [
      byNum(query, 'lotId', 'lotId'),
      byNum(query, 'workOrderId', 'workOrderId'),
      (row) => from === null || row.occurredAt >= from,
      (row) => to === null || row.occurredAt <= to,
    ]),
    query,
  );
});

/* ── 설비·보전 ────────────────────────────────────────────── */

on('POST', '/maintenance/inspections', (_p, _q, body) => {
  const created = { inspectionId: newId(), ...body, statusCode: 'DONE' };
  state.inspections.push(created);
  return { created, status: 201 };
});

on('GET', '/maintenance/inspections', (_p, query) =>
  page(keep(state.inspections, [byNum(query, 'equipmentId', 'equipmentId')]), query),
);

on('GET', '/maintenance/breakdowns', (_p, query) =>
  page(keep(state.breakdowns, [byNum(query, 'equipmentId', 'equipmentId')]), query),
);

on('POST', '/maintenance/breakdowns', (_p, _q, body) => {
  const created = { breakdownId: newId(), ...body, statusCode: 'RECEIVED', attachments: [] };
  state.breakdowns.push(created);
  return { created, status: 201 };
});

on('POST', '/maintenance/breakdowns/{breakdownId}/attachments', (params, _q, body) => {
  const breakdown = state.breakdowns.find(
    (each) => each.breakdownId === Number(params.breakdownId),
  );

  if (breakdown === undefined) {
    return null;
  }

  const attachment = { attachmentId: newId(), fileName: body?.fileName ?? 'photo.jpg' };
  breakdown.attachments.push(attachment);
  return { created: attachment, status: 201 };
});

/* ── 공통 ─────────────────────────────────────────────────── */

on('GET', '/app/approval-requests', (_p, query, _b, headers) => {
  const requestedByMe = bool(query, 'requestedByMe');
  const workerNo = headers['x-worker-no'] ?? null;

  return page(
    keep(state.approvalRequests, [
      byText(query, 'targetTypeCode', 'targetTypeCode'),
      byNum(query, 'targetId', 'targetId'),
      (row) => bool(query, 'pendingOnly') !== true || row.statusCode === 'PENDING',
      /* 이 셸에는 계정 로그인이 없어 서버가 상신자를 푸는 근거가 사번 헤더뿐이다. */
      (row) => requestedByMe !== true || workerNo === null || row.requestedByWorkerNo === workerNo,
    ]),
    query,
  );
});

/* ── 서버 ─────────────────────────────────────────────────── */

const readBody = (request) =>
  new Promise((resolve) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');

      try {
        resolve(raw === '' ? null : JSON.parse(raw));
      } catch {
        resolve(null);
      }
    });
  });

const send = (response, status, payload) => {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
};

/** 모르는 경로는 Prism 이 계약대로 답한다. 계약 전체를 여기서 다시 구현하지 않는다. */
const forward = async (request, response, body) => {
  const target = `http://127.0.0.1:${String(FALLBACK_PORT)}${request.url}`;
  const headers = { ...request.headers };
  delete headers.host;
  delete headers['content-length'];

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    });
    const text = await upstream.text();

    response.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
    });
    response.end(text);
  } catch {
    send(response, 502, {
      code: 'MOCK_FALLBACK_UNAVAILABLE',
      message: 'Prism 에 닿지 못했습니다.',
    });
  }
};

const server = createServer((request, response) => {
  void (async () => {
    if (request.method === 'OPTIONS') {
      send(response, 204, {});
      return;
    }

    const url = new URL(request.url ?? '/', `http://127.0.0.1:${String(PORT)}`);
    const body = await readBody(request);

    for (const route of routes) {
      if (route.method !== request.method) {
        continue;
      }

      const matched = route.matcher.exec(decodeURIComponent(url.pathname));

      if (matched === null) {
        continue;
      }

      const params = Object.fromEntries(route.keys.map((key, at) => [key, matched[at + 1]]));
      const result = route.handle(params, url.searchParams, body, request.headers);

      if (result === null) {
        send(response, 404, { code: 'NOT_FOUND', message: '씨앗에 없는 자원입니다.' });
        return;
      }

      if (result !== null && typeof result === 'object' && 'status' in result) {
        send(response, result.status, result.created);
        return;
      }

      send(response, 200, result);
      return;
    }

    await forward(request, response, body);
  })();
});

const specPaths = resolveSpecPaths();
const mergedSpecPath = writeMergedSpec(specPaths);

const prism = spawn(
  'pnpm',
  ['exec', 'prism', 'mock', mergedSpecPath, '--host', '127.0.0.1', '--port', String(FALLBACK_PORT)],
  { stdio: ['ignore', 'ignore', 'inherit'] },
);

server.listen(PORT, HOST, () => {
  console.log(`상태 기반 목 서버: http://127.0.0.1:${String(PORT)}`);

  for (const address of lanAddresses()) {
    console.log(`  실기에서: http://${address}:${String(PORT)}`);
  }

  console.log(`  씨앗 기준일: ${state.today}`);
  console.log(`  사번: ${state.scannables.workerNos.join(' · ')}`);
  console.log(`  모르는 경로는 Prism(${String(FALLBACK_PORT)})으로 넘깁니다`);
});

const stop = () => {
  prism.kill();
  server.close();
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
