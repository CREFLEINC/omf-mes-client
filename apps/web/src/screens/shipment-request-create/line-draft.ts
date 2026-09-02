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
      customerLotRequirement: '',
      shippingInspectionRequired: false,
      minimumRemainingShelfLifeDays: '',
    }));

/** 단독 생성의 빈 줄. **값을 지어내지 않는다** — 사용자가 고르지 않은 품목이 전표에 실리면 안 된다. */
export const emptyLineDraft = (): ShipmentRequestLineDraft => ({
  key: nextKey('new'),
  salesOrderLineId: null,
  itemId: '',
  requestedQty: '',
  allocatedQty: '',
  uomId: '',
  customerLotRequirement: '',
  shippingInspectionRequired: false,
  minimumRemainingShelfLifeDays: '',
});

export const addLineDraft = (
  lines: readonly ShipmentRequestLineDraft[],
): ShipmentRequestLineDraft[] => [...lines, emptyLineDraft()];

/** 그 줄을 뺀 새 목록. 남은 줄의 키가 그대로라 표의 행이 자리를 옮기지 않는다. */
export const removeLineDraft = (
  lines: readonly ShipmentRequestLineDraft[],
  key: string,
): ShipmentRequestLineDraft[] => lines.filter((line) => line.key !== key);

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
