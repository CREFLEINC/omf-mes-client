import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeNote,
  codePlaceholder,
  DEFECT_WAREHOUSE_TYPE_CODES,
  isDefectWarehouseTypePending,
  isRequiredCodeListPending,
  narrowToDefectWarehouses,
  PLACEHOLDER_DISPOSAL_ISSUE_CODES,
  REQUIRED_CODE_KEYS,
  toCodeOptionSets,
  type CodeValueLists,
} from './code-options';
import type { WarehouseEntry } from './types';

const warehouse = (overrides: Partial<WarehouseEntry> = {}): WarehouseEntry => ({
  value: '9701',
  label: 'SAMPLE-WH-01 · 합성 창고 가',
  isActive: true,
  warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
  ...overrides,
});

describe('자리표시 — 지금의 사실', () => {
  /**
   * **값을 지어내지 않는 것이 이 파일의 목적이다.** 계약의 `@example`도 심지 않는다 —
   * 그것은 예시이지 확정이 아니다.
   */
  it('코드 일곱의 값 목록이 전부 비어 있다', () => {
    expect(Object.values(PLACEHOLDER_DISPOSAL_ISSUE_CODES).every((values) => values.length === 0)).toBe(
      true,
    );
    /* 짝 방향 — 키가 실제로 일곱이다(빈 객체라 통과한 것이 아니다). */
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toHaveLength(7);
  });

  it('불량창고 유형의 자리표시도 비어 있다', () => {
    expect(DEFECT_WAREHOUSE_TYPE_CODES).toEqual([]);
  });

  /**
   * 등록 필수는 **다섯**이다. 착수 이슈는 둘(폐기 계정 · 승인 유형·상태)만 미결로 적었으나
   * 계약이 등록에 요구하는 코드가 이만큼이다(계획 §5.4-9).
   */
  it('등록 필수 코드가 다섯이다', () => {
    expect([...REQUIRED_CODE_KEYS]).toEqual([
      'issueType',
      'sourceDocumentType',
      'destinationType',
      'disposalAccount',
      'reason',
    ]);
  });
});

describe('toCodeOptionSets', () => {
  const filled = (overrides: Partial<CodeValueLists> = {}): CodeValueLists => ({
    ...PLACEHOLDER_DISPOSAL_ISSUE_CODES,
    ...overrides,
  });

  it('값이 없으면 선택지도 없다', () => {
    expect(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES).receiptType).toEqual([]);
  });

  /**
   * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
   * 아직 없는데 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
   */
  it('코드값을 그대로 라벨로 쓰고 차례를 바꾸지 않는다', () => {
    const sets = toCodeOptionSets(filled({ receiptType: ['SAMPLE_TY_B', 'SAMPLE_TY_A'] }));

    expect(sets.receiptType).toEqual([
      { value: 'SAMPLE_TY_B', label: 'SAMPLE_TY_B' },
      { value: 'SAMPLE_TY_A', label: 'SAMPLE_TY_A' },
    ]);
  });

  it('일곱을 모두 옮긴다', () => {
    expect(Object.keys(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES))).toHaveLength(7);
  });
});

/**
 * **전환 감지기** — 자리표시가 채워졌을 때 살아나는 것을 재지 않으면 그것은 죽은 가지다.
 * 이 판정을 읽어 「품의 등록」을 잠그는 자리는 뒤따르는 회차에 있고, 판정을 여기 두는 이유는
 * 값이 확정될 때 **고칠 자리가 이 파일 하나**여야 하기 때문이다.
 */
describe('isRequiredCodeListPending — 두 방향', () => {
  const filledRequired = (): CodeValueLists => ({
    ...PLACEHOLDER_DISPOSAL_ISSUE_CODES,
    issueType: ['SAMPLE_ISSUE_TYPE_A'],
    sourceDocumentType: ['SAMPLE_SRC_TYPE_A'],
    destinationType: ['SAMPLE_DEST_TYPE_A'],
    disposalAccount: ['SAMPLE_ACCOUNT_A'],
    reason: ['SAMPLE_REASON_A'],
  });

  it('지금은 값이 없어 참이다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES))).toBe(true);
  });

  it('다섯이 모두 차면 거짓이 된다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(filledRequired()))).toBe(false);
  });

  it('다섯 중 하나만 비어도 참이다', () => {
    for (const key of REQUIRED_CODE_KEYS) {
      const values = { ...filledRequired(), [key]: [] };

      expect(isRequiredCodeListPending(toCodeOptionSets(values))).toBe(true);
    }
  });

  /** **조회 조건 둘은 판정에 들지 않는다** — 비어 있어도 아무것도 막지 않는다. */
  it('조회 조건 코드가 비어도 판정이 바뀌지 않는다', () => {
    const values = { ...filledRequired(), receiptType: [], status: [] };

    expect(isRequiredCodeListPending(toCodeOptionSets(values))).toBe(false);
  });
});

describe('codeNote · codePlaceholder', () => {
  it('선택지가 비면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });

  /** **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
  it('선택지가 차면 안내를 거둔다', () => {
    expect(codeNote([{ value: 'SAMPLE_TY_A', label: 'SAMPLE_TY_A' }])).toBeUndefined();
  });
});

/**
 * **불량창고 좁힘의 전환 감지기.**
 *
 * 지금은 좁히지 못해 전체를 보이고, 값 목록이 채워지면 그 유형만 남는다. 좁힘을 상수로 굳히면
 * 자리표시를 채워도 창고가 좁혀지지 않는다 — 그 어긋남을 이 두 방향이 잡는다.
 */
describe('불량창고 좁힘 — 두 방향', () => {
  const entries = [
    warehouse(),
    warehouse({ value: '9702', warehouseTypeCode: 'SAMPLE_WH_TYPE_B' }),
    warehouse({ value: '9703', warehouseTypeCode: 'SAMPLE_WH_TYPE_C' }),
  ];

  it('자리표시가 비어 있는 지금은 좁히지 못한다', () => {
    expect(isDefectWarehouseTypePending(DEFECT_WAREHOUSE_TYPE_CODES)).toBe(true);
    expect(narrowToDefectWarehouses(entries, DEFECT_WAREHOUSE_TYPE_CODES)).toEqual(entries);
  });

  it('자리표시가 차면 좁힐 수 있다고 판정한다', () => {
    expect(isDefectWarehouseTypePending(['SAMPLE_WH_TYPE_B'])).toBe(false);
  });

  it('자리표시를 채우면 그 유형만 남는다', () => {
    expect(narrowToDefectWarehouses(entries, ['SAMPLE_WH_TYPE_B']).map((entry) => entry.value)).toEqual(
      ['9702'],
    );
  });

  it('유형이 둘이면 둘 다 남는다', () => {
    expect(
      narrowToDefectWarehouses(entries, ['SAMPLE_WH_TYPE_B', 'SAMPLE_WH_TYPE_C']).map(
        (entry) => entry.value,
      ),
    ).toEqual(['9702', '9703']);
  });

  /** 좁힌 결과가 비는 것도 사실이다 — 없는 것을 전체로 되돌리지 않는다. */
  it('맞는 유형이 하나도 없으면 빈 목록이 된다', () => {
    expect(narrowToDefectWarehouses(entries, ['SAMPLE_WH_TYPE_Z'])).toEqual([]);
  });
});
