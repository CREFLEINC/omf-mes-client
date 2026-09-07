import { describe, expect, it } from 'vitest';

import {
  canSubmit,
  countedLines,
  qtyProblemOf,
  queuedForLocationOf,
  toCountDraft,
  type DraftLine,
  type InventoryCount,
} from './count';

const line = (overrides: Partial<DraftLine> = {}): DraftLine => ({
  inventoryCountLineId: 5101,
  locationId: 3001,
  itemId: 2002,
  lotId: 8001,
  uomId: 1001,
  systemQty: 120,
  counted: false,
  previousQty: null,
  qty: '',
  ...overrides,
});

const count = (): InventoryCount => ({
  inventoryCountId: 5001,
  inventoryCountNo: 'IC-2026-000031',
  countTypeCode: 'PERIODIC',
  warehouseId: 1001,
  plannedDate: '2026-09-07',
  blindCount: false,
  statusCode: 'IN_PROGRESS',
});

const location = { locationId: 3001 };

describe('실물 수량 검사', () => {
  it('숫자가 아니면 막는다', () => {
    expect(qtyProblemOf(line({ qty: '열' }))).toBe('notNumber');
  });

  it('음수를 막는다', () => {
    expect(qtyProblemOf(line({ qty: '-1' }))).toBe('negative');
  });

  /* 세어 보니 없더라는 유효한 답이다. 0 을 막으면 그것을 적을 길이 없다. */
  it('0 은 막지 않는다', () => {
    expect(qtyProblemOf(line({ qty: '0' }))).toBeNull();
  });

  /* 빈 글자는 아직 세지 않은 것이다. 문제가 아니라 상태다. */
  it('안 적은 줄은 문제로 보지 않는다', () => {
    expect(qtyProblemOf(line())).toBeNull();
  });
});

/*
 * 이 화면의 전부다. 안 센 것을 0 으로 보내면 관리웹이 그것을 전량 손실로 잡는다 -
 * 120 라인 중 38 개만 센 상태에서 나머지 82 개가 없는 것으로 확정돼 버린다.
 */
describe('아직 세지 않은 것과 0 으로 센 것', () => {
  it('안 적은 줄은 센 줄이 아니다', () => {
    expect(countedLines([line()])).toHaveLength(0);
  });

  it('0 을 적은 줄은 센 줄이다', () => {
    expect(countedLines([line({ qty: '0' })])).toHaveLength(1);
  });

  it('안 적은 줄은 보내는 본문에 없다', () => {
    const draft = toCountDraft(
      count(),
      3001,
      [line({ qty: '0' }), line({ inventoryCountLineId: 5102, itemId: 2001 })],
      new Date('2026-09-07T09:12:00+09:00'),
      '100028',
    );
    const body = draft.body as { lines: { inventoryCountLineId: number; countedQty: number }[] };

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.inventoryCountLineId).toBe(5101);
    expect(body.lines[0]?.countedQty).toBe(0);
  });

  /* 서버가 센 것으로 보는 줄이라도 이번에 안 적었으면 이번 전송에 넣지 않는다. */
  it('전에 센 줄이라도 이번에 안 적었으면 보내지 않는다', () => {
    expect(countedLines([line({ counted: true, previousQty: 120 })])).toHaveLength(0);
  });
});

describe('완료 가능 여부', () => {
  const lines = [line({ qty: '118' })];

  it('위치를 안 고르면 완료할 수 없다', () => {
    expect(canSubmit(null, lines, true, 0)).toBe(false);
  });

  it('사번이 없으면 완료할 수 없다', () => {
    expect(canSubmit(location, lines, false, 0)).toBe(false);
  });

  it('한 줄도 적지 않으면 완료할 수 없다', () => {
    expect(canSubmit(location, [line()], true, 0)).toBe(false);
  });

  it('수량이 잘못된 줄이 있으면 완료할 수 없다', () => {
    expect(canSubmit(location, [line({ qty: '-1' })], true, 0)).toBe(false);
  });

  /* 서버 응답에는 아직 안 간 건이 없다. 큐를 세지 않으면 같은 위치를 두 번 치환한다. */
  it('큐에 이 위치의 전송이 담겨 있으면 완료할 수 없다', () => {
    expect(canSubmit(location, lines, true, 1)).toBe(false);
  });

  it('0 만 적어도 완료한다', () => {
    expect(canSubmit(location, [line({ qty: '0' })], true, 0)).toBe(true);
  });

  it('적은 줄이 있고 수량이 맞으면 완료한다', () => {
    expect(canSubmit(location, lines, true, 0)).toBe(true);
  });
});

describe('큐에 담긴 것 세기', () => {
  /* 위치는 경로가 아니라 본문에 있다. 경로만 보면 같은 실사의 다른 위치까지 함께 센다. */
  const entries = [
    { path: '/inventory/counts/5001/lines', body: { locationId: 3001 } },
    { path: '/inventory/counts/5001/lines', body: { locationId: 3002 } },
    { path: '/inventory/counts/5002/lines', body: { locationId: 3001 } },
  ];

  it('같은 실사의 같은 위치만 센다', () => {
    expect(queuedForLocationOf(entries, 5001, 3001)).toBe(1);
  });

  it('다른 위치는 세지 않는다', () => {
    expect(queuedForLocationOf(entries, 5001, 3003)).toBe(0);
  });

  it('다른 실사의 같은 위치는 세지 않는다', () => {
    expect(queuedForLocationOf(entries, 5003, 3001)).toBe(0);
  });
});

describe('보낼 것', () => {
  const now = new Date('2026-09-07T09:12:00+09:00');

  /* 위치 단위로 끊어 치환한다. 실사 전체를 한 번에 치환하면 다른 위치가 지워진다. */
  it('그 위치만 치환하도록 보낸다', () => {
    const draft = toCountDraft(count(), 3001, [line({ qty: '118' })], now, '100028');
    const body = draft.body as { locationId: number };

    expect(draft.method).toBe('PUT');
    expect(draft.path).toBe('/inventory/counts/5001/lines');
    expect(body.locationId).toBe(3001);
  });

  /* 기준일 없이 보내면 서버가 치환을 거절한다. */
  it('업무 기준일을 싣는다', () => {
    const draft = toCountDraft(count(), 3001, [line({ qty: '118' })], now, '100028');
    const body = draft.body as { businessDate: string };

    expect(body.businessDate).toBe('2026-09-07');
  });

  /* 센 시각은 이 단말의 것이다. 오프라인에서 늦게 닿아도 언제 세었는지가 남아야 한다. */
  it('센 시각을 줄마다 싣는다', () => {
    const draft = toCountDraft(count(), 3001, [line({ qty: '118' })], now, '100028');
    const body = draft.body as { lines: { countedAt: string }[] };

    expect(body.lines[0]?.countedAt).toBe(now.toISOString());
  });

  it('LOT 이 없는 줄도 그대로 싣는다', () => {
    const draft = toCountDraft(count(), 3001, [line({ qty: '5', lotId: null })], now, '100028');
    const body = draft.body as { lines: { lotId: number | null }[] };

    expect(body.lines[0]?.lotId).toBeNull();
  });
});
