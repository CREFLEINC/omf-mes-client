import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';
import { businessDateOf } from '../putaway/putaway';

export type HandlingUnit = components['schemas']['HandlingUnit'];
export type HandlingUnitContent = components['schemas']['HandlingUnitContent'];
export type Warehouse = components['schemas']['Warehouse'];
export type Location = components['schemas']['Location'];
export type Lot = components['schemas']['Lot'];
export type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];
export type GoodsReceiptLineCreate = components['schemas']['GoodsReceiptLineCreate'];
export type PutawayTaskComplete = components['schemas']['PutawayTaskComplete'];
export type PutawayRule = components['schemas']['PutawayRule'];

/**
 * 담는 경로의 이름.
 *
 * 담는 쪽과 세는 쪽이 이 상수를 함께 쓴다. 문자열을 양쪽에 적으면 한쪽만 고쳐졌을 때 셈이
 * 조용히 0 이 되고, 같은 인식표를 두 번 입고하는 것을 막지 못한다.
 */
export const RECEIPT_LABEL = messages.productReceipt.record.received;
export const PUTAWAY_LABEL = messages.productReceipt.record.putaway;

/** 제품 입고다. 값 목록은 서버에서 받고 이 화면은 그중 이 값을 고른다. */
export const PRODUCT = 'PRODUCT';

/** 창고 관리 수준이 창고까지면 위치를 받지 않는다. 값 순서가 계층 깊이를 뜻한다. */
export const WAREHOUSE_LEVEL = 'WAREHOUSE';

/** 위치를 관리하지 않는 창고의 흡수용 위치. */
export const DEFAULT_LOCATION = 'DEFAULT';

/** 검사 대기 LOT 도 입고한다. 막히는 것은 하류의 피킹·출하다. */
export const INSPECTION_PENDING = 'INSPECTION_PENDING';

/** 들어오는 물건은 가용 재고로 선다. */
export const AVAILABLE = 'AVAILABLE';

/**
 * 화면이 든 한 줄.
 *
 * 수량은 실물대로 받는다 - 인식표가 말하는 수량과 달라도 막지 않는다. 다만 차이를 담을 자리가
 * 계약에 없어 사유를 지어내지 않는다.
 */
export interface DraftLine {
  handlingUnitContentId: number;
  itemId: number;
  lotId: number;
  uomId: number;
  /** 인식표가 말하는 수량. 실물과 다를 수 있다. */
  expectedQty: number;
  qty: string;
}

export type QtyProblem = 'notNumber' | 'negative' | 'zero';

/**
 * 실물 수량 하나를 본다.
 *
 * 0 을 막는다 - 계약이 입고 수량에 0 보다 큰 값을 요구한다. 아무것도 안 들어온 줄은 입고할
 * 것이 없다.
 */
export const qtyProblemOf = (line: DraftLine): QtyProblem | null => {
  const trimmed = line.qty.trim();

  if (trimmed === '') {
    return 'zero';
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value < 0) {
    return 'negative';
  }

  return value === 0 ? 'zero' : null;
};

/** 인식표가 말한 것과 실물이 다른가. 막지 않고 보이기만 한다. */
export const differsFromExpected = (line: DraftLine): boolean => {
  const trimmed = line.qty.trim();

  return trimmed !== '' && Number.isFinite(Number(trimmed)) && Number(trimmed) !== line.expectedQty;
};

/** 이 창고가 위치를 관리하는가. */
export const managesLocations = (warehouse: Warehouse | null): boolean =>
  warehouse !== null && warehouse.managementLevelCode !== WAREHOUSE_LEVEL;

/**
 * 목적지 위치를 정한다.
 *
 * 위치를 관리하는 창고면 스캔한 자리다. 관리하지 않으면 흡수용 대표 위치로 들어간다 -
 * 계약이 목적지를 필수로 요구해 비워 보낼 수 없다.
 *
 * 대표 위치가 없으면 지어내지 않는다. 아무 위치나 골라 넣으면 재고가 남의 자리에 선다.
 */
export const destinationOf = (
  warehouse: Warehouse | null,
  scanned: Location | null,
  locations: Location[],
): Location | null => {
  if (warehouse === null) {
    return null;
  }

  if (managesLocations(warehouse)) {
    return scanned;
  }

  return locations.find((each) => each.locationTypeCode === DEFAULT_LOCATION) ?? null;
};

/**
 * 이 품목이 이 창고에서 가야 할 자리.
 *
 * 적치 규칙이 여럿이면 우선순위가 앞선 것을 쓴다. 자리를 비운 규칙은 권장이 아니다 - 창고만
 * 정하고 칸을 정하지 않은 규칙이라 대조할 대상이 없다.
 */
export const recommendedOf = (rules: PutawayRule[]): number | null => {
  const withLocation = rules
    .filter((rule) => rule.locationId !== null && rule.locationId !== undefined)
    .sort((left, right) => left.priorityNo - right.priorityNo);

  return withLocation[0]?.locationId ?? null;
};

/**
 * 스캔한 위치가 규칙과 맞는가.
 *
 * 권장이 있으면 그 자리만 받는다 - 다른 칸에 두면 다음 피킹이 물건을 찾지 못한다. 권장이 없는
 * 품목까지 막으면 규칙이 등록되지 않은 품목이 적치 자체를 못 해 현장이 선다. 그때는 확인을
 * 받고 통과시키되 그 사실을 화면이 말한다.
 */
export const MATCHED = 'matched';
export const NOT_RECOMMENDED = 'notRecommended';
export const NO_RULE = 'noRule';

export type LocationVerdict = typeof MATCHED | typeof NOT_RECOMMENDED | typeof NO_RULE;

export const verdictOf = (
  recommended: number | null,
  scanned: Location | null,
): LocationVerdict => {
  if (recommended === null) {
    return NO_RULE;
  }

  return scanned !== null && scanned.locationId === recommended ? MATCHED : NOT_RECOMMENDED;
};

/**
 * 이 LOT 이 이미 재고로 서 있는가.
 *
 * 넷이다. 확인하지 못한 것은 서 있지 않은 것과 다르고, 아직 묻는 중인 것은 확인하지 못한
 * 것과 다르다 - 셋을 뭉치면 스캔할 때마다 확인하지 못했다는 경고가 깜빡여 진짜 경고가 묻힌다.
 */
export type StockedCheck = 'stocked' | 'clear' | 'unknown' | 'checking';

/**
 * 이미 입고돼 다시 세울 수 없는 LOT.
 *
 * 이 화면이 재고를 세우는 지점이라 두 번 서면 같은 제품이 두 벌이 된다. 다른 단말이 먼저
 * 입고한 것은 큐로는 알 수 없다.
 */
export const stockedLines = (
  lines: DraftLine[],
  checks: ReadonlyMap<number, StockedCheck>,
): DraftLine[] => lines.filter((line) => checks.get(line.lotId) === 'stocked');

/** 재고 여부를 확인하지 못한 줄. 오프라인에서는 이 판정을 할 수 없다. */
export const unverifiedLines = (
  lines: DraftLine[],
  checks: ReadonlyMap<number, StockedCheck>,
): DraftLine[] => lines.filter((line) => (checks.get(line.lotId) ?? 'unknown') === 'unknown');

export interface SubmitInput {
  warehouse: Warehouse | null;
  destination: Location | null;
  lines: DraftLine[];
  hasWorker: boolean;
  plantId: number | null;
  /** 이 단말이 같은 LOT 을 이미 담아 둔 건수. */
  queuedForLots: number;
  verdict: LocationVerdict;
  confirmedNoRule: boolean;
  stocked: ReadonlyMap<number, StockedCheck>;
}

export const canSubmit = ({
  warehouse,
  destination,
  lines,
  hasWorker,
  plantId,
  queuedForLots,
  verdict,
  confirmedNoRule,
  stocked,
}: SubmitInput): boolean => {
  if (
    warehouse === null ||
    destination === null ||
    !hasWorker ||
    plantId === null ||
    queuedForLots > 0 ||
    lines.length === 0
  ) {
    return false;
  }

  /* 묻는 중에는 아직 모른다. 짧게 막히고 답이 오면 풀린다. */
  if (lines.some((line) => stocked.get(line.lotId) === 'checking')) {
    return false;
  }

  if (stockedLines(lines, stocked).length > 0) {
    return false;
  }

  /*
   * 위치를 관리하는 창고에서만 규칙을 따진다. 관리하지 않으면 스캔할 라벨 자체가 없어 대조할
   * 대상이 없다.
   */
  if (
    managesLocations(warehouse) &&
    verdict !== MATCHED &&
    !(verdict === NO_RULE && confirmedNoRule)
  ) {
    return false;
  }

  return lines.every((line) => qtyProblemOf(line) === null);
};

/**
 * 이 LOT 들을 이 단말이 이미 입고해 큐에 담아 두었는가.
 *
 * 서버 응답에는 아직 안 간 건이 없다. 오프라인에서 같은 인식표를 두 번 스캔하면 둘 다
 * 통과하고, 같은 LOT 이 두 번 재고로 선다.
 *
 * 인식표가 아니라 LOT 으로 센다 - 담기는 본문에 인식표가 없고, 두 번 서면 안 되는 것도
 * 인식표가 아니라 LOT 이다. 같은 LOT 이 다른 인식표에 담겨 와도 걸린다.
 */
export const queuedForLotsOf = (entries: { body?: unknown }[], lotIds: number[]): number =>
  entries.filter((entry) => {
    const body = entry.body as { lines?: { lotId?: number }[] } | undefined;

    return (body?.lines ?? []).some(
      (line) => line.lotId !== undefined && lotIds.includes(line.lotId),
    );
  }).length;

/**
 * 입고 전표를 만든다.
 *
 * 원천 문서를 비워 보낸다 - 인식표에서 생산 실적 식별자를 얻을 길이 없고, 계약이 유형과
 * 식별자를 함께 비우는 것을 허용한다. 한쪽만 채우면 없는 행을 가리킨다.
 */
export const toReceiptDraft = (
  warehouse: Warehouse,
  destination: Location,
  lines: DraftLine[],
  plantId: number,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: GoodsReceiptCreate = {
    receiptTypeCode: PRODUCT,
    plantId,
    warehouseId: warehouse.warehouseId,
    /* 입고 시각은 단말 시계다. 서버가 받은 시각으로 덮지 않는다. */
    receiptDatetime: now.toISOString(),
    businessDate: businessDateOf(now),
    lines: lines.map((line): GoodsReceiptLineCreate => ({
      itemId: line.itemId,
      lotId: line.lotId,
      receiptQty: Number(line.qty.trim()),
      uomId: line.uomId,
      qualityStatusCode: INSPECTION_PENDING,
      inventoryStatusCode: AVAILABLE,
      destinationLocationId: destination.locationId,
    })),
  };

  return {
    label: RECEIPT_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/logistics/goods-receipts',
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};

/**
 * 적치 완료를 만든다.
 *
 * 적치 지시 식별자는 입고 응답에만 있다 - 입고가 담긴 채로 끝나면 아직 없어서 이 건을
 * 만들 수 없다. 계약이 그 상태를 오류가 아니라 표현 가능한 상태로 두고, 남은 지시는
 * 적치 화면이 되찾는다.
 */
export const toPutawayDraft = (
  putawayTaskId: number,
  destination: Location,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: PutawayTaskComplete = {
    actualLocationId: destination.locationId,
    businessDate: businessDateOf(now),
    occurredAt: now.toISOString(),
  };

  return {
    label: PUTAWAY_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/putaway-tasks/${String(putawayTaskId)}:complete`,
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};

/**
 * 입고 응답이 실어 온 적치 지시 식별자.
 *
 * 라인마다 하나씩 선다. 없는 라인은 건너뛴다 - 서버가 만들지 않았다면 화면이 지어낼 수 없다.
 */
export const putawayTaskIdsOf = (response: unknown): number[] => {
  const lines = (response as { lines?: { putawayTaskId?: number | null }[] } | undefined)?.lines;

  return (lines ?? [])
    .map((line) => line.putawayTaskId)
    .filter((id): id is number => typeof id === 'number');
};
