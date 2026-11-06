import { describe, expect, it } from 'vitest';
import { lineLocationDefaults } from './line-location-defaults';
describe('생산 라인 변경 위치 기본값', () => {
  it('ERP 또는 수동 지정 완제품 위치는 보존하며 WIP·스크랩만 새 라인 기본값을 적용한다', () => {
    const current = {
      defaultFgLocationId: '77',
      defaultWipLocationId: '1',
      defaultScrapLocationId: '2',
    };
    expect({
      ...current,
      ...lineLocationDefaults({ defaultWipLocationId: 3, defaultScrapLocationId: 4 }),
    }).toEqual({
      defaultFgLocationId: '77',
      defaultWipLocationId: '3',
      defaultScrapLocationId: '4',
    });
    expect({ ...current, ...lineLocationDefaults(undefined) }).toEqual({
      defaultFgLocationId: '77',
      defaultWipLocationId: '',
      defaultScrapLocationId: '',
    });
  });
});
