import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import type { AffectedWorkOrder, ChangeNotification } from './types';

/**
 * 판정 초안과 게이트.
 *
 * ⭐ **게이트와 본문 조립을 한 파일에 둔다** — 갈라지면 「버튼은 열렸는데 본문이 안 만들어진다」
 * 또는 「막았는데 본문은 만들어진다」가 생긴다.
 *
 * ⛔ **이것은 승인 워크플로우가 아니라 «확인» 행위다**(§5-4) — 결재선이 없고 단일 액션이다.
 */

export type AcknowledgeBody = components['schemas']['ProductionOrderAcknowledge'];

/** 계약이 열거한 둘. 손으로 적은 유니온을 두지 않는다 — 계약이 값을 바꾸면 컴파일이 잡는다. */
export type DecisionCode = AcknowledgeBody['decisionCode'];

/** 사유의 길이 상한. 계약이 상한을 두지 않아 화면이 정한다. */
export const REASON_MAX = 500;

export interface DecisionDraft {
  /** 아직 고르지 않았으면 `null`. */
  decision: DecisionCode | null;
  reason: string;
}

export const EMPTY_DECISION: DecisionDraft = { decision: null, reason: '' };

/**
 * 사유 검증.
 *
 * ⛔ **강행일 때만 필수다** — 화면이 막고 DB 는 막지 않는다(§6). 반영에 사유를 요구하면
 * 정상 흐름이 매번 글쓰기를 요구받는다.
 */
export const reasonError = (draft: DecisionDraft): string | undefined => {
  const t = messages.poChangeReview.decision;
  if (draft.decision !== 'PROCEED') return undefined;

  const value = draft.reason.trim();
  if (value === '') return t.reasonRequired;
  if (value.length > REASON_MAX) return t.reasonTooLong;

  return undefined;
};

export interface DecisionGateInput {
  selected: ChangeNotification | null;
  draft: DecisionDraft;
  isSaving: boolean;
}

/**
 * 「확인 처리」를 막는 사유. 없으면 `undefined`.
 *
 * ⛔ **활성 조건을 넓히지 않는다**(§5-6) — 「판정 선택됨 AND (반영 **또는** 사유 입력됨)」이
 * 전부다. 반영인데 W/O 조정을 하나도 안 한 상태로도 저장할 수 있어야 한다 — **중단·취소
 * 반영이 정당하게 그 상태**이고, 막으면 그 갈래가 아예 못 지나간다. 대신 경고가 진다.
 */
export const decisionLockReason = (input: DecisionGateInput): string | undefined => {
  const t = messages.poChangeReview.lock;

  if (input.isSaving) return t.saving;
  if (input.selected === null) return t.selectNone;
  if (input.draft.decision === null) return t.decisionNone;
  if (reasonError(input.draft) !== undefined) return t.reason;

  return undefined;
};

/**
 * 보낼 본문. **막을 사유가 하나라도 있으면 `null`.**
 *
 * ⚠ **반영에는 사유를 싣지 않는다** — 계약이 「강행이면 사유가 필요하다」로 적었고, 반영에
 * 빈 글자를 실어 보내면 서버가 「사유를 적었는데 비어 있다」로 읽는다.
 *
 * ⛔ **`workOrderAdjustments` 를 아직 싣지 못한다** — 그 칸이 생성물에 반영되지 않았다.
 * 지금은 조정 없이 보내고, 서버가 조정되지 않은 W/O 에 불일치 표식을 세운다. 화면은 저장
 * 전에 그 파급을 말한다(G-19).
 */
export const toAcknowledgeBody = (input: DecisionGateInput): AcknowledgeBody | null => {
  if (decisionLockReason(input) !== undefined) return null;
  if (input.draft.decision === null) return null;

  return input.draft.decision === 'PROCEED'
    ? { decisionCode: 'PROCEED', reason: input.draft.reason.trim() }
    : { decisionCode: 'APPLY' };
};

/**
 * 저장 전에 말할 파급.
 *
 * ⭐ **G-19 — 저장 전에 파급을 말한다.** 되돌릴 수 없는 판정이라 무엇이 남는지를 «누르기 전»에
 * 보여야 한다. 막지 않는다(A-9 ⓑ).
 */
export interface DecisionWarnings {
  /** 강행이라 불일치 표식이 남는다. */
  mismatch: boolean;
  /** 반영인데 조정을 못 보낸다 — 조정되지 않은 W/O 에 표식이 남는다. */
  applyWithoutAdjustment: boolean;
  /** 실적이 변경 후 수량을 넘는 W/O 들. */
  overProduced: AffectedWorkOrder[];
}

export const decisionWarnings = (
  draft: DecisionDraft,
  workOrders: readonly AffectedWorkOrder[],
  changedQty: number | null,
): DecisionWarnings => ({
  mismatch: draft.decision === 'PROCEED',
  /*
   * ⚠ 지금은 조정을 «보낼 수가» 없어 반영을 고르면 언제나 참이다. 조정 칸이 계약에 앉으면
   * 「하나도 지정하지 않았을 때만」으로 좁아진다.
   */
  applyWithoutAdjustment: draft.decision === 'APPLY' && workOrders.length > 0,
  overProduced:
    changedQty === null
      ? []
      : workOrders.filter((one) => one.producedQty !== null && one.producedQty > changedQty),
});
