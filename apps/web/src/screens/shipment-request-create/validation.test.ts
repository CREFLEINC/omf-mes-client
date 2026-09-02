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
  it('단독 생성은 고객·납품처·출하요청일이 모두 필수다', () => {
    const errors = validateHeader('standalone', {
      customerId: '',
      shipToPartnerId: '',
      requestedShipDate: '',
    });

    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(['customerId', 'shipToPartnerId', 'requestedShipDate']),
    );
  });

  it('지시서 경유는 고객·납품처를 판정하지 않는다 — 지시서가 채운다', () => {
    const errors = validateHeader('fromOrder', {
      customerId: '',
      shipToPartnerId: '',
      requestedShipDate: '2026-08-20',
    });

    expect(errors).toEqual({});
  });

  it('출하요청일은 두 모드 모두 필수다', () => {
    const errors = validateHeader('fromOrder', {
      customerId: '8201',
      shipToPartnerId: '8211',
      requestedShipDate: '',
    });

    expect(errors.requestedShipDate).toBeDefined();
  });
});

describe('validateLines', () => {
  it('단독 생성 줄은 품목·단위가 필수다', () => {
    const target = line({ salesOrderLineId: null, itemId: '', uomId: '' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'itemId')]).toBeDefined();
    expect(errors[lineFieldId(target.key, 'uomId')]).toBeDefined();
  });

  it('지시서 경유 줄은 품목·단위를 판정하지 않는다 — 읽기 전용이다', () => {
    const target = line({ salesOrderLineId: 1, itemId: '', uomId: '' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'itemId')]).toBeUndefined();
    expect(errors[lineFieldId(target.key, 'uomId')]).toBeUndefined();
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

  it('잔여 유효기간이 음수면 오류다', () => {
    const target = line({ salesOrderLineId: 1, minimumRemainingShelfLifeDays: '-1' });
    const { errors } = validateLines([target]);

    expect(errors[lineFieldId(target.key, 'minimumRemainingShelfLifeDays')]).toBeDefined();
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
