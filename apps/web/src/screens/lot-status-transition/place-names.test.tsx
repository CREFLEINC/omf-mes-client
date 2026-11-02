import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { usePlaceNames } from './place-names';

const Probe = ({ warehouseId, locationId }: { warehouseId?: number; locationId?: number }) => {
  const place = usePlaceNames(warehouseId, locationId);
  return (
    <p>
      {place.warehouse ?? '없음'} / {place.location ?? '없음'}
    </p>
  );
};

const routes = [
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/warehouses',
    respond: () =>
      jsonResponse({
        items: [
          { warehouseId: 13, warehouseCode: 'WH', warehouseName: '자재창고', isActive: true },
        ],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
  {
    match: (request: Request) => new URL(request.url).pathname === '/mdm/locations',
    respond: () =>
      jsonResponse({
        items: [
          {
            locationId: 25,
            warehouseId: 13,
            locationCode: 'A-01',
            locationName: '격리장',
            isActive: true,
          },
        ],
        page: { page: 1, size: 50, total: 1 },
      }),
  },
];

describe('usePlaceNames — 보류 확인 창의 대상 위치', () => {
  it('창고 · 위치 번호를 이름으로 푼다', async () => {
    renderWithProviders(<Probe warehouseId={13} locationId={25} />, {
      fetch: createStubFetch(routes),
    });
    expect(await screen.findByText('WH · 자재창고 / A-01 · 격리장')).toBeVisible();
  });

  it('목록에 없는 번호는 지어내지 않고 번호 그대로, 없으면 null', async () => {
    renderWithProviders(<Probe warehouseId={99} />, { fetch: createStubFetch(routes) });
    expect(await screen.findByText('99 / 없음')).toBeVisible();
  });
});
