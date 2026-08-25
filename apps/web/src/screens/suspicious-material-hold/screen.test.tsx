import type { components } from '@omf-mes/api-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { SuspiciousMaterialHoldFlow, SuspiciousMaterialHoldScreen } from './screen';

type Lot = components['schemas']['LotQualityStatus'];
const lot = (id: number, overrides: Partial<Lot> = {}): Lot => ({
  lotId: id,
  lotNo: `SYN-LOT-${String(id)}`,
  itemId: 801001,
  lotStatusCode: 'NORMAL',
  versionNo: id,
  warehouseId: 802001,
  locationId: 803001,
  onHandQty: 25,
  uomId: 804001,
  fullyHeld: false,
  ...overrides,
});
const list = (items: unknown[]) => ({ items, page: { page: 1, size: 100, total: items.length } });
const reference = (url: URL): unknown => {
  if (url.pathname === '/mdm/items')
    return list([{ itemId: 801001, itemCode: 'SYN', itemName: '품목', isActive: true }]);
  if (url.pathname === '/mdm/warehouses')
    return list([
      { warehouseId: 802001, warehouseCode: 'WH', warehouseName: '창고', isActive: true },
    ]);
  if (url.pathname === '/mdm/locations')
    return list([
      { locationId: 803001, locationCode: 'LOC', locationName: '격리장', isActive: true },
    ]);
  if (url.pathname === '/mdm/uoms')
    return list([{ uomId: 804001, uomCode: 'EA', uomName: '개', isActive: true }]);
  if (url.pathname === '/mdm/code-values') {
    const reason = url.searchParams.get('codeGroupCode') === 'LOT_HOLD_REASON';
    return list([
      reason
        ? { code: 'DAMAGE', codeName: '파손', displayOrder: 1, isActive: true }
        : { code: 'NORMAL', codeName: '정상', displayOrder: 1, isActive: true },
    ]);
  }
  return undefined;
};
const renderScreen = (target: string | null, publicScreen = false) => {
  const requests: Request[] = [];
  let candidateGets = 0;
  let candidateRows = [lot(701), lot(702)];
  let candidatePending: Promise<Response> | null = null;
  let releaseCandidate!: (value: Response) => void;
  const fetch = createStubFetch([
    {
      match: (request) => {
        const url = new URL(request.url);
        return url.pathname === '/quality/lot-statuses' || reference(url) !== undefined;
      },
      respond: (request) => {
        const url = new URL(request.url);
        if (url.pathname === '/quality/lot-statuses') {
          candidateGets += 1;
          if (candidatePending !== null) return candidatePending as unknown as Response;
          return jsonResponse(list(candidateRows));
        }
        return jsonResponse(reference(url));
      },
    },
    {
      match: (request) =>
        request.method === 'POST' && new URL(request.url).pathname === '/quality/lot-holds',
      respond: (request) => {
        requests.push(request.clone());
        return jsonResponse([], { status: 201 });
      },
    },
  ]);
  const view = renderWithProviders(
    publicScreen ? (
      <SuspiciousMaterialHoldScreen />
    ) : (
      <SuspiciousMaterialHoldFlow targetLotStatusCode={target} />
    ),
    { fetch },
  );
  return {
    ...view,
    candidateGets: () => candidateGets,
    deferCandidate: () => {
      candidatePending = new Promise((resolve) => {
        releaseCandidate = resolve;
      });
    },
    releaseCandidate: () => {
      candidatePending = null;
      releaseCandidate(jsonResponse(list([lot(701), lot(702)])));
    },
    setCandidateRows: (rows: Lot[]) => {
      candidateRows = rows;
    },
    requests,
    user: userEvent.setup(),
  };
};
const chooseWarehouse = async (user: ReturnType<typeof userEvent.setup>) => {
  const warehouse = await screen.findByLabelText('창고');
  await waitFor(() => expect(warehouse).toBeEnabled());
  await user.click(warehouse);
  await user.click(screen.getByRole('option', { name: 'WH · 창고' }));
  await user.click(screen.getByRole('button', { name: '조회' }));
  expect(await screen.findAllByText(/WH · 창고 \/ LOC · 격리장/)).toHaveLength(2);
};

describe('의심자재 등록 screen', () => {
  it('설계 target이 없으면 입력을 보여도 등록은 fail-closed다', async () => {
    const { requests, user } = renderScreen(null);
    await chooseWarehouse(user);
    await user.click(screen.getByRole('checkbox', { name: 'SYN-LOT-701 선택' }));
    expect(await screen.findByText(/도착 상태를 확인할 때까지 등록할 수 없습니다/)).toBeVisible();
    expect(screen.getByRole('button', { name: '등록 확인' })).toBeDisabled();
    expect(requests).toHaveLength(0);
  });

  it('두 LOT 선택부터 pinned exact POST·성공 clear와 fresh refetch까지 조립한다', async () => {
    const { candidateGets, queryClient, requests, user } = renderScreen(null, true);
    await chooseWarehouse(user);
    await user.click(screen.getByRole('checkbox', { name: 'SYN-LOT-701 선택' }));
    await user.click(screen.getByRole('checkbox', { name: 'SYN-LOT-702 선택' }));
    expect(screen.queryByRole('radio', { name: '일부 보류' })).toBeNull();
    const reason = screen.getByLabelText('보류 사유');
    await waitFor(() => expect(reason).toBeEnabled());
    await user.click(reason);
    await user.click(screen.getByRole('option', { name: '파손' }));
    await user.type(screen.getByLabelText('해제 조건'), '재검 완료');
    await waitFor(() => expect(screen.getByRole('button', { name: '등록 확인' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: '등록 확인' }));
    const pinnedCount = candidateGets();
    await queryClient.invalidateQueries({ queryKey: ['suspicious-material-hold'] });
    expect(candidateGets()).toBe(pinnedCount);
    await user.click(screen.getByRole('button', { name: '보류 등록' }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(await requests[0]?.json()).toEqual({
      lots: [
        { lotId: 701, versionNo: 701 },
        { lotId: 702, versionNo: 702 },
      ],
      reasonCode: 'DAMAGE',
      releaseCondition: '재검 완료',
      targetLotStatusCode: 'INSPECTION_PENDING',
    });
    expect(await screen.findByText('0건 선택')).toBeVisible();
    await waitFor(() => expect(candidateGets()).toBeGreaterThan(pinnedCount));
  });

  it('candidate background refetch 중 cached body를 즉시 닫아 POST 0으로 유지한다', async () => {
    const view = renderScreen('HOLD');
    await chooseWarehouse(view.user);
    await view.user.click(screen.getByRole('checkbox', { name: 'SYN-LOT-701 선택' }));
    const reason = screen.getByLabelText('보류 사유');
    await waitFor(() => expect(reason).toBeEnabled());
    await view.user.click(reason);
    await view.user.click(screen.getByRole('option', { name: '파손' }));
    await view.user.type(screen.getByLabelText('해제 조건'), '재검 완료');
    await waitFor(() => expect(screen.getByRole('button', { name: '등록 확인' })).toBeEnabled());
    view.deferCandidate();
    void view.queryClient.invalidateQueries({
      queryKey: ['suspicious-material-hold', 'candidates'],
    });
    await waitFor(() => expect(screen.getByRole('button', { name: '등록 확인' })).toBeDisabled());
    expect(screen.getByText('1건 선택')).toBeVisible();
    expect(view.requests).toHaveLength(0);
    view.releaseCandidate();
  });

  it('성공 refetch의 location·UOM ID 변경에 예전 표시 이름을 붙이지 않는다', async () => {
    const view = renderScreen('HOLD');
    await chooseWarehouse(view.user);
    await view.user.click(screen.getByRole('checkbox', { name: 'SYN-LOT-701 선택' }));
    expect(await screen.findByText(/25 EA · 개 · WH · 창고 \/ LOC · 격리장/)).toBeVisible();
    view.setCandidateRows([
      lot(701, { versionNo: 702, locationId: 903001, uomId: 904001 }),
      lot(702),
    ]);
    await view.queryClient.invalidateQueries({
      queryKey: ['suspicious-material-hold', 'candidates'],
    });
    expect(await screen.findByText(/단위 이름 미확인 · 위치 이름 미확인/)).toBeVisible();
    expect(screen.queryByText(/EA · 개 · WH · 창고 \/ LOC · 격리장/)).toBeNull();
    expect(screen.getByRole('button', { name: '등록 확인' })).toBeDisabled();
    for (const raw of ['903001', '904001']) expect(screen.queryByText(raw)).toBeNull();
  });
});
