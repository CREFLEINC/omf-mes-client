import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toCodeOptionSets, type CodeValueLists } from './code-options';
import type { DisposalReadyState } from './disposal-selection';
import type { DisposalDraft } from './types';
import { EMPTY_DISPOSAL_DRAFT } from './types';
import {
  CODE_FIELD_NAMES,
  CODE_MAX,
  disposalBlockReason,
  DISPOSAL_FORM_FIELDS,
  resubmitBlockReason,
  SUBMIT_FORM_FIELDS,
  validateDisposalDraft,
} from './validation';

const t = messages.disposalIssue;

const READY: DisposalReadyState = { kind: 'ready' };
const BLOCKED: DisposalReadyState = { kind: 'blocked', reason: '고른 줄이 없습니다' };

const FILLED_DRAFT: DisposalDraft = {
  codes: {
    issueType: 'SAMPLE_GI_TYPE_A',
    sourceDocumentType: 'SAMPLE_SRC_TYPE_A',
    destinationType: 'SAMPLE_DEST_TYPE_A',
    disposalAccount: '9561',
    reason: 'SAMPLE_GI_REASON_A',
  },
  issuedDate: '2026-08-11',
  issuedTime: '09:30',
  remarks: '',
  reason: '합성 폐기 사유',
};

/** 값 목록이 확정된 상태. **다섯을 다 채운다** — 하나만 비어도 판정이 「준비 중」으로 접힌다. */
const FILLED_LISTS: CodeValueLists = {
  issueType: ['SAMPLE_GI_TYPE_A'],
  sourceDocumentType: ['SAMPLE_SRC_TYPE_A'],
  destinationType: ['SAMPLE_DEST_TYPE_A'],
  disposalAccount: ['9561'],
  reason: ['SAMPLE_GI_REASON_A'],
  receiptType: [],
  status: [],
  issueStatus: [],
};

const EMPTY_LISTS: CodeValueLists = {
  issueType: [],
  sourceDocumentType: [],
  destinationType: [],
  disposalAccount: [],
  reason: [],
  receiptType: [],
  status: [],
  issueStatus: [],
};

const block = (
  draft: DisposalDraft = FILLED_DRAFT,
  lists: CodeValueLists = FILLED_LISTS,
  selection: DisposalReadyState = READY,
): string | null =>
  disposalBlockReason({ codeOptions: toCodeOptionSets(lists), draft, selection });

describe('disposalBlockReason', () => {
  /**
   * **자리표시 두 방향**(완료 조건 C51 · 감지기 M53). 값 목록이 비어 있는 동안 잠기고,
   * 채워지면 열린다 — 채웠을 때 살아나는 것을 재지 않으면 자리표시는 죽은 가지다.
   */
  it('필수 코드 값 목록이 비어 있으면 잠긴다', () => {
    expect(block(FILLED_DRAFT, EMPTY_LISTS)).toBe(t.actionReasons.codeListPending);
  });

  it('값 목록이 채워지고 다 고르면 열린다', () => {
    expect(block()).toBeNull();
  });

  it.each(['issueType', 'sourceDocumentType', 'destinationType', 'disposalAccount', 'reason'] as const)(
    '값 목록 다섯 중 %s 하나만 비어도 잠긴다',
    (key) => {
      expect(block(FILLED_DRAFT, { ...FILLED_LISTS, [key]: [] })).toBe(
        t.actionReasons.codeListPending,
      );
    },
  );

  /** 무엇을 보내는가(줄)가 누구에게·언제(폼)보다 앞이다 — 화면에 놓인 차례 그대로다. */
  it('줄 판정의 사유를 그대로 낸다', () => {
    expect(block(FILLED_DRAFT, FILLED_LISTS, BLOCKED)).toBe(BLOCKED.reason);
  });

  it.each(['issueType', 'sourceDocumentType', 'destinationType', 'disposalAccount', 'reason'] as const)(
    '코드 %s를 고르지 않으면 잠긴다',
    (key) => {
      const draft = { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, [key]: '  ' } };

      expect(block(draft)).toBe(t.actionReasons.needsCodes);
    },
  );

  it('출고 일자·시각이 비면 각각의 사유가 나온다', () => {
    expect(block({ ...FILLED_DRAFT, issuedDate: '' })).toBe(t.actionReasons.needsIssuedDate);
    expect(block({ ...FILLED_DRAFT, issuedTime: '' })).toBe(t.actionReasons.needsIssuedTime);
  });

  /** **공백만도 빈 값이다**(목이 202로 받는 자리) — 사유는 이 화면에서만 막힌다. */
  it.each(['', '   ', '\n'])('상신 사유가 %j이면 잠긴다', (reason) => {
    expect(block({ ...FILLED_DRAFT, reason })).toBe(t.actionReasons.needsReason);
  });

  /** 사유가 사유 코드와 갈린다 — 코드를 골랐다고 상신 사유가 채워지는 것이 아니다. */
  it('사유 코드를 골랐어도 상신 사유가 비면 잠긴다', () => {
    expect(block({ ...FILLED_DRAFT, reason: '' })).toBe(t.actionReasons.needsReason);
  });
});

describe('resubmitBlockReason', () => {
  it('이미 상신된 품의는 잠긴다', () => {
    expect(resubmitBlockReason({ submission: 'submitted', reason: '사유' })).toBe(
      t.actionReasons.alreadySubmitted,
    );
  });

  /**
   * **셋째 갈래를 미상신으로 접지 않는다**(`approval-progress.ts`와 같은 판정). 값이 실려 온
   * 이상 이미 올라갔을 수 있고, 그때 다시 올리면 같은 품의의 결재 요청이 두 벌이 된다.
   */
  it('상신 여부를 확인할 수 없으면 잠긴다', () => {
    expect(resubmitBlockReason({ submission: 'unusable', reason: '사유' })).toBe(
      t.actionReasons.submissionUnknown,
    );
  });

  it.each(['', '   '])('사유가 %j이면 잠긴다', (reason) => {
    expect(resubmitBlockReason({ submission: 'notSubmitted', reason })).toBe(
      t.actionReasons.needsReason,
    );
  });

  it('미상신 전표에 사유를 적으면 열린다', () => {
    expect(resubmitBlockReason({ submission: 'notSubmitted', reason: '사유' })).toBeNull();
  });

  /** 상신 여부가 사유보다 앞이다 — 이미 올라간 건에 「사유를 적으세요」는 할 수 없는 조치다. */
  it('이미 상신됐으면 사유가 비어도 그 사유를 먼저 낸다', () => {
    expect(resubmitBlockReason({ submission: 'submitted', reason: '' })).toBe(
      t.actionReasons.alreadySubmitted,
    );
  });
});

describe('validateDisposalDraft', () => {
  it('상한을 넘는 코드에 계약 필드 이름으로 오류를 매긴다', () => {
    const long = 'x'.repeat(CODE_MAX + 1);
    const draft = { ...FILLED_DRAFT, codes: { ...FILLED_DRAFT.codes, issueType: long } };

    expect(validateDisposalDraft(draft)).toEqual({
      [CODE_FIELD_NAMES.issueType]: t.errors.codeTooLong(CODE_MAX),
    });
  });

  /** 보낼 값의 길이를 잰다 — 요청 조립이 앞뒤 공백을 떼고 보낸다. */
  it('앞뒤 공백을 뺀 길이로 잰다', () => {
    const draft = {
      ...FILLED_DRAFT,
      codes: { ...FILLED_DRAFT.codes, issueType: `  ${'x'.repeat(CODE_MAX)}  ` },
    };

    expect(validateDisposalDraft(draft)).toEqual({});
  });

  /** 사유는 **인라인 오류**로 낸다 — 고칠 자리가 그 칸이다. */
  it('상신 사유가 공백만이면 사유 칸에 오류를 매긴다', () => {
    expect(validateDisposalDraft({ ...FILLED_DRAFT, reason: '   ' })).toEqual({
      reason: t.errors.reasonRequired,
    });
  });

  it('채워진 초안에는 오류가 없다', () => {
    expect(validateDisposalDraft(FILLED_DRAFT)).toEqual({});
  });

  it('빈 초안은 사유 오류만 낸다 — 나머지는 잠금 사유가 맡는다', () => {
    expect(validateDisposalDraft(EMPTY_DISPOSAL_DRAFT)).toEqual({
      reason: t.errors.reasonRequired,
    });
  });
});

describe('화면이 아는 필드', () => {
  /**
   * 서버가 준 필드 오류를 **인라인으로 낼지 배너로 올릴지** 가른다. 잣대는 「그 이름의 오류를
   * 화면이 **보일 자리가 있는가**」다 — 없는 이름을 담으면 어디에도 보이지 않는 오류가 된다.
   */
  it('폼에 칸이 있는 이름만 담는다', () => {
    expect([...DISPOSAL_FORM_FIELDS].sort()).toEqual(
      [
        'issueTypeCode',
        'sourceDocumentTypeCode',
        'destinationTypeCode',
        'destinationId',
        'reasonCode',
        'issuedAt',
        'remarks',
      ].sort(),
    );
  });

  /** 화면이 값을 정하지 않는 필드는 담지 않는다 — 고른 전표·표의 줄·파생·상수에서 온다. */
  it.each(['sourceDocumentId', 'sourceWarehouseId', 'businessDate', 'occurredAt', 'lines', 'postImmediately'])(
    '%s는 담지 않는다',
    (field) => {
      expect(DISPOSAL_FORM_FIELDS).not.toContain(field);
    },
  );

  /** 상신 본문의 필드는 사유 하나다 — 넓히면 남의 오류가 사유 칸에 붙는다. */
  it('상신이 아는 필드는 사유 하나다', () => {
    expect(SUBMIT_FORM_FIELDS).toEqual(['reason']);
  });
});
