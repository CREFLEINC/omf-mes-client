import type { components } from '@omf-mes/api-client';

/**
 * P-02-03 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 *
 * **이 슬라이스가 다루는 것은 「계획 대비 수령」 한 구획**이다. 스캔·투입 확정은 뒤 슬라이스다.
 */

type ShopfloorReceiptResponse = components['schemas']['ShopfloorReceipt'];
type ShopfloorReceiptLineResponse = components['schemas']['ShopfloorReceiptLine'];

/**
 * 수령 상태 — **서버가 계산한 `varianceQty`를 옮긴 것이지 화면이 뺀 것이 아니다**(공유계약 L-2).
 *
 * | 값 | 뜻 |
 * | --- | --- |
 * | `matched` | 출고량을 그대로 받았다 |
 * | `short` | 일부만 받았다 — ⚠ 경고. **투입을 막지 않는다**(스펙 §6 「라인 수령 미달」) |
 * | `none` | 한 개도 받지 못했다 — ⛔ 표시. 이것도 막지 않는다(결품은 `P-02-10` 소관) |
 */
export type ReceiptLineStatus = 'matched' | 'short' | 'none';

/**
 * 수령 상태를 가른다.
 *
 * **`varianceQty`가 아니라 `receivedQty`로 「미수령」을 가른다.** 차이 수량만 보면 출고량이 0인
 * 줄(있을 수 있다 — 취소분)이 차이 0이 되어 `matched`로 읽힌다. 「받은 것이 없다」는 받은 양이
 * 정하는 사실이다.
 *
 * ⚠ **음수 차이를 `short`로 읽지 않는다.** 계약은 `receivedQty`를 출고량 이하로 두지만 그것은
 * 서버의 약속이고, 어긋난 값이 오면 「부족」이라 말하는 쪽이 사실과 멀다 — 받은 것이 있고
 * 모자라지 않으므로 `matched`다.
 */
export const toReceiptLineStatus = (line: {
  receivedQty: number;
  varianceQty: number;
}): ReceiptLineStatus => {
  if (line.receivedQty <= 0) return 'none';

  return line.varianceQty > 0 ? 'short' : 'matched';
};

/** 화면이 다루는 수령 라인 한 줄. */
export interface ReceiptLineView {
  shopfloorReceiptLineId: number;
  itemId: number;
  lotId: number;
  issuedQty: number;
  receivedQty: number;
  varianceQty: number;
  uomId: number;
  varianceReasonCode: string | null;
  status: ReceiptLineStatus;
}

/** 응답 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toReceiptLineView = (line: ShopfloorReceiptLineResponse): ReceiptLineView => ({
  shopfloorReceiptLineId: line.shopfloorReceiptLineId,
  itemId: line.itemId,
  lotId: line.lotId,
  issuedQty: line.issuedQty,
  receivedQty: line.receivedQty,
  varianceQty: line.varianceQty,
  uomId: line.uomId,
  varianceReasonCode: line.varianceReasonCode ?? null,
  status: toReceiptLineStatus(line),
});

/** 화면이 다루는 생산창고 입고 전표 한 건. 줄은 상세 조회에서만 온다. */
export interface ReceiptView {
  shopfloorReceiptId: number;
  shopfloorReceiptNo: string;
  receivedAt: string;
}

export const toReceiptView = (data: ShopfloorReceiptResponse): ReceiptView => ({
  shopfloorReceiptId: data.shopfloorReceiptId,
  shopfloorReceiptNo: data.shopfloorReceiptNo,
  receivedAt: data.receivedAt,
});
