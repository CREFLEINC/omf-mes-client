import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toLocationChoices } from './location-options';
import type { ReferenceSource } from './lookups';

const t = messages.putawayRule;

const source = (entries: ReferenceSource['entries']): ReferenceSource => ({
  entries,
  isError: false,
  isLoading: false,
  truncated: false,
});

describe('toLocationChoices', () => {
  it('맨 앞에 「창고 전체」 빈 선택지를 세운다', () => {
    const choices = toLocationChoices(source([]));

    expect(choices).toEqual([{ value: '', label: t.values.warehouseWide }]);
  });

  /** 빈 선택지가 없으면 한 번 고른 뒤에 창고 전체 규칙으로 되돌릴 길이 칸 안에 없다. */
  it('위치가 있어도 빈 선택지가 첫 자리에 남는다', () => {
    const choices = toLocationChoices(
      source([{ value: '9301', label: 'SYN-LOC-01 · 합성위치 가', isActive: true }]),
    );

    expect(choices[0]).toEqual({ value: '', label: t.values.warehouseWide });
    expect(choices).toHaveLength(2);
  });

  /** 미사용 위치에 남은 규칙을 정리하는 것이 이 마스터의 정상 업무다 — 빼지 않고 표식만 붙인다. */
  it('미사용 위치가 표식과 함께 남는다', () => {
    const choices = toLocationChoices(
      source([{ value: '9302', label: 'SYN-LOC-02 · 합성위치 나', isActive: false }]),
    );

    expect(choices[1]).toEqual({
      value: '9302',
      label: `SYN-LOC-02 · 합성위치 나${t.values.inactiveSuffix}`,
    });
  });

  /**
   * 조건 줄의 빈 선택지(「전체」)와 **문구가 다르다.** 폼에서 비우는 것은 좁히지 않겠다는
   * 뜻이 아니라 「창고 전체에 적용한다」는 확정된 값이다.
   */
  it('조건 줄의 「전체」 문구를 쓰지 않는다', () => {
    const choices = toLocationChoices(source([]));

    expect(choices[0]?.label).not.toBe(t.filters.all);
  });
});
