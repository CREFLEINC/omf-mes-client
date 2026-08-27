import type { WorkOrder } from './types';

/**
 * 「지연」 판정 — **계획 종료가 지났는데 아직 안 끝난 지시**.
 *
 * ⚠ **이 판정은 원래 서버 몫이다.** 스펙 §4-A 와 공유계약 L-2 가 「달성률·지연 같은 파생은
 * 서버가 낸다」고 적었는데, **계약에 지연 필드가 없다**(전문 검색 0건 · 달성률은 들어가 있다).
 * 설계 저장소에 물어 두었다(omf-mes#265).
 *
 * ⭐ **그래서 화면이 내되 「참고값」임을 밝힌다.** 요약 집계와 처리가 갈리는 이유는 이렇다 —
 * 요약은 **모집단(필터 전체)이 화면에 없어** 셀 수가 없지만, 지연은 **한 줄 안에서 완결된다.**
 * 그 줄의 계획 종료와 상태만 보면 되므로 페이지가 몇 건이든 **각 줄의 판정은 정확하다.**
 *
 * ⛔ **「지금」을 함수 안에서 읽지 않는다.** 화면이 이미 보이고 있는 **기준 시각**을 받는다
 * (L-5). 그래야 사용자가 「무엇을 기준으로 센 값인가」를 눈으로 보고, 감지기도 실행 시각에
 * 흔들리지 않는다.
 *
 * 서버가 필드를 주기 시작하면 **이 함수 하나만 갈아 끼우면 된다.**
 */

/**
 * 지연 판정의 결과.
 *
 * ⛔ **「모른다」를 「아니다」와 갈라 둔다.** 계획 종료가 비어 있는 지시는 늦었는지 아닌지
 * **판정할 수 없는데**, 그것을 「지연 아님」과 같은 값으로 두면 화면이 빈칸으로 그리고
 * 사용자는 **「정상이구나」로 읽는다**(스펙 §5-3 · 공유 계약 후보 3).
 */
export type DelayState = 'delayed' | 'onTime' | 'unknown';

/** 아직 끝나지 않은 것만 지연일 수 있다 — 끝난 지시는 늦게 끝났어도 「지연 중」이 아니다. */
const isFinished = (workOrder: WorkOrder): boolean =>
  workOrder.completedAt !== undefined || workOrder.closedAt !== undefined;

/**
 * @param basisAt 화면이 보이고 있는 기준 시각. 조회한 순간이다.
 */
export const resolveDelay = (workOrder: WorkOrder, basisAt: Date): DelayState => {
  const plannedEnd = workOrder.plannedEndAt;

  /* ⛔ 계획 종료가 없으면 「아님」이 아니라 「모름」이다. */
  if (plannedEnd === undefined || plannedEnd === '') return 'unknown';

  const deadline = Date.parse(plannedEnd);
  /* 읽을 수 없는 값도 「모름」이다 — 지어내서 판정하지 않는다. */
  if (Number.isNaN(deadline)) return 'unknown';

  if (isFinished(workOrder)) return 'onTime';

  return deadline < basisAt.getTime() ? 'delayed' : 'onTime';
};
