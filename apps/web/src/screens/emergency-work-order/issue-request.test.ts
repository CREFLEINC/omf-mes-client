import { describe, expect, it } from 'vitest';

import type { IssueFormValue } from './issue-form';
import { type IssueCommand, toWorkOrderCreateBody, toWorkOrderReleaseBody } from './issue-request';

const form = (overrides: Partial<IssueFormValue> = {}): IssueFormValue => ({
  itemId: '5001',
  orderQty: '200',
  dueDate: '2026-08-06',
  remarks: '고객 긴급 요청',
  ...overrides,
});

const command = (overrides: Partial<IssueCommand> = {}): IssueCommand => ({
  form: form(),
  item: { itemId: 5001, itemCode: 'SYN-ITEM-0001', itemName: '합성 품목', baseUomId: 11 },
  routingOperationId: 901,
  typeCode: 'SYN_EMERGENCY',
  ...overrides,
});

describe('toWorkOrderCreateBody', () => {
  it('⛔ 계획 참조를 «명시적 null» 로 보낸다 — 키를 빼는 것과 뜻이 다르다', () => {
    const body = toWorkOrderCreateBody(command());

    expect(body).toBeDefined();
    expect(body).toHaveProperty('productionPlanId', null);
    expect(Object.keys(body ?? {})).toContain('productionPlanId');
  });

  it('필수 넷과 유형·사유를 싣는다', () => {
    expect(toWorkOrderCreateBody(command())).toMatchObject({
      routingOperationId: 901,
      itemId: 5001,
      orderQty: 200,
      uomId: 11,
      workOrderTypeCode: 'SYN_EMERGENCY',
      remarks: '고객 긴급 요청',
    });
  });

  it('⛔ 단위는 고른 품목의 기준 단위다 — 사용자가 고르는 값이 아니다', () => {
    const body = toWorkOrderCreateBody(
      command({
        item: { itemId: 5001, itemCode: 'SYN-ITEM-0001', itemName: '합성 품목', baseUomId: 77 },
      }),
    );

    expect(body?.uomId).toBe(77);
  });

  it('⛔ 계약에 자리가 있어도 스펙이 받으라 하지 않은 값은 싣지 않는다', () => {
    const body = toWorkOrderCreateBody(command());

    expect(body).not.toHaveProperty('priorityNo');
    expect(body).not.toHaveProperty('plannedStartAt');
  });

  it('⛔ 계획 자원 다섯은 본문에 자리조차 없다 — 무배정 배포다', () => {
    const body = toWorkOrderCreateBody(command());

    for (const field of [
      'plannedEquipmentId',
      'plannedMoldId',
      'plannedShiftId',
      'productionLineId',
      'responsibleWorkerId',
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  describe('납기', () => {
    /*
     * ⛔ `dueDate`(계약 신설)로 보낸다 — `plannedEndAt`(계획 종료 «시각»)이 아니다. 뜻이
     * 다르다: 납기는 「언제까지 내야 하는가」, 계획 종료는 「언제 끝날 것으로 잡았는가」다.
     */
    it('날짜 그대로 dueDate 에 싣는다 — plannedEndAt 이 아니다', () => {
      const body = toWorkOrderCreateBody(command());

      expect(body?.dueDate).toBe('2026-08-06');
      expect(body).not.toHaveProperty('plannedEndAt');
    });

    it('⛔ 비운 납기는 키 자체를 싣지 않는다 — 빈 값이 「비웠다」로 남지 않게', () => {
      const body = toWorkOrderCreateBody(command({ form: form({ dueDate: '' }) }));

      expect(body).toBeDefined();
      expect(body).not.toHaveProperty('dueDate');
    });
  });

  it('앞뒤 공백을 다듬어 싣는다', () => {
    const body = toWorkOrderCreateBody(
      command({ form: form({ orderQty: ' 200 ', remarks: '  고객 긴급 요청  ' }) }),
    );

    expect(body?.orderQty).toBe(200);
    expect(body?.remarks).toBe('고객 긴급 요청');
  });

  describe('⛔ 갖춰지지 않으면 본문을 만들지 않는다 — 잠금이 뚫려도 나가지 않는다', () => {
    it.each([
      ['사유 없음', command({ form: form({ remarks: '' }) })],
      ['수량 0', command({ form: form({ orderQty: '0' }) })],
      ['품목 없음', command({ form: form({ itemId: '' }) })],
      ['납기 형식 오류', command({ form: form({ dueDate: '2026-02-30' }) })],
      ['시작 공정 미정', command({ routingOperationId: null })],
      ['유형 코드 미정', command({ typeCode: '' })],
      ['유형 코드가 공백뿐', command({ typeCode: '   ' })],
    ])('%s', (_name, input) => {
      expect(toWorkOrderCreateBody(input)).toBeUndefined();
    });
  });
});

describe('toWorkOrderReleaseBody', () => {
  it('⛔ LOT 크기를 지시수량으로 둔다 — 슬롯 하나가 된다', () => {
    expect(toWorkOrderReleaseBody('200')).toEqual({ lotSize: 200 });
  });

  it('소수 수량도 그대로 옮긴다', () => {
    expect(toWorkOrderReleaseBody('12.5')).toEqual({ lotSize: 12.5 });
  });

  it('앞뒤 공백을 다듬는다', () => {
    expect(toWorkOrderReleaseBody('  200  ')).toEqual({ lotSize: 200 });
  });

  it.each(['', '0', '-1', 'abc'])(
    '⛔ 슬롯을 만들 수 없는 수량으로는 본문을 만들지 않는다: %s',
    (qty) => {
      expect(toWorkOrderReleaseBody(qty)).toBeUndefined();
    },
  );
});
