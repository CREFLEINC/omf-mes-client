import { messages } from '@omf-mes/i18n';

import type { LocationCapacity } from './lookups';

/**
 * 규칙 용량을 **그 위치가 스스로 가진 용량**과 견준다.
 *
 * ## 실값으로 나란히 보이고 **막지 않는다**
 *
 * 이슈 §4는 이 자리를 「자리표시 상수 + 안내」로 적었지만 **계약이 위치 용량과 그 단위를
 * 실제로 내려준다**(`Location.capacityQty` · `capacityUomId`). 값을 주는데 자리표시를 만들면
 * 화면이 가진 사실을 숨기는 것이라, 승인 기록 Q4가 **실값 표시**로 정했다.
 *
 * **저장은 막지 않는다**(`omf-mes#84`). 규칙 용량과 위치 용량 중 어느 쪽이 이기는지 아직
 * 정해지지 않았고, 용량은 적치 판정에 쓰이지도 않는다 — 정해지지 않은 규칙으로 저장을 막으면
 * 화면이 없는 규칙을 지어내는 것이다. 그래서 **경고만** 한다.
 *
 * ## 전제가 없으면 견주지 않는다
 *
 * | 갈래 | 무엇을 내는가 | 왜 |
 * | --- | --- | --- |
 * | 견줄 위치 용량이 없다 | **아무것도** | 창고 전체 규칙 · 용량이 비어 있는 위치 · 목록 미도착·실패. 없는 값으로 경고를 지어내지 않는다(C3-7) |
 * | 규칙 쪽 값을 아직 읽을 수 없다 | 값만 | 다 치지 않은 입력에 경고를 띄우면 입력 도중 내내 붉은 글씨가 선다 |
 * | 단위가 다르다 | 값 + 사유 | 환산 정의가 없다. 두 수는 애초에 같은 종류가 아니다 |
 * | 넘지 않았다 | 값만 | 사용자가 할 일이 없다 |
 * | 넘었다 | 값 + 경고 | 확인할 일이 있다. 저장은 그대로 된다(C3-6) |
 *
 * **「아직 못 견줬다」와 「견줬는데 안 넘었다」가 같은 모양(`plain`)인 것은 의도다** —
 * 둘 다 사용자가 지금 할 일이 없고, 화면이 할 말도 없다. 다만 「견줄 값이 아예 없다」(`none`)와는
 * 가른다: 그때는 위치 용량 자체를 그리지 말아야 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.putawayRule;

/** 지금 폼이 만들려는 규칙의 용량 쪽. **읽을 수 없는 값은 `null`로 넘어온다.** */
export interface CapacityTarget {
  capacityQty: number | null;
  uomId: number | null;
}

/** 위치 용량을 어떻게 그릴 것인가. 네 갈래가 각각 다른 모양이다. */
export type CapacityNote =
  | { kind: 'none' }
  | { kind: 'plain'; capacity: LocationCapacity }
  | { kind: 'unitMismatch'; capacity: LocationCapacity }
  | { kind: 'over'; capacity: LocationCapacity };

/**
 * 판정 순서가 뜻을 정한다 — **값 없음 → 규칙 쪽 미확정 → 단위 → 초과**다.
 *
 * 단위가 초과보다 앞선다: 단위가 다르면 두 수의 크고 작음이 성립하지 않는다.
 * 뒤집으면 「3박스가 500개보다 작다」 같은 판정이 서고, 사용자는 그것을 사실로 읽는다.
 */
export const judgeCapacity = (
  capacity: LocationCapacity | null,
  target: CapacityTarget,
): CapacityNote => {
  if (capacity === null) return { kind: 'none' };
  if (target.capacityQty === null || target.uomId === null) return { kind: 'plain', capacity };
  if (capacity.capacityUomId !== target.uomId) return { kind: 'unitMismatch', capacity };

  return target.capacityQty > capacity.capacityQty
    ? { kind: 'over', capacity }
    : { kind: 'plain', capacity };
};

/**
 * 값 옆에 붙일 사유·경고. **`plain`에는 아무 말도 하지 않는다** — 할 말이 없는 자리에
 * 문장을 두면 안내가 배경이 되어 정작 경고가 설 때 읽히지 않는다.
 */
export const capacityNoteText = (note: CapacityNote): string | undefined => {
  switch (note.kind) {
    case 'over':
      return t.notes.locationCapacityOver;
    case 'unitMismatch':
      return t.notes.locationCapacityUnitMismatch;
    case 'plain':
    case 'none':
      return undefined;
  }
};
