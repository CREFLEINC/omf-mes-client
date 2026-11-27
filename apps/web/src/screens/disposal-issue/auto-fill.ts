import type { DisposalDraft } from './types';

/**
 * 폐기 요청 정보 자동 채움(사용자 지시 2026-11-27 · #360 「자동 키인」) — 화면이 이미 아는 값을 칸에
 * 미리 넣는다. 채운 값은 사용자가 바꿀 수 있고, 보내는 값의 형식은 그대로다.
 *
 * **사용자가 고친 값은 덮지 않는다.** 칸이 비어 있거나 **직전에 화면이 채운 값 그대로**일 때만
 * 새 값으로 바꾼다 — 폐기 요청 정보는 전표를 바꿔도 유지되는 초안이다(`screen.tsx` 수명 표).
 * 폐기 사유 · 요청 사유처럼 사람이 판단할 값은 채우지 않는다.
 */
export interface DisposalAutoValues {
  issueType: string;
  sourceDocumentType: string;
  issuedDate: string;
  issuedTime: string;
  disposalPartnerId: string;
}

export const NO_DISPOSAL_AUTO_VALUES: DisposalAutoValues = {
  issueType: '',
  sourceDocumentType: '',
  issuedDate: '',
  issuedTime: '',
  disposalPartnerId: '',
};

const pick = (current: string, previous: string, next: string): string =>
  current === '' || current === previous ? next : current;

export const applyDisposalAutoFill = (
  draft: DisposalDraft,
  previous: DisposalAutoValues,
  next: DisposalAutoValues,
): DisposalDraft => ({
  ...draft,
  codes: {
    ...draft.codes,
    issueType: pick(draft.codes.issueType, previous.issueType, next.issueType),
    sourceDocumentType: pick(
      draft.codes.sourceDocumentType,
      previous.sourceDocumentType,
      next.sourceDocumentType,
    ),
  },
  issuedDate: pick(draft.issuedDate, previous.issuedDate, next.issuedDate),
  issuedTime: pick(draft.issuedTime, previous.issuedTime, next.issuedTime),
  /* 자체 폐기를 체크했으면 거래처를 넣지 않는다 — 체크와 거래처가 함께 남는 조합은 없다(`withSelfDisposal`). */
  disposalPartnerId: draft.isSelfDisposal
    ? draft.disposalPartnerId
    : pick(draft.disposalPartnerId, previous.disposalPartnerId, next.disposalPartnerId),
});

/** 선택지가 하나뿐이면 그 값, 아니면 빈 글자 — 고를 것이 하나뿐인 칸만 채운다. */
export const onlyOptionValue = (options: readonly { value: string }[]): string =>
  options.length === 1 ? (options[0]?.value ?? '') : '';
