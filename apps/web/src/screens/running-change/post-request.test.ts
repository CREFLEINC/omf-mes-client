import { describe, expect, it } from 'vitest';

import {
  NEW_ITEM_ID,
  NEW_LOT_ID,
  OLD_CONSUMPTION_ID,
  UOM_ID,
  WORK_ORDER_ID,
  WORK_SESSION_ID,
  makePart,
} from './fixtures';
import { toOffsetDateTime, toReplacementConsumption } from './post-request';

const OCCURRED_AT = new Date(2026, 8, 2, 9, 12, 0);

const draft = (overrides: Partial<Parameters<typeof toReplacementConsumption>[0]> = {}) => ({
  workOrderId: WORK_ORDER_ID,
  part: makePart(),
  replacedConsumptionId: OLD_CONSUMPTION_ID,
  qty: '120',
  workSessionId: WORK_SESSION_ID,
  occurredAt: OCCURRED_AT,
  ...overrides,
});

describe('교체 등록 본문', () => {
  it('계약이 필수로 둔 여섯 칸을 화면이 가진 값으로 채운다', () => {
    const body = toReplacementConsumption(draft());

    expect(body).toMatchObject({
      workOrderId: WORK_ORDER_ID,
      itemId: NEW_ITEM_ID,
      lotId: NEW_LOT_ID,
      inputQty: 120,
      uomId: UOM_ID,
    });
    expect(body?.occurredAt).toBe(toOffsetDateTime(OCCURRED_AT));
  });

  /*
   * ⭐ 이 한 칸이 「지우지 않고 잇는다」를 만든다(스펙 §5-2). 빠지면 같은 오퍼레이션이
   * 평범한 투입으로 기록되어 이전 부품과 이어지지 않는다 — 오류 없이 조용히 어긋난다.
   */
  it('교체 대상을 replacedConsumptionId 로 싣는다', () => {
    expect(toReplacementConsumption(draft())?.replacedConsumptionId).toBe(OLD_CONSUMPTION_ID);
  });

  it('교체 대상이 없으면 본문을 만들지 않는다', () => {
    expect(toReplacementConsumption(draft({ replacedConsumptionId: null }))).toBeNull();
  });

  it('정정 축(correctsConsumptionId)을 쓰지 않는다', () => {
    expect(toReplacementConsumption(draft())).not.toHaveProperty('correctsConsumptionId');
  });

  /* 통지 #563 · omf-mes#252 — 상수를 박는 것도 하지 않는다. */
  it('투입 유형·작업자·단말·서버 파생 칸을 보내지 않는다', () => {
    const body = toReplacementConsumption(draft());

    expect(body).not.toHaveProperty('consumptionTypeCode');
    expect(body).not.toHaveProperty('workerId');
    expect(body).not.toHaveProperty('terminalId');
    expect(body).not.toHaveProperty('bomComponentId');
    expect(body).not.toHaveProperty('shopfloorReceiptLineId');
    expect(body).not.toHaveProperty('actualUseProcessId');
  });

  /* 값 목록이 확정 전이라(omf-mes#397 ②) 지어낸 코드를 원장에 남기지 않는다. */
  it('교체 사유를 보내지 않는다', () => {
    expect(toReplacementConsumption(draft())).not.toHaveProperty('changeReasonCode');
  });

  it('세션이 없으면 그 칸을 아예 빼고, 있으면 싣는다', () => {
    expect(toReplacementConsumption(draft({ workSessionId: null }))).not.toHaveProperty(
      'workSessionId',
    );
    expect(toReplacementConsumption(draft())?.workSessionId).toBe(WORK_SESSION_ID);
  });

  it('작업지시·부품·수량이 갖춰지지 않으면 만들지 않는다', () => {
    expect(toReplacementConsumption(draft({ workOrderId: null }))).toBeNull();
    expect(toReplacementConsumption(draft({ part: null }))).toBeNull();
    expect(toReplacementConsumption(draft({ qty: '' }))).toBeNull();
    expect(toReplacementConsumption(draft({ qty: '0' }))).toBeNull();
    expect(toReplacementConsumption(draft({ qty: '-1' }))).toBeNull();
  });
});

describe('발생 시각', () => {
  /* ⛔ offset 이 없으면 같은 글자가 지역마다 다른 순간을 가리킨다. */
  it('offset 을 붙인 지역 시각 문자열을 만든다', () => {
    const text = toOffsetDateTime(OCCURRED_AT);

    expect(text).toMatch(/^2026-09-02T09:12:00[+-]\d{2}:\d{2}$/);
  });

  it('한 자리 수를 0으로 채운다', () => {
    expect(toOffsetDateTime(new Date(2026, 0, 3, 4, 5, 6))).toMatch(
      /^2026-01-03T04:05:06[+-]\d{2}:\d{2}$/,
    );
  });
});
