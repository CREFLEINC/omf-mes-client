import { describe, expect, it } from 'vitest';

import {
  PLACEHOLDER_INVENTORY_STATUS_CODES,
  PLACEHOLDER_OWNERSHIP_TYPE_CODES,
  PLACEHOLDER_QUALITY_STATUS_CODES,
  distinctCodes,
  toCodeOptions,
  withCurrentValue,
} from './code-options';
import { toBalanceView, type BalanceView } from './types';

const row = (overrides: Partial<BalanceView> = {}): BalanceView => ({
  ...toBalanceView({
    groupBy: 'ITEM',
    itemId: 9301,
    ownershipTypeCode: 'SAMPLE_OWN_A',
    onHandQty: 10,
    reservedQty: 0,
    pickedQty: 0,
    blockedQty: 0,
    availableQty: 10,
    uomId: 9501,
  }),
  ...overrides,
});

describe('고정·운영 코드 목록', () => {
  /*
   * 값 목록이 확정되지 않았다(omf-mes#64). 예시 값을 채우면 **없는 선택지를 지어내는 것**이라
   * 사용자가 고른 값으로 조회했다가 늘 0건을 본다. 자리는 남기고 비워 둔다 —
   * 확정됐을 때 고칠 곳이 한눈에 보이게 하기 위해서다.
   */
  it('재고 상태는 고정 enum이고 나머지는 운영 목록을 기다린다', () => {
    expect(PLACEHOLDER_QUALITY_STATUS_CODES).toEqual([]);
    expect(PLACEHOLDER_INVENTORY_STATUS_CODES).toEqual([
      'AVAILABLE',
      'BLOCKED',
      'IN_TRANSIT',
      'ON_HOLD',
    ]);
    expect(PLACEHOLDER_OWNERSHIP_TYPE_CODES).toEqual([]);
  });
});

describe('distinctCodes — 결과에서 관측한 코드', () => {
  it('중복을 접고 문자열 오름차순으로 낸다', () => {
    const rows = [
      row({ qualityStatusCode: 'SAMPLE_Q_B' }),
      row({ qualityStatusCode: 'SAMPLE_Q_A' }),
      row({ qualityStatusCode: 'SAMPLE_Q_B' }),
    ];

    expect(distinctCodes(rows, (item) => item.qualityStatusCode)).toEqual([
      'SAMPLE_Q_A',
      'SAMPLE_Q_B',
    ]);
  });

  /* 값이 없는 줄이 선택지에 빈 항목을 만들면 「전체」와 구분되지 않는다. */
  it('없는 값과 빈 문자열은 버린다', () => {
    const rows = [row({ qualityStatusCode: null }), row({ qualityStatusCode: '' })];

    expect(distinctCodes(rows, (item) => item.qualityStatusCode)).toEqual([]);
  });

  it('소유 구분처럼 늘 채워진 코드도 같은 방식으로 뽑는다', () => {
    const rows = [row({ ownershipTypeCode: 'SAMPLE_OWN_B' }), row()];

    expect(distinctCodes(rows, (item) => item.ownershipTypeCode)).toEqual([
      'SAMPLE_OWN_A',
      'SAMPLE_OWN_B',
    ]);
  });
});

describe('withCurrentValue — 지금 걸린 값', () => {
  /*
   * 남기지 않으면 조건을 걸어 좁힌 순간 그 값이 결과에서 사라져
   * **선택지에서 없어지고 해제할 방법이 사라진다.**
   */
  it('목록에 없으면 맨 앞에 남긴다', () => {
    expect(withCurrentValue(['SAMPLE_Q_A'], 'SAMPLE_Q_Z')).toEqual(['SAMPLE_Q_Z', 'SAMPLE_Q_A']);
  });

  it('이미 있으면 더 넣지 않는다', () => {
    expect(withCurrentValue(['SAMPLE_Q_A'], 'SAMPLE_Q_A')).toEqual(['SAMPLE_Q_A']);
  });

  it('걸린 값이 없으면 그대로 둔다', () => {
    expect(withCurrentValue(['SAMPLE_Q_A'], '')).toEqual(['SAMPLE_Q_A']);
  });
});

describe('toCodeOptions — 자리표시 · 관측값 · 걸린 값을 한 목록으로', () => {
  it('고정 목록 뒤에 관측값이 나온다', () => {
    const rows = [row({ inventoryStatusCode: 'SAMPLE_I_A' })];

    expect(
      toCodeOptions(
        PLACEHOLDER_INVENTORY_STATUS_CODES,
        rows,
        (item) => item.inventoryStatusCode,
        '',
      ),
    ).toEqual(['AVAILABLE', 'BLOCKED', 'IN_TRANSIT', 'ON_HOLD', 'SAMPLE_I_A']);
  });

  it('자리표시와 관측값이 겹치면 접힌다', () => {
    const rows = [row({ inventoryStatusCode: 'SAMPLE_I_A' })];

    expect(toCodeOptions(['SAMPLE_I_A'], rows, (item) => item.inventoryStatusCode, '')).toEqual([
      'SAMPLE_I_A',
    ]);
  });

  it('결과에 없는 걸린 값이 맨 앞에 남는다', () => {
    const rows = [row({ inventoryStatusCode: 'SAMPLE_I_A' })];

    expect(
      toCodeOptions(
        PLACEHOLDER_INVENTORY_STATUS_CODES,
        rows,
        (item) => item.inventoryStatusCode,
        'SAMPLE_I_Z',
      ),
    ).toEqual(['SAMPLE_I_Z', 'AVAILABLE', 'BLOCKED', 'IN_TRANSIT', 'ON_HOLD', 'SAMPLE_I_A']);
  });

  it('결과가 비어 있어도 걸린 값은 남는다', () => {
    expect(
      toCodeOptions(
        PLACEHOLDER_INVENTORY_STATUS_CODES,
        [],
        (item) => item.inventoryStatusCode,
        'SAMPLE_I_Z',
      ),
    ).toEqual(['SAMPLE_I_Z', 'AVAILABLE', 'BLOCKED', 'IN_TRANSIT', 'ON_HOLD']);
  });
});
