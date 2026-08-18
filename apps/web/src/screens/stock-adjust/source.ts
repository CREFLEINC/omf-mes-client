import type { AdjustLineDraft } from './types';

/**
 * 조정 원천 — **라디오는 둘이고 자료의 출처는 셋이다**(조심 ⑤).
 *
 * | 출처 | 갈래 | 실사 참조 |
 * | --- | --- | --- |
 * | 실사 차이 | `count` | 있다 |
 * | 현장 실측(호퍼 잔량 등) | `direct` | **없는 것이 정상이다** |
 * | 직접 등록 | `direct` | **없는 것이 정상이다** |
 *
 * 뒤의 둘은 실사를 거치지 않으므로 화면에서 같은 갈래로 들어온다 — 갈래를 셋으로 두면
 * 사용자가 「현장 실측」과 「직접 등록」의 차이를 화면에서 골라야 하는데, 계약이 그 둘을
 * 가르지 않는다(조정 라인의 모양이 같다).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

export type AdjustSourceKind = 'count' | 'direct';

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_LINES: AdjustLineDraft[] = [];

/**
 * 처음 설 갈래. 주소가 실사를 가리키면 그 실사가 원천으로 고정된다(D-2 · C1).
 *
 * **맥락이 없으면 직접 등록이다** — 「고르지 않음」 상태를 따로 두지 않는다. 이 화면에는
 * 원천 없이 할 수 있는 일이 없어서, 세 번째 상태는 아무것도 못 하는 빈 화면만 만든다.
 */
export const initialSourceKind = (inventoryCountId: number | null): AdjustSourceKind =>
  inventoryCountId === null ? 'direct' : 'count';

/** 원천을 바꿀 때 무슨 일이 일어나는가. */
export interface SourceChangeEffect {
  /**
   * 바뀐 뒤 남는 줄 — **빈 목록이다.**
   *
   * 매번 새 배열을 만들지 않고 같은 참조를 되돌린다 — 화면이 이 값을 그대로 상태로 넣으므로,
   * 새 배열이면 아무것도 달라지지 않은 조작이 매번 다시 그리기를 부른다.
   */
  keptLines: AdjustLineDraft[];
  /** 사라지는 줄 수. 0이면 잃을 것이 없다 */
  discardedCount: number;
}

/**
 * 원천을 바꾸면 **세운 대상이 남지 않는다.**
 *
 * 실사에서 승계한 줄은 위치·품목·LOT을 고칠 수 없고 장부가 실사에서 오는 줄이다 —
 * 직접 등록으로 옮겨 놓으면 고칠 수 없는 줄이 고칠 수 있는 표 안에 남아, 사용자가 무엇을
 * 고칠 수 있는지 알 수 없게 된다. 반대 방향도 같다(직접 등록 줄에는 실사 원천이 없다).
 *
 * **판정이 여기 하나뿐이다.** 「무엇을 잃는가」를 미리 밝히는 안내와 실제로 지우는 자리가
 * 같은 값을 쓰지 않으면, 안내가 0행이라고 말한 뒤 3행이 사라지는 화면이 된다.
 */
export const applySourceChange = (lines: readonly AdjustLineDraft[]): SourceChangeEffect => ({
  keptLines: EMPTY_LINES,
  discardedCount: lines.length,
});
