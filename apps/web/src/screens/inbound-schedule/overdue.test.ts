import { describe, expect, it } from 'vitest';

import { scheduleLine } from './fixtures';
import { isOpenLine, isOverdue } from './overdue';

/**
 * 지연 판정 — 서버 `overdueOnly` 와 같은 기준이어야 한다. 표식과 거른 결과가 다른 줄을 가리키면
 * 사용자는 둘 중 하나를 믿지 못한다.
 */

const TODAY = '2026-10-20';

describe('isOpenLine', () => {
  it('남은 수량이 있고 취소·종료가 아니면 미완료다', () => {
    expect(isOpenLine(scheduleLine())).toBe(true);
  });

  it('남은 수량이 0이면 미완료가 아니다', () => {
    expect(isOpenLine(scheduleLine({ remainingQty: 0 }))).toBe(false);
  });

  it('라인이 취소됐으면 미완료가 아니다', () => {
    expect(isOpenLine(scheduleLine({ cancelledAt: '2026-10-01T00:00:00.000Z' }))).toBe(false);
  });

  it.each(['CLOSED', 'CANCELLED'])('헤더가 %s 이면 미완료가 아니다', (purchaseOrderStatusCode) => {
    expect(isOpenLine(scheduleLine({ purchaseOrderStatusCode }))).toBe(false);
  });
});

describe('isOverdue', () => {
  it('납기가 오늘보다 앞서고 미완료면 지연이다', () => {
    expect(isOverdue(scheduleLine({ expectedReceiptDate: '2026-10-19' }), TODAY)).toBe(true);
  });

  /* 서버도 당일을 지연으로 보지 않는다(`lt` 공장 현지 오늘). */
  it('납기 당일은 지연이 아니다', () => {
    expect(isOverdue(scheduleLine({ expectedReceiptDate: TODAY }), TODAY)).toBe(false);
  });

  it('납기가 지났어도 다 들어왔으면 지연이 아니다', () => {
    expect(
      isOverdue(scheduleLine({ expectedReceiptDate: '2026-10-01', remainingQty: 0 }), TODAY),
    ).toBe(false);
  });

  it('납기가 지났어도 취소된 라인은 지연이 아니다', () => {
    expect(
      isOverdue(
        scheduleLine({ expectedReceiptDate: '2026-10-01', cancelledAt: '2026-10-02T00:00:00Z' }),
        TODAY,
      ),
    ).toBe(false);
  });

  it('납기가 없으면 지연이 아니다', () => {
    expect(isOverdue(scheduleLine({ expectedReceiptDate: null }), TODAY)).toBe(false);
  });

  /* 문자열 비교는 형식이 깨진 값도 「작다」로 판정한다 — 형식을 먼저 본다. */
  it('형식이 깨진 납기에는 지연을 붙이지 않는다', () => {
    expect(isOverdue(scheduleLine({ expectedReceiptDate: '2026-8-9' }), TODAY)).toBe(false);
  });
});
