import { describe, expect, it } from 'vitest';

import {
  WORK_ORDER_CLOSE_CODE_GROUPS,
  toWorkOrderCloseCodeOptions,
  toWorkOrderCloseProductionOrderOptions,
} from './code-options';

describe('work-order close code options', () => {
  it('uses the design-owned group names', () => {
    expect(WORK_ORDER_CLOSE_CODE_GROUPS).toEqual({
      status: 'WORK_ORDER_STATUS',
      varianceReason: 'WORK_ORDER_COMPLETION_VARIANCE_REASON',
      correctionReason: 'PRODUCTION_RESULT_CORRECT_REASON',
    });
  });

  it('keeps active values in display order and falls back to the code for a blank name', () => {
    const values = [
      { code: 'LATER', codeName: 'Later', displayOrder: 30, isActive: true },
      { code: 'RETIRED', codeName: 'Retired', displayOrder: 10, isActive: false },
      { code: 'FIRST', codeName: '   ', displayOrder: 20, isActive: true },
    ];

    expect(toWorkOrderCloseCodeOptions(values)).toEqual([
      { value: 'FIRST', label: 'FIRST' },
      { value: 'LATER', label: 'Later' },
    ]);
    expect(values.map((value) => value.code)).toEqual(['LATER', 'RETIRED', 'FIRST']);
    expect(toWorkOrderCloseCodeOptions([])).toEqual([]);
  });

  /* G-33 — 고객이 늘리는 코드의 표시명은 다국어 컬럼이 먼저고 기본 이름은 fallback이다. */
  it('prefers the localized name and falls back to the base name, then the code', () => {
    expect(
      toWorkOrderCloseCodeOptions([
        { code: 'LOCAL', codeName: 'Base', nameKo: '현지 이름', displayOrder: 1, isActive: true },
        { code: 'BLANK_LOCAL', codeName: 'Base', nameKo: '   ', displayOrder: 2, isActive: true },
        { code: 'NULL_LOCAL', codeName: '  ', nameKo: null, displayOrder: 3, isActive: true },
      ]),
    ).toEqual([
      { value: 'LOCAL', label: '현지 이름' },
      { value: 'BLANK_LOCAL', label: 'Base' },
      { value: 'NULL_LOCAL', label: 'NULL_LOCAL' },
    ]);
  });

  it('preserves P/O server order', () => {
    expect(
      toWorkOrderCloseProductionOrderOptions([
        { productionOrderId: 502, productionOrderNo: 'SYN-PO-502' },
        { productionOrderId: 501, productionOrderNo: 'SYN-PO-501' },
      ]),
    ).toEqual([
      { value: '502', label: 'SYN-PO-502' },
      { value: '501', label: 'SYN-PO-501' },
    ]);
  });
});
