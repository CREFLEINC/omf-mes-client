import { describe, expect, it } from 'vitest';

import { adjustLineDraft } from './fixtures';
import { applySourceChange, initialSourceKind } from './source';

/**
 * 원천은 **두 갈래**이고 자료의 출처는 셋이다(실사 차이 · 현장 실측 · 직접 등록).
 * 뒤의 둘은 실사를 거치지 않으므로 같은 갈래로 들어온다.
 *
 * **원천을 바꾸면 세운 대상이 남지 않는다.** 그 판정이 이 파일 한 곳에 있어야
 * 「무엇을 잃는가」를 미리 밝히는 안내와 실제로 지우는 자리가 갈리지 않는다.
 */

describe('initialSourceKind', () => {
  it('주소가 실사를 가리키면 실사 갈래로 연다', () => {
    expect(initialSourceKind(9101)).toBe('count');
  });

  it('맥락이 없으면 직접 등록으로 연다', () => {
    expect(initialSourceKind(null)).toBe('direct');
  });
});

describe('applySourceChange', () => {
  it('세운 줄이 남지 않는다 — 원천이 다르면 줄의 출처도 다르다', () => {
    const effect = applySourceChange([adjustLineDraft(), adjustLineDraft({ key: 's1:new:2' })]);

    expect(effect.keptLines).toHaveLength(0);
  });

  it('사라지는 줄 수를 함께 낸다 — 안내와 실제 처리가 같은 판정을 쓴다', () => {
    const effect = applySourceChange([adjustLineDraft(), adjustLineDraft({ key: 's1:new:2' })]);

    expect(effect.discardedCount).toBe(2);
  });

  it('세운 줄이 없으면 잃을 것도 없다', () => {
    const effect = applySourceChange([]);

    expect(effect.discardedCount).toBe(0);
    expect(effect.keptLines).toHaveLength(0);
  });

  it('받은 목록을 고치지 않는다', () => {
    const lines = [adjustLineDraft()];

    applySourceChange(lines);

    expect(lines).toHaveLength(1);
  });
});
