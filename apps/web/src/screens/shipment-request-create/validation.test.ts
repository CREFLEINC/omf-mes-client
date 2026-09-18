import { describe, expect, it } from 'vitest';

import { emptyLineDraft } from './line-draft';
import type { ShipmentRequestLineDraft } from './types';
import {
  hasAllocatableLine,
  lineFieldId,
  readQty,
  validateHeader,
  validateLines,
} from './validation';

const line = (patch: Partial<ShipmentRequestLineDraft>): ShipmentRequestLineDraft => ({
  ...emptyLineDraft(),
  ...patch,
});

describe('readQty', () => {
  it('빈 글자는 empty다', () => {
    expect(readQty('')).toEqual({ kind: 'empty' });
    expect(readQty('   ')).toEqual({ kind: 'empty' });
  });

  it('숫자가 아니면 invalid다', () => {
    expect(readQty('abc')).toEqual({ kind: 'invalid' });
  });

  it('무한대는 invalid다 — 그대로 흘리면 직렬화 사고가 난다', () => {
    expect(readQty('Infinity')).toEqual({ kind: 'invalid' });
  });

  it('수를 읽는다', () => {
    expect(readQty('12.5')).toEqual({ kind: 'qty', value: 12.5 });
  });
});

describe('validateHeader', () => {
  it('단독 생성은 공장·고객·납품처·출하요청일이 모두 필수다', () => {
    const errors = validateHeader('standalone', {
      fulfillmentPlantId: '',
      customerId: '',
      shipToPartnerId: '',
      requestedShipDate: '',
    });

    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['fulfillmentPlantId', 'customerId', 'shipToPartnerId', 'requestedShipDate']),
    );
  });

  it('지시서 경유는 고객·납품처를 판정하지 않는다 — 지시서가 채운다', () => {
    const errors = validateHeader('fromOrder', {
      fulfillmentPlantId: '1',
      customerId: '',
      shipToPartnerId: '',
      requestedShipDate: '2026-08-20',
    });

    expect(errors).toEqual({});
  });

  it('출하요청일은 두 모드 모두 필수다', () => {
    const errors = validateHeader('fromOrder', {
      fulfillmentPlantId: '1',
      customerId: '8201',
      shipToPartnerId: '8211',
      requestedShipDate: '',
    });

    expect(errors.requestedShipDate).toBeDefined();
  });
});

describe('validateLines', () => {
  /*
   * ⛔ **아직 안 채운 칸은 «오류»가 아니라 «미완»이다**(사용자 지시 2026-09-18). 줄마다 붉게
   *    적지 않는다 — 라인을 막 추가한 사람에게 경고가 먼저 서면 아무것도 안 했는데 잘못한
   *    것처럼 읽힌다.
   * ⭐ **그래도 편성은 막는다.** 둘을 한 시험에서 함께 붙든다 — 갈라 두면 「안 적는다」만 남기고
   *    막는 것을 잃어도 시험이 통과한다. 그러면 단추가 열린 채 눌리고 아무 일도 안 일어난다.
   */
  it('단독 생성 줄의 빈 품목·단위는 붉게 적지 않되 편성을 막는다', () => {
    const target = line({ salesOrderLineId: null, itemId: '', uomId: '' });
    const { errors, isIncomplete } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'itemId')]).toBeUndefined();
    expect(errors[lineFieldId(target.key, 'uomId')]).toBeUndefined();
    expect(isIncomplete).toBe(true);
  });

  it('지시서 경유 줄은 품목·단위를 판정하지 않는다 — 읽기 전용이다', () => {
    const target = line({ salesOrderLineId: 1, itemId: '', uomId: '' });
    const { errors, isIncomplete } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'itemId')]).toBeUndefined();
    expect(errors[lineFieldId(target.key, 'uomId')]).toBeUndefined();
    expect(isIncomplete).toBe(false);
  });

  /* 다 채운 줄은 막지 않는다 — 「늘 막는다」로 굳어도 위 시험은 통과한다. */
  it('다 채운 단독 생성 줄은 막지 않는다', () => {
    const target = line({
      salesOrderLineId: null,
      itemId: '8301',
      uomId: '8401',
      requestedQty: '10',
    });

    expect(validateLines([target]).isIncomplete).toBe(false);
  });

  it('배정 수량이 요청 수량을 넘으면 오류다(완료 조건 C4)', () => {
    const target = line({ salesOrderLineId: 1, requestedQty: '10', allocatedQty: '11' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'allocatedQty')]).toBeDefined();
  });

  it('배정 수량이 음수면 오류다', () => {
    const target = line({ salesOrderLineId: 1, requestedQty: '10', allocatedQty: '-1' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'allocatedQty')]).toBeDefined();
  });

  it('배정 수량이 요청 수량 이하면 통과한다 — 가용 부족은 이 파일이 판정하지 않는다', () => {
    const target = line({ salesOrderLineId: 1, requestedQty: '10', allocatedQty: '10' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'allocatedQty')]).toBeUndefined();
  });

  it('배정 수량이 비어 있으면 오류가 아니다 — 그 줄은 제외될 뿐이다', () => {
    const target = line({ salesOrderLineId: 1, requestedQty: '10', allocatedQty: '' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'allocatedQty')]).toBeUndefined();
  });



  it('지시서 경유 줄은 요청 수량을 판정하지 않는다 — 읽기 전용이다', () => {
    const target = line({ salesOrderLineId: 1, requestedQty: 'not-a-number' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'requestedQty')]).toBeUndefined();
  });

  it('단독 생성 줄의 요청 수량이 0 이하면 오류다', () => {
    const target = line({ salesOrderLineId: null, itemId: '1', uomId: '1', requestedQty: '0' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'requestedQty')]).toBeDefined();
  });
});

describe('hasAllocatableLine', () => {
  it('배정 수량이 1 이상인 줄이 있으면 참이다', () => {
    expect(hasAllocatableLine([line({ allocatedQty: '1' })])).toBe(true);
  });

  it('전부 0이거나 비어 있으면 거짓이다', () => {
    expect(hasAllocatableLine([line({ allocatedQty: '0' }), line({ allocatedQty: '' })])).toBe(
      false,
    );
  });
});
