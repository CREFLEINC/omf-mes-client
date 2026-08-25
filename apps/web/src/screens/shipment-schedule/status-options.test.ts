import { describe, expect, it } from 'vitest';

import { distinctStatusCodes, toStatusOptions, withCurrentValue } from './status-options';
import type { ShipmentRequestView } from './types';

const row = (statusCode: string): ShipmentRequestView => ({
  shipmentRequestId: 1,
  shipmentRequestNo: 'SR-1',
  customerId: 1,
  shipToPartnerId: 1,
  requestedShipDate: '2026-08-01',
  statusCode,
  hasInspectionRequiredLine: false,
  lineTotals: null,
});

describe('distinctStatusCodes', () => {
  it('결과에 나온 코드를 오름차순 중복 없이 뽑는다', () => {
    expect(distinctStatusCodes([row('B'), row('A'), row('B')])).toEqual(['A', 'B']);
  });

  it('빈 값은 버린다', () => {
    expect(distinctStatusCodes([row(''), row('A')])).toEqual(['A']);
  });

  it('행이 없으면 빈 배열이다', () => {
    expect(distinctStatusCodes([])).toEqual([]);
  });
});

describe('withCurrentValue', () => {
  it('지금 값이 목록에 있으면 그대로 둔다', () => {
    expect(withCurrentValue(['A', 'B'], 'A')).toEqual(['A', 'B']);
  });

  it('지금 값이 목록에 없으면 맨 앞에 남긴다', () => {
    expect(withCurrentValue(['A', 'B'], 'C')).toEqual(['C', 'A', 'B']);
  });

  it('지금 값이 없으면(전체) 목록을 그대로 둔다', () => {
    expect(withCurrentValue(['A', 'B'], '')).toEqual(['A', 'B']);
  });
});

describe('toStatusOptions', () => {
  it('자리표시 상수와 결과 코드를 합친다', () => {
    expect(toStatusOptions(['PLACEHOLDER'], [row('A')], '')).toEqual(['PLACEHOLDER', 'A']);
  });

  it('중복을 제거한다', () => {
    expect(toStatusOptions(['A'], [row('A')], '')).toEqual(['A']);
  });

  it('지금 걸린 값이 어디에도 없으면 맨 앞에 남긴다', () => {
    expect(toStatusOptions([], [row('A')], 'B')).toEqual(['B', 'A']);
  });
});
