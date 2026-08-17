import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { lineDraft, sourceLineView } from './fixtures';
import { createInheritedLineDraft } from './line-draft';
import {
  PO_FORM_FIELDS,
  lineFieldId,
  supplierChangeWarning,
  validateHeader,
  validateLines,
} from './validation';

const t = messages.poRegister;

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **오류와 경고를 가른다**(계획 결정 5) — 오류는 등록을 막고 경고는 막지 않는다.
 * 하나로 뭉개면 「허용치를 크게 뒀다」가 등록을 막고, 그러면 사용자가 경고를 없애려고
 * 값을 되돌린다.
 */

const FILLED_HEADER = {
  supplierId: '9301',
  businessUnitId: '9201',
  plantId: '9401',
  orderDate: '2026-08-17',
  expectedReceiptDate: '',
};

describe('validateHeader', () => {
  it('필수 넷이 비면 각 칸에 오류가 붙는다', () => {
    const errors = validateHeader({
      supplierId: '',
      businessUnitId: '',
      plantId: '',
      orderDate: '',
      expectedReceiptDate: '',
    });

    expect(errors).toEqual({
      supplierId: t.errors.supplierRequired,
      businessUnitId: t.errors.businessUnitRequired,
      plantId: t.errors.plantRequired,
      orderDate: t.errors.orderDateRequired,
    });
  });

  it('입고 예정일은 비어도 오류가 아니다 — 계약이 선택으로 둔 값이다', () => {
    expect(validateHeader(FILLED_HEADER)).toEqual({});
  });
});

describe('PO_FORM_FIELDS', () => {
  it('화면이 소유한 머리 입력칸만 담는다 — 라인 오류는 어느 줄인지 계약이 알려 주지 않는다', () => {
    expect([...PO_FORM_FIELDS]).toEqual([
      'supplierId',
      'businessUnitId',
      'plantId',
      'orderDate',
      'expectedReceiptDate',
    ]);
  });
});

describe('validateLines — 발주수량', () => {
  it('승계 줄은 승계 수량보다 적게 발주할 수 없다(계획 결정 5)', () => {
    const row = createInheritedLineDraft(sourceLineView({ receivedQty: 12 }));
    const { errors } = validateLines([{ ...row, orderedQty: '11' }]);

    expect(errors[lineFieldId(row.key, 'orderedQty')]).toBe(t.errors.qtyBelowSource(12));
  });

  it('승계 수량과 같으면 오류가 아니다 — 하한이지 초과 요구가 아니다', () => {
    const row = createInheritedLineDraft(sourceLineView({ receivedQty: 12 }));
    const { errors } = validateLines([{ ...row, orderedQty: '12' }]);

    expect(errors).toEqual({});
  });

  it('사용자가 더한 줄에는 하한이 없다 — 승계 근거가 없는 줄이다', () => {
    const row = lineDraft({ key: 'new:1', sourceLineId: null, sourceQty: null, orderedQty: '1' });

    expect(validateLines([row]).errors).toEqual({});
  });

  it.each([
    ['', t.errors.qtyRequired],
    ['   ', t.errors.qtyRequired],
    ['abc', t.errors.qtyNotNumber],
    ['Infinity', t.errors.qtyNotNumber],
    ['0', t.errors.qtyNotPositive],
    ['-1', t.errors.qtyNotPositive],
  ])('발주수량 %o은 오류다', (raw, message) => {
    const row = lineDraft({ key: 'new:2', sourceLineId: null, sourceQty: null, orderedQty: raw });

    expect(validateLines([row]).errors[lineFieldId('new:2', 'orderedQty')]).toBe(message);
  });
});

describe('validateLines — 품목·단위·허용치', () => {
  it('품목과 단위는 비울 수 없다', () => {
    const row = lineDraft({
      key: 'new:3',
      sourceLineId: null,
      sourceQty: null,
      itemId: '',
      uomId: '',
    });
    const { errors } = validateLines([row]);

    expect(errors[lineFieldId('new:3', 'itemId')]).toBe(t.errors.itemRequired);
    expect(errors[lineFieldId('new:3', 'uomId')]).toBe(t.errors.uomRequired);
  });

  it.each([
    [{ toleranceOverQty: '-1' }, 'toleranceOverQty' as const, t.errors.toleranceNegative],
    [{ toleranceOverQty: 'abc' }, 'toleranceOverQty' as const, t.errors.toleranceNotNumber],
    [{ toleranceUnderQty: '-2' }, 'toleranceUnderQty' as const, t.errors.toleranceNegative],
    [{ toleranceUnderQty: 'x' }, 'toleranceUnderQty' as const, t.errors.toleranceNotNumber],
  ])('허용치 %o은 오류다', (patch, field, message) => {
    const row = lineDraft({ key: 'new:4', ...patch });

    expect(validateLines([row]).errors[lineFieldId('new:4', field)]).toBe(message);
  });

  it('허용치를 비우면 0으로 본다 — 계약이 선택으로 둔 값이다', () => {
    const row = lineDraft({ key: 'new:5', toleranceOverQty: '', toleranceUnderQty: '' });

    expect(validateLines([row]).errors).toEqual({});
  });

  it('초과 허용치가 0보다 크면 경고가 붙되 오류가 아니다', () => {
    const row = lineDraft({ key: 'new:6', toleranceOverQty: '5' });
    const { errors, warnings } = validateLines([row]);

    expect(warnings[lineFieldId('new:6', 'toleranceOverQty')]).toBe(
      t.warnings.toleranceOverPositive,
    );
    expect(errors).toEqual({});
  });
});

describe('validateLines — 줄 사이 격리', () => {
  it('두 줄이 동시에 오류면 각 오류가 자기 줄의 열쇠에 붙는다(사본 체크리스트 3번)', () => {
    const inherited = createInheritedLineDraft(sourceLineView({ receivedQty: 12 }));
    const added = lineDraft({ key: 'new:7', sourceLineId: null, sourceQty: null, orderedQty: '0' });

    const { errors } = validateLines([{ ...inherited, orderedQty: '11' }, added]);

    expect(errors[lineFieldId(inherited.key, 'orderedQty')]).toBe(t.errors.qtyBelowSource(12));
    expect(errors[lineFieldId('new:7', 'orderedQty')]).toBe(t.errors.qtyNotPositive);
  });
});

describe('supplierChangeWarning', () => {
  it('승계값과 다른 공급사를 고르면 경고한다(계획 결정 5)', () => {
    expect(supplierChangeWarning({ ...FILLED_HEADER, supplierId: '9302' }, 9301)).toBe(
      t.warnings.supplierChanged,
    );
  });

  it('승계값 그대로면 경고하지 않는다', () => {
    expect(supplierChangeWarning(FILLED_HEADER, 9301)).toBeNull();
  });

  it('아직 고르지 않았거나 승계 원천이 없으면 견줄 것이 없다', () => {
    expect(supplierChangeWarning({ ...FILLED_HEADER, supplierId: '' }, 9301)).toBeNull();
    expect(supplierChangeWarning(FILLED_HEADER, null)).toBeNull();
  });
});
