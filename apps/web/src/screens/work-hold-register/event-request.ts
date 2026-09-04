import { EVENT_TYPE_RESUME, EVENT_TYPE_STOP } from './codes';
import type { HoldDraft } from './hold-draft';
import type { WorkSessionEventCreate } from './types';

/**
 * 초안 → 보낼 본문.
 *
 * ⛔ **비고는 싣지 않는다.** `WorkSessionEventCreate` 에 그 칸이 없다 — 화면 스펙 §3 목업에는
 * 입력이 있으나 §4-A 필드 표와 계약 어디에도 세션 «사건» 의 비고 컬럼이 없다(세션 표의
 * `remarks` 는 세션의 것이다). 없는 칸에 임의로 실으면 서버가 거부하거나 조용히 버린다.
 * 어디에 담는지가 정해지면 이 파일 하나가 바뀐다.
 *
 * ⛔ **재개는 사유를 비운다**(스펙 §5-4) — 「없음」을 뜻하는 값을 지어내지 않는다.
 */
export const toStopRequest = (draft: HoldDraft, occurredAt: string): WorkSessionEventCreate => ({
  eventTypeCode: EVENT_TYPE_STOP,
  occurredAt,
  /* 사유는 중단에서 필수다(§6 ⓐ 차단) — 여기 닿기 전에 `hold-draft.ts` 가 막는다. */
  reasonCode: draft.reasonCode ?? undefined,
});

export const toResumeRequest = (occurredAt: string): WorkSessionEventCreate => ({
  eventTypeCode: EVENT_TYPE_RESUME,
  occurredAt,
});
