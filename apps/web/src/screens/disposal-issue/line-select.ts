import { messages } from '@omf-mes/i18n';

import type { ReceiptLineView } from './types';

/**
 * **「이 줄을 폐기 대상으로 고를 수 있는가」를 판정하는 유일한 자리**(계획 §4.1 · 감지기 M24).
 *
 * 표·화면·요청 조립이 각자 판정하면 규칙이 갈린다 — 표에는 고를 수 있다고 나오는데 보낼 때
 * 막히거나, 반대로 보낼 수 없는 줄이 요청에 실린다. 이 화면이 만드는 것은 **승인을 받아
 * 재고를 덜어 내는 전표**라 그 어긋남은 잘못된 폐기 품의로 남는다.
 *
 * **상태 코드로 판정하지 않는다.** 입고 라인의 품질·재고 상태는 값 목록이 확정되지 않았고
 * (공유계약 G-2) 값으로 분기하면 값이 정해질 때 조용히 틀린다. 그래서 화면 타입에 그 자리를
 * 두지 않았고(`types.ts`), 이 판정이 볼 수 있는 것은 **계약이 요구하는 값이 실제로 있는가**뿐이다.
 *
 * **보류(`held`)로도 판정하지 않는다.** 보류·차단된 자재를 장부에서 덜어 내는 것이 이 화면의
 * 주 용도다 — 표식은 알리는 것이고 막는 것이 아니다(계획 결정 4와 같은 논거).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

/**
 * 한 줄의 선택 가능 여부. **두 갈래이고 막힌 쪽은 사유를 함께 낸다** —
 * 사유 없이 잠그면 사용자가 무엇을 해야 풀리는지 화면에서 읽을 수 없다(배치 규범 4).
 */
export type LineSelectState = { kind: 'selectable' } | { kind: 'blocked'; reason: string };

/**
 * 폐기 라인이 요구하는 식별자가 쓸 수 있는 값인가.
 *
 * 계약은 `itemId`·`lotId`·`uomId`·`sourceLocationId`를 **양의 int64**로 두었으므로
 * 0 이하는 「그 값이 없다」는 뜻이다. 화면이 그런 번호를 요청에 실으면 서버가 400으로
 * 되돌리는데, 사용자는 자기가 고른 줄이 왜 거절됐는지 알 길이 없다 — 고르기 전에 막는다.
 */
const isUsableId = (id: number): boolean => Number.isFinite(id) && id > 0;

/**
 * 판정 순서가 뜻을 정한다 — **값 없음이 수량보다 앞선다.**
 *
 * 둘 다 어긋난 줄에서 수량 사유를 내면 「수량이 문제다」로 읽히는데, 값이 없으면 수량이
 * 얼마든 폐기 라인을 만들 수 없다. 사용자가 헛다리를 짚지 않게 한다.
 *
 * - **값 없음**: 계약이 출고 라인 한 줄에 품목·자재 LOT·수량·단위·출발 위치 **다섯을 전부
 *   필수**로 두었다(실측). 적치 목적지가 곧 폐기 출고의 출발 위치다.
 * - **수량 0 이하**: 계약이 `issueQty`에 `exclusiveMinimum: 0`을 두어 **0도 보낼 수 없다.**
 *   재고실사(`minimum: 0`)와 갈리는 자리다 — 그쪽은 「세어 보니 하나도 없었다」가 정상 값이지만
 *   여기서는 「0개를 폐기한다」에 뜻이 없다.
 */
export const describeLineSelect = (line: ReceiptLineView): LineSelectState => {
  const hasAllValues =
    isUsableId(line.itemId) &&
    isUsableId(line.lotId) &&
    isUsableId(line.uomId) &&
    isUsableId(line.destinationLocationId);

  if (!hasAllValues) return { kind: 'blocked', reason: t.reasons.lineMissingValues };
  if (line.receiptQty <= 0) return { kind: 'blocked', reason: t.reasons.lineQtyNotPositive };

  return { kind: 'selectable' };
};

export const isLineSelectable = (line: ReceiptLineView): boolean =>
  describeLineSelect(line).kind === 'selectable';
