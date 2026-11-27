import type { ReturnDraft } from './types';

/**
 * 반품 정보 자동 채움(사용자 지시 2026-11-27 · #360 「자동 키인」) — 화면이 이미 아는 값을 칸에 미리
 * 넣는다. 채운 값은 사용자가 바꿀 수 있고, 보내는 값의 형식은 그대로다.
 *
 * **사용자가 고친 값은 덮지 않는다.** 칸이 비어 있거나 **직전에 화면이 채운 값 그대로**일 때만
 * 새 값으로 바꾼다 — 반품 정보는 전표를 바꿔도 유지되는 초안이라(`screen.tsx` 수명 표), 앞 전표의
 * 공급사를 화면이 채웠으면 다음 전표의 공급사로 바뀌고 사용자가 고른 공급사는 남는다.
 * 반품 사유처럼 사람이 판단할 값은 채우지 않는다.
 */
export interface ReturnAutoValues {
  supplier: string;
  issueType: string;
  sourceDocumentType: string;
  destinationType: string;
  issuedDate: string;
  issuedTime: string;
}

export const NO_RETURN_AUTO_VALUES: ReturnAutoValues = {
  supplier: '',
  issueType: '',
  sourceDocumentType: '',
  destinationType: '',
  issuedDate: '',
  issuedTime: '',
};

const pick = (current: string, previous: string, next: string): string =>
  current === '' || current === previous ? next : current;

export const applyReturnAutoFill = (
  draft: ReturnDraft,
  previous: ReturnAutoValues,
  next: ReturnAutoValues,
): ReturnDraft => ({
  ...draft,
  supplier: pick(draft.supplier, previous.supplier, next.supplier),
  codes: {
    ...draft.codes,
    issueType: pick(draft.codes.issueType, previous.issueType, next.issueType),
    sourceDocumentType: pick(
      draft.codes.sourceDocumentType,
      previous.sourceDocumentType,
      next.sourceDocumentType,
    ),
    destinationType: pick(
      draft.codes.destinationType,
      previous.destinationType,
      next.destinationType,
    ),
  },
  issuedDate: pick(draft.issuedDate, previous.issuedDate, next.issuedDate),
  issuedTime: pick(draft.issuedTime, previous.issuedTime, next.issuedTime),
});

/** 선택지가 하나뿐이면 그 값, 아니면 빈 글자 — 고를 것이 하나뿐인 칸만 채운다. */
export const onlyOptionValue = (options: readonly { value: string }[]): string =>
  options.length === 1 ? (options[0]?.value ?? '') : '';

/** 계약 `GoodsIssueCreate.issueTypeCode` 의 확정 값 — 공급사반품(2026-08-31 확정). */
export const SUPPLIER_RETURN_ISSUE_TYPE_CODE = 'SUPPLIER_RETURN';
