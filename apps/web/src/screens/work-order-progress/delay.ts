import type { WorkOrder } from './types';

/**
 * 「지연」 판정 — **계획 종료가 지났는데 아직 안 끝난 지시**.
 *
 * ⭐ **서버 판정이 먼저다.** 실적 누계와 함께 받은 응답에는 `progress.delayStatusCode` 가 실려 오고
 * (공유계약 L-2 — 달성률·지연 같은 파생은 서버가 낸다), 요약의 지연 건수도 같은 기준으로 센다.
 *
 * 화면 계산은 그 값이 없을 때만 쓴다. 지연은 **한 줄 안에서 완결돼** 그 줄의 계획 종료와 상태만 보면 된다.
 *
 * ⛔ **「지금」을 함수 안에서 읽지 않는다.** 화면이 이미 보이고 있는 **기준 시각**을 받는다
 * (L-5). 그래야 사용자가 「무엇을 기준으로 센 값인가」를 눈으로 보고, 감지기도 실행 시각에
 * 흔들리지 않는다.
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

const SERVER_DELAY: Record<string, DelayState> = {
  ON_TIME: 'onTime',
  DELAYED: 'delayed',
  UNDETERMINABLE: 'unknown',
};

/** 서버가 낸 판정만. 실적 누계 없이 받았으면 `null` — 기준 시각 없이는 화면이 대신 판정하지 않는다. */
export const servedDelay = (workOrder: WorkOrder): DelayState | null =>
  SERVER_DELAY[workOrder.progress?.delayStatusCode ?? ''] ?? null;

/**
 * @param basisAt 화면이 보이고 있는 기준 시각. 조회한 순간이다.
 */
export const resolveDelay = (workOrder: WorkOrder, basisAt: Date): DelayState => {
  /*
   * ⭐ 서버가 판정을 주면 그대로 쓴다(`progress.delayStatusCode`) — 요약의 지연 건수와 같은 기준이라
   * 줄과 요약이 어긋나지 않는다. 아래 계산은 실적 누계 없이 받은 응답을 위한 것이다.
   */
  const served = servedDelay(workOrder);
  if (served !== null) return served;

  const plannedEnd = workOrder.plannedEndAt;

  /* ⛔ 계획 종료가 없으면 「아님」이 아니라 「모름」이다. */
  if (plannedEnd === undefined || plannedEnd === '') return 'unknown';

  const deadline = Date.parse(plannedEnd);
  /* 읽을 수 없는 값도 「모름」이다 — 지어내서 판정하지 않는다. */
  if (Number.isNaN(deadline)) return 'unknown';

  if (isFinished(workOrder)) return 'onTime';

  return deadline < basisAt.getTime() ? 'delayed' : 'onTime';
};
