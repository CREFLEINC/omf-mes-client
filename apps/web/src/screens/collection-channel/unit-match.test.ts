import { describe, expect, it } from 'vitest';

import { makeSpec } from './fixtures';
import { judgeUnit } from './unit-match';

const uoms = new Map([
  [1, 'SEC'],
  [2, 'CEL'],
]);

describe('단위 견주기', () => {
  it('두 코드가 같으면 맞다', () => {
    expect(judgeUnit('SEC', makeSpec(5001, 'CYCLE', '사이클', { uomId: 1 }), uoms)).toEqual({
      kind: 'match',
    });
  });

  it('다르면 두 값을 함께 말한다', () => {
    expect(judgeUnit('SEC', makeSpec(5002, 'TEMP', '온도', { uomId: 2 }), uoms)).toEqual({
      kind: 'mismatch',
      channelUnitCode: 'SEC',
      itemUnitCode: 'CEL',
    });
  });

  /**
   * ⛔ **「모른다」를 「같다」로 접지 않는다**(공유계약 G-9). 단위 목록이 잘리거나 실패하면
   * 항목의 단위를 코드로 옮길 수 없는데, 침묵하면 사용자는 **맞는 것으로 읽는다.**
   */
  it('항목의 단위를 코드로 옮기지 못하면 모른다고 한다', () => {
    expect(judgeUnit('SEC', makeSpec(5003, 'X', '항목', { uomId: 999 }), uoms)).toEqual({
      kind: 'unknown',
    });
  });

  it('채널에 단위가 없으면 견줄 것이 없다', () => {
    expect(judgeUnit('', makeSpec(5001, 'CYCLE', '사이클', { uomId: 1 }), uoms)).toEqual({
      kind: 'notComparable',
    });
  });

  it('항목에 단위가 없으면 견줄 것이 없다', () => {
    expect(judgeUnit('SEC', makeSpec(5004, 'T', '텍스트 항목'), uoms)).toEqual({
      kind: 'notComparable',
    });
  });

  it('항목의 단위가 null 이어도 견줄 것이 없다', () => {
    expect(judgeUnit('SEC', makeSpec(5004, 'T', '항목', { uomId: null }), uoms)).toEqual({
      kind: 'notComparable',
    });
  });

  it('고른 항목이 없으면 견줄 것이 없다', () => {
    expect(judgeUnit('SEC', null, uoms)).toEqual({ kind: 'notComparable' });
  });

  /** ⛔ 자동 변환하지 않는다 — 변환 규칙을 어디에도 저장하지 않았다(스펙 §5-5). */
  it('비슷한 이름의 단위를 같은 것으로 접지 않는다', () => {
    const table = new Map([
      [1, 'CEL'],
      [2, 'KELVIN'],
    ]);

    expect(judgeUnit('CEL', makeSpec(5002, 'T', '온도', { uomId: 2 }), table).kind).toBe(
      'mismatch',
    );
  });
});
