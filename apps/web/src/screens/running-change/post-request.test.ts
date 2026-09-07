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
import { stripLeadingZeros } from './quantity-pad';

const OCCURRED_AT = new Date(2026, 8, 2, 9, 12, 0);

const draft = (overrides: Partial<Parameters<typeof toReplacementConsumption>[0]> = {}) => ({
  workOrderId: WORK_ORDER_ID,
  part: makePart(),
  replacedConsumptionId: OLD_CONSUMPTION_ID,
  qty: '120',
  changeReasonCode: null,
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

/*
 * 사유는 «고르지 않아도» 등록이 서고(스펙 §6 — 권고), 골랐으면 그대로 실린다. ⛔ 「안 골랐다」를
 * 빈 값으로 보내지 않는다 — 기록에서 둘이 갈라지지 않는다.
 */
describe('교체 사유', () => {
  it('고르지 않았으면 칸 자체를 싣지 않는다', () => {
    expect(toReplacementConsumption(draft())).not.toHaveProperty('changeReasonCode');
    expect(toReplacementConsumption(draft({ changeReasonCode: '' }))).not.toHaveProperty(
      'changeReasonCode',
    );
  });

  it('골랐으면 그 코드를 싣는다', () => {
    expect(toReplacementConsumption(draft({ changeReasonCode: 'DEFECT' }))).toMatchObject({
      changeReasonCode: 'DEFECT',
    });
  });
});

/*
 * 키패드가 앞자리 0 을 흘리지 않는지. 계약이 받는 것은 «수»라 `011` 은 `11` 로 실리는데,
 * 화면이 `011` 을 그대로 보여 주면 친 값과 남는 값이 달라진다.
 */
describe('수량의 앞자리 0', () => {
  it('앞의 0 은 털고 값의 일부인 0 은 남긴다', () => {
    expect(stripLeadingZeros('011')).toBe('11');
    expect(stripLeadingZeros('0011')).toBe('11');
    expect(stripLeadingZeros('0')).toBe('0');
    expect(stripLeadingZeros('0.5')).toBe('0.5');
    expect(stripLeadingZeros('120')).toBe('120');
  });
});
