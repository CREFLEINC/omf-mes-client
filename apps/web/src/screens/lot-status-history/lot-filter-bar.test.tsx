import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { EMPTY_LOT_FILTERS, type LotFilters } from './filters';
import { LotFilterBar, type LotFilterBarProps } from './lot-filter-bar';

const TYPES = [
  { value: 'SAMPLE_MATERIAL', label: '합성 자재' },
  { value: 'SAMPLE_PRODUCT', label: '합성 제품' },
];
const STATUSES = [{ value: 'SAMPLE_NORMAL', label: '합성 정상' }];
const WAREHOUSES = [
  { value: '101', label: 'SAMPLE-WH-01 · 합성 창고 가' },
  { value: '109', label: 'SAMPLE-WH-09 · 합성 창고 나' },
];
const ITEMS = [{ value: '103', label: 'SAMPLE-ITEM-01 · 합성 품목' }];
const locationWarehouseIds: string[] = [];

const locationFetch = createStubFetch([
  {
    match: (request) => new URL(request.url).pathname === '/mdm/locations',
    respond: (request) => {
      locationWarehouseIds.push(new URL(request.url).searchParams.get('warehouseId') ?? '');
      return jsonResponse({
        items: [
          {
            locationId: 102,
            locationCode: 'SAMPLE-LOC-01',
            locationName: '합성 위치',
            isActive: true,
          },
        ],
        page: { page: 1, size: 50, total: 1 },
      });
    },
  },
]);

const filters = (overrides: Partial<LotFilters> = {}): LotFilters => ({
  ...EMPTY_LOT_FILTERS,
  ...overrides,
});

const props = (overrides: Partial<LotFilterBarProps> = {}): LotFilterBarProps => ({
  appliedFilters: EMPTY_LOT_FILTERS,
  lotTypeOptions: TYPES,
  lotStatusOptions: STATUSES,
  warehouseOptions: WAREHOUSES,
  itemOptions: ITEMS,
  onSearch: vi.fn(),
  onReset: vi.fn(),
  ...overrides,
});

const renderBar = (overrides: Partial<LotFilterBarProps> = {}) => {
  const current = props(overrides);
  const view = renderWithProviders(<LotFilterBar {...current} />, { fetch: locationFetch });
  return { ...view, ...current, user: userEvent.setup() };
};

const AppliedProbe = ({ initial }: { initial: LotFilters }) => {
  const [applied, setApplied] = useState(initial);
  return (
    <>
      <LotFilterBar {...props({ appliedFilters: applied })} />
      <button type="button" onClick={() => setApplied({ ...applied })}>
        같은 적용
      </button>
      <button
        type="button"
        onClick={() => setApplied(filters({ lotType: 'SAMPLE_PRODUCT', q: '적용값' }))}
      >
        다른 적용
      </button>
    </>
  );
};

const choose = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string) => {
  await user.click(screen.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('LOT 현재 조회 조건', () => {
  it('LOT 유형을 고르기 전에는 조회를 잠그고 사유를 잇는다', () => {
    renderBar();

    const search = screen.getByRole('button', { name: '조회' });
    expect(screen.getByLabelText('LOT 유형')).toHaveAttribute('aria-required', 'true');
    expect(search).toBeDisabled();
    expect(
      document.getElementById(search.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent('LOT 유형을 선택하세요.');
  });

  it('기준값이 없으면 별도 사유로 조회를 잠근다', () => {
    renderBar({ lotTypeBlockReason: 'LOT 유형 기준값을 불러오지 못했습니다.' });

    expect(screen.getByText('LOT 유형 기준값을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '조회' })).toBeDisabled();
  });

  it('초안을 모아 조회할 때 적용값과 기존 정렬을 함께 넘긴다', async () => {
    const { onSearch, user } = renderBar({
      appliedFilters: filters({ sort: 'lotNoAsc' }),
    });

    await choose(user, 'LOT 유형', '합성 자재');
    await choose(user, '품목', 'SAMPLE-ITEM-01 · 합성 품목');
    await choose(user, '현재 상태', '합성 정상');
    await choose(user, '창고', 'SAMPLE-WH-01 · 합성 창고 가');
    await choose(user, '위치', 'SAMPLE-LOC-01 · 합성 위치');
    await user.type(screen.getByLabelText('LOT 번호'), 'SAMPLE-LOT-001');
    expect(onSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith(
      filters({
        lotType: 'SAMPLE_MATERIAL',
        item: '103',
        status: 'SAMPLE_NORMAL',
        warehouse: '101',
        location: '102',
        q: 'SAMPLE-LOT-001',
        sort: 'lotNoAsc',
      }),
    );
  });

  it('창고를 바꾸면 앞 창고의 위치 초안을 제거한다', async () => {
    locationWarehouseIds.length = 0;
    const { onSearch, user } = renderBar({
      appliedFilters: filters({ lotType: 'SAMPLE_MATERIAL', warehouse: '101', location: '102' }),
    });

    await choose(user, '창고', 'SAMPLE-WH-09 · 합성 창고 나');
    await waitFor(() => expect(locationWarehouseIds).toContain('109'));
    await user.click(screen.getByRole('button', { name: '조회' }));

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({ warehouse: '109', location: '' }),
    );
  });

  it('같은 값의 새 적용 객체가 내려와도 작성 중인 LOT 번호를 지우지 않는다', async () => {
    const applied = filters({ lotType: 'SAMPLE_MATERIAL' });
    renderWithProviders(<AppliedProbe initial={applied} />, { fetch: locationFetch });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('LOT 번호'), '작성 중');
    await user.click(screen.getByRole('button', { name: '같은 적용' }));

    expect(screen.getByLabelText('LOT 번호')).toHaveValue('작성 중');
  });

  it('적용값이 실제로 바뀌면 초안도 그 값으로 되돌린다', async () => {
    renderWithProviders(<AppliedProbe initial={filters({ lotType: 'SAMPLE_MATERIAL' })} />, {
      fetch: locationFetch,
    });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('LOT 번호'), '작성 중');
    await user.click(screen.getByRole('button', { name: '다른 적용' }));

    expect(screen.getByLabelText('LOT 번호')).toHaveValue('적용값');
  });

  it('초기화는 상위에 한 번 알린다', async () => {
    const { onReset, user } = renderBar();

    await user.click(screen.getByRole('button', { name: '초기화' }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
