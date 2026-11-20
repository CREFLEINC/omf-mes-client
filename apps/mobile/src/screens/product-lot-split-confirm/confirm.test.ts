import { ko, vi as viMessages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { confirmFailureOf, roleOf } from './confirm';
import type { ProductLotSplit } from './queries';

const split = {
  parentLot: { lotId: 1, lotNo: 'SYN-PL-0001', qty: 70 },
  childLot: { lotId: 2, lotNo: 'SYN-PL-0001-S1', qty: 30 },
} as ProductLotSplit;

describe('M-04-05 판정', () => {
  it('US3-2 스캔한 번호가 원래인지 새 LOT 인지 가른다 — 둘 다 아니면 null', () => {
    expect(roleOf(split, 'SYN-PL-0001')).toBe('parent');
    expect(roleOf(split, 'SYN-PL-0001-S1')).toBe('child');
    expect(roleOf(split, 'SYN-PL-0002')).toBeNull();
  });

  it('US3-4 · US3-5 확인 거절을 가른다 — 409 ALREADY_CONFIRMED · 400 INVALID · 연결 끊김', () => {
    expect(
      confirmFailureOf({ kind: 'conflict', cause: 'user', code: 'ALREADY_CONFIRMED', message: '' }),
    ).toBe('already');
    expect(
      confirmFailureOf({
        kind: 'validation',
        errors: [{ scope: 'screen', code: 'INVALID', message: '짝 아님' }],
      }),
    ).toBe('wrong');
    expect(confirmFailureOf({ kind: 'network' })).toBe('offline');
    expect(confirmFailureOf({ kind: 'http', status: 500 })).toBe('failed');
  });

  it('vi 문구가 있고 한국어가 남지 않는다', () => {
    const vi = viMessages.productLotSplitConfirm;
    expect(vi.title).toBe('Xác nhận tách LOT');
    expect(vi.notice.doneTitle).not.toBe(ko.productLotSplitConfirm.notice.doneTitle);
    expect(JSON.stringify(vi)).not.toMatch(/[가-힣]/u);
    expect(viMessages.productPicking.rejected.LOT_SPLIT_UNCONFIRMED).toBe('LOT chưa xác nhận tách');
  });
});
