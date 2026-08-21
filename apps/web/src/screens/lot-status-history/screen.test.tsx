import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import {
  createStubFetch,
  jsonResponse,
  renderWithProviders,
  type StubRoute,
} from '../../test/api-harness';
import { LotStatusHistoryScreen } from './screen';

const route = (path: string, respond: StubRoute['respond']): StubRoute => ({
  match: (request) => request.method === 'GET' && new URL(request.url).pathname === path,
  respond,
});

const list = (items: unknown[], total = items.length) => ({
  items,
  page: { page: 1, size: 50, total },
});

type LotTypeState = 'ready' | 'empty' | 'error';

const codeRoute = (typeState: LotTypeState = 'ready'): StubRoute =>
  route('/mdm/code-values', (request) => {
    const group = new URL(request.url).searchParams.get('codeGroupCode');
    if (group === 'LOT_TYPE' && typeState === 'error') {
      return jsonResponse({ message: '합성 오류' }, { status: 500 });
    }
    const items =
      group === 'LOT_TYPE'
        ? typeState === 'empty'
          ? []
          : [{ code: 'SAMPLE_MATERIAL', codeName: '합성 자재', displayOrder: 1, isActive: true }]
        : [{ code: 'SAMPLE_NORMAL', codeName: '합성 정상', displayOrder: 1, isActive: false }];
    return jsonResponse(
      list(items, group === 'LOT_TYPE' && typeState === 'ready' ? 2 : items.length),
    );
  });

const referenceRoutes: StubRoute[] = [
  route('/mdm/warehouses', () =>
    jsonResponse(
      list(
        [
          {
            warehouseId: 101,
            warehouseCode: 'SAMPLE-WH-01',
            warehouseName: '합성 창고',
            isActive: false,
          },
        ],
        2,
      ),
    ),
  ),
  route('/mdm/items', () =>
    jsonResponse(
      list([{ itemId: 103, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목', isActive: true }]),
    ),
  ),
  route('/mdm/locations', () =>
    jsonResponse(
      list([
        {
          locationId: 102,
          locationCode: 'SAMPLE-LOC-01',
          locationName: '합성 위치',
          isActive: true,
        },
      ]),
    ),
  ),
];

const fetchFor = (typeState: LotTypeState = 'ready') =>
  createStubFetch([codeRoute(typeState), ...referenceRoutes]);

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

const renderScreen = (route = '/quality/lot-status', typeState: LotTypeState = 'ready') => {
  const urls: URL[] = [];
  const stubFetch = fetchFor(typeState);
  const result = renderWithProviders(
    <>
      <LotStatusHistoryScreen />
      <LocationProbe />
    </>,
    {
      route,
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return stubFetch(request);
      },
    },
  );
  return { ...result, urls };
};

const locationSearch = (): URLSearchParams => {
  const value = screen.getByTestId('location').textContent ?? '';
  return new URL(value, 'http://test').searchParams;
};

const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('Lot Status 화면 shell', () => {
  it('기본 모드에서 초안을 주소에 쓰지 않고 조회할 때만 적용한다', async () => {
    const { urls } = renderScreen('/quality/lot-status?from=2026-08-01');
    const user = userEvent.setup();

    expect(screen.getByRole('heading', { name: 'Lot Status 현황·변경이력 조회' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: '탐색 경로' })).toBeVisible();
    expect(screen.getByRole('tablist', { name: 'Lot Status 조회 모드' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'LOT으로 찾기' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await choose(user, 'LOT 유형', '합성 자재');
    await choose(user, '현재 상태', '합성 정상 (미사용)');
    await choose(user, '창고', 'SAMPLE-WH-01 · 합성 창고 (미사용)');
    await user.type(screen.getByLabelText('LOT 번호'), 'SAMPLE-LOT-001');
    expect(await screen.findByText('일부 LOT 유형만 표시됩니다.')).toBeVisible();
    expect(await screen.findByText('일부 창고만 표시됩니다.')).toBeVisible();
    expect(locationSearch().get('lotType')).toBeNull();

    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(locationSearch().get('lotType')).toBe('SAMPLE_MATERIAL');
    expect(locationSearch().get('q')).toBe('SAMPLE-LOT-001');
    expect(locationSearch().get('status')).toBe('SAMPLE_NORMAL');
    expect(locationSearch().get('warehouse')).toBe('101');
    expect(locationSearch().get('from')).toBe('2026-08-01');
    expect(
      urls.some(({ pathname }) =>
        ['/quality/lot-statuses', '/quality/lot-status-summary'].includes(pathname),
      ),
    ).toBe(false);
  });

  it('이력 모드로 바꾸면 다른 조건은 보존하고 선택 LOT만 제거한다', async () => {
    renderScreen('/quality/lot-status?lotType=SAMPLE_MATERIAL&lot=404&from=2026-08-01');
    const user = userEvent.setup();

    await user.click(screen.getByRole('tab', { name: '이력으로 찾기' }));
    await waitFor(() => expect(locationSearch().get('mode')).toBe('history'));
    expect(locationSearch().get('lotType')).toBe('SAMPLE_MATERIAL');
    expect(locationSearch().get('from')).toBe('2026-08-01');
    expect(locationSearch().get('lot')).toBeNull();
    expect(screen.getByText('보류 사건 이력 조회는 후속 단계에서 연결됩니다.')).toBeVisible();
  });

  it('이력 모드 최초 진입에서는 현재 조회 선택지를 요청하지 않는다', async () => {
    const urls: URL[] = [];
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status?mode=history',
      fetch: async (request) => {
        urls.push(new URL(request.url));
        return jsonResponse({});
      },
    });

    expect(screen.getByText('보류 사건 이력 조회는 후속 단계에서 연결됩니다.')).toBeVisible();
    await waitFor(() => expect(urls).toHaveLength(0));
  });

  it('초기화는 현재 모드 조건·쪽·선택만 지우고 이력 조건은 보존한다', async () => {
    renderScreen(
      '/quality/lot-status?lotType=SAMPLE_MATERIAL&q=LOT&page=3&lot=404&from=2026-08-01',
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(locationSearch().get('lotType')).toBeNull();
    expect(locationSearch().get('q')).toBeNull();
    expect(locationSearch().get('page')).toBeNull();
    expect(locationSearch().get('lot')).toBeNull();
    expect(locationSearch().get('from')).toBe('2026-08-01');
  });

  it('LOT 유형 기준값이 비어 있으면 필터를 공개하되 조회 사유를 밝힌다', async () => {
    renderScreen('/quality/lot-status', 'empty');

    expect(await screen.findByText('LOT 유형 기준값이 준비되지 않았습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });

  it('LOT 유형 기준값 요청 중에는 조회를 막고 사유를 밝힌다', async () => {
    renderWithProviders(<LotStatusHistoryScreen />, {
      route: '/quality/lot-status',
      fetch: async () => new Promise<Response>(() => undefined),
    });

    expect(await screen.findByText('LOT 유형 기준값을 불러오는 중입니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });

  it('LOT 유형 기준값 요청 실패 시 조회를 막고 사유를 밝힌다', async () => {
    renderScreen('/quality/lot-status', 'error');

    expect(await screen.findByText('LOT 유형 기준값을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });
});
