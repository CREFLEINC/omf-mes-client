import { ko, setLocale, vi as viMessages } from '@omf-mes/i18n';
import { afterEach, describe, expect, it } from 'vitest';

import {
  SPLIT_BLOCK_CODES,
  blockViewOf,
  initialLocationId,
  qtyProblemOf,
  subtractQty,
} from './model';
import type { SplitLookupLocation } from './queries';

const at = (overrides: Partial<SplitLookupLocation> = {}): SplitLookupLocation => ({
  locationId: 45,
  locationCode: 'FG-A-01',
  warehouseCode: 'FG',
  onHandQty: 100,
  selectable: true,
  blocked: null,
  systemRoleCode: null,
  ...overrides,
});

afterEach(() => {
  setLocale('ko');
});

describe('P-04-08 판정', () => {
  it('US2-4 · Q11 수량은 0 보다 크고 그 위치 보유보다 작아야 한다, EA 는 정수만', () => {
    expect(qtyProblemOf('30', at(), 'EA')).toBeNull();
    expect(qtyProblemOf('0', at(), 'EA')).toBe('range');
    expect(qtyProblemOf('100', at(), 'EA')).toBe('range');
    expect(qtyProblemOf('101', at(), 'EA')).toBe('range');
    expect(qtyProblemOf('2.5', at(), 'EA')).toBe('integer');
    expect(qtyProblemOf('2.5', at(), 'KG')).toBeNull();
    expect(qtyProblemOf('', at(), 'EA')).toBeNull();
  });

  it('US1-6 고를 수 있는 위치가 하나면 그것을 고르고, 둘 이상이면 고르지 않는다', () => {
    expect(initialLocationId([at(), at({ locationId: 90, selectable: false })])).toBe(45);
    expect(initialLocationId([at(), at({ locationId: 46 })])).toBeNull();
    expect(initialLocationId([])).toBeNull();
  });

  it('US1-1 원래 LOT 에 남는 수량은 LOT 수량에서 뺀 값(부동소수 꼬리 없음)', () => {
    expect(subtractQty(100, 30)).toBe(70);
    expect(subtractQty(0.3, 0.1)).toBe(0.2);
  });

  it('T026 막힌 이유 9종(016 반제품 포함) 모두 ko 와 vi 문구가 있다', () => {
    for (const code of SPLIT_BLOCK_CODES) {
      const korean = blockViewOf(code);
      expect(korean.title).not.toBe(ko.productLotSplit.blocked.unknown.title);

      setLocale('vi');
      const vietnamese = blockViewOf(code);
      setLocale('ko');

      expect(vietnamese.title).not.toBe(korean.title);
      expect(vietnamese.title).not.toMatch(/[가-힣]/u);
    }
    expect(viMessages.productLotSplit.title).toBe('Tách LOT sản xuất');
  });

  it('US2-2 보류 LOT 은 상태 이름을 제목에 넣는다', () => {
    expect(blockViewOf('INVALID_STATE', 'HOLD').title).toBe(
      ko.productLotSplit.blocked.INVALID_STATE.title('보류'),
    );
  });
});
