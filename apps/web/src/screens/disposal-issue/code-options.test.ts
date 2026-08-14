import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeNote,
  codePlaceholder,
  DEFECT_WAREHOUSE_TYPE_CODES,
  isDefectWarehouseTypePending,
  isDisposalPartnerListPending,
  isRequiredCodeListPending,
  narrowToDefectWarehouses,
  PLACEHOLDER_DISPOSAL_ISSUE_CODES,
  PLACEHOLDER_DISPOSAL_PARTNER_OPTIONS,
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
  it('코드 여섯의 값 목록이 전부 비어 있다', () => {
    expect(
      Object.values(PLACEHOLDER_DISPOSAL_ISSUE_CODES).every((values) => values.length === 0),
    ).toBe(true);
    /* 짝 방향 — 키가 실제로 여섯이다(빈 객체라 통과한 것이 아니다). */
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toHaveLength(6);
  });

  /**
   * **여섯이 전부다 — 없앤 자리가 정말 없다**(변경 통지 #124 · 짝 규칙).
   *
   * 폐기 계정은 회계 소관이라 자리째 없앴고, 도착지 유형은 짝인 도착지 식별자를 공급할 자리가
   * 함께 사라져 **한쪽만 실린 본문**이 만들어지지 않게 같이 없앴다. 값만 비워 두면 「나중에 채울
   * 자리」로 남아 다음 사본으로 전파된다.
   *
   * **집합을 그대로 견준다**(`not.toContain`이 아니라 `toEqual`). 없앤 이름을 시험이 다시 적으면
   * 그 이름이 저장소에 남아, 「이 화면에 그런 자리가 없다」가 검색으로도 사실이 되지 못한다.
   * 집합 견줌은 되살아난 자리도 새로 는 자리도 함께 잡는다.
   */
  it('자리표시 여섯이 그 여섯 그대로다', () => {
    const expected = [
      'issueType',
      'sourceDocumentType',
      'reason',
      'receiptType',
      'status',
      'issueStatus',
    ];

    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES).sort()).toEqual([...expected].sort());
    expect(Object.keys(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).sort()).toEqual(
      [...expected].sort(),
    );
  });

  /**
   * **출고 전표 상태와 입고 전표 상태를 한 키로 묶지 않는다.** 두 값 목록은 서로 다른 공통코드라
   * 한쪽이 확정될 때 다른 쪽 선택칸까지 함께 열리면 화면이 없는 선택지를 내놓게 된다.
   *
   * 반대로 **출고 유형·폐기 사유는 한 키를 함께 쓴다** — 폐기 정보 폼이 고르는 값과 이력 조건이
   * 거르는 값이 **같은 공통코드**이고, 갈라 두면 값이 확정될 때 채울 자리가 둘이 된다.
   */
  it('출고 상태와 입고 상태의 자리가 갈려 있다', () => {
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toContain('issueStatus');
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toContain('status');
  });

  it('불량창고 유형의 자리표시도 비어 있다', () => {
    expect(DEFECT_WAREHOUSE_TYPE_CODES).toEqual([]);
  });

  /**
   * 등록 필수는 **셋**이다. 폐기 계정과 도착지 유형을 없애면서 다섯에서 줄었다(#124).
   *
   * **줄어도 등록은 그대로 잠겨 있다** — 남은 셋의 값 목록이 여전히 비어 있기 때문이다.
   * 아래 「지금은 값이 없어 참이다」가 그 사실을 함께 잰다.
   */
  it('등록 필수 코드가 셋이다', () => {
    expect([...REQUIRED_CODE_KEYS]).toEqual(['issueType', 'sourceDocumentType', 'reason']);
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

  it('여섯을 모두 옮긴다', () => {
    expect(Object.keys(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES))).toHaveLength(6);
  });
});

/**
 * **전환 감지기** — 자리표시가 채워졌을 때 살아나는 것을 재지 않으면 그것은 죽은 가지다.
 * 이 판정을 읽어 「승인 요청」을 잠그는 자리는 `validation.ts`이고, 판정을 여기 두는 이유는
 * 값이 확정될 때 **고칠 자리가 이 파일 하나**여야 하기 때문이다.
 */
describe('isRequiredCodeListPending — 두 방향', () => {
  const filledRequired = (): CodeValueLists => ({
    ...PLACEHOLDER_DISPOSAL_ISSUE_CODES,
    issueType: ['SAMPLE_ISSUE_TYPE_A'],
    sourceDocumentType: ['SAMPLE_SRC_TYPE_A'],
    reason: ['SAMPLE_REASON_A'],
  });

  /**
   * **등록 잠금이 이번 변경으로 열리지 않는다**(완료 조건 C14의 잣대). 필수가 다섯에서 셋으로
   * 줄었어도 남은 셋이 여전히 비어 있어 판정은 그대로 참이다 — 자리를 지우는 일이 사용자에게
   * 무엇을 열어 주는 일이 되어서는 안 된다.
   */
  it('지금은 값이 없어 참이다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES))).toBe(
      true,
    );
  });

  it('셋이 모두 차면 거짓이 된다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(filledRequired()))).toBe(false);
  });

  it('셋 중 하나만 비어도 참이다', () => {
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

/**
 * **폐기 거래처 선택지의 전환 감지기**(변경 통지 #128 §3).
 *
 * 이 회차에는 선택지를 채우는 조회가 없다 — 좁힐 역할 코드가 미확정이라 살아 있는 조회는
 * 뒤 회차의 일이다. 그동안 칸은 **기존 자리표시 셋과 같은 모양으로** 잠기고 「선택지 준비 중」이
 * 뜬다. 판정 함수가 **목록을 인자로 받는 이유**는 창고 유형 자리표시와 같다 — 함수 안에서
 * 상수를 직접 읽으면 「차면 무엇이 달라지는가」를 잴 길이 없어 자리표시가 죽은 가지가 된다.
 */
describe('폐기 거래처 선택지 — 두 방향', () => {
  it('이 회차의 선택지는 비어 있다', () => {
    expect(PLACEHOLDER_DISPOSAL_PARTNER_OPTIONS).toEqual([]);
  });

  it('비어 있으면 준비 중으로 판정한다', () => {
    expect(isDisposalPartnerListPending(PLACEHOLDER_DISPOSAL_PARTNER_OPTIONS)).toBe(true);
  });

  /** **둘째 방향** — 채우면 살아나지 않는 자리표시는 죽은 가지다. */
  it('선택지가 차면 준비 중이 아니다', () => {
    expect(
      isDisposalPartnerListPending([{ value: '9251', label: 'SAMPLE-PARTNER-01 · 합성 업체 가' }]),
    ).toBe(false);
  });

  /**
   * **공통코드 자리표시에 섞지 않는다.** 폐기 거래처는 값 목록을 기다리는 코드가 아니라
   * **조회로 오는 마스터**다 — 한 통에 담으면 「코드 값이 확정되면 열린다」는 규칙이 조회에도
   * 걸린 것처럼 읽히고, 필수 코드 판정이 거래처까지 세게 된다.
   */
  it('거래처를 코드 자리표시 여섯에 섞지 않는다', () => {
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).not.toContain('disposalPartner');
    expect(Object.keys(PLACEHOLDER_DISPOSAL_ISSUE_CODES)).toHaveLength(6);
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
    expect(
      narrowToDefectWarehouses(entries, ['SAMPLE_WH_TYPE_B']).map((entry) => entry.value),
    ).toEqual(['9702']);
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
