import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { emptyLineDraft } from './line-draft';
import type { AvailableQtyLookup } from './lookups';
import { ShortageBanner, countShortageLines, isShortageLine } from './shortage-banner';
import type { ShipmentRequestLineDraft } from './types';

const line = (patch: Partial<ShipmentRequestLineDraft>): ShipmentRequestLineDraft => ({
  ...emptyLineDraft(),
  ...patch,
});

const availableOf = (values: Record<number, number>): AvailableQtyLookup => ({
  of: (itemId) =>
    itemId === null || !(itemId in values)
      ? { kind: 'unasked' }
      : { kind: 'qty', value: values[itemId]! },
  refetchAll: () => undefined,
});

describe('isShortageLine', () => {
  it('배정이 가용을 넘으면 부족이다', () => {
    const target = line({ itemId: '8301', allocatedQty: '80' });

    expect(isShortageLine(target, availableOf({ 8301: 60 }))).toBe(true);
  });

  it('배정이 가용 이하면 부족이 아니다', () => {
    const target = line({ itemId: '8301', allocatedQty: '50' });

    expect(isShortageLine(target, availableOf({ 8301: 60 }))).toBe(false);
  });

  it('가용을 아직 모르면(로딩·실패) 부족으로 세지 않는다 — 모르는 것을 단언하지 않는다', () => {
    const target = line({ itemId: '8301', allocatedQty: '9999' });

    expect(isShortageLine(target, availableOf({}))).toBe(false);
  });

  it('배정 수량이 없는 줄은 부족이 아니다', () => {
    const target = line({ itemId: '8301', allocatedQty: '' });

    expect(isShortageLine(target, availableOf({ 8301: 0 }))).toBe(false);
  });
});

describe('countShortageLines', () => {
  it('부족한 줄 수를 센다', () => {
    const lines = [
      line({ itemId: '8301', allocatedQty: '80' }),
      line({ itemId: '8302', allocatedQty: '10' }),
    ];

    expect(countShortageLines(lines, availableOf({ 8301: 60, 8302: 100 }))).toBe(1);
  });
});

describe('ShortageBanner', () => {
  it('0건이면 아무것도 그리지 않는다', () => {
    const { container } = render(<ShortageBanner count={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('부족 건수가 있으면 경고를 낸다 — 막지 않는다', () => {
    render(<ShortageBanner count={2} />);

    expect(screen.getByText(/가용 재고가 부족한 라인이 있습니다/)).toBeInTheDocument();
  });
});
