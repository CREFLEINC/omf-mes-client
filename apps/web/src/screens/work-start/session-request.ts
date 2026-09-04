import type { ControlOverride, WorkOrder, WorkSessionCreate } from './types';

/**
 * 작업 시작 요청 본문을 만드는 **유일한 자리**.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `workOrderId` | 고른 작업지시 | ② 에서 선택 |
 * | `startedAt` | **단말 시각** | 공유계약 C-12 — 서버 수신 시각으로 덮지 않는다 |
 * | `equipmentId` | **실제로 도는 설비**(헤더 설비) | ⚠ 계획 설비가 아니다 |
 * | `moldId` | W/O 의 계획 금형 | 스펙 §5-A |
 * | `terminalId`·`workerId(s)`·`shiftId` | **싣지 않는다** | 통지 #563 · omf-mes#271 |
 *
 * ⛔ **단말·작업자·교대를 싣지 않는다.** 계약이 `terminalId` 를 뺐고, 사번은 헤더로 가며,
 * 교대는 서버가 시작 시각과 단말의 공장으로 푼다. 선택으로 남기지도 않는다 — 서버가 받지
 * 않는 키를 보내면 조용히 무시되고, 그 사이 「화면이 정한다」는 옛 전제가 코드에 남는다.
 *
 * ⭐ **`equipmentId` 는 헤더 설비다.** 「전체 보기」로 계획 밖 설비의 지시를 시작할 수 있고
 * (§8 미결 5 — 막지 않고 경고만 한다), 그때 세션에 남아야 하는 것은 **실제로 도는 설비**다.
 * 이 값이 사후 추적의 근거가 된다.
 *
 * ⛔ **없는 값을 0 이나 빈 값으로 채우지 않는다** — 키 자체를 싣지 않는다. 채워 보내면
 * 「배정이 없다」가 「0번 설비다」로 기록에 남는다.
 *
 * ⭐ **우회는 세션 본문에도 함께 실린다**(`P-02-02` §5-8 · 계약 `ControlOverride`). 서버가
 * 세션과 「통제 우회」 사건을 한 트랜잭션으로 만든다 — 별도 액션을 두지 않는 이유는
 * 「우회만 하고 세션을 안 여는」 상태를 없애기 위함이다. ⛔ 우회가 아니면 키를 싣지 않는다.
 */
export interface SessionRequestInput {
  workOrder: WorkOrder;
  /** 이 단말이 붙어 있는 설비. 모르면 `null` — 그때는 키를 싣지 않는다. */
  equipmentId: number | null;
  /** 단말 시각. `terminal-clock.ts` 가 만든다. */
  startedAt: string;
  /**
   * 작업 전 점검 통제를 우회하고 시작하는가. 우회가 아니면 `null` — **키를 싣지 않는다.**
   *
   * ⛔ 화면이 이 값을 «정하지» 않는다. 게이트(`P-02-02`)가 긴급 W/O 와 판정을 보고 정한
   * 결과만 여기로 온다.
   */
  controlOverride?: ControlOverride | null;
}

export const toSessionRequest = ({
  workOrder,
  equipmentId,
  startedAt,
  controlOverride = null,
}: SessionRequestInput): WorkSessionCreate => ({
  workOrderId: workOrder.workOrderId,
  startedAt,
  ...(equipmentId === null ? {} : { equipmentId }),
  ...(workOrder.plannedMoldId === undefined ? {} : { moldId: workOrder.plannedMoldId }),
  ...(controlOverride === null ? {} : { controlOverride }),
});
