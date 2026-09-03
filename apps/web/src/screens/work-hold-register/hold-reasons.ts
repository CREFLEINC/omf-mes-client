import { messages } from '@omf-mes/i18n';

/**
 * 중단 사유와 세션 사건 유형의 **자리표시 상수** — 착수 이슈 §4 가 정한 처리다.
 *
 * ⚠ **목록을 화면이 들고 있는 것이 임시다.** 값 자체는 코드 사전이 확정했고, 받아 오는 자리가
 * 아직 없어 여기 적어 둔다. 값 목록의 정본은 공통코드
 * (`GET /mdm/code-values?codeGroupCode=WORK_SESSION_EVENT_REASON`)이고 그 마스터를 채우는
 * 화면은 이 저장소 밖이다(`W-06-06`). 마스터가 서면 **이 파일 하나가** 조회로 바뀐다 —
 * 화면 본문은 아래 목록만 부른다.
 *
 * ⛔ **값을 화면 곳곳에 흩어 적지 않는다.** 착수 이슈가 「프론트 상수 한 곳에 모으고 임시
 * 목록임을 표시」로 처리 방법을 정했다 — 흩어 두면 마스터가 섰을 때 무엇을 지울지 셀 수 없다.
 *
 * ⛔ **여기 없는 값을 화면이 지어내지 않는다.** 사유 7값·사건 유형 5값은 스펙과 공유계약
 * `A-25` 가 열거한 «전부»이고 예시가 아니다.
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

export interface HoldReason {
  code: string;
  name: string;
}

/**
 * 중단 사유 7값 — 스펙 §3 목업의 표시 순서를 그대로 따른다.
 *
 * ⛔ **코드 문자열은 고정한 설계 기준의 코드 사전이 정본이다**(`CD-WORK-SESSION-EVENT-REASON`).
 * 화면이 「뜻이 통하는」 이름을 지어내면 정정 경로가 없는 기록에 서버가 모르는 값이 남는다 —
 * 실제로 첫 값을 그렇게 잘못 적고 있었다(2026-09-03 정정).
 */
export const HOLD_REASONS: readonly HoldReason[] = [
  { code: 'URGENT_ORDER_INTERRUPT', name: t.reasons.URGENT_ORDER_INTERRUPT },
  { code: 'EQUIPMENT_FAILURE', name: t.reasons.EQUIPMENT_FAILURE },
  { code: 'TOOL_FAILURE', name: t.reasons.TOOL_FAILURE },
  { code: 'MATERIAL_SHORTAGE', name: t.reasons.MATERIAL_SHORTAGE },
  { code: 'MOLD_CHANGE', name: t.reasons.MOLD_CHANGE },
  { code: 'QUALITY_ISSUE', name: t.reasons.QUALITY_ISSUE },
  { code: 'OTHER', name: t.reasons.OTHER },
];

/** 사유 코드의 표시명. 목록에 없으면 코드를 그대로 보인다. */
export const holdReasonName = (code: string): string =>
  HOLD_REASONS.find((reason) => reason.code === code)?.name ?? code;
