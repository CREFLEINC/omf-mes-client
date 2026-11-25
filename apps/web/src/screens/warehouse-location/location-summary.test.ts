import { describe, expect, it } from 'vitest';

import { locationFixtures } from './fixtures';
import { locationCountText, summarizeLocations } from './location-summary';
import type { Location } from './types';

const base = locationFixtures[0]!;
const at = (patch: Partial<Location>): Location => ({ ...base, ...patch });

describe('summarizeLocations', () => {
  it('사람이 만든 위치만 단계별로 세고, 서버가 만든 위치는 따로 모은다', () => {
    const summary = summarizeLocations([
      at({ locationId: 1, locationLevelCode: 'ZONE' }),
      at({ locationId: 2, locationLevelCode: 'ZONE', isActive: false }),
      at({ locationId: 3, locationLevelCode: 'RACK' }),
      at({ locationId: 4, locationLevelCode: 'CELL' }),
      at({ locationId: 5, locationLevelCode: 'ZONE', systemRoleCode: 'WAREHOUSE_WHOLE' }),
      at({ locationId: 6, locationLevelCode: 'ZONE', systemRoleCode: 'PUTAWAY_STAGING' }),
    ]);

    expect(summary.total).toBe(6);
    expect(summary.levels).toEqual({ ZONE: 2, RACK: 1, LEVEL: 0, CELL: 1 });
    expect(summary.inactive).toBe(1);
    // 적치 대기가 먼저, 창고 전체가 뒤.
    expect(summary.system.map((location) => location.locationId)).toEqual([6, 5]);
  });

  it('단계가 비어 온 옛 위치는 단계 수에 넣지 않는다', () => {
    const summary = summarizeLocations([at({ locationLevelCode: null })]);

    expect(summary.total).toBe(1);
    expect(summary.levels).toEqual({ ZONE: 0, RACK: 0, LEVEL: 0, CELL: 0 });
  });
});

describe('locationCountText', () => {
  it('전체 · 있는 단계 · 사용 중지를 한 줄로 잇고, 0 인 것은 뺀다', () => {
    const text = locationCountText(
      summarizeLocations([
        at({ locationId: 1, locationLevelCode: 'ZONE' }),
        at({ locationId: 2, locationLevelCode: 'ZONE', isActive: false }),
        at({ locationId: 3, locationLevelCode: 'RACK' }),
        at({ locationId: 4, locationLevelCode: 'ZONE', systemRoleCode: 'WAREHOUSE_WHOLE' }),
      ]),
    );

    expect(text).toBe('전체 4 · 구역 2 · 랙 1 · 사용 중지 1');
  });

  it('서버가 만든 위치뿐이면 전체 수만 보인다', () => {
    const text = locationCountText(
      summarizeLocations([
        at({ locationId: 5, locationLevelCode: 'ZONE', systemRoleCode: 'PUTAWAY_STAGING' }),
        at({ locationId: 6, locationLevelCode: 'ZONE', systemRoleCode: 'WAREHOUSE_WHOLE' }),
      ]),
    );

    expect(text).toBe('전체 2');
  });
});
