import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  describeCancelBlockReason,
  KNOWN_BLOCK_REASON_CODES,
  readCancelAvailability,
} from './cancel-availability';

const t = messages.documentProgress;

describe('KNOWN_BLOCK_REASON_CODES', () => {
  /*
   * 계약이 설명문에 **열거한** 넷이다. 여기에 값을 더하려면 계약이 먼저 늘어야 한다 —
   * 화면이 코드를 지어내면 그 뜻도 화면이 지어낸 것이 된다.
   */
  it('계약이 열거한 네 값이다', () => {
    expect(KNOWN_BLOCK_REASON_CODES).toEqual([
      'SUCCESSOR_EXISTS',
      'ALREADY_CANCELLED',
      'CANCEL_IN_PROGRESS',
      'STATE_LOCKED',
    ]);
  });
});

describe('readCancelAvailability', () => {
  /*
   * ⭐ **판정은 서버가 한다.** 후속 건수·상태로 화면이 다시 세지 않고 `cancellable` 하나만 본다.
   */
  it('취소할 수 있으면 사유를 보지 않는다', () => {
    expect(
      readCancelAvailability({ cancellable: true, cancelBlockedReasonCode: 'SUCCESSOR_EXISTS' }),
    ).toEqual({ kind: 'available' });
  });

  it('계약이 열거한 코드는 아는 코드로 판정한다', () => {
    expect(
      readCancelAvailability({ cancellable: false, cancelBlockedReasonCode: 'CANCEL_IN_PROGRESS' }),
    ).toEqual({ kind: 'blocked', reasonCode: 'CANCEL_IN_PROGRESS', known: true });
  });

  it('열거에 없는 코드는 모르는 코드로 판정한다', () => {
    expect(
      readCancelAvailability({ cancellable: false, cancelBlockedReasonCode: 'SYN_UNKNOWN' }),
    ).toEqual({ kind: 'blocked', reasonCode: 'SYN_UNKNOWN', known: false });
  });

  /* 계약이 선택으로 둔 자리라 실재하는 갈래다. 코드를 지어내지 않는다. */
  it('사유 코드가 없어도 막힌 것은 막힌 것이다', () => {
    expect(readCancelAvailability({ cancellable: false, cancelBlockedReasonCode: null })).toEqual({
      kind: 'blocked',
      reasonCode: '',
      known: false,
    });
  });
});

describe('describeCancelBlockReason', () => {
  it('취소할 수 있으면 사유 문면이 없다', () => {
    expect(describeCancelBlockReason({ kind: 'available' })).toBe('');
  });

  it('아는 네 코드는 우리말 문면을 낸다', () => {
    const texts = KNOWN_BLOCK_REASON_CODES.map((code) =>
      describeCancelBlockReason({ kind: 'blocked', reasonCode: code, known: true }),
    );

    expect(texts).toEqual([
      t.blockReasons.SUCCESSOR_EXISTS,
      t.blockReasons.ALREADY_CANCELLED,
      t.blockReasons.CANCEL_IN_PROGRESS,
      t.blockReasons.STATE_LOCKED,
    ]);
    /* 넷이 서로 다른 문면이어야 사용자가 무엇을 해야 하는지 갈린다. */
    expect(new Set(texts).size).toBe(4);
  });

  /*
   * ⭐ **모르는 코드는 코드 문자열을 그대로 낸다.** 사용자가 담당자에게 그대로 전할 수 있어야
   * 하고, 화면이 이름을 붙이면 값이 늘 때 조용히 틀린다.
   */
  it('모르는 코드는 코드 문자열을 그대로 낸다', () => {
    expect(
      describeCancelBlockReason({ kind: 'blocked', reasonCode: 'SYN_UNKNOWN', known: false }),
    ).toBe('SYN_UNKNOWN');
  });

  /* 빈 칸으로 두면 사유가 없는 것인지 화면이 못 그린 것인지 구분되지 않는다. */
  it('사유 코드가 없으면 받지 못했다고 적는다', () => {
    expect(describeCancelBlockReason({ kind: 'blocked', reasonCode: '', known: false })).toBe(
      t.values.noBlockReason,
    );
  });
});
