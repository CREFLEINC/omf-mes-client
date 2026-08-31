import type { ShipmentRequestLineCandidate } from './types';

/**
 * ①출하 내역의 편집 초안 — 라인마다 출하수량과 LOT 배분(LOT + 수량)을 사용자가 직접 채운다.
 *
 * `ShipmentLineCreate`(계약)가 `shippedQty`와 `allocations[]`를 나란히 요구한다 — 서버가 둘을
 * 대조하는 명시적 CHECK를 두지 않아(계획서 미결 항목), **클라이언트가 보수적으로 강제한다**:
 * 합이 다르면 제출을 막는다.
 *
 * 순수 함수만 둔다 — API 호출·React 상태는 이 파일 밖(`shipment-lines-pane.tsx`·`candidate-screen.tsx`)의 몫이다.
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export interface LotAllocationDraft {
  draftId: string;
  lotId: number | null;
  qty: string;
}

export interface LineAllocationDraft {
  shipmentRequestLineId: number;
  lineNo: number;
  itemId: number;
  uomId: number;
  requestedQty: number;
  allocatedQty: number;
  pickedQty: number;
  shippedQty: string;
  allocations: LotAllocationDraft[];
}

export const createLineAllocationDrafts = (
  lines: readonly ShipmentRequestLineCandidate[],
): LineAllocationDraft[] =>
  lines.map((line) => ({
    shipmentRequestLineId: line.shipmentRequestLineId,
    lineNo: line.lineNo,
    itemId: line.itemId,
    uomId: line.uomId,
    requestedQty: line.requestedQty,
    allocatedQty: line.allocatedQty,
    pickedQty: line.pickedQty,
    shippedQty: '',
    allocations: [],
  }));

export const addAllocation = (line: LineAllocationDraft): LineAllocationDraft => ({
  ...line,
  allocations: [...line.allocations, { draftId: crypto.randomUUID(), lotId: null, qty: '' }],
});

export const removeAllocation = (
  line: LineAllocationDraft,
  draftId: string,
): LineAllocationDraft => ({
  ...line,
  allocations: line.allocations.filter((allocation) => allocation.draftId !== draftId),
});

export const setAllocationLot = (
  line: LineAllocationDraft,
  draftId: string,
  lotId: number,
): LineAllocationDraft => ({
  ...line,
  allocations: line.allocations.map((allocation) =>
    allocation.draftId === draftId ? { ...allocation, lotId } : allocation,
  ),
});

export const setAllocationQty = (
  line: LineAllocationDraft,
  draftId: string,
  qty: string,
): LineAllocationDraft => ({
  ...line,
  allocations: line.allocations.map((allocation) =>
    allocation.draftId === draftId ? { ...allocation, qty } : allocation,
  ),
});

export const setShippedQty = (
  line: LineAllocationDraft,
  shippedQty: string,
): LineAllocationDraft => ({
  ...line,
  shippedQty,
});

/** 자릿값으로 못 읽으면(빈 값·NaN·0 이하) `null` — 「입력 없음」과 「잘못된 값」을 한 판정으로 묶는다. */
const parseQty = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

/** LOT 배분 수량의 합 — 못 읽는 값은 0으로 접어 더한다(합계 자체를 계산 불능으로 만들지 않는다). */
export const allocationSum = (line: LineAllocationDraft): number =>
  line.allocations.reduce((total, allocation) => total + (parseQty(allocation.qty) ?? 0), 0);

export type LineAllocationIssue =
  | 'SHIPPED_QTY_INVALID'
  | 'NO_ALLOCATIONS'
  | 'LOT_NOT_SELECTED'
  | 'ALLOCATION_QTY_INVALID'
  | 'DUPLICATE_LOT'
  | 'SUM_MISMATCH';

/** 합계 비교의 부동소수 오차 허용치. */
const SUM_EPSILON = 1e-6;

/** 이 라인이 제출 가능하지 않은 이유 전부. 빈 배열이면 이 라인은 제출 가능하다. */
export const lineAllocationIssues = (line: LineAllocationDraft): LineAllocationIssue[] => {
  const issues: LineAllocationIssue[] = [];
  const shippedQty = parseQty(line.shippedQty);

  if (shippedQty === null) issues.push('SHIPPED_QTY_INVALID');
  if (line.allocations.length === 0) issues.push('NO_ALLOCATIONS');
  if (line.allocations.some((allocation) => allocation.lotId === null))
    issues.push('LOT_NOT_SELECTED');
  if (line.allocations.some((allocation) => parseQty(allocation.qty) === null)) {
    issues.push('ALLOCATION_QTY_INVALID');
  }

  const lotIds = line.allocations
    .map((allocation) => allocation.lotId)
    .filter((lotId): lotId is number => lotId !== null);
  if (new Set(lotIds).size !== lotIds.length) issues.push('DUPLICATE_LOT');

  /*
   * 합계검증은 다른 항목이 전부 온전할 때만 뜻이 있다 — LOT을 못 고른 배분이나 못 읽는 수량이
   * 섞인 채로 합을 비교하면 「합이 다르다」는 오류가 실제 원인(선택 누락)을 가린다.
   */
  const otherIssuesClear =
    shippedQty !== null &&
    line.allocations.length > 0 &&
    !line.allocations.some((allocation) => allocation.lotId === null) &&
    !line.allocations.some((allocation) => parseQty(allocation.qty) === null);

  if (
    otherIssuesClear &&
    shippedQty !== null &&
    Math.abs(allocationSum(line) - shippedQty) > SUM_EPSILON
  ) {
    issues.push('SUM_MISMATCH');
  }

  return issues;
};

export const isLineBalanced = (line: LineAllocationDraft): boolean =>
  lineAllocationIssues(line).length === 0;

/**
 * ①출하 내역 표의 한 행 — LOT 배분 하나. **라인마다 배분이 0건이어도 자리표시 행을 하나
 * 낸다**(`isPlaceholder`) — `Table`의 `groupBy`는 그룹키를 가진 행이 하나도 없으면 그 그룹
 * 자체를 렌더하지 않으므로, 배분을 아직 하나도 만들지 않은 라인이 표에서 통째로 사라지는 것을
 * 막는다.
 */
export interface ShipmentLineAllocationRow {
  rowKey: string;
  shipmentRequestLineId: number;
  lineNo: number;
  itemId: number;
  uomId: number;
  requestedQty: number;
  allocatedQty: number;
  pickedQty: number;
  shippedQty: string;
  draftId: string;
  lotId: number | null;
  qty: string;
  isPlaceholder: boolean;
}

export const toAllocationRows = (
  lines: readonly LineAllocationDraft[],
): ShipmentLineAllocationRow[] =>
  lines.flatMap((line): ShipmentLineAllocationRow[] => {
    const base = {
      shipmentRequestLineId: line.shipmentRequestLineId,
      lineNo: line.lineNo,
      itemId: line.itemId,
      uomId: line.uomId,
      requestedQty: line.requestedQty,
      allocatedQty: line.allocatedQty,
      pickedQty: line.pickedQty,
      shippedQty: line.shippedQty,
    };

    if (line.allocations.length === 0) {
      return [
        {
          ...base,
          rowKey: `${String(line.shipmentRequestLineId)}:placeholder`,
          draftId: 'placeholder',
          lotId: null,
          qty: '',
          isPlaceholder: true,
        },
      ];
    }

    return line.allocations.map((allocation) => ({
      ...base,
      rowKey: `${String(line.shipmentRequestLineId)}:${allocation.draftId}`,
      draftId: allocation.draftId,
      lotId: allocation.lotId,
      qty: allocation.qty,
      isPlaceholder: false,
    }));
  });
