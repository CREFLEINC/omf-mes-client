import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  codeNote,
  codePlaceholder,
  isRequiredCodeListPending,
  PLACEHOLDER_GOODS_RECEIPT_CODES,
  REQUIRED_CODE_KEYS,
  toCodeOptionSets,
  type CodeValueLists,
} from './code-options';

/** 지어낸 합성 코드. **계약의 `@example` 값을 쓰지 않는다** — 예시가 확정 값으로 읽히면 안 된다. */
const SAMPLE_CODES: CodeValueLists = {
  receiptType: ['SAMPLE_RECEIPT_TYPE_A'],
  sourceDocumentType: ['SAMPLE_SOURCE_TYPE_A'],
  qualityStatus: ['SAMPLE_QUALITY_A'],
  inventoryStatus: ['SAMPLE_INVENTORY_A'],
  reason: ['SAMPLE_REASON_A'],
};

describe('자리표시 상수', () => {
  /*
   * **M26** — 계약 예시 값을 초기값으로 심으면 사용자는 고를 수 있다고 믿는데 서버는 그 값을
   * 모른다. 되돌릴 수 없는 전표에 실리므로 지어내지 않는다.
   */
  it('코드 다섯의 값 목록이 전부 비어 있다', () => {
    expect(Object.values(PLACEHOLDER_GOODS_RECEIPT_CODES).every((values) => values.length === 0)).toBe(
      true,
    );
    /* 짝 방향 — 다섯 키가 실제로 있다(빈 객체는 위 단언을 그냥 통과한다). */
    expect(Object.keys(PLACEHOLDER_GOODS_RECEIPT_CODES)).toHaveLength(5);
  });

  it('계약의 예시 코드값이 어디에도 심겨 있지 않다', () => {
    const planted = Object.values(PLACEHOLDER_GOODS_RECEIPT_CODES).flat();

    for (const example of ['PURCHASE', 'INBOUND_RECEIPT', 'RELEASED', 'AVAILABLE', 'RETURN']) {
      expect(planted).not.toContain(example);
    }
  });

  it('필수는 넷이고 사유는 그중에 없다', () => {
    expect([...REQUIRED_CODE_KEYS]).toEqual([
      'receiptType',
      'sourceDocumentType',
      'qualityStatus',
      'inventoryStatus',
    ]);
    expect(REQUIRED_CODE_KEYS).not.toContain('reason');
  });
});

describe('toCodeOptionSets', () => {
  it('값을 그대로 선택지로 옮긴다 — 라벨을 지어내지 않는다', () => {
    const sets = toCodeOptionSets(SAMPLE_CODES);

    expect(sets.receiptType).toEqual([
      { value: 'SAMPLE_RECEIPT_TYPE_A', label: 'SAMPLE_RECEIPT_TYPE_A' },
    ]);
  });

  it('여러 값의 차례를 바꾸지 않는다 — 서버가 내려준 차례가 뜻일 수 있다', () => {
    const sets = toCodeOptionSets({
      ...SAMPLE_CODES,
      qualityStatus: ['SAMPLE_QUALITY_B', 'SAMPLE_QUALITY_A'],
    });

    expect(sets.qualityStatus.map((option) => option.value)).toEqual([
      'SAMPLE_QUALITY_B',
      'SAMPLE_QUALITY_A',
    ]);
  });

  it('자리표시 상수를 넘기면 다섯 선택지가 전부 비어 있다', () => {
    const sets = toCodeOptionSets(PLACEHOLDER_GOODS_RECEIPT_CODES);

    expect(Object.values(sets).every((options) => options.length === 0)).toBe(true);
  });
});

/**
 * **G1의 전환** — 배열이 비면 잠기고 차면 살아난다.
 *
 * 이 판정 하나가 「입고 처리」의 활성 여부를 가른다. 값 목록이 확정돼 배열을 채우는 순간
 * 화면이 저절로 열려야 하고, 그때 고칠 자리는 `code-options.ts`의 배열 하나뿐이어야 한다.
 */
describe('isRequiredCodeListPending — 배열이 비면 잠기고 차면 풀린다', () => {
  it('지금은 잠겨 있다 — 자리표시 상수가 비어 있다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(PLACEHOLDER_GOODS_RECEIPT_CODES))).toBe(true);
  });

  it('필수 넷이 차면 풀린다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets(SAMPLE_CODES))).toBe(false);
  });

  it('필수 중 하나만 비어도 잠긴 채로 둔다', () => {
    for (const key of REQUIRED_CODE_KEYS) {
      const sets = toCodeOptionSets({ ...SAMPLE_CODES, [key]: [] });

      expect(isRequiredCodeListPending(sets)).toBe(true);
    }
  });

  /* 사유는 계약상 선택이라 비어 있어도 입고 처리를 막지 않는다. */
  it('사유만 비어 있으면 잠그지 않는다', () => {
    expect(isRequiredCodeListPending(toCodeOptionSets({ ...SAMPLE_CODES, reason: [] }))).toBe(false);
  });
});

describe('안내 문구', () => {
  it('선택지가 비면 왜 비었는지 밝힌다', () => {
    expect(codeNote([])).toBe(messages.pendingCode.note);
  });

  /* 짝 방향 — 채워진 뒤에도 안내가 남으면 「아직 준비 중」이라는 거짓말이 화면에 남는다. */
  it('선택지가 차면 안내를 거둔다', () => {
    expect(codeNote([{ value: 'SAMPLE_QUALITY_A', label: 'SAMPLE_QUALITY_A' }])).toBeUndefined();
  });

  it('트리거 자리표시가 공통 문구와 같다', () => {
    expect(codePlaceholder()).toBe(messages.pendingCode.placeholder);
  });
});
