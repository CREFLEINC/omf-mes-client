import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { purchaseOrderLineFixtures } from './fixtures';
import { toSplitLines } from './split-calc';
import { EMPTY_HEADER_DRAFT, type SplitMode } from './types';
import {
  DELIVERY_NOTE_NO_MAX,
  RECEIPT_FORM_FIELDS,
  canSubmit,
  modeBlockReason,
  qtyErrorReason,
  validateHeader,
} from './validation';

const t = messages.overReceiptSplit;

const counts = (normalLines: number, excessLines: number) => ({ normalLines, excessLines });

/**
 * **계약의 조건부 필수를 화면이 막는다.**
 *
 * 계약은 「`mode`가 `EXCESS_ONLY`가 아니면 `normal` 필수」를 설명으로만 적었고 `oneOf`로
 * 표현하지 않았다. 목 서버도 어긋난 조합을 201로 통과시킨다(실측) — 막는 곳은 화면뿐이다.
 */
describe('canSubmit — 모드별 조건부 필수', () => {
  /* **M27** — 초과분이 없는데 분리 등록을 허용하면 `excess` 없는 `BOTH`가 나간다. */
  it('분리 등록은 정량분과 초과분이 모두 있어야 한다', () => {
    expect(canSubmit('BOTH', counts(1, 1))).toBe(true);
    expect(canSubmit('BOTH', counts(1, 0))).toBe(false);
    expect(canSubmit('BOTH', counts(0, 1))).toBe(false);
    expect(canSubmit('BOTH', counts(0, 0))).toBe(false);
  });

  /* **M28** — 정량분이 하나도 없는데 「정량분만 저장」이 열리면 빈 `normal`이 나간다. */
  it('정량분만 저장은 정량분이 있어야 한다', () => {
    expect(canSubmit('NORMAL_ONLY', counts(1, 0))).toBe(true);
    /* 초과분이 함께 있어도 정량분만 저장할 수 있다 — 초과분을 받지 않기로 한 경우다. */
    expect(canSubmit('NORMAL_ONLY', counts(1, 1))).toBe(true);
    expect(canSubmit('NORMAL_ONLY', counts(0, 1))).toBe(false);
    expect(canSubmit('NORMAL_ONLY', counts(0, 0))).toBe(false);
  });

  it('초과분만 저장은 초과분이 있어야 한다', () => {
    expect(canSubmit('EXCESS_ONLY', counts(0, 1))).toBe(true);
    expect(canSubmit('EXCESS_ONLY', counts(1, 1))).toBe(true);
    expect(canSubmit('EXCESS_ONLY', counts(1, 0))).toBe(false);
    expect(canSubmit('EXCESS_ONLY', counts(0, 0))).toBe(false);
  });

  /* **M29** — 라인이 한 줄도 없으면 어느 갈래로도 보낼 수 없다(계약: `lines` 최소 1행). */
  it('라인이 하나도 없으면 세 갈래가 모두 막힌다', () => {
    const modes: SplitMode[] = ['BOTH', 'NORMAL_ONLY', 'EXCESS_ONLY'];

    for (const mode of modes) {
      expect(canSubmit(mode, counts(0, 0))).toBe(false);
    }
  });
});

describe('modeBlockReason — 왜 막혔는지', () => {
  /* 짝 방향 — 보낼 수 있는 상태에서는 사유를 내지 않는다. 늘 사유를 내면 늘 잠긴 것처럼 보인다. */
  it('보낼 수 있으면 사유가 없다', () => {
    expect(modeBlockReason('BOTH', counts(1, 1))).toBeNull();
    expect(modeBlockReason('NORMAL_ONLY', counts(2, 0))).toBeNull();
    expect(modeBlockReason('EXCESS_ONLY', counts(0, 3))).toBeNull();
  });

  /*
   * 아직 아무 수량도 넣지 않은 상태는 **세 버튼이 함께 잠긴다.** 버튼마다 「정량분이 없다」
   * 「초과분이 없다」를 따로 말하면 같은 사정을 세 번 되풀이하게 된다.
   */
  it('수량을 하나도 넣지 않았으면 세 버튼이 같은 사유를 낸다', () => {
    expect(modeBlockReason('BOTH', counts(0, 0))).toBe(t.actionReasons.noQty);
    expect(modeBlockReason('NORMAL_ONLY', counts(0, 0))).toBe(t.actionReasons.noQty);
    expect(modeBlockReason('EXCESS_ONLY', counts(0, 0))).toBe(t.actionReasons.noQty);
  });

  /* 분리 등록이 막히는 두 갈래는 **사용자가 할 조치가 다르다** — 다른 버튼을 가리킨다. */
  it('분리 등록은 어느 쪽이 없는지에 따라 다른 버튼을 가리킨다', () => {
    expect(modeBlockReason('BOTH', counts(2, 0))).toBe(t.actionReasons.bothNeedsExcess);
    expect(modeBlockReason('BOTH', counts(0, 2))).toBe(t.actionReasons.bothNeedsNormal);
  });

  it('한쪽만 저장하는 두 버튼은 자기 몫이 없다고 말한다', () => {
    expect(modeBlockReason('NORMAL_ONLY', counts(0, 2))).toBe(
      t.actionReasons.normalOnlyNeedsNormal,
    );
    expect(modeBlockReason('EXCESS_ONLY', counts(2, 0))).toBe(
      t.actionReasons.excessOnlyNeedsExcess,
    );
  });

  /* 규범 4-5 — 사유는 그 버튼의 이름으로 시작한다. 시각적으로 끊겨도 소유가 복원된다. */
  it('버튼별 사유가 그 버튼 이름으로 시작한다', () => {
    expect(t.actionReasons.bothNeedsExcess.startsWith(t.actions.registerBoth)).toBe(true);
    expect(t.actionReasons.bothNeedsNormal.startsWith(t.actions.registerBoth)).toBe(true);
    expect(
      t.actionReasons.normalOnlyNeedsNormal.startsWith(t.actions.registerNormalOnly),
    ).toBe(true);
    expect(
      t.actionReasons.excessOnlyNeedsExcess.startsWith(t.actions.registerExcessOnly),
    ).toBe(true);
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
  it('예외 유형을 골랐으면 초과 사유가 필수다', () => {
    expect(validateHeader(header({ exceptionTypeCode: 'SAMPLE_EXCEPTION' }))).toEqual({
      exceptionReason: t.errors.exceptionReasonRequired,
    });
  });

  it('공백만 친 초과 사유는 넣지 않은 것으로 본다', () => {
    expect(
      validateHeader(header({ exceptionTypeCode: 'SAMPLE_EXCEPTION', exceptionReason: '   ' })),
    ).toEqual({ exceptionReason: t.errors.exceptionReasonRequired });
  });

  it('예외 유형과 사유를 함께 채우면 오류가 없다', () => {
    expect(
      validateHeader(header({ exceptionTypeCode: 'SAMPLE_EXCEPTION', exceptionReason: '합성 사유' })),
    ).toEqual({});
  });

  /* 그 반대 — 유형 없이 사유만 채우는 것은 막지 않는다. 계약이 사유를 선택으로 두었다. */
  it('예외 유형 없이 사유만 채우는 것은 오류가 아니다', () => {
    expect(validateHeader(header({ exceptionReason: '초과가 온 사정' }))).toEqual({});
  });

  /* 여러 칸이 동시에 잘못됐으면 **전부** 낸다 — 하나씩 고치게 하면 저장을 여러 번 눌러야 한다. */
  it('여러 오류를 한 번에 낸다', () => {
    expect(
      validateHeader({
        ...EMPTY_HEADER_DRAFT,
        deliveryNoteNo: 'A'.repeat(DELIVERY_NOTE_NO_MAX + 1),
        exceptionTypeCode: 'SAMPLE_EXCEPTION',
      }),
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
describe('qtyErrorReason — 고치지 않은 수량', () => {
  const rowsWith = (drafts: Record<number, string>) =>
    toSplitLines(purchaseOrderLineFixtures, drafts);

  it('사유가 붙은 줄이 있으면 등록을 막을 사유를 낸다', () => {
    expect(qtyErrorReason(rowsWith({ 9401: '0' }))).toBe(t.errors.qtyInvalidBlocked);
    expect(qtyErrorReason(rowsWith({ 9401: '66', 9402: 'abc' }))).toBe(
      t.errors.qtyInvalidBlocked,
    );
  });

  /* 짝 방향 — 정상 입력과 빈 칸에는 사유를 내지 않는다. 빈 칸은 「이번에 받지 않는다」이다. */
  it('정상 입력과 빈 칸에는 사유가 없다', () => {
    expect(qtyErrorReason(rowsWith({ 9401: '66' }))).toBeNull();
    expect(qtyErrorReason(rowsWith({}))).toBeNull();
  });
});
