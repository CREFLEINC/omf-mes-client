import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { purchaseOrderLineFixtures } from './fixtures';
import { createDrafts, setDraftLot, setDraftQty, type LineDrafts } from './line-draft';
import { toSplitLines } from './split-calc';
import { EMPTY_HEADER_DRAFT, type SplitMode } from './types';
import {
  DELIVERY_NOTE_NO_MAX,
  RECEIPT_FORM_FIELDS,
  defaultSelection,
  lineErrorReason,
  modeFor,
  registerBlockReason,
  validateHeader,
} from './validation';

const t = messages.overReceiptSplit;

const counts = (normalLines: number, excessLines: number) => ({ normalLines, excessLines });

/**
 * **계약의 조건부 필수를 화면이 막는다** — 「`mode`가 `EXCESS_ONLY`가 아니면 `normal` 필수」. 사람은
 * 갈래를 고르지 않는다. 수량이 있는 전표가 기본으로 켜지고, 켜진 전표가 갈래가 된다.
 */
describe('defaultSelection · modeFor — 만들어지는 전표가 갈래를 정한다', () => {
  it('수량이 있는 전표는 모두 켜진 채로 시작한다', () => {
    expect(defaultSelection(counts(1, 1))).toEqual({ normal: true, excess: true });
    expect(defaultSelection(counts(1, 0))).toEqual({ normal: true, excess: false });
    expect(defaultSelection(counts(0, 1))).toEqual({ normal: false, excess: true });
    expect(defaultSelection(counts(0, 0))).toEqual({ normal: false, excess: false });
  });

  it('켜진 전표 조합이 곧 갈래다', () => {
    expect(modeFor({ normal: true, excess: true })).toBe('BOTH');
    expect(modeFor({ normal: true, excess: false })).toBe('NORMAL_ONLY');
    expect(modeFor({ normal: false, excess: true })).toBe('EXCESS_ONLY');
    expect(modeFor({ normal: false, excess: false })).toBeNull();
  });
});

describe('registerBlockReason — 등록 단추가 잠기는 사유', () => {
  it('실릴 줄이 하나도 없을 때만 잠긴다', () => {
    expect(registerBlockReason(counts(0, 0))).toBe(t.actionReasons.noQty);
    expect(registerBlockReason(counts(1, 0))).toBeNull();
    expect(registerBlockReason(counts(0, 1))).toBeNull();
    expect(registerBlockReason(counts(1, 1))).toBeNull();
  });
});

describe('validateHeader — 머리 입력', () => {
  const header = (patch: Partial<typeof EMPTY_HEADER_DRAFT> = {}) => ({
    ...EMPTY_HEADER_DRAFT,
    receiptDatetime: '2026-08-06T09:12',
    ...patch,
  });

  /* 계약 필수인데 입력칸이 있는 유일한 값이다 — 비면 요청을 만들 수 없다. */
  it('입하 일시가 비면 오류다', () => {
    expect(validateHeader({ ...EMPTY_HEADER_DRAFT })).toEqual({
      receiptDatetime: t.errors.receiptDatetimeRequired,
    });
  });

  /* 짝 방향 — 다 채운 정상 입력에는 오류가 하나도 없다. */
  it('입하 일시만 채우면 오류가 없다', () => {
    expect(validateHeader(header())).toEqual({});
  });

  /* 계약이 100자로 정했다. **경계 두 값을 모두 본다** — 한쪽만 보면 부등호 방향이 남는다. */
  it('거래명세서번호는 100자까지 넣을 수 있고 101자는 오류다', () => {
    expect(validateHeader(header({ deliveryNoteNo: 'A'.repeat(DELIVERY_NOTE_NO_MAX) }))).toEqual(
      {},
    );
    expect(
      validateHeader(header({ deliveryNoteNo: 'A'.repeat(DELIVERY_NOTE_NO_MAX + 1) })),
    ).toEqual({ deliveryNoteNo: t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX) });
  });

  /*
   * **보내는 값의 길이로 잰다.** 요청 조립이 앞뒤 공백을 떼고 보내므로, 뗀 뒤 100자면
   * 실제로 보낼 값이 상한 안이다 — 여기서 막으면 보낼 수 있는 값을 화면이 거절한다.
   */
  it('앞뒤 공백을 뗀 길이로 잰다', () => {
    expect(
      validateHeader(header({ deliveryNoteNo: ` ${'A'.repeat(DELIVERY_NOTE_NO_MAX)} ` })),
    ).toEqual({});
  });

  /* **M32** — 짝 제약. 계약이 「`exceptionTypeCode`가 있으면 필수」로 정했다. */
  const EXCESS = { needsExceptionType: true };

  it('초과분이 실릴 때 예외 유형을 골랐으면 초과 사유가 필수다', () => {
    expect(validateHeader(header({ exceptionTypeCode: 'SAMPLE_EXCEPTION' }), EXCESS)).toEqual({
      exceptionReason: t.errors.exceptionReasonRequired,
    });
  });

  /* 초과분 전표에만 실리는 값이다 — 초과분이 없으면 기본 유형이 서 있어도 사유를 묻지 않는다. */
  it('초과분이 실리지 않으면 예외 유형·사유를 보지 않는다', () => {
    expect(validateHeader(header({ exceptionTypeCode: 'SAMPLE_EXCEPTION' }))).toEqual({});
  });

  it('공백만 친 초과 사유는 넣지 않은 것으로 본다', () => {
    expect(
      validateHeader(
        header({ exceptionTypeCode: 'SAMPLE_EXCEPTION', exceptionReason: '   ' }),
        EXCESS,
      ),
    ).toEqual({ exceptionReason: t.errors.exceptionReasonRequired });
  });

  it('예외 유형과 사유를 함께 채우면 오류가 없다', () => {
    expect(
      validateHeader(
        header({ exceptionTypeCode: 'SAMPLE_EXCEPTION', exceptionReason: '합성 사유' }),
        EXCESS,
      ),
    ).toEqual({});
  });

  /* 그 반대 — 유형 없이 사유만 채우는 것은 막지 않는다. 계약이 사유를 선택으로 두었다. */
  it('예외 유형 없이 사유만 채우는 것은 오류가 아니다', () => {
    expect(validateHeader(header({ exceptionReason: '초과가 온 사정' }))).toEqual({});
  });

  it('초과분이 실리는데 유형이 없으면 유형만 묻는다', () => {
    expect(validateHeader(header(), EXCESS)).toEqual({
      exceptionTypeCode: t.errors.exceptionTypeRequired,
    });
  });

  /* 초과분 줄은 발주에 묶이지 않아 서버가 예외 유형을 요구한다 — 초과분이 실리는 갈래에서만 필수다. */
  it('초과분이 실리는 갈래에서는 예외 유형이 필수다', () => {
    expect(validateHeader(header(), { needsExceptionType: true })).toEqual({
      exceptionTypeCode: t.errors.exceptionTypeRequired,
    });
    expect(validateHeader(header(), { needsExceptionType: false })).toEqual({});
    expect(
      validateHeader(header({ exceptionTypeCode: 'OVER_DELIVERY', exceptionReason: '합성 사유' }), {
        needsExceptionType: true,
      }),
    ).toEqual({});
  });

  /* 여러 칸이 동시에 잘못됐으면 **전부** 낸다 — 하나씩 고치게 하면 저장을 여러 번 눌러야 한다. */
  it('여러 오류를 한 번에 낸다', () => {
    expect(
      validateHeader(
        {
          ...EMPTY_HEADER_DRAFT,
          deliveryNoteNo: 'A'.repeat(DELIVERY_NOTE_NO_MAX + 1),
          exceptionTypeCode: 'SAMPLE_EXCEPTION',
        },
        EXCESS,
      ),
    ).toEqual({
      receiptDatetime: t.errors.receiptDatetimeRequired,
      deliveryNoteNo: t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX),
      exceptionReason: t.errors.exceptionReasonRequired,
    });
  });
});

/**
 * 서버가 준 필드 오류를 인라인으로 낼지 배너로 올릴지 가르는 기준.
 *
 * **머리 입력칸 이름만 둔다.** 라인 오류는 계약이 어느 행인지 알려 주지 않으므로 인라인으로
 * 낼 자리를 고를 수 없다 — 전부 배너로 올린다.
 */
describe('RECEIPT_FORM_FIELDS', () => {
  it('머리 입력칸 다섯을 담는다', () => {
    expect([...RECEIPT_FORM_FIELDS]).toEqual([
      'receiptDatetime',
      'deliveryNoteNo',
      'remarks',
      'exceptionTypeCode',
      'exceptionReason',
    ]);
  });

  it('라인 필드를 담지 않는다', () => {
    for (const field of ['receivedQty', 'itemId', 'uomId', 'purchaseOrderLineId']) {
      expect(RECEIPT_FORM_FIELDS).not.toContain(field);
    }
  });
});

/**
 * 고치지 않은 수량이 남은 채로 등록하면 **그 줄만 빠진 전표**가 만들어진다.
 * 되돌릴 수 없는 쓰기라 빠뜨린 줄을 나중에 알아채도 화면이 고칠 수 없다.
 */
describe('lineErrorReason — 고치지 않은 줄', () => {
  const draftsWith = (
    texts: Record<number, string>,
    lotNo = 'SAMPLE-ITEM-01|66|260806|SAMPLE-SUP-01|0001',
  ): LineDrafts =>
    Object.entries(texts).reduce<LineDrafts>(
      (drafts, [lineId, text]) =>
        setDraftLot(
          setDraftLot(setDraftQty(drafts, Number(lineId), text), Number(lineId), 'normal', {
            lotNo,
          }),
          Number(lineId),
          'excess',
          { labelMissing: true, reasonCode: 'OTHER' },
        ),
      createDrafts(purchaseOrderLineFixtures),
    );
  const rowsWith = (texts: Record<number, string>, lotNo?: string) =>
    toSplitLines(purchaseOrderLineFixtures, draftsWith(texts, lotNo));

  it('수량에 사유가 붙은 줄이 있으면 그 줄번호를 짚어 막는다', () => {
    expect(lineErrorReason(rowsWith({ 9401: '0' }))).toBe(t.errors.lineInvalidBlocked('1'));
    expect(lineErrorReason(rowsWith({ 9401: '66', 9402: 'abc' }))).toBe(
      t.errors.lineInvalidBlocked('2'),
    );
  });

  it('LOT 에 사유가 붙은 줄이 있어도 막는다', () => {
    expect(lineErrorReason(rowsWith({ 9401: '66' }, ''))).toBe(t.errors.lineInvalidBlocked('1'));
  });

  it('정상 입력과 빈 칸에는 사유가 없다', () => {
    expect(lineErrorReason(rowsWith({ 9401: '66' }))).toBeNull();
    expect(lineErrorReason(rowsWith({}))).toBeNull();
  });
});
