import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { purchaseOrderLineFixtures } from './fixtures';
import { createDrafts, setDraftLot, setDraftQty, type LineDrafts } from './line-draft';
import { toSplitLines } from './split-calc';
import { EMPTY_HEADER_DRAFT } from './types';
import {
  DELIVERY_NOTE_NO_MAX,
  RECEIPT_FORM_FIELDS,
  lineErrorReason,
  registerBlockReason,
  validateHeader,
} from './validation';

const t = messages.overReceiptSplit;

const counts = (lines: number, excessLines: number) => ({ lines, excessLines });

describe('registerBlockReason — 등록 단추가 잠기는 사유', () => {
  it('실릴 줄이 하나도 없을 때만 잠긴다', () => {
    expect(registerBlockReason(counts(0, 0))).toBe(t.actionReasons.noQty);
    expect(registerBlockReason(counts(1, 0))).toBeNull();
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

  /* 여러 칸이 동시에 잘못됐으면 **전부** 낸다 — 하나씩 고치게 하면 저장을 여러 번 눌러야 한다. */
  it('여러 오류를 한 번에 낸다', () => {
    expect(
      validateHeader({
        ...EMPTY_HEADER_DRAFT,
        deliveryNoteNo: 'A'.repeat(DELIVERY_NOTE_NO_MAX + 1),
      }),
    ).toEqual({
      receiptDatetime: t.errors.receiptDatetimeRequired,
      deliveryNoteNo: t.errors.deliveryNoteNoTooLong(DELIVERY_NOTE_NO_MAX),
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
  it('머리 입력칸 셋을 담는다 — 예외 유형·사유는 이 화면이 보내지 않는다', () => {
    expect([...RECEIPT_FORM_FIELDS]).toEqual(['receiptDatetime', 'deliveryNoteNo', 'remarks']);
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
        setDraftLot(setDraftQty(drafts, Number(lineId), text), Number(lineId), { lotNo }),
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

  /* 다 받은 줄(9402 — 한도 0)에 수량을 넣으면 수량 칸에 사유가 붙어 그 줄을 짚는다. */
  it('다 받은 줄에 수량을 넣었으면 그 줄을 짚어 막는다', () => {
    expect(lineErrorReason(rowsWith({ 9401: '66', 9402: '12' }))).toBe(
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
