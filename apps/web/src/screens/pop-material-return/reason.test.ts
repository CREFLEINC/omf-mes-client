import { messages, setLocale } from '@omf-mes/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import { returnReasonOf } from './reason';

/*
 * P-01-03 반납 입고 거절 문구(피처 019 · 실제 앱 확인 F-03). 합성값만 쓴다.
 */

const HANGUL = /[가-힣]/u;

const rejected = (code: string, field: string, message: string) => ({
  kind: 'validation' as const,
  status: 400,
  errors: [{ scope: 'field' as const, field, code, message }],
});

describe('P-01-03 반납 입고 거절 문구', () => {
  afterEach(() => {
    setLocale('ko');
  });

  it('US1-4 반납 대상 아님 · 남은 양 없음 · W/O 어긋남은 오류 코드의 문구다', () => {
    const r = messages.materialReturn.reason;

    expect(returnReasonOf(rejected('NOT_RETURNABLE', 'lotNo', '서버 문구'))).toBe(r.NOT_RETURNABLE);
    expect(returnReasonOf(rejected('NOTHING_TO_RETURN', 'lotNo', '서버 문구'))).toBe(
      r.NOTHING_TO_RETURN,
    );
    expect(
      returnReasonOf(rejected('WORK_ORDER_MISMATCH', 'lines[0].workOrderId', '서버 문구')),
    ).toBe(r.WORK_ORDER_MISMATCH);
    expect(returnReasonOf(rejected('INVALID', 'lines[1].lotId', '없는 LOT 입니다.'))).toBe(
      r.lotMissing,
    );
  });

  it('US1-3 반납 가능 넘음은 서버가 준 양에 그 줄의 단위를 붙인다', () => {
    const units = ['EA', 'KG'];

    expect(
      returnReasonOf(
        rejected(
          'RANGE',
          'lines[1].returnQty',
          '출고된 양보다 많이 반납할 수 없습니다 (반납 가능 12.5)',
        ),
        (index) => (index === null ? '' : (units[index] ?? '')),
      ),
    ).toBe(messages.materialReturn.reason.overReturnable('12.5 KG'));
  });

  it('모르는 코드는 서버 문구 그대로 둔다', () => {
    expect(returnReasonOf(rejected('SOMETHING_NEW', 'lines', '새 거절'))).toBe('새 거절');
  });

  it('US1-4 베트남어 단말에는 서버 한국어 문구가 아니라 베트남어 문구가 보인다', () => {
    setLocale('vi');

    for (const code of ['NOT_RETURNABLE', 'NOTHING_TO_RETURN', 'WORK_ORDER_MISMATCH']) {
      const text = returnReasonOf(rejected(code, 'lotNo', '반납할 수 있는 자재 LOT 이 아닙니다'));
      expect(text).not.toBeNull();
      expect(text).not.toMatch(HANGUL);
    }
    const over = returnReasonOf(
      rejected(
        'RANGE',
        'lines[0].returnQty',
        '출고된 양보다 많이 반납할 수 없습니다 (반납 가능 36)',
      ),
      () => 'EA',
    );
    expect(over).toBe(messages.materialReturn.reason.overReturnable('36 EA'));
    expect(over).not.toMatch(HANGUL);
  });
});
