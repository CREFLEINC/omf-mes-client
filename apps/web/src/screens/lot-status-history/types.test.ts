import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { lotStatusRowKey, toLotHoldView, toLotStatusRow, toLotStatusSummaryView } from './types';

type LotQualityStatusResponse = components['schemas']['LotQualityStatus'];
type LotStatusSummaryResponse = components['schemas']['LotStatusSummary'];
type LotHoldResponse = components['schemas']['LotHold'];

const MINIMAL_LOT_STATUS: LotQualityStatusResponse = {
  lotId: 101,
  lotNo: 'SAMPLE-LOT-001',
  itemId: 202,
  lotStatusCode: 'SAMPLE_STATUS_A',
  fullyHeld: false,
};

const FULL_LOT_STATUS: LotQualityStatusResponse = {
  ...MINIMAL_LOT_STATUS,
  lotTypeCode: 'SAMPLE_TYPE_A',
  warehouseId: 303,
  locationId: 404,
  onHandQty: 100,
  heldQty: 30,
  availableQty: 91,
  uomId: 505,
  openHoldCount: 2,
  fullyHeld: true,
  latestTransitionAt: '2026-08-07T13:14:15+09:00',
  latestReasonCode: 'SAMPLE_REASON_A',
};

describe('toLotStatusRow', () => {
  it('빠진 선택 필드를 전부 null로 정규화한다', () => {
    expect(toLotStatusRow(MINIMAL_LOT_STATUS)).toEqual({
      lotId: 101,
      lotNo: 'SAMPLE-LOT-001',
      itemId: 202,
      lotTypeCode: null,
      lotStatusCode: 'SAMPLE_STATUS_A',
      warehouseId: null,
      locationId: null,
      onHandQty: null,
      heldQty: null,
      availableQty: null,
      uomId: null,
      openHoldCount: null,
      fullyHeld: false,
      latestTransitionAt: null,
      latestReasonCode: null,
    });
  });

  it('수량과 열린 보류 건수를 계산하지 않고 서버 값 그대로 보존한다', () => {
    const row = toLotStatusRow(FULL_LOT_STATUS);

    expect(row.onHandQty).toBe(100);
    expect(row.heldQty).toBe(30);
    expect(row.availableQty).toBe(91);
    expect(row.openHoldCount).toBe(2);
  });

  it('수량과 열린 보류 건수의 0을 값 없음으로 바꾸지 않는다', () => {
    const row = toLotStatusRow({
      ...FULL_LOT_STATUS,
      onHandQty: 0,
      heldQty: 0,
      availableQty: 0,
      openHoldCount: 0,
    });

    expect(row.onHandQty).toBe(0);
    expect(row.heldQty).toBe(0);
    expect(row.availableQty).toBe(0);
    expect(row.openHoldCount).toBe(0);
  });

  it('전량 보류 여부와 최근 전이 원문을 보존한다', () => {
    const row = toLotStatusRow(FULL_LOT_STATUS);

    expect(row.fullyHeld).toBe(true);
    expect(row.latestTransitionAt).toBe('2026-08-07T13:14:15+09:00');
    expect(row.latestReasonCode).toBe('SAMPLE_REASON_A');
  });
});

describe('lotStatusRowKey', () => {
  it('같은 LOT이 여러 Location에 나뉘면 서로 다른 행 키를 만든다', () => {
    const first = toLotStatusRow(FULL_LOT_STATUS);
    const second = toLotStatusRow({ ...FULL_LOT_STATUS, locationId: 405 });

    expect(lotStatusRowKey(first)).not.toBe(lotStatusRowKey(second));
  });

  it('같은 LOT과 Location이어도 창고가 다르면 서로 다른 행 키를 만든다', () => {
    const first = toLotStatusRow(FULL_LOT_STATUS);
    const second = toLotStatusRow({ ...FULL_LOT_STATUS, warehouseId: 304 });

    expect(lotStatusRowKey(first)).not.toBe(lotStatusRowKey(second));
  });

  it('LOT·창고·Location 조합이 같으면 같은 행 키를 만든다', () => {
    expect(lotStatusRowKey(toLotStatusRow(FULL_LOT_STATUS))).toBe(
      lotStatusRowKey(toLotStatusRow({ ...FULL_LOT_STATUS })),
    );
  });

  it('null의 위치가 다른 창고·Location 조합과 둘 다 null인 조합은 충돌하지 않는다', () => {
    const warehouseOnly = lotStatusRowKey(
      toLotStatusRow({ ...FULL_LOT_STATUS, warehouseId: 303, locationId: undefined }),
    );
    const locationOnly = lotStatusRowKey(
      toLotStatusRow({ ...FULL_LOT_STATUS, warehouseId: undefined, locationId: 303 }),
    );
    const withoutStorage = lotStatusRowKey(
      toLotStatusRow({ ...FULL_LOT_STATUS, warehouseId: undefined, locationId: undefined }),
    );

    expect(warehouseOnly).not.toBe(locationOnly);
    expect(warehouseOnly).not.toBe(withoutStorage);
    expect(locationOnly).not.toBe(withoutStorage);
  });
});

const SUMMARY: LotStatusSummaryResponse = {
  counts: [
    { statusCode: 'SAMPLE_STATUS_B', lotCount: 7, lotTypeCode: 'SAMPLE_TYPE_A' },
    { statusCode: 'SAMPLE_STATUS_A', lotCount: 3 },
  ],
  asOf: '2026-08-07T15:16:17+09:00',
  outOfScopeCount: 0,
};

describe('toLotStatusSummaryView', () => {
  it('상태별 코드·건수·LOT 유형을 서버 순서와 값 그대로 보존한다', () => {
    const view = toLotStatusSummaryView(SUMMARY);

    expect(view.counts).toEqual([
      { statusCode: 'SAMPLE_STATUS_B', lotCount: 7, lotTypeCode: 'SAMPLE_TYPE_A' },
      { statusCode: 'SAMPLE_STATUS_A', lotCount: 3, lotTypeCode: null },
    ]);
    expect(view.counts).not.toBe(SUMMARY.counts);
  });

  it('응답의 count 항목을 나중에 바꿔도 이미 만든 view 항목은 변하지 않는다', () => {
    const count = { statusCode: 'SAMPLE_STATUS_C', lotCount: 11, lotTypeCode: 'SAMPLE_TYPE_B' };
    const response: LotStatusSummaryResponse = {
      counts: [count],
      asOf: '2026-08-08T10:11:12+09:00',
    };
    const view = toLotStatusSummaryView(response);

    count.lotCount = 99;

    expect(view.counts[0]).not.toBe(count);
    expect(view.counts[0]).toEqual({
      statusCode: 'SAMPLE_STATUS_C',
      lotCount: 11,
      lotTypeCode: 'SAMPLE_TYPE_B',
    });
  });

  it('범위 밖 건수는 필드가 없으면 null로 모으되 0은 보존한다', () => {
    expect(
      toLotStatusSummaryView({ counts: [], asOf: '2026-08-07T15:16:17+09:00' }).outOfScopeCount,
    ).toBeNull();
    expect(toLotStatusSummaryView(SUMMARY).outOfScopeCount).toBe(0);
  });

  it('기준 시각 원문을 보존한다', () => {
    expect(toLotStatusSummaryView(SUMMARY).asOf).toBe('2026-08-07T15:16:17+09:00');
  });
});

const MINIMAL_HOLD: LotHoldResponse = {
  lotHoldId: 701,
  lotId: 101,
  reasonCode: 'SAMPLE_REASON_A',
  statusCode: 'SAMPLE_HOLD_STATUS_A',
  heldAt: '2026-08-03T09:10:11+09:00',
};

const FULL_HOLD: LotHoldResponse = {
  ...MINIMAL_HOLD,
  lotNo: 'SAMPLE-LOT-001',
  itemId: 202,
  holdQty: 0,
  uomId: 505,
  releaseCondition: '합성 해제 조건',
  heldBy: 801,
  releasedBy: 802,
  releasedAt: '2026-08-04T10:11:12+09:00',
  remarks: '합성 비고',
  lotStatusCode: 'SAMPLE_LOT_STATUS_A',
};

describe('toLotHoldView', () => {
  it('등록자·등록시각과 해제자·해제시각을 서로 다른 축으로 보존한다', () => {
    const view = toLotHoldView(FULL_HOLD);

    expect(view.heldBy).toBe(801);
    expect(view.heldAt).toBe('2026-08-03T09:10:11+09:00');
    expect(view.releasedBy).toBe(802);
    expect(view.releasedAt).toBe('2026-08-04T10:11:12+09:00');
  });

  it('보류 수량 null과 0을 구분한다', () => {
    expect(toLotHoldView({ ...MINIMAL_HOLD, holdQty: null }).holdQty).toBeNull();
    expect(toLotHoldView({ ...MINIMAL_HOLD, holdQty: 0 }).holdQty).toBe(0);
  });

  it('빠진 선택 필드를 전부 null로 정규화한다', () => {
    expect(toLotHoldView(MINIMAL_HOLD)).toEqual({
      lotHoldId: 701,
      lotId: 101,
      lotNo: null,
      itemId: null,
      holdQty: null,
      uomId: null,
      reasonCode: 'SAMPLE_REASON_A',
      releaseCondition: null,
      holdStatusCode: 'SAMPLE_HOLD_STATUS_A',
      heldBy: null,
      heldAt: '2026-08-03T09:10:11+09:00',
      releasedBy: null,
      releasedAt: null,
      remarks: null,
      lotStatusCode: null,
    });
  });

  it('해제 조건·비고·LOT 현재 상태 코드를 원문 그대로 보존한다', () => {
    const view = toLotHoldView(FULL_HOLD);

    expect(view.releaseCondition).toBe('합성 해제 조건');
    expect(view.remarks).toBe('합성 비고');
    expect(view.lotStatusCode).toBe('SAMPLE_LOT_STATUS_A');
  });

  it('보류 문서 상태와 LOT 현재 상태를 한 필드로 합치지 않는다', () => {
    const view = toLotHoldView(FULL_HOLD);

    expect(view.holdStatusCode).toBe('SAMPLE_HOLD_STATUS_A');
    expect(view.lotStatusCode).toBe('SAMPLE_LOT_STATUS_A');
  });
});
