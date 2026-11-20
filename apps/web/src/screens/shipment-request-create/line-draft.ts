import type { SalesOrderLineView, ShipmentRequestLineDraft } from './types';

/**
 * 출하작업지시 라인 초안의 파생 — 만들기·더하기·지우기·고치기.
 *
 * **줄마다 안정 키를 만든다.** 표의 `getRowId`가 이 키를 쓰므로, 가운데 줄을 지워도 남은 줄의
 * DOM 노드가 살아남아 치던 값과 포커스가 그 자리에 남는다(전례 `stock-adjust`·`po-register`와
 * 같은 규율). 이 화면은 등록 재시도를 위한 「초안 세션」 개념이 없다 — 등록은 단발 POST고
 * 실패해도 초안이 그대로 남아 다시 보낼 뿐이라, 세션을 나눌 축이 없다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

let draftSequence = 0;

/** 창고를 아직 고르지 않은 줄의 세 칸(피처 012). */
const NO_WAREHOUSE = { warehouseId: '', warehouseFilled: false, warehouseCleared: false } as const;

const nextKey = (prefix: string): string => {
  draftSequence += 1;

  return `${prefix}:${String(draftSequence)}`;
};

/**
 * 지시서 라인에서 잔여 라인을 뽑아 초안으로 세운다(완료 조건 C2).
 *
 * **잔여 = 주문수량 − 누적 출하수량.** 잔여가 0 이하인 라인은 이미 다 나갔으므로 빼낸다 —
 * 남기면 배정할 것이 없는 줄에 사용자가 값을 칠 수 있는 것처럼 보인다.
 *
 * **요청 수량은 잔여로 자동 채워지고 읽기 전용이다**(미결 항목 표의 구현 판단). 배정 수량
 * 기본값도 잔여와 같다 — 전량 배정이 흔한 경로이고, 가용이 부족하면 사용자가 줄인다
 * (그때 경고만 뜨고 막지 않는다 · C5).
 */
export const lineDraftsFromSalesOrder = (
  lines: readonly SalesOrderLineView[],
): ShipmentRequestLineDraft[] =>
  lines
    .map((line) => ({ line, remaining: line.orderedQty - line.shippedQty }))
    .filter(({ remaining }) => remaining > 0)
    .map(({ line, remaining }) => ({
      key: nextKey('order'),
      salesOrderLineId: line.salesOrderLineId,
      itemId: String(line.itemId),
      requestedQty: String(remaining),
      allocatedQty: String(remaining),
      uomId: String(line.uomId),
      shippingInspectionRequired: false,
      ...NO_WAREHOUSE,
      splitOf: null,
      salesOrderLineNo: line.lineNo,
      erpStorageLocationCode: line.erpStorageLocationCode,
    }));

/** 단독 생성의 빈 줄. **값을 지어내지 않는다** — 사용자가 고르지 않은 품목이 전표에 실리면 안 된다. */
export const emptyLineDraft = (): ShipmentRequestLineDraft => ({
  key: nextKey('new'),
  salesOrderLineId: null,
  itemId: '',
  requestedQty: '',
  allocatedQty: '',
  uomId: '',
  shippingInspectionRequired: false,
  ...NO_WAREHOUSE,
  splitOf: null,
  salesOrderLineNo: null,
  erpStorageLocationCode: null,
});

/**
 * 첫 줄의 출고 창고 — 새 줄·안 고른 줄의 기본값이다(피처 012 FR-004). 첫 줄이 아직 비었으면 빈 글자.
 */
export const firstLineWarehouse = (lines: readonly ShipmentRequestLineDraft[]): string =>
  lines[0]?.warehouseId ?? '';

/** 새 줄에 첫 줄 창고를 채운다 — 첫 줄이 비었으면 그대로 빈 줄이다. */
const withFirstWarehouse = (
  line: ShipmentRequestLineDraft,
  warehouseId: string,
): ShipmentRequestLineDraft =>
  warehouseId === '' ? line : { ...line, warehouseId, warehouseFilled: true, warehouseCleared: false };

export const addLineDraft = (
  lines: readonly ShipmentRequestLineDraft[],
): ShipmentRequestLineDraft[] => [
  ...lines,
  withFirstWarehouse(emptyLineDraft(), firstLineWarehouse(lines)),
];

/** 고른 품목들로 줄을 붙인다 — 새 줄의 창고는 첫 줄 창고다(FR-004). */
export const appendItemLines = (
  lines: readonly ShipmentRequestLineDraft[],
  items: readonly { itemId: number; baseUomId: number }[],
): ShipmentRequestLineDraft[] => {
  const warehouseId = firstLineWarehouse(lines);

  return [
    ...lines,
    ...items.map((item) => withFirstWarehouse(lineDraftFromItem(item.itemId, item.baseUomId), warehouseId)),
  ];
};

/**
 * 한 줄의 출고 창고를 고른다(피처 012 FR-003·004).
 *
 * ⭐ **첫 줄을 고르면 아직 창고가 빈 줄을 그 창고로 채운다** — 「첫 줄 창고로 채움」. 사업부를 바꿔 비운
 *    줄(노란 줄)은 채우지 않는다 — 사람이 다시 골라야 한다는 안내가 그 줄에 남아 있어야 한다.
 * ⛔ 이미 창고가 있는 줄은 건드리지 않는다 — 사람이 고른 값을 덮지 않는다.
 */
export const setLineWarehouse = (
  lines: readonly ShipmentRequestLineDraft[],
  key: string,
  warehouseId: string,
): ShipmentRequestLineDraft[] => {
  const isFirst = lines[0]?.key === key;

  return lines.map((line) => {
    if (line.key === key) {
      return { ...line, warehouseId, warehouseFilled: false, warehouseCleared: false };
    }
    if (isFirst && warehouseId !== '' && line.warehouseId === '' && !line.warehouseCleared) {
      return { ...line, warehouseId, warehouseFilled: true };
    }

    return line;
  });
};

/**
 * S/O 줄을 나눈다(피처 012 FR-005) — 그 묶음 맨 끝에 「나눈 줄」을 붙인다.
 *
 * - 같은 S/O 줄(`salesOrderLineId`)·품목·단위·검사 대상을 잇는다.
 * - **배정 수량은 0 으로 시작한다**(시안 — 반으로 가르지 않는다). 사람이 원 줄과 나눈 줄 수량을 정한다.
 * - 창고는 첫 줄 창고로 채운다(FR-004) — 다른 창고로 바꾸는 것이 나누는 까닭이다.
 * - 요청 수량은 비운다 — 보내기 직전 S/O 잔여를 묶음 안에서 나눠 정한다(`shipment-request-create-body.ts`).
 */
export const splitLineDraft = (
  lines: readonly ShipmentRequestLineDraft[],
  key: string,
): ShipmentRequestLineDraft[] => {
  const origin = lines.find((line) => line.key === key);

  if (origin === undefined || origin.salesOrderLineId === null || origin.splitOf !== null) {
    return [...lines];
  }

  const split: ShipmentRequestLineDraft = withFirstWarehouse(
    {
      ...emptyLineDraft(),
      key: nextKey('split'),
      salesOrderLineId: origin.salesOrderLineId,
      itemId: origin.itemId,
      uomId: origin.uomId,
      allocatedQty: '0',
      shippingInspectionRequired: origin.shippingInspectionRequired,
      splitOf: origin.key,
      salesOrderLineNo: origin.salesOrderLineNo,
    },
    firstLineWarehouse(lines),
  );

  const lastIndexOfGroup = lines.reduce(
    (last, line, index) => (line.key === key || line.splitOf === key ? index : last),
    -1,
  );
  const next = [...lines];

  next.splice(lastIndexOfGroup + 1, 0, split);

  return next;
};

/**
 * 사업부를 바꿨을 때 그 사업부 밖 창고를 고른 줄의 창고를 비운다(피처 012 FR-004 · US1-7).
 *
 * 비운 줄은 `warehouseCleared` 로 노란 테를 받고, 다시 고를 때까지 남는다. **같은 사업부로 되돌려도
 * 비운 값을 살리지 않는다**(시안 판단) — 무엇을 골랐었는지 기억해 되살리면 사람이 본 적 없는 값이 나간다.
 */
export const clearWarehousesOutside = (
  lines: readonly ShipmentRequestLineDraft[],
  allowedWarehouseIds: ReadonlySet<string>,
): ShipmentRequestLineDraft[] =>
  lines.map((line) =>
    line.warehouseId !== '' && !allowedWarehouseIds.has(line.warehouseId)
      ? { ...line, warehouseId: '', warehouseFilled: false, warehouseCleared: true }
      : line,
  );

/**
 * 고른 품목으로 줄을 만든다 — **품목 선택 팝업이 부른다.**
 *
 * ⭐ **기준 단위를 함께 채운다.** 품목 조회가 `baseUomId` 를 주므로 담당이 줄마다 단위를 고르지
 *    않아도 된다 — 서버가 준 값이라 지어내는 것이 아니다.
 * ⚠ **선택칸은 그대로 둔다.** 서버는 라인의 단위가 품목 기준 단위와 «같은지» 보지 않고 그 단위가
 *   있는지만 본다 — 기준과 다른 단위로 내보내는 것을 서버가 허용하므로, 화면이 그 길을 막지
 *   않는다(2026-09-18 통합 실측).
 */
export const lineDraftFromItem = (
  itemId: number,
  baseUomId: number,
): ShipmentRequestLineDraft => ({
  ...emptyLineDraft(),
  itemId: String(itemId),
  uomId: String(baseUomId),
});

/** 그 줄을 뺀 새 목록. 남은 줄의 키가 그대로라 표의 행이 자리를 옮기지 않는다. */
export const removeLineDraft = (
  lines: readonly ShipmentRequestLineDraft[],
  key: string,
): ShipmentRequestLineDraft[] =>
  lines.filter((line) => line.key !== key && line.splitOf !== key);

/**
 * 한 줄의 값을 바꾼다. **앞 초안을 고치지 않는다** — 같은 참조를 고치면 화면이 다시 그려지지 않는다.
 * 없는 키는 그냥 지나간다.
 */
export const patchLineDraft = (
  lines: readonly ShipmentRequestLineDraft[],
  key: string,
  patch: Partial<Omit<ShipmentRequestLineDraft, 'key'>>,
): ShipmentRequestLineDraft[] =>
  lines.map((line) => (line.key === key ? { ...line, ...patch } : line));
