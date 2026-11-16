import { describe, expect, it } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderHookWithProviders, jsonResponse } from '../../../test/api-harness';
import {
  arrivalLocationNeedsCorrection,
  warehouseArrival,
  useWarehouseArrival,
  type ArrivalLocation,
} from './arrival-location';
const place = (
  id: number,
  role: ArrivalLocation['systemRoleCode'],
  active = true,
): ArrivalLocation => ({
  locationId: id,
  warehouseId: 35,
  locationCode: String(id),
  locationName: String(id),
  isActive: active,
  systemRoleCode: role,
});
describe('생산품 입고 창고 내부 위치 자동 처리', () => {
  it('나뉘지 않은 창고는 창고 전체, 나뉜 창고는 적치 대기를 사용한다', () => {
    const system = [place(1, 'WAREHOUSE_WHOLE'), place(2, 'PUTAWAY_STAGING')];
    expect(warehouseArrival(system)).toMatchObject({ divided: false, location: { locationId: 1 } });
    expect(warehouseArrival([...system, place(3, null)])).toMatchObject({
      divided: true,
      location: { locationId: 2 },
    });
    expect(warehouseArrival([...system, place(3, null, false)])).toMatchObject({
      divided: false,
      location: { locationId: 1 },
    });
  });
  it('시스템 입고 위치가 없거나 비활성이면 다른 위치로 대체하지 않는다', () => {
    expect(warehouseArrival([place(1, 'WAREHOUSE_WHOLE', false)]).location).toBeUndefined();
    expect(
      warehouseArrival([place(1, 'WAREHOUSE_WHOLE'), place(3, null)]).location,
    ).toBeUndefined();
  });
  it('다음 페이지의 사용자 위치까지 읽어서 창고 분할 여부를 판정한다', async () => {
    const fetch = async (request: Request) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      return jsonResponse({
        items:
          page === 1
            ? [place(1, 'WAREHOUSE_WHOLE'), place(2, 'PUTAWAY_STAGING')]
            : [place(3, null)],
        page: { page, size: 2, total: 3 },
      });
    };
    const { result } = renderHookWithProviders(() => useWarehouseArrival(35), { fetch });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ divided: true, location: { locationId: 2 } });
  });
});

it('기존 입고 위치가 ERP 창고 밖이거나 비활성이면 보완 선택이 필요하다', () => {
  const items = [place(1, 'WAREHOUSE_WHOLE'), place(2, 'PUTAWAY_STAGING', false)];
  expect(arrivalLocationNeedsCorrection(items, '9')).toBe(true);
  expect(arrivalLocationNeedsCorrection(items, '2')).toBe(true);
  expect(arrivalLocationNeedsCorrection(items, '1')).toBe(false);
});
