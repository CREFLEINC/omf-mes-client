import type { InspectionItemSpec } from './types';

/**
 * 수신값의 단위와 검사 항목의 단위가 맞는가.
 *
 * ⛔ **자동 변환하지 않는다**(스펙 §5-5). 변환 규칙을 어디에도 저장하지 않았고, 틀리면
 * **측정값이 조용히 어긋난다.** 경고만 하고 사람이 맞춘다 — 보내는 쪽이나 항목 정의를 고친다.
 */

/**
 * 견줌의 결과 **셋**.
 *
 * ⭐ **「모른다」를 「같다」로 접지 않는다**(공유계약 G-9). 단위 목록이 잘리거나 실패하면
 * 항목의 단위 식별자를 코드로 옮길 수 없는데, 그때 침묵하면 사용자는 **맞는 것으로 읽는다.**
 * 그 오독의 대가가 어긋난 측정값이라 침묵이 가장 나쁜 선택이다.
 */
export type UnitMatch =
  | { kind: 'match' }
  /** 견줄 것이 아예 없다 — 한쪽이 비었으면 다툼도 없다 */
  | { kind: 'notComparable' }
  | { kind: 'unknown' }
  | { kind: 'mismatch'; channelUnitCode: string; itemUnitCode: string };

/**
 * 견준다.
 *
 * | 사태 | 결과 |
 * | --- | --- |
 * | 채널에 단위가 없거나 항목에 단위가 없다 | 견줄 것이 없다 |
 * | 항목의 단위 식별자를 코드로 옮길 수 없다 | **모른다** |
 * | 두 코드가 같다 | 맞다 |
 * | 다르다 | **다르다** — 두 값을 함께 말한다 |
 */
export const judgeUnit = (
  channelUnitCode: string,
  item: InspectionItemSpec | null,
  uomCodeById: ReadonlyMap<number, string>,
): UnitMatch => {
  const itemUomId = item?.uomId;

  if (channelUnitCode === '' || itemUomId === undefined || itemUomId === null) {
    return { kind: 'notComparable' };
  }

  const itemUnitCode = uomCodeById.get(itemUomId);

  if (itemUnitCode === undefined) return { kind: 'unknown' };

  return itemUnitCode === channelUnitCode
    ? { kind: 'match' }
    : { kind: 'mismatch', channelUnitCode, itemUnitCode };
};
