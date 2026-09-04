import { EVENT_TYPE_RESUME, EVENT_TYPE_STOP } from './codes';

/**
 * 지금 어느 버튼이 열리는가 — **서버 상태와 큐를 함께 읽는다.**
 *
 * 화면이 직접 계산하지 않고 여기로 뺀 이유는, 판정을 가르는 구간 중 하나가 **화면에서
 * 재현하기 어렵기 때문**이다: 보낸 것이 서버에 닿아 큐는 비었는데 세션 조회가 아직 돌아오지
 * 않은 짧은 사이다. 그 사이 옛 상태를 그대로 믿으면 방금 건 중단이 한 번 더 눌린다.
 *
 * | 무엇을 아는가 | 지금 방향 |
 * | --- | --- |
 * | 큐에 담긴 것이 있다 | 그 마지막 유형 |
 * | 큐는 비었고 **다시 읽는 중**이다 | 마지막으로 보낸 유형 |
 * | 둘 다 아니다 | 서버가 말하는 세션 상태 |
 *
 * ⛔ **같은 방향을 두 번 열지 않는다** — 세션 사건은 정정 경로가 없다.
 * ⛔ **반대 방향은 막지 않는다** — 망이 끊겨 큐가 비지 않는 동안 재개가 아예 불가능해진다
 * (공유계약 C-1 #2 — 담는 것이 곧 성공이다).
 */
export interface ActionAvailability {
  canStop: boolean;
  canResume: boolean;
}

export interface ActionInputs {
  /** 서버가 말하는 세션이 진행 중인가. */
  running: boolean;
  /** 서버가 말하는 세션이 중단 상태인가. */
  stopped: boolean;
  /** 큐에 마지막으로 담긴 사건 유형. */
  lastQueuedType: string | null;
  /** 마지막으로 서버가 받은 사건 유형. */
  lastSentType: string | null;
  /** 세션을 다시 읽는 중인가. */
  isRefetching: boolean;
}

export const resolveActions = ({
  running,
  stopped,
  lastQueuedType,
  lastSentType,
  isRefetching,
}: ActionInputs): ActionAvailability => {
  const inFlight = lastQueuedType ?? (isRefetching ? lastSentType : null);

  if (inFlight === null) return { canStop: running, canResume: stopped };

  return {
    canStop: inFlight === EVENT_TYPE_RESUME,
    canResume: inFlight === EVENT_TYPE_STOP,
  };
};
