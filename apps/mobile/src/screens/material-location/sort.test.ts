import { describe, expect, it } from 'vitest';

import type { InventoryBalance } from './queries';
import { byOnHandDesc } from './sort';

const row = (locationId: number, onHandQty: number): InventoryBalance =>
  ({ locationId, onHandQty }) as InventoryBalance;

describe('잔액 정렬', () => {
  it('보유 수량이 많은 자리를 먼저 둔다', () => {
    const sorted = byOnHandDesc([row(21, 30), row(22, 90), row(23, 0)]);

    expect(sorted.map((balance) => balance.locationId)).toEqual([22, 21, 23]);
  });

  it('받은 배열을 건드리지 않는다', () => {
    const given = [row(21, 30), row(22, 90)];

    byOnHandDesc(given);

    expect(given.map((balance) => balance.locationId)).toEqual([21, 22]);
  });
});
