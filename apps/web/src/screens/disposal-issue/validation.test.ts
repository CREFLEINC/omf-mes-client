import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { PostApproval, Submission } from './approval-progress';
import {
  PLACEHOLDER_DISPOSAL_PARTNER_OPTIONS,
  toCodeOptionSets,
  type CodeValueLists,
} from './code-options';
import type { DisposalReadyState } from './disposal-selection';
import type { DisposalDraft, SelectOption } from './types';
import { EMPTY_DISPOSAL_DRAFT } from './types';
import {
  CODE_FIELD_NAMES,
  CODE_MAX,
  disposalBlockReason,
  DISPOSAL_FORM_FIELDS,
  postBlockReason,
  POST_FORM_FIELDS,
  type PostGateInput,
  resubmitBlockReason,
  SUBMIT_FORM_FIELDS,
  validateDisposalDraft,
} from './validation';

const t = messages.disposalIssue;

const READY: DisposalReadyState = { kind: 'ready' };
const BLOCKED: DisposalReadyState = { kind: 'blocked', reason: '고른 줄이 없습니다' };

/** 도착지까지 정한 초안 — **자체 폐기**다. 거래처 갈래는 `PARTNER_DRAFT`가 짝으로 잰다. */
const FILLED_DRAFT: DisposalDraft = {
  codes: {
    issueType: 'SAMPLE_GI_TYPE_A',
    sourceDocumentType: 'SAMPLE_SRC_TYPE_A',
    reason: 'SAMPLE_GI_REASON_A',
  },
  issuedDate: '2026-08-11',
  issuedTime: '09:30',
  remarks: '',
  isSelfDisposal: true,
  disposalPartnerId: '',
  reason: '합성 폐기 사유',
};

const PARTNER_DRAFT: DisposalDraft = {
  ...FILLED_DRAFT,
  isSelfDisposal: false,
  disposalPartnerId: '9251',
};

/** 도착지를 아직 정하지 않은 초안 — 「자체 폐기라 없다」와 갈리는 상태다. */
const UNDECIDED_DRAFT: DisposalDraft = {
  ...FILLED_DRAFT,
  isSelfDisposal: false,
  disposalPartnerId: '',
};

/** 폐기 거래처 선택지가 채워진 뒤의 모양. **지금의 사실이 아니라 전환을 재기 위한 입력**이다. */
const FILLED_PARTNERS: SelectOption[] = [
  { value: '9251', label: 'SAMPLE-PARTNER-01 · 합성 폐기업체 가' },
];

/** 값 목록이 확정된 상태. **셋을 다 채운다** — 하나만 비어도 판정이 「준비 중」으로 접힌다. */
const FILLED_LISTS: CodeValueLists = {
  issueType: ['SAMPLE_GI_TYPE_A'],
  sourceDocumentType: ['SAMPLE_SRC_TYPE_A'],
  reason: ['SAMPLE_GI_REASON_A'],
  receiptType: [],
  status: [],
  issueStatus: [],
};

const EMPTY_LISTS: CodeValueLists = {
  issueType: [],
  sourceDocumentType: [],
  reason: [],
  receiptType: [],
  status: [],
  issueStatus: [],
};

const block = (
  draft: DisposalDraft = FILLED_DRAFT,
  lists: CodeValueLists = FILLED_LISTS,
  selection: DisposalReadyState = READY,
  disposalPartnerOptions: readonly SelectOption[] = PLACEHOLDER_DISPOSAL_PARTNER_OPTIONS,
): string | null =>
  disposalBlockReason({
    codeOptions: toCodeOptionSets(lists),
    draft,
    selection,
    disposalPartnerOptions,
  });

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

  it.each(['issueType', 'sourceDocumentType', 'reason'] as const)(
    '값 목록 셋 중 %s 하나만 비어도 잠긴다',
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

  it.each(['issueType', 'sourceDocumentType', 'reason'] as const)(
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

/**
 * **도착지를 정해야 열린다**(완료 조건 C18 · 변경 통지 #128 §4 ⛔).
 *
 * 「체크 없이 거래처도 안 고르면 막는다」가 통지의 문면이고, 그 잠금이 **「승인 요청」 버튼**에
 * 선다(승인 기록 D-1 안 A — 계약에 전표 헤더를 고치는 경로가 없어 도착지는 **발의 시점**에
 * 정해져 생성 본문으로 나간다).
 *
 * **사유가 둘로 갈리는 것이 이 묶음의 요점이다.** 고를 것이 없는 사용자에게 「고르세요」라고
 * 말하면, 사용자는 자기가 놓친 것을 찾다가 화면을 고장으로 읽는다 — 이 슬라이스가 코드
 * 자리표시에서 이미 세운 규율을 도착지에도 그대로 적용한다.
 */
describe('disposalBlockReason — 도착지 두 갈래', () => {
  it('선택칸이 잠겨 있으면 자체 폐기를 가리키는 사유가 나온다', () => {
    expect(block(UNDECIDED_DRAFT)).toBe(t.actionReasons.disposalPartnerPending);
  });

  /** **전환의 둘째 방향** — 선택지가 차면 사유가 「고르거나 체크하십시오」로 바뀐다. */
  it('선택칸이 열려 있으면 고르라고 말한다', () => {
    expect(block(UNDECIDED_DRAFT, FILLED_LISTS, READY, FILLED_PARTNERS)).toBe(
      t.actionReasons.needsDisposalDestination,
    );
  });

  /** ⭐ **선택지가 없어도 자체 폐기로는 열린다**(#128 §3) — 「값이 없어도 화면은 선다」. */
  it('자체 폐기를 체크하면 선택지가 없어도 열린다', () => {
    expect(block(FILLED_DRAFT)).toBeNull();
  });

  it('거래처를 고르면 열린다', () => {
    expect(block(PARTNER_DRAFT, FILLED_LISTS, READY, FILLED_PARTNERS)).toBeNull();
  });

  /**
   * **게이트와 조립이 같은 판정을 쓴다**(리뷰 Minor M2 · `screen.tsx`의 「판정은 한 곳에서
   * 나온다」 규율).
   *
   * 여기서 자체 조건(`값이 비었는가`)으로 판정하면 **번호로 읽을 수 없는 값**에서 둘이 갈린다 —
   * 버튼은 열리는데 조립은 `null`을 내어 **눌러도 아무 일이 없는** 상태가 된다(`if (body ===
   * null) return;`). 「번호로 못 읽는 값」 갈래가 조립 쪽에만 있으면 그 어긋남을 아무도 잡지 못한다.
   */
  it.each(['9251x', '0', '   '])('번호로 읽을 수 없는 거래처 값 %j이면 여전히 잠긴다', (value) => {
    expect(
      block({ ...PARTNER_DRAFT, disposalPartnerId: value }, FILLED_LISTS, READY, FILLED_PARTNERS),
    ).toBe(t.actionReasons.needsDisposalDestination);
  });

  /**
   * **차례가 뜻을 정한다**(계획 §5 T3-4). 값 목록 미확정 → 무엇을 보내는가 → **어떤
   * 전표인가**(코드·일시·도착지) → 왜 올리는가(요청 사유). 도착지가 사유보다 앞이고
   * 코드·일시보다 뒤다 — 화면에 놓인 차례 그대로다.
   */
  it('코드·일시가 도착지보다 앞이다', () => {
    expect(block({ ...UNDECIDED_DRAFT, codes: { ...FILLED_DRAFT.codes, reason: '' } })).toBe(
      t.actionReasons.needsCodes,
    );
    expect(block({ ...UNDECIDED_DRAFT, issuedDate: '' })).toBe(t.actionReasons.needsIssuedDate);
    expect(block({ ...UNDECIDED_DRAFT, issuedTime: '' })).toBe(t.actionReasons.needsIssuedTime);
  });

  it('도착지가 요청 사유보다 앞이다', () => {
    expect(block({ ...UNDECIDED_DRAFT, reason: '' })).toBe(t.actionReasons.disposalPartnerPending);
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
        'reasonCode',
        'issuedAt',
        'remarks',
        'destinationId',
      ].sort(),
    );
  });

  /**
   * **`destinationId`는 이제 담는다**(리뷰 Minor M1 · 변경 통지 #128).
   *
   * 이 파일의 잣대는 「그 이름의 오류를 화면이 **보일 자리가 있는가**」인데, 폐기 거래처
   * 선택칸이 생기면서 자리가 **생겼다.** 담지 않으면 「없는 거래처」·「폐기 역할이 아니다」류
   * 400이 고칠 칸 옆이 아니라 배너로만 간다.
   */
  it('destinationId는 담는다 — 그 오류를 보일 칸이 생겼다', () => {
    expect(DISPOSAL_FORM_FIELDS).toContain('destinationId');
  });

  /**
   * **`destinationTypeCode`는 여전히 담지 않는다**(짝 규칙의 다른 쪽).
   *
   * 도착지 유형은 **사용자가 고르는 값이 아니라 상수**다(`DISPOSAL_DESTINATION_TYPE_CODE`) —
   * 그 이름으로 오는 오류는 고칠 칸이 화면에 없고, 배너가 받아야 사용자가 읽는다.
   * 코드 셋에도 들지 않는다(폼의 코드 칸은 셋뿐이다).
   *
   * 짝 양성은 바로 위 두 시험이다 — 담는 여섯을 확정한 같은 시점의 음성 단언이다.
   */
  it('destinationTypeCode는 담지 않는다 — 화면이 고르는 값이 아니다', () => {
    expect(DISPOSAL_FORM_FIELDS).not.toContain('destinationTypeCode');
    expect(Object.values(CODE_FIELD_NAMES)).not.toContain('destinationTypeCode');
    expect(Object.values(CODE_FIELD_NAMES)).not.toContain('destinationId');
  });

  /** 화면이 값을 정하지 않는 필드는 담지 않는다 — 고른 전표·표의 줄·파생·상수에서 온다. */
  it.each([
    'sourceDocumentId',
    'sourceWarehouseId',
    'businessDate',
    'occurredAt',
    'lines',
    'postImmediately',
  ])('%s는 담지 않는다', (field) => {
    expect(DISPOSAL_FORM_FIELDS).not.toContain(field);
  });

  /** 상신 본문의 필드는 사유 하나다 — 넓히면 남의 오류가 사유 칸에 붙는다. */
  it('상신이 아는 필드는 사유 하나다', () => {
    expect(SUBMIT_FORM_FIELDS).toEqual(['reason']);
  });

  /**
   * 전기에는 **입력칸이 없다** — 본문 두 값이 전부 전표에서 파생한다. 이름을 하나라도 담으면
   * 붙일 칸이 없는 오류가 어디에도 보이지 않게 된다.
   */
  it('전기가 아는 필드는 없다', () => {
    expect(POST_FORM_FIELDS).toEqual([]);
  });
});

describe('postBlockReason — 처리를 잠글 근거', () => {
  /**
   * **미상신 전표는 잠근다**(완료 조건 C69). 승인 요청 값이 없다는 것은 승인이 있을 수 없다는
   * 뜻이고, 그것은 화면이 **값 유무로 확실히 아는 사실**이다.
   */
  it('미상신이면 잠그고 그 사유를 낸다', () => {
    expect(
      postBlockReason({ submission: 'notSubmitted', approval: { kind: 'judgePending' } }),
    ).toBe(t.actionReasons.postNeedsSubmission);
  });

  /**
   * **자리표시가 비어 있는 동안은 잠그지 않는다**(승인 기록 §13-2 안 1 · 완료 조건 C67).
   * 잠그면 승인된 건까지 막혀 화면이 통째로 무용해진다 — 막는 것은 서버다.
   */
  it('상신됐고 자리표시가 비면 잠그지 않는다', () => {
    expect(postBlockReason({ submission: 'submitted', approval: { kind: 'judgePending' } })).toBe(
      null,
    );
  });

  /** **전환 감지기**(감지기 M64) — 자리표시가 채워지고 승인 전이면 그때 잠긴다. */
  it('자리표시가 채워지고 승인 전이면 잠근다', () => {
    expect(postBlockReason({ submission: 'submitted', approval: { kind: 'notApproved' } })).toBe(
      t.actionReasons.postNotApproved,
    );
  });

  /** 짝 방향 — 승인됐으면 열린다. 잠금이 상수로 굳지 않았음을 함께 잰다. */
  it('승인됐으면 잠그지 않는다', () => {
    expect(postBlockReason({ submission: 'submitted', approval: { kind: 'approved' } })).toBe(null);
  });

  /**
   * **결재 진행을 못 읽었어도 잠그지 않는다**(완료 조건 C78) — 못 읽은 것은 「승인되지
   * 않았다」가 아니다.
   */
  it('진행을 못 읽었으면 잠그지 않는다', () => {
    expect(postBlockReason({ submission: 'submitted', approval: { kind: 'unread' } })).toBe(null);
  });

  /**
   * **상신 여부를 확인할 수 없는 전표도 잠그지 않는다** — 재상신과 갈리는 자리다. 저쪽은
   * 되풀이하면 결재 요청이 두 벌이 되지만, 여기서 잘못 누르면 돌아오는 것은 서버의 400이다.
   */
  it('상신 여부를 확인할 수 없으면 잠그지 않는다', () => {
    expect(postBlockReason({ submission: 'unusable', approval: { kind: 'judgePending' } })).toBe(
      null,
    );
  });

  /** **차례가 뜻을 정한다** — 미상신이면 승인 여부를 말할 것이 없으므로 그 사유가 앞선다. */
  it('미상신이면 승인 사유보다 상신 사유가 앞선다', () => {
    expect(postBlockReason({ submission: 'notSubmitted', approval: { kind: 'notApproved' } })).toBe(
      t.actionReasons.postNeedsSubmission,
    );
  });

  /**
   * **③ 구획은 이 회차에서 잠금을 하나도 얻지 않는다**(완료 조건 C20 · 선행 회차 §13-2 결정 유지).
   *
   * 통지 #128은 활성 조건에 「승인 완료 후 AND (자체 폐기 OR 거래처)」를 적었으나, ① 그 시점에
   * 도착지를 보낼 계약 통로가 없어 결정이 **발의 시점**으로 옮겨졌고(D-1 안 A) ② 「승인 완료」
   * 자체를 화면이 판정할 근거가 계약에 없다 — **모르는 것을 근거로 잠그면 정당한 처리가 영영
   * 막힌다.** 그래서 잠그는 갈래는 여전히 **둘뿐**이다.
   *
   * 갈래를 **전부 세어** 잰다. 「이 조합은 잠그지 않는다」를 하나씩 적으면 새 잠금이 그 목록
   * 밖에서 생겨도 아무도 울지 않는다 — 열둘을 다 돌아 잠기는 둘을 집합으로 못 박는다.
   */
  it('잠그는 갈래가 여전히 둘뿐이다 — 도착지 축으로 새로 잠그지 않는다', () => {
    /*
     * **갈래 목록을 타입에서 파생한다**(리뷰 Nit N3). 손으로 적으면 유니온에 갈래가 늘었을 때
     * 「전수」가 조용히 전수가 아니게 된다 — `satisfies`가 빠짐과 오타를 타입 검사로 잡는다.
     */
    const submissions = ['notSubmitted', 'submitted', 'unusable'] satisfies Submission['kind'][];
    const approvals = [
      'judgePending',
      'notApproved',
      'approved',
      'unread',
    ] satisfies PostApproval['kind'][];
    const locked: string[] = [];

    for (const submission of submissions) {
      for (const kind of approvals) {
        if (postBlockReason({ submission, approval: { kind } }) !== null) {
          locked.push(`${submission}/${kind}`);
        }
      }
    }

    expect(locked.sort()).toEqual(
      [
        /* 갈래 하나 — 승인 요청 값이 **없다**(승인이 있을 수 없다). 승인 축과 무관하게 잠긴다. */
        'notSubmitted/judgePending',
        'notSubmitted/notApproved',
        'notSubmitted/approved',
        'notSubmitted/unread',
        /*
         * 갈래 둘 — **자리표시가 찼고 승인 상태가 아니다.** 아래 `unusable`은 같은 갈래이며
         * 화면에서는 닿지 않는다(그 갈래는 승인 요청을 부르지 않아 진행이 `null`로 남고,
         * 그때 판정은 `unread`·`judgePending`이 된다). 함수는 총(total)이라 값으로는 선다.
         */
        'submitted/notApproved',
        'unusable/notApproved',
      ].sort(),
    );
  });

  /**
   * **처리 게이트는 도착지를 보지 않는다**(같은 결정의 다른 방향).
   *
   * 입력 타입에 도착지 자리가 없다는 것이 그 사실을 타입 수준에서 굳힌다 — 자리를 두면
   * 「승인 뒤에 도착지를 다시 묻는」 길이 열리는데, 그 시점에 고른 값을 보낼 통로가 계약에 없다.
   */
  it('처리 게이트의 입력이 승인 축 둘뿐이다', () => {
    const input: PostGateInput = { submission: 'submitted', approval: { kind: 'approved' } };

    expect(Object.keys(input).sort()).toEqual(['approval', 'submission']);
  });
});
