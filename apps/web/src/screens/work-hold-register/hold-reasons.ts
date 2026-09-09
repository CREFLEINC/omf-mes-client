import { messages } from '@omf-mes/i18n';

/**
 * 화면이 코드를 **사람 말로 옮기는 자리** — 시스템이 소유한 값만 남는다.
 *
 * ⛔ **중단 사유 목록은 여기 없다.** 그 그룹은 `registry`(고객이 늘린다)라 서버가 갖는다 —
 * `reason-options.ts` 가 받아 온다. 앞선 판이 7값을 상수로 들고 있었던 것은 스펙 §3 목업을
 * 확정 목록으로 읽었기 때문인데, 2026-09-06 개정이 그것을 **초기 시드**로 정정했다.
 *
 * ⭐ **아래 둘은 남는다** — 사건 유형 5값과 세션 상태 3값은 **시스템 소유**라(계약이 「고객이
 * 값을 늘리지 않는다」로 못박았다) 화면이 표시명을 갖는 것이 맞다. 목록을 고르는 자리가
 * 아니라 받은 값을 읽는 자리다.
 */

const t = messages.workHoldRegister;

/** 세션 사건 유형 5값(공유계약 `A-25`). 이 화면이 «만드는» 것은 중단·재개뿐이다. */
export const WORK_SESSION_EVENT_TYPES = [
  'START',
  'STOP',
  'RESUME',
  'END',
  'CONTROL_OVERRIDE',
] as const;

export type WorkSessionEventTypeCode = (typeof WORK_SESSION_EVENT_TYPES)[number];

const EVENT_TYPE_NAMES: Record<WorkSessionEventTypeCode, string> = t.eventTypes;

/**
 * 사건 유형의 표시명. **모르는 값이면 코드를 그대로 보인다.**
 *
 * ⛔ 인식하지 못한 값을 「기타」로 접지 않는다 — 설계가 승인한 적 없는 접기를 화면이 만들면
 * 이력에서 그 사건이 다른 것으로 읽힌다.
 */
export const eventTypeName = (code: string): string =>
  code in EVENT_TYPE_NAMES ? EVENT_TYPE_NAMES[code as WorkSessionEventTypeCode] : code;

/** 세션 상태 표시명. **모르는 값이면 코드를 그대로 보인다** — 임의로 접지 않는다. */
export const sessionStatusName = (code: string): string =>
  code in t.sessionStatus ? t.sessionStatus[code as keyof typeof t.sessionStatus] : code;
