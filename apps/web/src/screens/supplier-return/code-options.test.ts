import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeNote,
  codePlaceholder,
  isRequiredCodeListPending,
  PLACEHOLDER_SUPPLIER_RETURN_CODES,
  REQUIRED_CODE_KEYS,
  toCodeOptionSets,
  type CodeValueLists,
} from './code-options';

/**
 * 값 목록이 확정되지 않은 코드 여섯.
 *
 * **이 파일의 감지기가 지키는 것은 「비어 있다」다.** 값 하나가 슬며시 들어오면 사용자는
 * 고를 수 있다고 믿는데 서버는 그 값을 모르고, 되돌릴 수 없는 전표에 그 코드가 실린다.
 */

const ALL_KEYS = [
  'issueType',
  'sourceDocumentType',
  'destinationType',
  'reason',
  'receiptType',
  'status',
] as const;

describe('PLACEHOLDER_SUPPLIER_RETURN_CODES', () => {
  it('닫힌 구조 코드만 고정 계약 값으로 채운다', () => {
    expect(PLACEHOLDER_SUPPLIER_RETURN_CODES.sourceDocumentType).toEqual(['GOODS_RECEIPT']);
    expect(PLACEHOLDER_SUPPLIER_RETURN_CODES.destinationType).toEqual(['PARTNER']);
    for (const key of ['issueType', 'reason', 'receiptType', 'status'] as const) {
      expect(PLACEHOLDER_SUPPLIER_RETURN_CODES[key]).toEqual([]);
    }
  });

  /**
   * **계약 필수는 넷이다** — 착수 이슈가 셋만 적었으나 원천 문서 유형이 함께 필수다
   * (계약 실측 · 계획 §5.4-3). 넷이 비어 있는 동안에는 반품을 처리할 수 없다.
   */
  it('요청 필수 코드가 넷이다', () => {
    expect([...REQUIRED_CODE_KEYS]).toEqual([
      'issueType',
      'sourceDocumentType',
      'destinationType',
      'reason',
    ]);
  });

  it('조회 조건의 코드 둘은 필수가 아니다', () => {
    expect(REQUIRED_CODE_KEYS).not.toContain('receiptType');
    expect(REQUIRED_CODE_KEYS).not.toContain('status');
  });
});

describe('toCodeOptionSets', () => {
  it('코드값을 그대로 라벨로 쓴다', () => {
    const sets = toCodeOptionSets({
      ...PLACEHOLDER_SUPPLIER_RETURN_CODES,
      issueType: ['SAMPLE_ISSUE_A', 'SAMPLE_ISSUE_B'],
    });

    expect(sets.issueType).toEqual([
      { value: 'SAMPLE_ISSUE_A', label: 'SAMPLE_ISSUE_A' },
      { value: 'SAMPLE_ISSUE_B', label: 'SAMPLE_ISSUE_B' },
    ]);
  });

  /* 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등). */
  it('차례를 바꾸지 않는다', () => {
    const sets = toCodeOptionSets({
      ...PLACEHOLDER_SUPPLIER_RETURN_CODES,
      status: ['SAMPLE_Z', 'SAMPLE_A'],
    });

    expect(sets.status.map((option) => option.value)).toEqual(['SAMPLE_Z', 'SAMPLE_A']);
  });

  it('고정 구조 코드 두 축만 선택지로 옮긴다', () => {
    const sets = toCodeOptionSets(PLACEHOLDER_SUPPLIER_RETURN_CODES);

    expect(sets.sourceDocumentType.map((option) => option.value)).toEqual(['GOODS_RECEIPT']);
    expect(sets.destinationType.map((option) => option.value)).toEqual(['PARTNER']);
    for (const key of ['issueType', 'reason', 'receiptType', 'status'] as const)
      expect(sets[key]).toEqual([]);
  });
});

describe('isRequiredCodeListPending', () => {
  const fill = (overrides: Partial<CodeValueLists>): CodeValueLists => ({
    ...PLACEHOLDER_SUPPLIER_RETURN_CODES,
    ...overrides,
  });

  it('지금은 참이다 — 반품 처리를 열 수 없는 상태다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(PLACEHOLDER_SUPPLIER_RETURN_CODES))).toBe(
      true,
    );
  });

  it.each([...REQUIRED_CODE_KEYS])('필수 코드 %s 하나만 비어도 참이다', (pendingKey) => {
    const filled = Object.fromEntries(
      REQUIRED_CODE_KEYS.map((key) => [key, key === pendingKey ? [] : ['SAMPLE_CODE']]),
    );

    expect(isRequiredCodeListPending(toCodeOptionSets(fill(filled)))).toBe(true);
  });

  /**
   * **배열이 차면 저절로 살아난다** — 값이 확정될 때 고칠 자리가 이 파일 하나임을 고정한다.
   */
  it('필수 넷이 모두 차면 거짓이다', () => {
    const filled = Object.fromEntries(REQUIRED_CODE_KEYS.map((key) => [key, ['SAMPLE_CODE']]));

    expect(isRequiredCodeListPending(toCodeOptionSets(fill(filled)))).toBe(false);
  });

  /* 조회 조건의 코드는 비어 있어도 아무것도 막지 않는다. */
  it('조회 조건 코드가 비어 있는 것은 판정에 들지 않는다', () => {
    const filled = Object.fromEntries(REQUIRED_CODE_KEYS.map((key) => [key, ['SAMPLE_CODE']]));

    expect(
      isRequiredCodeListPending(toCodeOptionSets(fill({ ...filled, receiptType: [], status: [] }))),
    ).toBe(false);
  });
});

describe('codeNote · codePlaceholder', () => {
  it('선택지가 비어 있으면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
  });

  /* **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
  it('선택지가 차면 안내를 거둔다', () => {
    expect(codeNote([{ value: 'SAMPLE_A', label: 'SAMPLE_A' }])).toBeUndefined();
  });

  it('자리표시 문구는 공통 문구를 쓴다', () => {
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });
});
