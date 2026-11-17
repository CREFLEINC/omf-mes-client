import { describe, expect, it } from 'vitest';

import { foldRows } from './fold';

/**
 * 접기 셈의 감지기.
 *
 * ⚠ 이 셈은 한 번 틀린 적이 있다 — 포장 라벨에서 **마지막 줄에 안내를 덧그려** 두 글이 겹쳤다.
 *   경계(자리에 딱 맞음 · 하나 넘침)를 빠짐없이 밟는다.
 */

const rows = (count: number): string[] => Array.from({ length: count }, (_, index) => `r${String(index)}`);

describe('줄 접기', () => {
  it('자리보다 적으면 그대로 싣는다', () => {
    expect(foldRows(rows(2), 3)).toEqual({ shown: ['r0', 'r1'], hidden: 0 });
  });

  /* ⛔ 딱 맞으면 안내를 넣지 않는다 — 「외 0건」이 서면 안 된다. */
  it('자리에 «딱» 맞으면 안내 없이 전부 싣는다', () => {
    expect(foldRows(rows(3), 3)).toEqual({ shown: ['r0', 'r1', 'r2'], hidden: 0 });
  });

  /*
   * ⛔⛔ **하나만 넘쳐도 마지막 줄을 안내에 내준다.** 그러지 않으면 안내를 마지막 줄 위에
   *    덧그리게 되고, 점판은 지우지 않으므로 두 글이 겹쳐 둘 다 못 읽힌다.
   */
  it('하나 넘치면 마지막 자리를 안내에 내주고 «둘»이 남는다', () => {
    expect(foldRows(rows(4), 3)).toEqual({ shown: ['r0', 'r1'], hidden: 2 });
  });

  it('많이 넘쳐도 셈이 맞는다 — 보인 것과 숨은 것의 합이 전체다', () => {
    const folded = foldRows(rows(10), 3);

    expect(folded.shown).toHaveLength(2);
    expect(folded.hidden).toBe(8);
    expect(folded.shown.length + folded.hidden).toBe(10);
  });

  /* 어떤 수가 들어와도 합은 전체와 같아야 한다 — 셈이 한 칸 어긋나는 것을 잡는 그물이다. */
  it.each([
    [0, 3],
    [1, 3],
    [3, 3],
    [4, 3],
    [9, 4],
    [5, 1],
  ])('%i 줄을 %i 자리에 접어도 합이 전체와 같다', (count, max) => {
    const folded = foldRows(rows(count), max);

    expect(folded.shown.length + folded.hidden).toBe(count);
    expect(folded.shown.length).toBeLessThanOrEqual(max);
  });

  it('빈 목록은 접을 것이 없다', () => {
    expect(foldRows([], 3)).toEqual({ shown: [], hidden: 0 });
  });

  /* 자리가 없으면 안내조차 설 곳이 없다 — 전부 숨은 것으로 말하고 부르는 쪽이 판단한다. */
  it('자리가 없으면 전부 숨은 것이다', () => {
    expect(foldRows(rows(3), 0)).toEqual({ shown: [], hidden: 3 });
  });

  it('원본을 건드리지 않는다', () => {
    const original = rows(4);
    foldRows(original, 3);

    expect(original).toHaveLength(4);
  });
});
