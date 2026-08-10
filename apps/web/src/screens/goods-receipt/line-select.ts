import { messages } from '@omf-mes/i18n';

import type { IrLineView } from './types';

/**
 * **「이 줄로 입고할 수 있는가」를 판정하는 유일한 자리**(계획 결정 5 · 읽는 자리 파생).
 *
 * 표·화면·요청 조립이 각자 판정하면 규칙이 갈린다 — 표에는 고를 수 있다고 나오는데
 * 보낼 때 막히거나, 반대로 보낼 수 없는 줄이 요청에 실린다. 되돌릴 수 없는 쓰기라
 * 그 어긋남은 잘못된 전표로 남는다.
 *
 * **상태 코드로 판정하지 않는다.** 입하 라인의 `statusCode`는 값 목록이 확정되지 않았고
 * (공유계약 G-2), 값으로 분기하면 값이 정해질 때 조용히 틀린다. 판정에 쓰는 것은
 * **계약이 요구하는 값이 실제로 있는가**뿐이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.goodsReceipt;

/**
 * 한 줄의 선택 가능 여부. **두 갈래이고 막힌 쪽은 사유를 함께 낸다** —
 * 사유 없이 잠그면 사용자가 무엇을 해야 풀리는지 화면에서 읽을 수 없다(배치 규범 4).
 */
export type LineSelectState = { kind: 'selectable' } | { kind: 'blocked'; reason: string };

/**
 * 판정 순서가 뜻을 정한다 — **자재 LOT이 수량보다 앞선다.**
 *
 * 둘 다 어긋난 줄에서 수량 사유를 내면 「수량을 고치면 된다」로 읽히는데, 고쳐도 LOT이 없으면
 * 여전히 고를 수 없다. 사용자가 할 수 없는 조치를 가리키지 않는다.
 *
 * - **자재 LOT 없음**: 계약이 입고 라인의 `lotId`를 필수로 두는데 입하 라인의 `lotId`는
 *   nullable이다. 값이 없으면 보낼 것이 없다.
 * - **수량 0 이하**: 계약이 `receiptQty`에 `exclusiveMinimum: 0`을 두어 0도 보낼 수 없다.
 */
export const describeLineSelect = (line: IrLineView): LineSelectState => {
  if (line.lotId === null) return { kind: 'blocked', reason: t.reasons.lineNoLot };
  if (line.receivedQty <= 0) return { kind: 'blocked', reason: t.reasons.lineQtyNotPositive };

  return { kind: 'selectable' };
};

export const isLineSelectable = (line: IrLineView): boolean =>
  describeLineSelect(line).kind === 'selectable';

/**
 * 줄을 눌렀을 때 다음 선택. **한 줄만 고른다**(계획 결정 3) —
 * 다른 줄을 고르면 앞 선택이 풀리고, 고른 줄을 다시 누르면 선택이 없어진다.
 *
 * 계약은 라인마다 위치를 받으므로 나중에 여러 줄로 늘 수 있다(이슈 §4·§5). 그때 바뀌는 것은
 * 이 함수와 그것을 부르는 자리뿐이고 요청 조립·확정 구획은 이미 배열을 다룬다.
 */
export const nextSelectedLineId = (current: number | null, clicked: number): number | null =>
  current === clicked ? null : clicked;

/**
 * 고른 줄을 라인 목록에서 찾는다. **고를 수 없게 된 줄은 없는 것으로 본다** —
 * 주소를 손으로 고쳐 LOT 없는 줄을 가리키면, 그대로 두었을 때 「고를 수 없다고 표시된 줄이
 * 골라져 있는」 상태가 된다.
 *
 * 화면은 이 결과가 `null`인데 라인 응답이 도착해 있으면 주소에서 `line`을 정리한다
 * (수명 표 6행). 판정이 여기 하나뿐이라 표기와 정리가 어긋나지 않는다.
 */
export const findSelectedLine = (
  lines: readonly IrLineView[],
  selectedLineId: number | null,
): IrLineView | null => {
  if (selectedLineId === null) return null;

  const found = lines.find((line) => line.inboundReceiptLineId === selectedLineId);

  if (found === undefined) return null;

  return isLineSelectable(found) ? found : null;
};
