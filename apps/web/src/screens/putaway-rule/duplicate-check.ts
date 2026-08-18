import type { PutawayRule } from './types';

/**
 * 활성 중복 선검사의 **판정 한 곳**.
 *
 * 이슈 §6이 「화면도 저장 전에 같은 검사를 한다」를 요구한다. 근거로 삼을 수 있는 것은 셋이었고
 * **조준 조회**를 골랐다(계획 §5-4 갈래 32).
 *
 * | 후보 | 문제 |
 * | --- | --- |
 * | 지금 보이는 목록 쪽 | **쪽이 다르면 조용히 틀린다** — 2쪽에 있는 활성 중복을 못 본다 |
 * | 전건 조회 | 그 창고의 규칙 수를 모르는데 전건을 끌어온다. 잘림이 다시 생긴다 |
 * | **조준 조회**(채택) | 저장 직전에 창고·품목으로 좁혀 한 번 부르고 **위치·우선순위는 여기서 맞춘다** |
 *
 * **위치를 요청 쿼리에 싣지 않는 이유**: 쿼리로는 「창고 전체」(`null`)를 표현할 수 없다.
 * 위치를 비운 규칙을 찾으려면 「위치 조건 없음」으로 부를 수밖에 없는데, 그것은 곧 「전 위치」라
 * 다른 위치의 규칙까지 함께 온다 — 맞추는 일은 클라이언트 몫이다. 우선순위도 쿼리에 없다.
 *
 * ## ⚠ 판정 축은 **미결이며 4키를 기본값으로 채택한 것**이다
 *
 * 계약 정본 **안에서 문면이 갈린다** — 다시 사용(`:activate`)의 설명은 **4키**
 * (품목·창고·위치·우선순위)이고 등록(`POST`)의 설명은 **3키**(품목·창고·위치)다.
 * 공유계약 B-12와 이슈 §6은 4키를 말한다(승인 기록 부록 B Q2).
 *
 * 3키가 정답으로 오면 고칠 자리는 **여기 `keyOf`와 목록 표식(`duplicate-badge.ts`)의 `keyOf`
 * 둘이며 함께 고친다.** 두 자리가 갈리면 「표시는 하는데 저장은 막히는」(또는 그 반대) 화면이 된다.
 *
 * **서버 400과 이중이며 어느 하나를 등가로 보고 지우지 않는다.** 화면이 막는 것은
 * *사용자가 저장을 누르기 전에 이유를 아는 것*이고, 서버가 막는 것은 *경합에서 정확한 것*이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 조준 조회의 결과. **넷을 함께 들고 있어야 「판정하지 못했다」를 값으로 가를 수 있다.** */
export interface DuplicateProbe {
  items: readonly PutawayRule[];
  /** 서버가 밝힌 전체 건수. 받은 건수보다 크면 잘린 것이다. */
  total: number;
  isLoading: boolean;
  isError: boolean;
}

/**
 * 지금 만들거나 고치려는 조합.
 *
 * **`null`이 두 뜻으로 쓰이지 않게 나눠 둔다** — `locationId`의 `null`은 「창고 전체」라는
 * 확정된 값이고, `itemId`·`warehouseId`·`priorityNo`의 `null`은 「아직 정해지지 않았다」다.
 */
export interface DuplicateTarget {
  itemId: number | null;
  warehouseId: number | null;
  /** `null`이면 **창고 전체 규칙**이다. 값이 없는 것이 아니다. */
  locationId: number | null;
  priorityNo: number | null;
  /** 자기 자신. 수정에서는 빼야 한다 — 빼지 않으면 늘 자기 때문에 막힌다. */
  selfRuleId: number | null;
}

/**
 * 판정 결과.
 *
 * **「판정하지 못했다」가 세 번째 값이다.** 「중복 없음」으로 뭉개면 못 본 것을 없다고
 * 단정하고, 「중복 있음」으로 뭉개면 조회 실패 하나가 마스터 관리 전체를 멈춘다.
 */
export type DuplicateCheck =
  | { kind: 'clear' }
  /**
   * **건수만 낸다.** 겹친 상대의 번호는 두지 않는다 — 전례는 그 번호로 「기존 결재선 열기」
   * 손잡이를 냈지만 이 화면은 그 길을 만들지 않았고(단위 ③ 판정), 쓰지 않는 값을 타입에
   * 남기면 「이 화면에 그 기능이 없다」가 타입 수준의 사실이 되지 못한다
   * (사본 체크리스트 7번). 그 길이 필요해지는 회차가 그때 번호를 함께 가져온다.
   */
  | { kind: 'blocked'; existingCount: number }
  | { kind: 'unknown'; reason: 'loading' | 'failed' | 'truncated' | 'incomplete' };

/** 판정 축 넷을 한 열쇠로 접는다(Q2 기본값 — 위 주석). */
const keyOf = (
  itemId: number,
  warehouseId: number,
  locationId: number | null,
  priorityNo: number,
): string => [itemId, warehouseId, locationId, priorityNo].map(String).join('|');

/**
 * 조준 조회 결과를 판정으로 옮긴다.
 *
 * 순서가 뜻을 정한다 — **미완성 · 실패 · 미도착 · 잘림이 중복 판정보다 앞선다.** 넷 중 하나라도
 * 참인데 「중복 없음」이라 답하면 화면이 확인하지 않은 것을 확인했다고 말하게 된다.
 *
 * ⭐ **미완성(`incomplete`)이 그중에서도 맨 앞이다.** 품목·창고·우선순위 중 하나라도 정해지지
 * 않았으면 견줄 조합 자체가 없고, 그때는 조회가 열리지도 않는다 — 조회 상태(미도착·실패)를
 * 물으면 **열리지 않은 조회의 상태**를 답으로 내게 된다. 네 갈래 전부 **막지는 않는다.**
 *
 * **꺼진 규칙은 중복이 아니다.** 계약이 막는 것은 활성 중복이고, 끄고 새로 등록해 두는 것이
 * 이 마스터의 정상 운용이다.
 */
export const judgeDuplicate = (probe: DuplicateProbe, target: DuplicateTarget): DuplicateCheck => {
  const { itemId, warehouseId, priorityNo } = target;

  /*
   * **미완성이 가장 앞이다.** 겨눌 조합이 없으면 조회 상태를 물을 것도 없다 —
   * 뒤에 두면 아직 열리지도 않은 조회의 「불러오는 중」이 미완성을 가려, 갓 연 빈 폼이
   * 「확인하지 못했습니다」라고 말하게 된다. 확인을 **시도한 적이 없는데** 실패했다고
   * 말하는 것이라 이 슬라이스가 곳곳에서 세운 규율과 정면으로 어긋난다.
   */
  if (itemId === null || warehouseId === null || priorityNo === null) {
    return { kind: 'unknown', reason: 'incomplete' };
  }

  if (probe.isError) return { kind: 'unknown', reason: 'failed' };
  if (probe.isLoading) return { kind: 'unknown', reason: 'loading' };
  if (probe.total > probe.items.length) return { kind: 'unknown', reason: 'truncated' };

  const targetKey = keyOf(itemId, warehouseId, target.locationId, priorityNo);

  const clashes = probe.items.filter(
    (item) =>
      item.isActive &&
      item.putawayRuleId !== target.selfRuleId &&
      /* 계약의 세 상태(없음·`null`·값) 중 앞 둘은 화면에서 같은 뜻이다 — 「창고 전체」. */
      keyOf(item.itemId, item.warehouseId, item.locationId ?? null, item.priorityNo) === targetKey,
  );

  return clashes.length === 0
    ? { kind: 'clear' }
    : { kind: 'blocked', existingCount: clashes.length };
};
