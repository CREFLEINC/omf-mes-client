import { describe, expect, it } from 'vitest';

import { scheduleLine } from './fixtures';
import {
  checkQty,
  defaultReasonOf,
  picksKeyOf,
  selectAllOf,
  splitReceiveQty,
  toReceiveBody,
} from './receive-entry';

describe('splitReceiveQty — 정량 한도까지와 넘는 몫(초과분)', () => {
  it('한도(발주 + 초과 허용치 − 받은 수량)까지는 정량, 넘는 몫이 초과분이다', () => {
    const line = scheduleLine({ orderedQty: 100, toleranceOverQty: 5, receivedQty: 20 });

    expect(splitReceiveQty(line, 80)).toEqual({ normalQty: 80, excessQty: 0 });
    expect(splitReceiveQty(line, 100)).toEqual({ normalQty: 85, excessQty: 15 });
  });

  it('다 받은 줄은 전부 초과분이다', () => {
    const line = scheduleLine({ orderedQty: 10, receivedQty: 10, remainingQty: 0 });

    expect(splitReceiveQty(line, 3)).toEqual({ normalQty: 0, excessQty: 3 });
  });

  it.each([
    [0.3, 0.1, 0.2],
    [100, 99.7, 0.3],
    [8.01, 8, 0.01],
  ])(
    '소수 라인(발주 %s · 받은 %s)에서 남은 %s 를 받으면 초과분이 없다 — 부동소수 오차가 실리지 않는다',
    (ordered, received, qty) => {
      const line = scheduleLine({ orderedQty: ordered, receivedQty: received });

      expect(splitReceiveQty(line, qty)).toEqual({ normalQty: qty, excessQty: 0 });
    },
  );

  it('소수 초과분도 서버 자릿수로 맞는다', () => {
    const line = scheduleLine({ orderedQty: 0.3, receivedQty: 0.1 });

    expect(splitReceiveQty(line, 0.5).excessQty).toBe(0.3);
  });
});

describe('checkQty — 친 수량의 판정', () => {
  it.each([
    ['', { kind: 'empty' }],
    ['  ', { kind: 'empty' }],
    ['abc', { kind: 'notNumber' }],
    ['0', { kind: 'notPositive' }],
    ['-3', { kind: 'notPositive' }],
    [' 12.5 ', { kind: 'qty', value: 12.5 }],
  ])('%j → %j', (text, expected) => {
    expect(checkQty(text)).toEqual(expected);
  });
});

describe('selectAllOf — 「모두 선택」', () => {
  it('받을 것이 남은 줄 중 부분 입하 줄은 빼고, 뺀 수를 낸다', () => {
    const lines = [
      scheduleLine(),
      scheduleLine({ purchaseOrderLineId: 7302, receivedQty: 20, remainingQty: 80 }),
      scheduleLine({ purchaseOrderLineId: 7303, receivedQty: 100, remainingQty: 0 }),
      scheduleLine({ purchaseOrderLineId: 7304, receiptStatusCode: 'CANCELLED' }),
    ];

    expect(selectAllOf(lines)).toEqual({ ids: [7301], skippedPartial: 1 });
  });
});

describe('picksKeyOf — 같은 시도인가', () => {
  it('같은 줄 · 같은 수량이면 같고, 수량이 다르면 다르다', () => {
    const line = scheduleLine();

    expect(picksKeyOf([{ line, qty: 10 }])).toBe(picksKeyOf([{ line, qty: 10 }]));
    expect(picksKeyOf([{ line, qty: 10 }])).not.toBe(picksKeyOf([{ line, qty: 11 }]));
  });
});

describe('toReceiveBody — 보낼 본문', () => {
  const now = new Date('2026-10-27T04:00:00.000Z');

  it('초과분이 있는 줄에만 excessQty 를 싣고, 입하 일시는 넘겨받은 시각이다', () => {
    const body = toReceiveBody(
      [
        { line: scheduleLine(), qty: 100 },
        { line: scheduleLine({ purchaseOrderLineId: 7302 }), qty: 120 },
      ],
      'NO_LABEL',
      '2026-10-27',
      now,
    );

    expect(body.receiptDatetime).toBe(now.toISOString());
    expect(body.occurredAt).toBe(now.toISOString());
    expect(body.lines[0]).not.toHaveProperty('excessQty');
    expect(body.lines[1]).toMatchObject({ purchaseOrderLineId: 7302, excessQty: 20 });
    expect(body.lines.every((line) => line.supplierLotLabelAttached === false)).toBe(true);
  });

  it('받을 줄이 없으면 던진다', () => {
    expect(() => toReceiveBody([], 'NO_LABEL', '2026-10-27', now)).toThrow();
  });
});

describe('defaultReasonOf — 라벨 미부착 사유', () => {
  it('「라벨 없음」이 있으면 그것, 없으면 첫 코드, 하나도 없으면 null', () => {
    expect(defaultReasonOf([{ code: 'DAMAGED' }, { code: 'NO_LABEL' }])).toBe('NO_LABEL');
    expect(defaultReasonOf([{ code: 'DAMAGED' }])).toBe('DAMAGED');
    expect(defaultReasonOf([])).toBeNull();
  });
});
