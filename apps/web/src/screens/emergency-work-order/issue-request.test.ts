import { describe, expect, it } from 'vitest';

import type { IssueFormValue } from './issue-form';
import { type IssueCommand, toWorkOrderCreateBody, toWorkOrderReleaseBody } from './issue-request';

const AT = new Date('2026-08-05T09:00:00+09:00');

const form = (overrides: Partial<IssueFormValue> = {}): IssueFormValue => ({
  itemId: '5001',
  orderQty: '200',
  plannedEndAtLocal: '2026-08-06T18:00',
  remarks: '고객 긴급 요청',
  ...overrides,
});

const command = (overrides: Partial<IssueCommand> = {}): IssueCommand => ({
  form: form(),
  item: { itemId: 5001, itemCode: 'SYN-ITEM-0001', itemName: '합성 품목', baseUomId: 11 },
  routingOperationId: 901,
  typeCode: 'SYN_EMERGENCY',
  at: AT,
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
    it('초와 시간대를 갖춰 싣는다 — 시간대가 없으면 같은 글자가 다른 순간을 가리킨다', () => {
      const body = toWorkOrderCreateBody(command());

      expect(body?.plannedEndAt).toMatch(/^2026-08-06T18:00:00[+-]\d{2}:\d{2}$/);
    });

    /*
     * 모양만 보면 시간대를 «잘못» 붙여도 통과한다. 되읽어서 같은 벽시계 시각이 나오는지까지
     * 본다 — 여기서 UTC 로 보내거나 부호를 뒤집으면 사람이 고른 시각과 다른 순간이 지시에
     * 박힌다. 긴급 발행에서 납기가 아홉 시간 어긋나는 것은 작은 일이 아니다.
     */
    it('⛔ 되읽으면 사람이 고른 그 시각이다 — 시간대를 잘못 붙이면 다른 순간이 된다', () => {
      const sent = toWorkOrderCreateBody(command())?.plannedEndAt ?? '';
      const parsed = new Date(sent);

      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getMonth()).toBe(7);
      expect(parsed.getDate()).toBe(6);
      expect(parsed.getHours()).toBe(18);
      expect(parsed.getMinutes()).toBe(0);
    });

    it('⛔ 비운 납기는 키 자체를 싣지 않는다 — 빈 값이 「비웠다」로 남지 않게', () => {
      const body = toWorkOrderCreateBody(command({ form: form({ plannedEndAtLocal: '' }) }));

      expect(body).toBeDefined();
      expect(body).not.toHaveProperty('plannedEndAt');
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
      ['납기 형식 오류', command({ form: form({ plannedEndAtLocal: '2026-02-30T09:00' }) })],
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
