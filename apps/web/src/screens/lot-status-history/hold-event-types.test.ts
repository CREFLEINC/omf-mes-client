import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { toLotHoldEventView } from './types';

type LotHoldEventResponse = components['schemas']['LotHoldEvent'];

const MINIMAL_EVENT: LotHoldEventResponse = {
  lotHoldId: 701,
  eventTypeCode: 'RELEASED',
  occurredAt: '2026-08-07T10:11:12+09:00',
  lotId: 101,
  lotNo: 'SAMPLE-LOT-001',
  actorId: 801,
};

describe('toLotHoldEventView', () => {
  it('HELD 사건과 채워진 선택 필드를 서버 값 그대로 보존한다', () => {
    expect(
      toLotHoldEventView({
        ...MINIMAL_EVENT,
        eventTypeCode: 'HELD',
        itemId: 202,
        actorName: '합성 담당자',
        reasonCode: 'SAMPLE_REASON',
        holdQty: 12.5,
        uomId: 303,
        releaseCondition: '합성 해제 조건',
        targetLotStatusCode: 'SAMPLE_STATUS',
      }),
    ).toEqual({
      lotHoldId: 701,
      eventTypeCode: 'HELD',
      occurredAt: '2026-08-07T10:11:12+09:00',
      lotId: 101,
      lotNo: 'SAMPLE-LOT-001',
      itemId: 202,
      actorId: 801,
      actorName: '합성 담당자',
      reasonCode: 'SAMPLE_REASON',
      holdQty: 12.5,
      uomId: 303,
      releaseCondition: '합성 해제 조건',
      targetLotStatusCode: 'SAMPLE_STATUS',
    });
  });

  it('선택 필드가 빠지면 null로 모으되 보류 수량 0은 보존한다', () => {
    expect(toLotHoldEventView(MINIMAL_EVENT)).toEqual({
      lotHoldId: 701,
      eventTypeCode: 'RELEASED',
      occurredAt: '2026-08-07T10:11:12+09:00',
      lotId: 101,
      lotNo: 'SAMPLE-LOT-001',
      itemId: null,
      actorId: 801,
      actorName: null,
      reasonCode: null,
      holdQty: null,
      uomId: null,
      releaseCondition: null,
      targetLotStatusCode: null,
    });
    expect(toLotHoldEventView({ ...MINIMAL_EVENT, holdQty: 0 }).holdQty).toBe(0);
  });
});
