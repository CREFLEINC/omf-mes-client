import {
  DIRECTION_END,
  DIRECTION_RESUME,
  DIRECTION_STOP,
  EVENT_TYPE_RESUME,
  EVENT_TYPE_STOP,
} from './codes';
import type { HoldDraft } from './hold-draft';
import type { OutboxDraft } from './outbox';

/**
 * 초안 → **큐에 담을 한 묶음.**
 *
 * ⭐ **중단·재개는 호출이 둘이다**(스펙 §5-4 · 2026-09-06 게이트 승인) — W/O 층의 상태 전환과
 * 세션 구간 안의 사건이다. 둘은 한 트랜잭션이 아니므로 화면이 둘 다 부른다.
 *
 * **W/O 층을 먼저 보낸다.** 스펙이 순서를 정하지 않았으므로 우리가 정했다 — 상태가 먼저 서야
 * 사건이 「그 구간 안의 일」로 읽히고, 무엇보다 **앞만 닿은 상태가 뒤만 닿은 상태보다 덜
 * 위험하다**: W/O 상태는 다시 옮길 수 있지만 사건은 정정 경로가 없다.
 *
 * ⭐ **비고는 W/O 층 본문이 받는다** — 세션 «사건» 에는 비고 칸이 없다(스펙 §4-A). 앞선 판은
 * 담을 자리가 없어 입력 자체를 두지 않았는데, 그 자리가 정해졌다.
 *
 * ⛔ **재개는 사유를 비운다**(스펙 §5-4) — 「없음」을 뜻하는 값을 지어내지 않는다.
 */

/** 한 조작이 매인 곳 — **담을 때의 값이다.** 재전송 시점에 다시 고르지 않는다. */
export interface HoldTarget {
  workOrderId: number;
  workSessionId: number;
  workerNo: string;
}

/** 빈 문자열을 보내지 않는다 — 「안 적었다」와 「빈칸을 적었다」를 서버가 가를 이유가 없다. */
const toNote = (remarks: string): string | undefined => {
  const trimmed = remarks.trim();

  return trimmed === '' ? undefined : trimmed;
};

/**
 * 중단 한 묶음. **사유가 없으면 만들지 않는다** — `null` 을 낸다.
 *
 * ⛔ **호출자 규율에 기대지 않는다.** 사유는 계약 필수이고(`WorkOrderHold.reasonCode`) 화면이
 * 앞에서 막지만(§6 ⓐ 차단), 그 한 겹이 뚫리면 **빈 사유가 서버로 나가 400 을 받고 그 거부가
 * 큐 전체를 멈춰** 뒤에 쌓인 정상 건까지 막는다 — 이 큐가 지키려는 것과 정반대다.
 */
export const toStopGroup = (
  draft: HoldDraft,
  occurredAt: string,
  target: HoldTarget,
): OutboxDraft[] | null => {
  const reasonCode = draft.reasonCode;

  if (reasonCode === null || reasonCode === '') return null;

  return [
    {
      kind: 'work-order-hold',
      direction: DIRECTION_STOP,
      ...target,
      body: { reasonCode, occurredAt, note: toNote(draft.remarks) },
    },
    {
      kind: 'session-event',
      direction: DIRECTION_STOP,
      ...target,
      body: { eventTypeCode: EVENT_TYPE_STOP, occurredAt, reasonCode },
    },
  ];
};

/**
 * 재개.
 *
 * ⛔ **비고를 싣지 않는다.** 계약의 `WorkOrderResume` 에 칸은 있으나 **스펙 §3 도면이 재개에
 * 비고 입력을 그리지 않는다** — 화면에 없는 입력을 코드가 지어내 채우지 않는다.
 */
export const toResumeGroup = (occurredAt: string, target: HoldTarget): OutboxDraft[] => [
  {
    kind: 'work-order-resume',
    direction: DIRECTION_RESUME,
    ...target,
    body: { occurredAt },
  },
  {
    kind: 'session-event',
    direction: DIRECTION_RESUME,
    ...target,
    body: { eventTypeCode: EVENT_TYPE_RESUME, occurredAt },
  },
];

/**
 * 세션 종료 — **호출 하나다.**
 *
 * ⛔ **`END` 사건을 따로 담지 않는다.** 구간의 경계는 세션을 닫는 오퍼레이션이 같은
 * 트랜잭션으로 만든다(계약 실측) — 단말이 함께 보내면 같은 종료가 두 번 기록된다.
 *
 * ⛔ **`stopReasonCode` 를 싣지 않는다** — 계약이 「비우기로 정했다」로 못박았다(A-21).
 */
export const toEndGroup = (endedAt: string, target: HoldTarget): OutboxDraft[] => [
  {
    kind: 'session-end',
    direction: DIRECTION_END,
    ...target,
    body: { endedAt },
  },
];
