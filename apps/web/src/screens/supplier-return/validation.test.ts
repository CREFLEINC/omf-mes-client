import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  CODE_FIELD_NAMES,
  CODE_MAX,
  RETURN_FORM_FIELDS,
  returnBlockReason,
  validateReturnDraft,
  type ReturnGateInput,
} from './validation';
import { EMPTY_RETURN_DRAFT, type ReturnDraft } from './types';

const t = messages.supplierReturn;

/** 코드 넷과 공급사·일시가 전부 채워진 초안. 막히지 않는 상태의 기준점이다. */
const FILLED: ReturnDraft = {
  supplier: '9901',
  codes: {
    issueType: 'SAMPLE_ISSUE_TYPE_A',
    sourceDocumentType: 'SAMPLE_SOURCE_TYPE_A',
    destinationType: 'SAMPLE_DESTINATION_TYPE_A',
    reason: 'SAMPLE_REASON_A',
  },
  issuedDate: '2026-08-06',
  issuedTime: '09:12',
  replacementExpected: false,
  sendToErp: true,
  remarks: '',
};

const gate = (overrides: Partial<ReturnGateInput> = {}): ReturnGateInput => ({
  isCodeListPending: false,
  draft: FILLED,
  selection: { kind: 'ready' },
  ...overrides,
});

describe('returnBlockReason — 「반품 처리」를 열지 말지 가른다', () => {
  it('전부 갖춰지면 막지 않는다', () => {
    expect(returnBlockReason(gate())).toBeNull();
  });

  /*
   * **M35** — 코드 값 목록이 비어 있는 동안에는 어떤 반품도 처리할 수 없다. 잠금을 상수로
   * 굳히거나 아예 열어 두면 이 잣대가 운다. 「고르세요」가 아니라 「고를 값이 아직 없습니다」다.
   */
  it('필수 코드의 값 목록 자체가 없으면 그 사정을 사유로 낸다', () => {
    expect(returnBlockReason(gate({ isCodeListPending: true }))).toBe(
      t.actionReasons.codeListPending,
    );
  });

  /*
   * 차례가 뜻을 정한다 — **값 목록이 없다는 사정이 가장 앞이다.** 그 상태에서는 나머지를
   * 아무리 채워도 열리지 않으므로, 다른 사유를 먼저 내면 사용자가 할 수 없는 조치를 가리킨다.
   */
  it('값 목록이 없으면 다른 사유보다 그 사정이 앞선다', () => {
    const reason = returnBlockReason(
      gate({ isCodeListPending: true, draft: EMPTY_RETURN_DRAFT }),
    );

    expect(reason).toBe(t.actionReasons.codeListPending);
    expect(reason).not.toBe(t.actionReasons.needsSupplier);
  });

  /*
   * **C31·M31** — 「줄을 골랐는가」를 여기서 다시 판정하지 않는다. 표와 버튼이 각자 세면
   * 표에는 멀쩡한데 버튼이 잠기거나 그 반대가 된다. 받은 판정을 **그대로** 낸다.
   */
  it('줄 판정이 막혀 있으면 그 사유를 그대로 낸다', () => {
    expect(
      returnBlockReason(gate({ selection: { kind: 'blocked', reason: t.reasons.selectNone } })),
    ).toBe(t.reasons.selectNone);
  });

  it('줄 판정이 막혀 있으면 반품 정보가 비어 있어도 줄 사유가 앞선다', () => {
    expect(
      returnBlockReason(
        gate({
          draft: EMPTY_RETURN_DRAFT,
          selection: { kind: 'blocked', reason: t.reasons.selectQtyMissing },
        }),
      ),
    ).toBe(t.reasons.selectQtyMissing);
  });

  /* **C36** — 공급사가 비면 도착지를 채울 수 없다. */
  it('공급사를 고르지 않으면 막는다', () => {
    expect(returnBlockReason(gate({ draft: { ...FILLED, supplier: '' } }))).toBe(
      t.actionReasons.needsSupplier,
    );
  });

  /*
   * **C37 · M38** — 공백만 친 코드를 통과시키면 목이 201로 받는다(`minLength`가 없다).
   * 막는 곳이 화면뿐이라 `trim` 없이 재면 빈 코드가 되돌릴 수 없는 전표에 실린다.
   */
  it.each([
    ['issueType' as const],
    ['sourceDocumentType' as const],
    ['destinationType' as const],
    ['reason' as const],
  ])('%s가 공백만이면 막는다', (key) => {
    expect(
      returnBlockReason(gate({ draft: { ...FILLED, codes: { ...FILLED.codes, [key]: '   ' } } })),
    ).toBe(t.actionReasons.needsCodes);
  });

  it('코드 넷 중 하나만 비어도 막는다', () => {
    expect(
      returnBlockReason(
        gate({ draft: { ...FILLED, codes: { ...FILLED.codes, reason: '' } } }),
      ),
    ).toBe(t.actionReasons.needsCodes);
  });

  /*
   * **`reasonCode`는 계약 스키마에서 nullable인데 설명이 「반품·기타 출고에서는 필수」다**
   * (계획 §5.4-4). 목이 `null`을 201로 받으므로 막는 곳은 화면뿐이다 — 설명을 따른다.
   */
  it('반품 사유를 계약 필수와 같은 무게로 막는다', () => {
    expect(
      returnBlockReason(gate({ draft: { ...FILLED, codes: { ...FILLED.codes, reason: '' } } })),
    ).not.toBeNull();
  });

  it('출고 일자를 고르지 않으면 막는다', () => {
    expect(returnBlockReason(gate({ draft: { ...FILLED, issuedDate: '' } }))).toBe(
      t.actionReasons.needsIssuedDate,
    );
  });

  /* 시각이 비어 있으면 `issuedAt`이 날짜만으로 만들어져 계약 형식을 벗어난다. */
  it('출고 시각이 비면 막는다', () => {
    expect(returnBlockReason(gate({ draft: { ...FILLED, issuedTime: '' } }))).toBe(
      t.actionReasons.needsIssuedTime,
    );
  });

  /* 비고와 대체입고 예정·ERP 송신은 **막지 않는다** — 셋 다 선택이다. */
  it('비고가 비어 있어도 막지 않는다', () => {
    expect(returnBlockReason(gate({ draft: { ...FILLED, remarks: '' } }))).toBeNull();
  });

  it('ERP 송신을 끄거나 대체입고 예정을 켜도 막지 않는다', () => {
    expect(
      returnBlockReason(
        gate({ draft: { ...FILLED, sendToErp: false, replacementExpected: true } }),
      ),
    ).toBeNull();
  });
});

describe('validateReturnDraft — 인라인으로 낼 오류', () => {
  it('정상 초안에는 오류가 없다', () => {
    expect(validateReturnDraft(FILLED)).toEqual({});
  });

  /*
   * **C37** — 계약이 코드에 `maxLength: 50`을 두었고 목이 51자를 400으로 되돌린다(실측).
   * 되돌릴 수 없는 요청이 나간 뒤 400을 받는 것보다 나가기 전에 막는 편이 싸다.
   */
  it('코드가 상한을 넘으면 그 칸의 오류를 낸다', () => {
    const errors = validateReturnDraft({
      ...FILLED,
      codes: { ...FILLED.codes, issueType: 'A'.repeat(CODE_MAX + 1) },
    });

    expect(errors[CODE_FIELD_NAMES.issueType]).toBe(t.errors.codeTooLong(CODE_MAX));
  });

  it('상한과 같은 길이는 막지 않는다', () => {
    expect(
      validateReturnDraft({
        ...FILLED,
        codes: { ...FILLED.codes, issueType: 'A'.repeat(CODE_MAX) },
      }),
    ).toEqual({});
  });

  /*
   * **보낼 값의 길이를 잰다.** 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 재야
   * 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생기지 않는다.
   */
  it('앞뒤 공백을 뗀 길이로 잰다', () => {
    expect(
      validateReturnDraft({
        ...FILLED,
        codes: { ...FILLED.codes, issueType: `  ${'A'.repeat(CODE_MAX)}  ` },
      }),
    ).toEqual({});
  });

  it('코드 넷 모두를 잰다', () => {
    const long = 'A'.repeat(CODE_MAX + 1);
    const errors = validateReturnDraft({
      ...FILLED,
      codes: {
        issueType: long,
        sourceDocumentType: long,
        destinationType: long,
        reason: long,
      },
    });

    expect(Object.keys(errors).sort()).toEqual(Object.values(CODE_FIELD_NAMES).sort());
  });
});

describe('RETURN_FORM_FIELDS — 서버 오류를 인라인으로 낼지 가른다', () => {
  /*
   * **입력칸이 있는 필드 이름만 담는다**(계획 결정 16). 칸이 없는 이름을 담으면 그 오류가
   * 인라인으로 흘러가 **어디에도 표시되지 않는다.**
   */
  it('코드 넷과 공급사·출고 일시·비고를 담는다', () => {
    expect([...RETURN_FORM_FIELDS].sort()).toEqual(
      [
        'destinationId',
        'destinationTypeCode',
        'issuedAt',
        'issueTypeCode',
        'reasonCode',
        'remarks',
        'sourceDocumentTypeCode',
      ].sort(),
    );
  });

  /*
   * 화면이 값을 정하지 않는 필드는 담지 않는다 — 원천·창고는 고른 전표에서, 영업일·발생
   * 시각은 파생으로, 줄은 표에서 온다. 인라인으로 낼 칸이 없으므로 배너로 올라가야 한다.
   */
  it('화면에 칸이 없는 필드는 담지 않는다', () => {
    for (const field of [
      'sourceDocumentId',
      'sourceWarehouseId',
      'businessDate',
      'occurredAt',
      'lines',
      'postImmediately',
    ]) {
      expect(RETURN_FORM_FIELDS).not.toContain(field);
    }
  });
});
