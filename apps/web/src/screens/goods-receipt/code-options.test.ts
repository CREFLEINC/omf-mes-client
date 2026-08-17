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
import { INVENTORY_STATUS_CODES } from './gr-request';

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

  /*
   * **값 넷이 확정된 뒤에도 자리표시는 비어 있다.**
   *
   * 계약이 값을 알게 됐고 그 근거가 「1차 제안안」이 아니라 **확정**임도 회신으로 왔다(#175).
   * 그래도 채우지 않는다 — 채우는 순간 「입고 처리」가 열려 이 화면의 사용자 흐름이 바뀌기
   * 때문이다. **값의 확정과 화면을 여는 결정은 다른 일**이고, 여는 것은 그 흐름을 책임지는
   * 별도 회차의 몫이다. 아래 짝 방향 단언이 **채웠을 때 실제로 열린다**는 것을 함께 보여 준다 —
   * 그래서 이 감지기는 비어 있음을 헛통과로 넘기지 않는다.
   *
   * 값 목록을 `gr-request.ts`에서 가져오므로 계약이 값을 늘려도 이 감지기가 함께 자란다.
   */
  it('값 넷이 확정된 뒤에도 재고 상태 자리표시가 비어 있고 등록이 잠긴 채다', () => {
    expect(PLACEHOLDER_GOODS_RECEIPT_CODES.inventoryStatus).toEqual([]);
    expect(isRequiredCodeListPending(toCodeOptionSets(PLACEHOLDER_GOODS_RECEIPT_CODES))).toBe(true);

    /*
     * 짝 방향 — **재고 상태 축만 갈라서** 잰다. `SAMPLE_CODES`는 다섯이 이미 차 있어, 그 위에
     * 값을 얹기만 하면 무엇을 얹어도 통과한다(리뷰 R-M3). 같은 집합에서 이 축만 비우고·채워
     * 잠금이 그 축 때문에 갈리는지를 본다.
     */
    const withoutInventory = toCodeOptionSets({ ...SAMPLE_CODES, inventoryStatus: [] });
    const withContractCodes = toCodeOptionSets({
      ...SAMPLE_CODES,
      inventoryStatus: Object.keys(INVENTORY_STATUS_CODES),
    });

    expect(isRequiredCodeListPending(withoutInventory)).toBe(true);
    expect(isRequiredCodeListPending(withContractCodes)).toBe(false);

    /*
     * 심기는 값이 **계약이 아는 넷 그대로**인지도 잰다. 목록을 여기 한 번 더 적는 것은 중복이
     * 아니라 그물이다 — `gr-request.ts`의 파생과 갈리면 여기서 멈춘다. 이것이 없으면 위 두 줄은
     * 「비었나 찼나」만 재고, 무엇을 심었는지는 재지 않는다.
     */
    expect(withContractCodes.inventoryStatus.map((option) => option.value)).toEqual([
      'AVAILABLE',
      'IN_TRANSIT',
      'ON_HOLD',
      'BLOCKED',
    ]);
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
