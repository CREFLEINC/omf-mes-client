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
export type WorkOrderAdjustment = components['schemas']['WorkOrderAdjustment'];

/** 계약이 열거한 둘. 손으로 적은 유니온을 두지 않는다 — 계약이 값을 바꾸면 컴파일이 잡는다. */
export type DecisionCode = AcknowledgeBody['decisionCode'];

/** 사유의 길이 상한. 계약이 상한을 두지 않아 화면이 정한다. */
export const REASON_MAX = 500;

export interface DecisionDraft {
  /** 아직 고르지 않았으면 `null`. */
  decision: DecisionCode | null;
  reason: string;
  /**
   * W/O별 조정 수량 — 키는 `workOrderId`, 값은 입력 문자열. **비우면 그 W/O 는 그대로 둔다.**
   * 서버가 스스로 나누지 않는다(계약) — 어느 W/O 를 얼마나 줄일지는 여기서 사람이 정한다.
   */
  adjustments: Readonly<Record<string, string>>;
}

export const EMPTY_DECISION: DecisionDraft = { decision: null, reason: '', adjustments: {} };

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

/** 조정 수량 한 칸의 오류. 빈 칸은 「그대로 둔다」라 오류가 아니다. */
export const adjustmentError = (text: string): string | undefined => {
  const t = messages.poChangeReview.workOrders;
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  const value = Number(trimmed.replace(/,/g, ''));
  if (Number.isNaN(value)) return t.adjustNotNumber;
  if (value < 0) return t.adjustNegative;

  return undefined;
};

/** 줄마다의 조정 오류 — 키는 `workOrderId`. 반영이 아닐 때는 조정을 보내지 않으니 오류도 없다. */
export const adjustmentErrors = (
  draft: DecisionDraft,
  workOrders: readonly AffectedWorkOrder[],
): Record<string, string> => {
  if (draft.decision !== 'APPLY') return {};
  const errors: Record<string, string> = {};
  for (const workOrder of workOrders) {
    const error = adjustmentError(draft.adjustments[String(workOrder.workOrderId)] ?? '');
    if (error !== undefined) errors[String(workOrder.workOrderId)] = error;
  }

  return errors;
};

/**
 * 보낼 조정 — 수량을 적은 줄만, 잠금 토큰(`versionNo`)이 있는 줄만.
 *
 * ⛔ 토큰이 없는 W/O 는 싣지 않는다 — 계약이 `versionNo`를 필수로 두었고 화면은 그 칸을 잠근다.
 */
export const toAdjustments = (
  draft: DecisionDraft,
  workOrders: readonly AffectedWorkOrder[],
): WorkOrderAdjustment[] =>
  workOrders.flatMap((workOrder) => {
    const text = (draft.adjustments[String(workOrder.workOrderId)] ?? '').trim();
    if (text === '' || workOrder.versionNo === null || adjustmentError(text) !== undefined) {
      return [];
    }

    return [
      {
        workOrderId: workOrder.workOrderId,
        versionNo: workOrder.versionNo,
        orderQty: Number(text.replace(/,/g, '')),
      },
    ];
  });

export interface DecisionGateInput {
  selected: ChangeNotification | null;
  draft: DecisionDraft;
  workOrders: readonly AffectedWorkOrder[];
  isSaving: boolean;
}

/**
 * 「확인 처리」를 막는 사유. 없으면 `undefined`.
 *
 * ⛔ **활성 조건을 넓히지 않는다**(§5-6) — 「판정 선택됨 AND (반영 **또는** 사유 입력됨)」이
 * 전부다. 반영인데 W/O 조정을 하나도 안 한 상태로도 저장할 수 있어야 한다 — **중단·취소
 * 반영이 정당하게 그 상태**이고, 막으면 그 갈래가 아예 못 지나간다. 대신 경고가 진다.
 * 조정 칸에 «잘못된» 값이 있으면 막는다 — 반쪽짜리 조정을 보내지 않는다.
 */
export const decisionLockReason = (input: DecisionGateInput): string | undefined => {
  const t = messages.poChangeReview.lock;

  if (input.isSaving) return t.saving;
  if (input.selected === null) return t.selectNone;
  if (input.draft.decision === null) return t.decisionNone;
  if (reasonError(input.draft) !== undefined) return t.reason;
  if (Object.keys(adjustmentErrors(input.draft, input.workOrders)).length > 0) return t.adjustment;

  return undefined;
};

/**
 * 보낼 본문. **막을 사유가 하나라도 있으면 `null`.**
 *
 * ⚠ **반영에는 사유를 싣지 않는다** — 계약이 「강행이면 사유가 필요하다」로 적었고, 반영에
 * 빈 글자를 실어 보내면 서버가 「사유를 적었는데 비어 있다」로 읽는다.
 *
 * ⭐ **반영은 W/O 조정을 함께 싣는다** — P/O 확인과 W/O 조정이 «한 트랜잭션»이다(B-8).
 * 적은 줄이 없으면 칸을 내지 않는다(중단·취소 반영이 그 경우다).
 * ⛔ **강행에는 조정을 싣지 않는다** — 보내면 400 이다. 강행은 「기존을 유지한다」라 조정이
 * 성립하지 않는다.
 */
export const toAcknowledgeBody = (input: DecisionGateInput): AcknowledgeBody | null => {
  if (decisionLockReason(input) !== undefined) return null;
  if (input.draft.decision === null) return null;

  if (input.draft.decision === 'PROCEED') {
    return { decisionCode: 'PROCEED', reason: input.draft.reason.trim() };
  }

  const workOrderAdjustments = toAdjustments(input.draft, input.workOrders);

  return {
    decisionCode: 'APPLY',
    ...(workOrderAdjustments.length === 0 ? {} : { workOrderAdjustments }),
  };
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
  /** 반영인데 조정을 하나도 적지 않았다 — 조정되지 않은 W/O 에 표식이 남는다. */
  applyWithoutAdjustment: boolean;
  /** 실적이 계획을 넘게 되는 W/O 들 — 조정을 적었으면 그 수량과, 아니면 변경 후 P/O 수량과 견준다. */
  overProduced: AffectedWorkOrder[];
}

export const decisionWarnings = (
  draft: DecisionDraft,
  workOrders: readonly AffectedWorkOrder[],
  changedQty: number | null,
): DecisionWarnings => {
  const adjustments = toAdjustments(draft, workOrders);
  const adjustedQtyOf = new Map(adjustments.map((one) => [one.workOrderId, one.orderQty]));

  return {
    mismatch: draft.decision === 'PROCEED',
    applyWithoutAdjustment:
      draft.decision === 'APPLY' && workOrders.length > 0 && adjustments.length === 0,
    overProduced: workOrders.filter((one) => {
      if (one.producedQty === null) return false;
      const target = adjustedQtyOf.get(one.workOrderId);
      if (target !== undefined) return one.producedQty > target;
      return adjustments.length === 0 && changedQty !== null && one.producedQty > changedQty;
    }),
  };
};
