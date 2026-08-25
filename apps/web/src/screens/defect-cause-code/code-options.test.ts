import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { hierarchyFixtures } from './fixtures';
import { selectableCategoryOptions } from './code-options';

const state = (kind: 'ready' | 'loading' | 'failed') => ({
  isLoading: kind === 'loading',
  isError: kind === 'failed',
});

describe('selectableCategoryOptions', () => {
  it('사용 중인 상위 분류만 고를 수 있게 한다', () => {
    const options = selectableCategoryOptions(hierarchyFixtures, '', state('ready'));

    expect(options.every((option) => option.value !== '1006')).toBe(true);
  });

  it.each([
    ['ready', messages.common.reference.unknown],
    ['loading', messages.common.reference.loading],
    ['failed', messages.common.reference.failed],
  ] as const)('목록에 없는 현재 상위 id는 %s 상태로 보존한다', (kind, label) => {
    expect(selectableCategoryOptions([], '9999', state(kind))).toEqual([{ value: '9999', label }]);
  });
});
