import { beforeEach, describe, expect, it } from 'vitest';

import {
  readPendingInputs,
  removePendingInput,
  savePendingInput,
  toPendingBody,
  type PendingInput,
} from './pending-input';

const ITEM: PendingInput = {
  id: 'sample-1',
  workOrderId: 7801,
  workerNo: 'SAMPLE-W-0001',
  workSessionId: null,
  material: {
    lotId: 7301,
    lotNo: 'SAMPLE-LOT-0001',
    itemId: 7201,
    uomId: 7401,
    statusCode: 'NORMAL',
    isHeld: false,
    fourMChange: null,
  },
  qty: '12',
  scannedAt: '2026-10-26T09:00:00.000Z',
};

describe('「보낼 예정」 저장소(PI-26)', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it('저장하고, 같은 id면 바꾸고, 지운다', () => {
    savePendingInput(ITEM);
    savePendingInput({ ...ITEM, qty: '5' });
    expect(readPendingInputs()).toEqual([{ ...ITEM, qty: '5' }]);

    removePendingInput(ITEM.id);
    expect(readPendingInputs()).toEqual([]);
  });

  it('모양이 깨진 항목은 버린다', () => {
    globalThis.localStorage.setItem(
      'omf-mes.material-input-scan.pending',
      JSON.stringify([{ id: 'broken' }, ITEM]),
    );
    expect(readPendingInputs()).toEqual([ITEM]);
  });

  it('본문은 저장된 수량과 스캔 시각으로 만들고, 쓸 수 없는 수량이면 만들지 않는다', () => {
    expect(toPendingBody(ITEM)).toMatchObject({ workOrderId: 7801, lotId: 7301, inputQty: 12 });
    expect(toPendingBody({ ...ITEM, qty: '' })).toBeNull();
  });
});
