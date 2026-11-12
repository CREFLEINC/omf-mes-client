import type { DispositionDecisionCreateForward005 } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * ⭐ 005 FR-038 — 처분은 입하 LOT 단위다. 판정 하나가 부적합 LOT(= 입하 LOT 의 자재 관리 LOT) 전부를 옮기고,
 * 처분 수량은 **남은 수량 전부로 고정**한다(입력 · 일부 판정 없음). 선별은 수량이 아니라 **불량 자재 관리 LOT 고르기**다.
 */
export interface DecisionFormValue {
  dispositionTypeCode: string;
  reason: string;
  /** 선별(`SORT`)만 — 새 입하 LOT 로 옮길 불량 자재 관리 LOT(전부 아님). */
  sortLotIds: readonly number[];
  /** 선별만 — 정보 수량(선택 · 0 이상). 입력 그대로의 글자. 재고 · LOT 수량은 바뀌지 않는다. */
  goodQty: string;
  defectQty: string;
}

/** 선별 — 불량 자재 관리 LOT 을 새 입하 LOT · 새 부적합으로 넘긴다(US7-2). */
export const SORT = 'SORT';

export interface DecisionFormErrors {
  dispositionTypeCode?: string;
  /** 남은 수량을 아직 모르거나 남은 것이 없을 때 — 처분 수량 칸에 붙는다. */
  decisionQty?: string;
  reason?: string;
  lotIds?: string;
  goodQty?: string;
  defectQty?: string;
}

/**
 * 보낼 본문은 **계약(005 덧댐)에서 파생한다.** 정상 · 폐기 · 재작업과 선별의 모양이 갈린다(계약 §10).
 */
export type DecisionCreateBody = DispositionDecisionCreateForward005;

export const EMPTY_DECISION_FORM: DecisionFormValue = {
  dispositionTypeCode: '',
  reason: '',
  sortLotIds: [],
  goodQty: '',
  defectQty: '',
};

/**
 * 취소는 입력이 있을 때만 활성이다(스펙 §5-1) — API가 없고 화면 안에서 끝난다.
 * 칸을 늘어놓지 않고 값 전체를 본다 — 폼에 칸이 늘면 이 함수가 조용히 뒤처진다.
 */
export const hasDecisionInput = (value: DecisionFormValue): boolean =>
  Object.values(value).some((field) =>
    typeof field === 'string' ? field.trim() !== '' : field.length > 0,
  );

/**
 * 정보 수량의 모양 — 0 이상, 정수 12자리 · 소수 6자리까지(표시 자릿수와 같다).
 * ⚠ 상한이 없으면 `1e+21` 같은 지수 표기가 전선에 실린다.
 */
const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;

export interface DecisionFormContext {
  /** 남은 수량(서버가 낸 조회 시점 값 · 공유계약 L-2). 모르면 `undefined`. */
  remainingQty: number | undefined;
  /** 이 부적합의 자재 관리 LOT 수 — 선별은 전부를 고를 수 없다. */
  lotCount: number;
}

/** 선별에서 고른 LOT 이 막히는 이유 — 하나도 없거나 전부다. 없으면 `undefined`. */
export const sortSelectionError = (
  sortLotIds: readonly number[],
  lotCount: number,
): string | undefined => {
  const t = messages.dispositionDecision.sort;
  if (sortLotIds.length === 0) return t.noneSelected;
  if (sortLotIds.length >= lotCount) return t.allSelected;
  return undefined;
};

const infoQtyError = (raw: string): string | undefined =>
  raw.trim() === '' || DECIMAL.test(raw.trim())
    ? undefined
    : messages.dispositionDecision.sort.qtyInvalid;

/**
 * 입력 검증. 사유는 늘 필수다(계약 — 공백만은 받지 않는다).
 *
 * 정상 · 폐기 · 재작업은 남은 수량 전부를 보낸다 — 남은 수량을 아직 모르면(판정 이력 조회 전) 보낼 수가 없다.
 * 남은 수량 초과 · 동시 판정은 서버가 409 로 정한다(공유계약 L-2).
 */
export const validateDecisionForm = (
  value: DecisionFormValue,
  context: DecisionFormContext,
): DecisionFormErrors => {
  const t = messages.dispositionDecision.form;
  const errors: DecisionFormErrors = {};

  if (value.dispositionTypeCode === '') errors.dispositionTypeCode = t.dispositionRequired;
  if (value.reason.trim() === '') errors.reason = t.reasonRequired;

  if (value.dispositionTypeCode === SORT) {
    const lotError = sortSelectionError(value.sortLotIds, context.lotCount);
    if (lotError !== undefined) errors.lotIds = lotError;
    const good = infoQtyError(value.goodQty);
    const defect = infoQtyError(value.defectQty);
    if (good !== undefined) errors.goodQty = good;
    if (defect !== undefined) errors.defectQty = defect;
  } else if (value.dispositionTypeCode !== '') {
    if (context.remainingQty === undefined) errors.decisionQty = t.remainingUnknown;
    else if (context.remainingQty <= 0) errors.decisionQty = t.typeLock.closed;
  }

  return errors;
};

/**
 * 누른 순간의 로컬 날짜 `YYYY-MM-DD` — 특채 적용의 원장 업무 일자에 싣는다(공유계약 C-8).
 * ⚠ `toISOString()` 은 UTC 라 자정 근처에서 하루가 밀린다.
 */
export const toBusinessDate = (now: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const hasBlockingError = (errors: DecisionFormErrors): boolean =>
  Object.values(errors).some((message) => message !== undefined);

/**
 * 보낼 본문. **검증을 통과하지 못한 폼은 본문을 만들지 않는다.**
 *
 * ⛔ `decidedBy`·`decidedAt`은 싣지 않는다 — 서버가 인증 주체와 수신 시각으로 채운다(B-6).
 * 정상 · 폐기 · 재작업의 수량은 남은 수량 전부, 단위는 대상 LOT 의 것으로 고정한다.
 * 선별은 고른 LOT 과 (넣었으면) 정보 수량만 싣는다 — 수량 분할 본문은 없어졌다(FR-038).
 */
export const toDecisionCreateBody = (
  value: DecisionFormValue,
  uomId: number,
  context: DecisionFormContext,
): DecisionCreateBody | undefined => {
  if (hasBlockingError(validateDecisionForm(value, context))) return undefined;
  const reason = value.reason.trim();

  if (value.dispositionTypeCode === SORT) {
    const good = value.goodQty.trim();
    const defect = value.defectQty.trim();
    return {
      dispositionTypeCode: 'SORT',
      lotIds: [...value.sortLotIds],
      ...(good === '' ? {} : { goodQty: Number(good) }),
      ...(defect === '' ? {} : { defectQty: Number(defect) }),
      reason,
    };
  }

  if (context.remainingQty === undefined) return undefined;
  return {
    /* 선택지가 계약 `enum` 값 그대로다 — 선별 · 특채는 위 · 다른 길이라 셋으로 좁혀 싣는다. */
    dispositionTypeCode: value.dispositionTypeCode as 'REWORK' | 'SCRAP' | 'NORMAL',
    decisionQty: context.remainingQty,
    uomId,
    reason,
  };
};
