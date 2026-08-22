import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { codeLabel, defaultChannelFilters, withInactiveSuffix } from './options';

describe('코드에 이름 붙이기', () => {
  it('아는 코드에는 이름을 붙인다', () => {
    expect(codeLabel('11', [{ value: '11', label: '가상 1공장' }])).toBe('가상 1공장');
  });

  /** ⛔ 모르는 코드에 이름을 지어내지 않는다 — 없는 값이 있는 것처럼 보인다(G-9). */
  it('모르는 코드는 코드 그대로 둔다', () => {
    expect(codeLabel('99', [{ value: '11', label: '가상 1공장' }])).toBe('99');
  });
});

describe('미사용 표식', () => {
  it('사용 중이면 이름만 세운다', () => {
    expect(withInactiveSuffix('가상 성형기', true)).toBe('가상 성형기');
  });

  it('미사용이면 이름에 표식을 붙인다', () => {
    expect(withInactiveSuffix('가상 성형기', false)).toBe(
      `가상 성형기${messages.collectionChannel.values.inactiveSuffix}`,
    );
  });
});

describe('채널 조건 기본값', () => {
  /** ⭐ 미매핑은 이 화면에 온 이유다 — 기본으로 감추면 할 일이 보이지 않는다. */
  it('미매핑을 기본으로 감추지 않는다', () => {
    expect(defaultChannelFilters.unmappedOnly).toBe(false);
  });

  it('미사용은 기본으로 빼고 본다', () => {
    expect(defaultChannelFilters.includeInactive).toBe(false);
  });
});
