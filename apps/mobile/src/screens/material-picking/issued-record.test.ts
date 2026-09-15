import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ISSUED_KEY,
  appendIssued,
  issuedQtyByLine,
  readIssued,
  type IssuedRecord,
} from './issued-record';

const store = new Map<string, string>();

vi.mock('../../patterns/local-store', () => ({
  readLocal: (key: string) => Promise.resolve(store.get(key) ?? null),
  writeLocal: (key: string, value: string) => {
    store.set(key, value);

    return Promise.resolve();
  },
}));

const record = (
  idempotencyKey: string,
  pickingOrderId: number,
  issueQty: number,
): IssuedRecord => ({
  idempotencyKey,
  pickingOrderId,
  lines: [{ pickingLineId: 7, issueQty, itemId: 11, lotId: 22, uomId: 1, sourceLocationId: 33 }],
});

describe('내보낸 기록', () => {
  beforeEach(() => {
    store.clear();
  });

  /*
   * 단말에 남은 값은 앞선 판에서 적은 것일 수 있고, 저장하다 끊기면 반쪽으로 남는다. 라인이
   * 없는 것을 그대로 세면 그 자리에서 멈춰 화면이 아예 안 뜬다.
   */
  it('모양이 어긋난 기록은 없는 것으로 본다', async () => {
    store.set(
      ISSUED_KEY,
      JSON.stringify([record('a', 2, 30), { idempotencyKey: 'b', pickingOrderId: 2 }, null, 5]),
    );

    const kept = await readIssued();

    expect(kept).toHaveLength(1);
    expect(issuedQtyByLine(kept, 2, () => false).get(7)).toBe(30);
  });

  it('깨진 글자는 없는 것으로 본다', async () => {
    store.set(ISSUED_KEY, '{저장하다 만 것');

    expect(await readIssued()).toEqual([]);
  });

  /* 되돌아온 건은 나간 적이 없다. 빼 두면 다시 내보낼 길이 사라진다. */
  it('되돌아온 건은 셈에서 뺀다', async () => {
    await appendIssued(record('a', 2, 30));
    await appendIssued(record('b', 2, 20));

    const counted = issuedQtyByLine(await readIssued(), 2, (key) => key === 'b');

    expect(counted.get(7)).toBe(30);
  });

  /* 다른 지시의 양을 세면 남은 수량이 실제보다 적게 보여 확정이 잠긴다. */
  it('다른 지시의 기록은 세지 않는다', async () => {
    await appendIssued(record('a', 2, 30));
    await appendIssued(record('c', 9, 40));

    expect(issuedQtyByLine(await readIssued(), 2, () => false).get(7)).toBe(30);
  });
});
