import type { ApprovalRoute } from './types';

/**
 * 활성 중복 선검사의 **판정 한 곳**.
 *
 * 이슈가 「화면도 저장 전에 같은 검사를 한다」를 요구한다. 무엇을 근거로 검사할지는 셋 중
 * 하나였고 **조준 조회**를 골랐다(계획 결정 9).
 *
 * | 후보 | 문제 |
 * | --- | --- |
 * | 지금 보이는 목록 쪽 | **쪽이 다르면 조용히 틀린다** — 2쪽에 있는 활성 중복을 못 본다 |
 * | 전건 조회 | 결재선 수를 모르는데 전건을 끌어온다. 잘림이 다시 생긴다 |
 * | **조준 조회**(채택) | 저장 직전에 승인 유형으로 좁혀 한 번 부르고 **사업부는 여기서 맞춘다** |
 *
 * **사업부를 요청 쿼리에 싣지 않는 이유**: 쿼리로는 「전 사업부 공통」(`null`)을 표현할 수
 * 없다. 비운 결재선을 찾으려면 「사업부 조건 없음」으로 부를 수밖에 없는데, 그것은 곧
 * 「전 사업부」라 다른 사업부의 결재선까지 함께 온다 — 맞추는 일은 클라이언트 몫이다.
 *
 * **서버 400과 이중이며 어느 하나를 등가로 보고 지우지 않는다.** 화면이 막는 것은
 * *사용자가 저장을 누르기 전에 이유를 아는 것*이 목적이고, 서버가 막는 것은 *경합에서
 * 정확한 것*이 목적이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 조준 조회의 결과. **넷을 함께 들고 있어야 「판정하지 못했다」를 값으로 가를 수 있다.** */
export interface DuplicateProbe {
  items: readonly ApprovalRoute[];
  /** 서버가 밝힌 전체 건수. 받은 건수보다 크면 잘린 것이다. */
  total: number;
  isLoading: boolean;
  isError: boolean;
}

export interface DuplicateTarget {
  /** 지금 만들거나 고치려는 사업부. `null`이면 「전 사업부 공통」이다. */
  businessUnitId: number | null;
  /** 자기 자신. 수정·다시 사용에서는 빼야 한다 — 빼지 않으면 늘 자기 때문에 막힌다. */
  selfRouteId: number | null;
}

/**
 * 판정 결과.
 *
 * **「판정하지 못했다」가 세 번째 값이다.** 「중복 없음」으로 뭉개면 못 본 것을 없다고
 * 단정하고, 「중복 있음」으로 뭉개면 조회 실패 하나가 마스터 관리 전체를 멈춘다.
 */
export type DuplicateCheck =
  | { kind: 'clear' }
  | { kind: 'blocked'; existingCount: number; existingRouteId: number }
  | { kind: 'unknown'; reason: 'loading' | 'failed' | 'truncated' };

/**
 * 조준 조회 결과를 판정으로 옮긴다.
 *
 * 순서가 뜻을 정한다 — **실패 · 미도착 · 잘림이 중복 판정보다 앞선다.** 셋 중 하나라도
 * 참인데 「중복 없음」이라 답하면 화면이 확인하지 않은 것을 확인했다고 말하게 된다.
 *
 * **「활성 중복」의 뜻도 여기서 정한다.** 조준 조회가 `activeOnly=true`를 싣지만 그것은
 * 요청의 사정이고, 무엇을 중복으로 볼 것인가는 판정하는 자리에 있어야 한 곳에서 읽힌다.
 */
export const judgeDuplicate = (probe: DuplicateProbe, target: DuplicateTarget): DuplicateCheck => {
  if (probe.isError) return { kind: 'unknown', reason: 'failed' };
  if (probe.isLoading) return { kind: 'unknown', reason: 'loading' };
  if (probe.total > probe.items.length) return { kind: 'unknown', reason: 'truncated' };

  const clashes = probe.items.filter(
    (item) =>
      item.isActive &&
      item.approvalRouteId !== target.selfRouteId &&
      /* 계약의 세 상태(없음·`null`·값) 중 앞 둘은 화면에서 같은 뜻이다 — 「전 사업부 공통」. */
      (item.businessUnitId ?? null) === target.businessUnitId,
  );

  const first = clashes[0];

  if (first === undefined) return { kind: 'clear' };

  return { kind: 'blocked', existingCount: clashes.length, existingRouteId: first.approvalRouteId };
};
