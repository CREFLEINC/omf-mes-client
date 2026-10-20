import { describe, expect, it } from 'vitest';

import { ERP_CODE_GROUP_CODES, isErpCodeGroup } from './erp-groups';

describe('ERP 코드 그룹 판정', () => {
  it('게이트웨이 문서의 여덟 분류를 리터럴로 고정한다', () => {
    // 정본: erp-gateway/docs/mes-temp-tables.md §3.1. 바뀌면 문서와 함께 고친다.
    expect([...ERP_CODE_GROUP_CODES].sort()).toEqual([
      'COST_TYPE',
      'ORDER_TYPE',
      'PUR_GROUP',
      'SALE_GROUP',
      'SL_TYPE',
      'SO_TYPE',
      'TRANS_TYPE',
      'UNIT',
    ]);
  });

  it('MES 자체 그룹과 프로토타입 이름은 ERP 그룹이 아니다', () => {
    expect(isErpCodeGroup('ITEM_TYPE')).toBe(false);
    expect(isErpCodeGroup('toString')).toBe(false);
    expect(isErpCodeGroup('UNIT')).toBe(true);
  });
});
