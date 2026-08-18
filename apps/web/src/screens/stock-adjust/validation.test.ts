import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { adjustLineDraft } from './fixtures';
import {
  excludedLineCount,
  isExcludedLine,
  lineFieldId,
  readQty,
  validateLines,
} from './validation';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **이 파일이 이 화면에서 가장 조심할 자리다**(조심 ② · D-4). 줄이는 조정이 정상 경로라
 * **수량에 하한을 두지 않는다** — 계약에도 `minimum`이 없고 예시값이 음수다.
 *
 * | 갈래 | 무엇을 하나 |
 * | --- | --- |
 * | **오류** — 비었음 · 숫자로 못 읽음 · 위치·품목·단위 미선택 | 막는다(인라인) |
 * | **제외** — 차이가 0 | **막지 않는다.** 그 줄이 등록 본문에서 빠지고 표식으로 밝힌다 |
 */

const t = messages.stockAdjust;

describe('readQty', () => {
  it('음수를 그대로 읽는다 — 줄이는 조정이 정상 경로다', () => {
    expect(readQty('-20')).toEqual({ kind: 'qty', value: -20 });
  });

  it('0을 수로 읽는다 — 0은 「없음」이 아니다', () => {
    expect(readQty('0')).toEqual({ kind: 'qty', value: 0 });
  });

  it('소수를 읽는다', () => {
    expect(readQty('1.5')).toEqual({ kind: 'qty', value: 1.5 });
  });

  it('앞뒤 공백을 다듬고 읽는다', () => {
    expect(readQty(' -3 ')).toEqual({ kind: 'qty', value: -3 });
  });

  it('빈 글자는 미입력이다 — 공백만도 같다', () => {
    expect(readQty('')).toEqual({ kind: 'empty' });
    expect(readQty('   ')).toEqual({ kind: 'empty' });
  });

  it.each(['abc', '1a', 'Infinity', '-Infinity', 'NaN'])(
    '수로 읽히지 않는 %o은 형식 오류다',
    (raw) => {
      expect(readQty(raw)).toEqual({ kind: 'invalid' });
    },
  );
});

/**
 * **0은 오류가 아니라 제외다**(스펙 §6의 자동 제외 · D-4).
 *
 * 인라인 오류로 막으면 실사에서 차이 없는 줄이 함께 넘어온 화면이 통째로 잠긴다 —
 * 그 줄은 사용자가 고칠 잘못을 저지른 것이 아니다.
 */
describe('isExcludedLine', () => {
  it('차이가 0인 줄은 제외 대상이다', () => {
    expect(isExcludedLine(adjustLineDraft({ adjustmentQtyText: '0' }))).toBe(true);
  });

  it('음수 줄은 제외 대상이 아니다 — 줄이는 조정은 보내야 한다', () => {
    expect(isExcludedLine(adjustLineDraft({ adjustmentQtyText: '-20' }))).toBe(false);
  });

  it('양수 줄은 제외 대상이 아니다', () => {
    expect(isExcludedLine(adjustLineDraft({ adjustmentQtyText: '20' }))).toBe(false);
  });

  it('아직 치지 않은 줄은 제외 대상이 아니다 — 그 줄은 오류로 막힌다', () => {
    expect(isExcludedLine(adjustLineDraft({ adjustmentQtyText: '' }))).toBe(false);
  });

  it('수로 읽히지 않는 줄은 제외 대상이 아니다', () => {
    expect(isExcludedLine(adjustLineDraft({ adjustmentQtyText: 'abc' }))).toBe(false);
  });
});

describe('excludedLineCount', () => {
  it('제외될 줄을 센다', () => {
    expect(
      excludedLineCount([
        adjustLineDraft({ key: 's1:new:1', adjustmentQtyText: '0' }),
        adjustLineDraft({ key: 's1:new:2', adjustmentQtyText: '-20' }),
        adjustLineDraft({ key: 's1:new:3', adjustmentQtyText: '0' }),
      ]),
    ).toBe(2);
  });

  it('제외될 줄이 없으면 0이다', () => {
    expect(excludedLineCount([adjustLineDraft({ adjustmentQtyText: '-20' })])).toBe(0);
  });
});

/**
 * **줄마다 자기 열쇠에 붙는다**(사본 체크리스트 3번) — 두 줄이 동시에 잘못돼도
 * 각 칸이 자기 줄의 사유를 가리킨다.
 */
describe('validateLines — 차이 수량', () => {
  it('음수는 오류가 아니다 — 하한을 두지 않는다(조심 ②)', () => {
    const { errors } = validateLines([adjustLineDraft({ adjustmentQtyText: '-20' })]);

    expect(errors).toEqual({});
  });

  it('0은 오류가 아니다 — 막지 않고 등록에서 뺀다', () => {
    const { errors } = validateLines([adjustLineDraft({ adjustmentQtyText: '0' })]);

    expect(errors).toEqual({});
  });

  it('비어 있으면 그 줄에 오류가 붙는다', () => {
    const { errors } = validateLines([adjustLineDraft({ key: 's1:new:1', adjustmentQtyText: '' })]);

    expect(errors[lineFieldId('s1:new:1', 'adjustmentQty')]).toBe(t.errors.adjustmentQtyRequired);
  });

  it('수로 읽히지 않으면 그 줄에 오류가 붙는다', () => {
    const { errors } = validateLines([
      adjustLineDraft({ key: 's1:new:1', adjustmentQtyText: 'abc' }),
    ]);

    expect(errors[lineFieldId('s1:new:1', 'adjustmentQty')]).toBe(t.errors.adjustmentQtyNotNumber);
  });

  it('두 줄이 동시에 잘못돼도 열쇠가 갈린다', () => {
    const { errors } = validateLines([
      adjustLineDraft({ key: 's1:new:1', adjustmentQtyText: '' }),
      adjustLineDraft({ key: 's1:new:2', adjustmentQtyText: 'abc' }),
    ]);

    expect(errors[lineFieldId('s1:new:1', 'adjustmentQty')]).toBe(t.errors.adjustmentQtyRequired);
    expect(errors[lineFieldId('s1:new:2', 'adjustmentQty')]).toBe(t.errors.adjustmentQtyNotNumber);
  });
});

describe('validateLines — 고르지 않은 칸', () => {
  it('위치를 고르지 않으면 오류다', () => {
    const { errors } = validateLines([adjustLineDraft({ key: 's1:new:1', locationId: '' })]);

    expect(errors[lineFieldId('s1:new:1', 'locationId')]).toBe(t.errors.locationRequired);
  });

  it('품목을 고르지 않으면 오류다', () => {
    const { errors } = validateLines([adjustLineDraft({ key: 's1:new:1', itemId: '' })]);

    expect(errors[lineFieldId('s1:new:1', 'itemId')]).toBe(t.errors.itemRequired);
  });

  it('단위를 고르지 않으면 오류다', () => {
    const { errors } = validateLines([adjustLineDraft({ key: 's1:new:1', uomId: '' })]);

    expect(errors[lineFieldId('s1:new:1', 'uomId')]).toBe(t.errors.uomRequired);
  });

  /**
   * **자재 LOT은 필수가 아니다.** 계약이 선택으로 두었고(`lotId` nullable) LOT 관리를 하지 않는
   * 품목이 실재한다 — 필수로 두면 그 품목의 조정을 이 화면에서 만들 수 없다.
   */
  it('자재 LOT은 비어 있어도 오류가 아니다', () => {
    const { errors } = validateLines([adjustLineDraft({ lotId: '' })]);

    expect(errors).toEqual({});
  });
});

/**
 * **장부를 못 찾은 것은 오류가 아니다.** 현장 실측 갈래는 장부를 모른 채로도 조정해야 한다 —
 * 계약이 요구하는 것은 차이 수량뿐이다(C8).
 */
describe('validateLines — 장부와 무관함', () => {
  it('실사에서 온 장부가 없어도 오류가 아니다', () => {
    const { errors } = validateLines([adjustLineDraft({ countSystemQty: null })]);

    expect(errors).toEqual({});
  });
});
