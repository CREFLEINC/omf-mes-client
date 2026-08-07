import { describe, expect, it } from 'vitest';

import {
  componentRowName,
  extensionLabels,
  processText,
  requiredQtyText,
  scrapRateText,
} from './bom-component-format';
import { bomComponentFixtures } from './fixtures';

/**
 * C16 — **스크랩률은 0~1 비율이며 퍼센트가 아니다**(계약 A-8).
 * 100을 곱하면 사용자가 넣지 않은 값이 보이고 그 값을 근거로 판단이 내려진다.
 */
describe('scrapRateText', () => {
  it('비율을 그대로 낸다', () => {
    expect(scrapRateText(0.05)).toBe('0.05');
  });

  /* 경계값 둘. 「0%」·「100%」가 아니다. */
  it('0과 1을 그대로 낸다', () => {
    expect(scrapRateText(0)).toBe('0');
    expect(scrapRateText(1)).toBe('1');
  });

  it('퍼센트 기호를 붙이지 않는다', () => {
    expect(scrapRateText(0.05)).not.toContain('%');
  });

  /* 표기만 편다 — 값은 그대로다(F4). */
  it('아주 작은 비율을 지수 표기로 내지 않는다', () => {
    expect(scrapRateText(1e-8)).toBe('0.00000001');
  });
});

describe('requiredQtyText', () => {
  it('수량과 단위를 한 칸에 담는다', () => {
    expect(requiredQtyText(2, 'SYN-UOM-01 · 합성 단위 A')).toBe('2 SYN-UOM-01 · 합성 단위 A');
  });

  /* 자릿수를 맞추지 않는다 — 원본 자료가 화면에서 다른 값이 되면 안 된다. */
  it('수량의 자릿수를 손대지 않는다', () => {
    expect(requiredQtyText(2.5, '단위')).toBe('2.5 단위');
    expect(requiredQtyText(1e-8, '단위')).toBe('0.00000001 단위');
  });
});

describe('processText', () => {
  /* 계약이 「다를 수 있다」고 적었고 두 값이 같을 때가 많아 나란히 놓아야 비교된다. */
  it('등록 공정과 실사용 공정을 나란히 담는다', () => {
    expect(processText('Rev 2 · 1. 합성 공정 A', 'SYN-PROC-01 · 합성 공정 가')).toBe(
      'Rev 2 · 1. 합성 공정 A · SYN-PROC-01 · 합성 공정 가',
    );
  });
});

/**
 * 꺼진 것까지 내면 칸이 늘 두 줄이 되어 「켜져 있다」는 사실이 눈에 띄지 않는다.
 */
describe('extensionLabels', () => {
  it('켜진 것만 낸다', () => {
    expect(extensionLabels(bomComponentFixtures[0]!)).toEqual(['LOT 추적', '백플러시']);
  });

  it('둘 다 꺼져 있으면 빈 목록이다', () => {
    expect(extensionLabels(bomComponentFixtures[1]!)).toEqual([]);
  });

  it('하나만 켜져 있으면 그것만 낸다', () => {
    expect(extensionLabels(bomComponentFixtures[2]!)).toEqual(['백플러시']);
  });
});

/**
 * 같은 품목이 여러 줄에 나올 수 있고(계약이 막지 않는다), 이름을 못 받은 줄은
 * 전부 「알 수 없음」이 된다 — 둘을 함께 붙여야 서로 구분된다.
 */
describe('componentRowName', () => {
  it('순서와 이름을 함께 담는다', () => {
    expect(componentRowName(2, 'SYN-ITEM-02 · 합성 품목 B')).toBe('2. SYN-ITEM-02 · 합성 품목 B');
  });

  it('이름이 같아도 순서로 갈린다', () => {
    expect(componentRowName(1, '알 수 없음')).not.toBe(componentRowName(2, '알 수 없음'));
  });
});
