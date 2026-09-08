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

  /** 신규 선택에서는 미사용 위치를 고를 수 없고, 현재 상세가 가리킬 때만 보존한다. */
  it('미사용 위치는 현재 참조일 때만 표식과 함께 남는다', () => {
    const choices = toLocationChoices(
      source([{ value: '9302', label: 'SYN-LOC-02 · 합성위치 나', isActive: false }]),
      '9302',
    );

    expect(choices[1]).toEqual({
      value: '9302',
      label: `SYN-LOC-02 · 합성위치 나${t.values.inactiveSuffix}`,
    });
  });

  it('신규 선택지에서는 미사용 위치를 뺀다', () => {
    const choices = toLocationChoices(
      source([{ value: '9302', label: 'SYN-LOC-02 · 합성위치 나', isActive: false }]),
    );

    expect(choices).toEqual([{ value: '', label: t.values.warehouseWide }]);
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
